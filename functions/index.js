const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const deliveryQrNotify=require("./delivery-qr-notify-policy");

initializeApp();

const DEFAULT_TENANT = Object.freeze({
  id: "ff897699-de82-4370-a360-35b22cc74c85",
  slug: "tuahere-somtam",
  name: "ส้มตำตัวเฮีย"
});
const STAFF_ROLES = new Set(["owner", "admin", "cashier", "kitchen", "super_admin"]);

function tenantFromUser(user = {}) {
  return {
    id: String(user.tenantId || DEFAULT_TENANT.id).trim(),
    slug: String(user.tenantSlug || DEFAULT_TENANT.slug).trim().toLowerCase(),
    name: String(user.tenantName || DEFAULT_TENANT.name).trim()
  };
}

function membershipPayload(uid, user = {}, tenant = tenantFromUser(user)) {
  return {
    uid,
    email: user.email || "",
    displayName: user.displayName || "",
    role: user.role || "",
    active: user.active !== false,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function deleteMembership(db, tenantId, uid) {
  if (!tenantId) return;
  await db.collection("tenants").doc(tenantId).collection("memberships").doc(uid).delete().catch(error => {
    console.warn("Membership cleanup failed", { tenantId, uid, error: error.message });
  });
}

exports.syncUserMembership = onDocumentWritten(
  { document: "users/{uid}", region: "asia-southeast1" },
  async event => {
    const db = getFirestore();
    const uid = event.params.uid;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    if (before?.tenantId && before.tenantId !== after?.tenantId) {
      await deleteMembership(db, before.tenantId, uid);
    }

    if (!after) {
      if (before?.tenantId) await deleteMembership(db, before.tenantId, uid);
      return;
    }

    if (!STAFF_ROLES.has(after.role)) {
      if (after.tenantId) await deleteMembership(db, after.tenantId, uid);
      return;
    }

    const tenant = tenantFromUser(after);
    await db.collection("tenants").doc(tenant.id).collection("memberships").doc(uid).set(
      membershipPayload(uid, after, tenant),
      { merge: true }
    );
  }
);

exports.migrateCurrentUsersToSaaS = onCall(
  { region: "asia-southeast1" },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");

    const db = getFirestore();
    const callerSnapshot = await db.collection("users").doc(request.auth.uid).get();
    const caller = callerSnapshot.data();
    if (!caller || caller.active === false || caller.role !== "super_admin") {
      throw new HttpsError("permission-denied", "Super admin permission required");
    }

    const usersSnapshot = await db.collection("users").get();
    const batch = db.batch();
    let migrated = 0;

    usersSnapshot.docs.forEach(userDoc => {
      const user = userDoc.data();
      if (user.role === "super_admin") return;
      const tenant = tenantFromUser(user);
      batch.set(userDoc.ref, {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(db.collection("tenants").doc(tenant.id).collection("memberships").doc(userDoc.id), membershipPayload(userDoc.id, user, tenant), { merge: true });
      migrated += 1;
    });

    await batch.commit();
    return { ok: true, migrated };
  }
);

exports.notifyCompanionQrCashierReview = onDocumentWritten(
  { document: "tenants/{tenantId}/orders/{orderId}", region: "asia-southeast1" },
  async event => {
    const before=event.data?.before?.exists?event.data.before.data():null;
    const after=event.data?.after?.exists?event.data.after.data():null;
    const kind=deliveryQrNotify.cashierEvent(before,after);
    if(!kind)return;
    const {tenantId,orderId}=event.params;
    if(!/^[A-Za-z0-9_-]{4,128}$/.test(tenantId||"")||!/^[A-Za-z0-9_-]{8,128}$/.test(orderId||"")||
      after.tenantId!==tenantId)return;
    const db=getFirestore();
    const tenant=(await db.collection("tenants").doc(tenantId).get()).data();
    if(tenant?.active!==true)return;
    const snaps=await db.collection("tenants").doc(tenantId).collection("notificationTokens")
      .where("active","==",true).get();
    const docs=snaps.docs.filter(doc=>["owner","admin","cashier"].includes(doc.data().role)&&
      typeof doc.data().token==="string"&&doc.data().token.length>0).slice(0,500);
    const tokens=docs.map(doc=>doc.data().token);
    if(!tokens.length)return;
    const reviewMessage=kind==="uat_kitchen"
      ?"BankAlert UAT ส่งเข้าครัวเบื้องต้นแล้ว แต่ยังไม่ยืนยันรับเงิน"
      :"ลูกค้าแนบสลิปต้นฉบับแล้ว โปรดตรวจรับเงินจริง";
    const result=await getMessaging().sendEachForMulticast({
      tokens,
      notification:{title:"ตรวจสอบคำสั่งซื้อ Delivery",body:reviewMessage},
      data:{type:"delivery_companion_"+kind,tenantId,orderId,
        url:"/cashier/?orderId="+encodeURIComponent(orderId)},
      webpush:{fcmOptions:{link:"/cashier/?orderId="+encodeURIComponent(orderId)},
        notification:{icon:"/assets/images/icon-192.png",badge:"/assets/images/icon-192.png",
          tag:"delivery-companion-"+kind+"-"+orderId,renotify:false}},
    });
    const failures=[];
    for(let i=0;i<result.responses.length&&i<docs.length;i++){
      const code=result.responses[i].error?.code;
      if(!result.responses[i].success&&["messaging/invalid-registration-token",
        "messaging/registration-token-not-registered"].includes(code)){
        failures.push(docs[i].ref.set({active:false,invalidatedAt:FieldValue.serverTimestamp(),
          errorCode:code},{merge:true}));
      }
    }
    await Promise.all(failures);
  }
);

exports.notifyDeliveryOrderCreated = onDocumentCreated(
  { document: "tenants/{tenantId}/orders/{orderId}", region: "asia-southeast1" },
  async event => {
    const order = event.data?.data();
    if (!order || order.orderType !== "delivery" || deliveryQrNotify.suppressCreated(order)) return;

    const { tenantId, orderId } = event.params;
    const db = getFirestore();
    const tokenSnapshot = await db.collection("tenants").doc(tenantId).collection("notificationTokens")
      .where("active", "==", true)
      .where("role", "in", ["owner", "cashier"])
      .get();

    const tokenDocs = tokenSnapshot.docs;
    const tokens = tokenDocs.map(doc => doc.data().token).filter(Boolean);
    if (!tokens.length) return;

    const message = {
      tokens,
      notification: {
        title: "มีออเดอร์ Delivery ใหม่",
        body: `${order.recipientName || "ลูกค้า"} • ${Number(order.totalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`
      },
      data: {
        type: "delivery_order",
        tenantId,
        orderId
      },
      webpush: {
        fcmOptions: {
          link: `/cashier/?order=${encodeURIComponent(orderId)}`
        },
        notification: {
          icon: "/assets/images/icon-192.png",
          badge: "/assets/images/icon-192.png",
          tag: `delivery-${orderId}`,
          renotify: true
        }
      }
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log("Delivery push result", {
      tenantId,
      orderId,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    const invalidCodes = new Set([
      "messaging/invalid-registration-token",
      "messaging/registration-token-not-registered"
    ]);
    const invalidWrites = [];

    response.responses.forEach((result, index) => {
      if (result.success || !invalidCodes.has(result.error?.code)) return;
      invalidWrites.push(tokenDocs[index].ref.set({
        active: false,
        invalidatedAt: FieldValue.serverTimestamp(),
        errorCode: result.error.code
      }, { merge: true }));
    });

    await Promise.all(invalidWrites);
  }
);

const tenantAdmin = require("./tenant-admin");
exports.listTenants = tenantAdmin.listTenants;
exports.getPlatformTenantSavedPaymentAccount = tenantAdmin.getPlatformTenantSavedPaymentAccount;
exports.getPlatformTenantHybridInvoiceEvidence = tenantAdmin.getPlatformTenantHybridInvoiceEvidence;
exports.createTenant = tenantAdmin.createTenant;
exports.createTenantOwner = tenantAdmin.createTenantOwner;
const tenantProvision = require("./tenant-provision");
exports.createActiveTenantWithOwner = tenantProvision.createActiveTenantWithOwner;
exports.updateTenantOwner = tenantAdmin.updateTenantOwner;
exports.updateTenant = tenantAdmin.updateTenant;
exports.deleteTenant = tenantAdmin.deleteTenant;

const saasMigration = require("./saas-migration");
exports.inspectLegacySaasMigration = saasMigration.inspectLegacySaasMigration;
exports.migrateLegacySaasStore = saasMigration.migrateLegacySaasStore;

const staffAdmin = require("./staff-admin");
exports.listTenantStaff = staffAdmin.listTenantStaff;
exports.createTenantStaff = staffAdmin.createTenantStaff;
exports.updateTenantStaff = staffAdmin.updateTenantStaff;

const publicSignup = require("./public-signup");
exports.requestTrialTenantSignup = publicSignup.requestTrialTenantSignup;
exports.activateTrialTenantSignup = publicSignup.activateTrialTenantSignup;

const retailPosStaff = require("./retail-pos-staff");
exports.upsertRetailPosStaff = retailPosStaff.upsertRetailPosStaff;

const taxBuyerLookup = require("./tax-buyer-lookup");
const retailPosBackup = require("./retail-pos-backup");
exports.lookupTaxBuyer = taxBuyerLookup.lookupTaxBuyer;
exports.exportRetailPosBackup = retailPosBackup.exportRetailPosBackup;
exports.restoreRetailPosBackup = retailPosBackup.restoreRetailPosBackup;

const platformSettings = require("./platform-settings");
exports.getPlatformBranding = platformSettings.getPlatformBranding;
exports.updatePlatformBranding = platformSettings.updatePlatformBranding;
exports.getPlatformGoogleApis = platformSettings.getPlatformGoogleApis;
exports.updatePlatformGoogleApis = platformSettings.updatePlatformGoogleApis;
exports.getPlatformSlipVerification = platformSettings.getPlatformSlipVerification;
exports.updatePlatformSlipVerification = platformSettings.updatePlatformSlipVerification;
exports.testPlatformSlipVerification = platformSettings.testPlatformSlipVerification;
exports.getPlatformLalamove = platformSettings.getPlatformLalamove;
exports.updatePlatformLalamove = platformSettings.updatePlatformLalamove;
exports.testPlatformLalamove = platformSettings.testPlatformLalamove;
exports.registerPlatformLalamoveWebhook = platformSettings.registerPlatformLalamoveWebhook;

const tenantLalamoveWallet = require("./tenant-lalamove-wallet");
exports.updateTenantLalamoveApproval = tenantLalamoveWallet.updateTenantLalamoveApproval;
exports.getTenantLalamoveWallet = tenantLalamoveWallet.getTenantLalamoveWallet;
exports.reviewTenantLalamoveWalletTopup = tenantLalamoveWallet.reviewTenantLalamoveWalletTopup;
exports.getTenantLalamoveSettings = tenantLalamoveWallet.getTenantLalamoveSettings;
exports.updateTenantLalamoveSettings = tenantLalamoveWallet.updateTenantLalamoveSettings;
exports.testTenantLalamoveConnection = tenantLalamoveWallet.testTenantLalamoveConnection;
exports.getOwnTenantLalamoveWallet = tenantLalamoveWallet.getOwnTenantLalamoveWallet;
exports.submitTenantLalamoveWalletTopup = tenantLalamoveWallet.submitTenantLalamoveWalletTopup;
exports.deleteTenantLalamoveWalletTopup = tenantLalamoveWallet.deleteTenantLalamoveWalletTopup;

const revenueShare = require("./revenue-share");
exports.getTenantRevenueShareAccess = revenueShare.getTenantRevenueShareAccess;
exports.getTenantRevenueShareSummary = revenueShare.getTenantRevenueShareSummary;
exports.listTenantRevenueSharePayments = revenueShare.listTenantRevenueSharePayments;
exports.submitTenantRevenueSharePayment = revenueShare.submitTenantRevenueSharePayment;
exports.deleteTenantRevenueSharePayment = revenueShare.deleteTenantRevenueSharePayment;
exports.getPlatformRevenueShareSummary = revenueShare.getPlatformRevenueShareSummary;
exports.listPlatformRevenueSharePayments = revenueShare.listPlatformRevenueSharePayments;
exports.getPlatformRevenueSharePaymentHistory = revenueShare.getPlatformRevenueSharePaymentHistory;
exports.reviewRevenueSharePayment = revenueShare.reviewRevenueSharePayment;
exports.updateTenantRevenueShare = revenueShare.updateTenantRevenueShare;
exports.unlockTenantRevenueShare = revenueShare.unlockTenantRevenueShare;
exports.reconcileRevenueShare = revenueShare.reconcileRevenueShare;
exports.syncRevenueShareTenants = revenueShare.syncRevenueShareTenants;

const subscriptionAdmin = require("./subscription-admin");
exports.initializeTenantSubscription = subscriptionAdmin.initializeTenantSubscription;
exports.backfillTenantSubscriptions = subscriptionAdmin.backfillTenantSubscriptions;
exports.updateTenantSubscription = subscriptionAdmin.updateTenantSubscription;
exports.syncExpiredTenants = subscriptionAdmin.syncExpiredTenants;

const hybridBillingSettings = require("./hybrid-billing-settings");
exports.getPublicHybridBillingSettings = hybridBillingSettings.getPublicHybridBillingSettings;
exports.getHybridBillingSettings = hybridBillingSettings.getHybridBillingSettings;
exports.updateHybridBillingSettings = hybridBillingSettings.updateHybridBillingSettings;
// Read-only billing preview: no invoices, payments or tenant status are mutated.
exports.getTenantHybridBillingPreview = require("./hybrid-billing-preview").getTenantHybridBillingPreview;

const subscriptionPricing = require("./subscription-pricing");
exports.getPublicSubscriptionPricing = subscriptionPricing.getPublicSubscriptionPricing;
exports.getSubscriptionPricing = subscriptionPricing.getSubscriptionPricing;
exports.updateSubscriptionPricing = subscriptionPricing.updateSubscriptionPricing;
exports.getDeliveryThresholdVersions = subscriptionPricing.getDeliveryThresholdVersions;
exports.appendDeliveryThresholdVersion = subscriptionPricing.appendDeliveryThresholdVersion;

const googleDelivery = require("./google-delivery");
exports.getDeliveryGoogleMapsConfig = googleDelivery.getDeliveryGoogleMapsConfig;
exports.computeDeliveryRoute = googleDelivery.computeDeliveryRoute;

const deliveryCustomerAuth = require("./delivery-customer-auth");
exports.createDeliveryCustomerSession = deliveryCustomerAuth.createDeliveryCustomerSession;

const operationalOrders = require("./operational-orders");
exports.createWalkInOrder = operationalOrders.createWalkInOrder;
exports.assignWalkInTable = operationalOrders.assignWalkInTable;
exports.moveTableSession = operationalOrders.moveTableSession;
exports.settleTableSession = operationalOrders.settleTableSession;
exports.closeWalkInTable = operationalOrders.closeWalkInTable;
exports.releaseQuickOrderHeldBill = operationalOrders.releaseQuickOrderHeldBill;
exports.appendUnpaidWalkInItems = operationalOrders.appendUnpaidWalkInItems;
exports.settleDeferredWalkIn = operationalOrders.settleDeferredWalkIn;
exports.cancelDeferredWalkIn = operationalOrders.cancelDeferredWalkIn;
exports.updateDeferredKitchen = operationalOrders.updateDeferredKitchen;
exports.cancelReviewedPaidWalkIn = operationalOrders.cancelReviewedPaidWalkIn;

// Superadmin-only encrypted Telegram bot settings and explicit test delivery.
const platformTelegram = require("./platform-telegram");
const stripeWalletSandbox = require("./stripe-wallet-sandbox");
exports.getPlatformStripeWalletSandboxStatus = stripeWalletSandbox.getPlatformStripeWalletSandboxStatus;
const stripeWalletCheckout = require("./stripe-wallet-sandbox-checkout");
exports.getPlatformStripeWalletSandboxGate = stripeWalletCheckout.getPlatformStripeWalletSandboxGate;
exports.getOwnStripeWalletSandbox = stripeWalletCheckout.getOwnStripeWalletSandbox;
exports.getPlatformStripeWalletSandboxHistory = stripeWalletCheckout.getPlatformStripeWalletSandboxHistory;
exports.createStripeWalletSandboxCheckout = stripeWalletCheckout.createStripeWalletSandboxCheckout;
exports.checkStripeWalletSandboxCheckout = stripeWalletCheckout.checkStripeWalletSandboxCheckout;
exports.expireStripeWalletSandboxCheckout = stripeWalletCheckout.expireStripeWalletSandboxCheckout;
exports.stripeWalletSandboxWebhook = stripeWalletCheckout.stripeWalletSandboxWebhook;
exports.getPlatformTelegramSettings = platformTelegram.getPlatformTelegramSettings;
exports.savePlatformTelegramSettings = platformTelegram.savePlatformTelegramSettings;
exports.testPlatformTelegramSettings = platformTelegram.testPlatformTelegramSettings;
const telegramFinanceEvents = require("./platform-telegram-finance-events");
exports.notifyPlatformWalletTopupOutcome = telegramFinanceEvents.notifyPlatformWalletTopupOutcome;
exports.notifyPlatformRevenueShareOutcome = telegramFinanceEvents.notifyPlatformRevenueShareOutcome;
exports.notifyPlatformDeliveryReviewOutcome = telegramFinanceEvents.notifyPlatformDeliveryReviewOutcome;
exports.deliverPlatformTelegramFinanceEvent = telegramFinanceEvents.deliverPlatformTelegramFinanceEvent;

const lalamoveWebhook = require("./lalamove-webhook");
exports.lalamoveWebhook = lalamoveWebhook.lalamoveWebhook;

const lalamoveDispatch = require("./lalamove-dispatch");
exports.quotePublicLalamoveDelivery = lalamoveDispatch.quotePublicLalamoveDelivery;
exports.quoteTenantLalamoveDispatch = lalamoveDispatch.quoteTenantLalamoveDispatch;
exports.placeTenantLalamoveDispatch = lalamoveDispatch.placeTenantLalamoveDispatch;
exports.refreshTenantLalamoveDispatch = lalamoveDispatch.refreshTenantLalamoveDispatch;
exports.cancelTenantLalamoveDispatch = lalamoveDispatch.cancelTenantLalamoveDispatch;

// Server-enforced public Delivery writes; client Firestore delivery creates are denied.
exports.submitPublicDeliveryOrder = require("./public-delivery-submit").submitPublicDeliveryOrder;

// PENGUIN central Slip2Go verification for restaurant/cafe Delivery only.
const deliverySlip = require("./delivery-slip");
exports.verifyDeliveryPaymentSlip = deliverySlip.verifyDeliveryPaymentSlip;
exports.finalizeDeliveryPaymentSlip = deliverySlip.finalizeDeliveryPaymentSlip;
exports.approveDeliveryPaymentReview = deliverySlip.approveDeliveryPaymentReview;
exports.listPlatformDeliveryManualReviews = deliverySlip.listPlatformDeliveryManualReviews;
exports.notifyKitchenDeliveryAdmitted = deliverySlip.notifyKitchenDeliveryAdmitted;

const paymentCompanion = require("./payment-companion");
exports.pairPaymentCompanionDevice = paymentCompanion.pairPaymentCompanionDevice;
exports.changePaymentCompanionDevice = paymentCompanion.changePaymentCompanionDevice;
exports.getPaymentCompanionDashboard = paymentCompanion.getPaymentCompanionDashboard;
exports.paymentCompanionDeviceStatus = paymentCompanion.paymentCompanionDeviceStatus;
exports.paymentCompanionNoticeIngest = paymentCompanion.paymentCompanionNoticeIngest;

exports.setPaymentCompanionReceiver = paymentCompanion.setPaymentCompanionReceiver;
exports.getPaymentCompanionCashierReview = paymentCompanion.getPaymentCompanionCashierReview;
exports.recordPaymentCompanionCashierReview = paymentCompanion.recordPaymentCompanionCashierReview;
exports.setCompanionAutoKitchenConsent = paymentCompanion.setCompanionAutoKitchenConsent;

const companionQR = require("./payment-companion-qr");
exports.getPublicCompanionQrAvailability = companionQR.getPublicCompanionQrAvailability;
exports.getPublicCompanionQrState = companionQR.getPublicCompanionQrState;
exports.submitPublicCompanionLateSlip = companionQR.submitPublicCompanionLateSlip;

const companionKitchen = require("./payment-companion-kitchen");
exports.onPaymentCompanionNoticeForKitchen = companionKitchen.onPaymentCompanionNoticeForKitchen;

const tenantTelegram=require("./tenant-telegram");
exports.getTenantTelegramSettings = tenantTelegram.getTenantTelegramSettings;
exports.saveTenantTelegramSettings = tenantTelegram.saveTenantTelegramSettings;
exports.testTenantTelegramSettings = tenantTelegram.testTenantTelegramSettings;

const tenantTelegramEvents=require("./tenant-telegram-events");
exports.notifyTenantTelegramDelivery = tenantTelegramEvents.notifyTenantTelegramDelivery;
exports.notifyTenantTelegramWalletTopup = tenantTelegramEvents.notifyTenantTelegramWalletTopup;
exports.notifyTenantTelegramRevenueShare = tenantTelegramEvents.notifyTenantTelegramRevenueShare;
exports.notifyTenantTelegramHybridPlatformFee = tenantTelegramEvents.notifyTenantTelegramHybridPlatformFee;
exports.deliverTenantTelegramEvent = tenantTelegramEvents.deliverTenantTelegramEvent;

const m7EvidenceHistory=require("./m7-evidence-history");
exports.getOwnM7FinanceEvidenceHistory = m7EvidenceHistory.getOwnM7FinanceEvidenceHistory;
exports.getPlatformM7FinanceEvidenceHistory = m7EvidenceHistory.getPlatformM7FinanceEvidenceHistory;

const m7StripeTestReservation=require("./m7-stripe-test-reservation");
exports.getOwnM7StripeTestQuoteReadiness = m7StripeTestReservation.getOwnM7StripeTestQuoteReadiness;
exports.reserveOwnM7StripeTestInvoice = m7StripeTestReservation.reserveOwnM7StripeTestInvoice;

const m7StripeCheckout=require("./m7-stripe-test-checkout");
exports.getOwnM7StripeTestCheckoutStatus = m7StripeCheckout.getOwnM7StripeTestCheckoutStatus;
exports.createOwnM7StripeTestCheckout = m7StripeCheckout.createOwnM7StripeTestCheckout;
exports.inspectOwnM7StripeTestCheckout = m7StripeCheckout.inspectOwnM7StripeTestCheckout;
exports.m7StripeTestShadowWebhook = m7StripeCheckout.m7StripeTestShadowWebhook;

const m7StripeShadowHistory=require("./m7-stripe-test-shadow-history");
exports.getPlatformM7StripeTestShadowHistory = m7StripeShadowHistory.getPlatformM7StripeTestShadowHistory;

const m7TestRecovery=require("./m7-stripe-test-recovery");
exports.reviewPlatformM7StripeTestRecovery = m7TestRecovery.reviewPlatformM7StripeTestRecovery;
exports.bindPlatformM7StripeTestRecovery = m7TestRecovery.bindPlatformM7StripeTestRecovery;

const m7TestClosure=require("./m7-stripe-test-closure");
exports.reviewPlatformM7StripeTestClosure = m7TestClosure.reviewPlatformM7StripeTestClosure;
exports.approvePlatformM7StripeTestClosure = m7TestClosure.approvePlatformM7StripeTestClosure;

const m7OperationalFinanceReadiness=require("./m7-operational-finance-readiness");
exports.getPlatformM7OperationalFinanceReadiness =
  m7OperationalFinanceReadiness.getPlatformM7OperationalFinanceReadiness;

const m7SourceMigrationPreflight = require("./m7-source-migration-preflight");
exports.previewPlatformM7SourceMigrationPreflight =
  m7SourceMigrationPreflight.previewPlatformM7SourceMigrationPreflight;
exports.stagePlatformM7SourceMigrationPreflight =
  m7SourceMigrationPreflight.stagePlatformM7SourceMigrationPreflight;
exports.getPlatformM7SourceMigrationPreflightHistory =
  m7SourceMigrationPreflight.getPlatformM7SourceMigrationPreflightHistory;

const m7UatOperationalLedger = require("./m7-uat-operational-ledger");
exports.previewPlatformM7UatFinancialShadow =
  m7UatOperationalLedger.previewPlatformM7UatFinancialShadow;
exports.stagePlatformM7UatFinancialShadow =
  m7UatOperationalLedger.stagePlatformM7UatFinancialShadow;
exports.getPlatformM7UatFinancialShadowHistory =
  m7UatOperationalLedger.getPlatformM7UatFinancialShadowHistory;

// Actual issued Firebase Hybrid invoice / payment evidence status, read only.
exports.getOwnHybridIssuedInvoiceStatusPage =
  require("./hybrid-issued-invoice-status").getOwnHybridIssuedInvoiceStatusPage;
exports.getPlatformHybridIssuedInvoiceStatusPage =
  require("./hybrid-issued-invoice-status").getPlatformHybridIssuedInvoiceStatusPage;
