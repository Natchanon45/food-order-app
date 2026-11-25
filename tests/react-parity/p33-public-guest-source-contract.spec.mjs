import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicOrderAcceptingTenant } from "../../react-app/src/data/publicStorefrontOrderAccess.mjs";
import { tableOrderFailureText } from "../../react-app/src/data/tableOrderFailureText.mjs";
import { takeawayOrderFailureText } from "../../react-app/src/data/takeawayOrderFailureText.mjs";
const file=name=>readFileSync(new URL("../../"+name,import.meta.url),"utf8");
test("P3.3 tenant public guest order acceptance closes on exact suspension, expiry and nonrestaurant business",()=>{
 assert.equal(publicOrderAcceptingTenant({businessType:"restaurant_cafe",active:true,subscriptionStatus:"active"}),true);
 assert.equal(publicOrderAcceptingTenant({businessType:"both",active:true}),true);
 for(const state of [{active:false},{operationalSuspended:true},{revenueShareSuspended:true},
  {subscriptionStatus:"suspended"},{subscriptionStatus:"expired"},{status:"suspended"},
  {businessType:"retail"}]){
  assert.equal(publicOrderAcceptingTenant({...{active:true,businessType:"restaurant_cafe"},...state}),false,JSON.stringify(state));
 }
});
test("P3.3 approved Source guest error labels never echo internal SQL, URLs, provider details or customer text",()=>{
 const err={response:{status:500,data:{error:"SELECT * FROM users WHERE password=secret"}}};
 for(const value of [
  tableOrderFailureText(err,"ส่งออเดอร์ไม่ได้","QR หมดอายุ"),
  takeawayOrderFailureText(err,"ส่งออเดอร์ไม่ได้","ลูกค้าต้องระบุชื่อ")]){
  assert.equal(/SELECT|secret|password|users WHERE/.test(value),false);
  assert.match(value,/โปรดตรวจรายการ/);
 }
 assert.equal(tableOrderFailureText({message:"INVALID_TABLE_SESSION"},"x","หมดอายุ"),"หมดอายุ");
 assert.equal(takeawayOrderFailureText({message:"TAKEAWAY_CUSTOMER_REQUIRED"},"x","กรุณาระบุผู้รับ"),"กรุณาระบุผู้รับ");
});
test("P3.3 Public Table latest Source revokes stale QR token on live table move and on read failure",()=>{
 const page=file("react-app/src/pages/PublicOrderPage.jsx");
 for(const fragment of [
  'payload.table.status !== "occupied"','payload.table.orderToken !== tableToken',
  'setActiveTable(null);setOrders([]);return;',
  'setError("INVALID_TABLE_SESSION");',
  "tableOrderFailureText(submitError",
  'findPublicTableSession(tenant, activeCode || requestedTable, tableToken)'])
  assert.ok(page.includes(fragment),fragment);
});
test("P3.3 guest Table/Takeaway uses signed public Callables; server transaction rechecks canonical tenant, menu prices and replay",()=>{
 const data=file("react-app/src/data/publicStorefrontData.js");
 for(const fragment of [
  'httpsCallable(functions,"submitPublicTableOrder"',
  'httpsCallable(functions,"submitPublicTakeawayOrder"',
  'await submitPublicTableOrder({','await submitPublicTakeawayOrder({',
  'TABLE_ORDER_ALREADY_SUBMITTED_CHECK_KITCHEN',
  'TAKEAWAY_ORDER_ALREADY_SUBMITTED_CHECK_KITCHEN'])
  assert.ok(data.includes(fragment),fragment);
 const server=file("functions/public-guest-order-intake.js");
 for(const fragment of [
  'tx.get(tenantRef)','tx.get(ref)','tx.get(menus.doc(menuId))',
  'tx.get(tableRef)','PUBLIC_ORDER_ID_CONFLICT',
  'publicOrderFingerprint:fingerprint','status:"pending",paymentStatus:"unpaid"',
  "const DOC_ID=/^[A-Za-z0-9_-]{1,128}$/;",  'price:menu.price','tx.create(ref,{...common,...specific})'])
  assert.ok(server.includes(fragment),fragment);
});

test("P3.3 Firestore guest cannot create into a suspended Tenant even if public UI remains open on another device",()=>{
 const rules=file("firestore.rules");
 for(const guard of [
  "tenant.get('operationalSuspended', false) != true",
  "tenant.get('revenueShareSuspended', false) != true",
  "tenant.get('subscriptionStatus', 'active') != 'expired'",
  "tenant.get('businessType', 'both') in ['both', 'restaurant_cafe']"])
  assert.ok(rules.includes(guard),guard);
 assert.ok(rules.includes("(tenantStaffRole(tenantId) && (validPublicTenantTakeaway(tenantId) || validTenantTableOrder(tenantId)))"));
 assert.ok(rules.includes("validTenantTableOrder(tenantId) { return publicTenantOrderAccepting(tenantId)"));
 assert.ok(rules.includes("validPublicTenantTakeaway(tenantId) { return publicTenantOrderAccepting(tenantId)"));
});
test("P3.3 Source Takeaway live suspended state never makes a guest sale and keeps PENGUIN brand",()=>{
 const page=file("react-app/src/pages/TakeawayPage.jsx");
 for(const fragment of [
  "watchPublicTenantOrderAccess(tenant","publicAccess !== \"open\"",
  "data-public-store-access-suspended",
  "takeawayOrderFailureText(error",
  "aria-live=\"polite\"",
  '"PENGUIN"'])
  assert.ok(page.includes(fragment),fragment);
});
test("P3.3 missing route remains PENGUIN and legacy redirect only accepts validated current Tenant slug and allowlisted destination",()=>{
 const compat=file("react-app/src/pages/StorefrontCompatibilityEntry.jsx");
 const route=file("react-app/src/pages/PublicRouteMissingPage.jsx");
 assert.ok(route.includes("PENGUIN"));
 assert.match(compat,/\^\[a-z0-9\]\[a-z0-9-\]\{0,127\}\$/);
 assert.ok(compat.includes('["takeaway","delivery","order"].includes(target)'));
 assert.ok(compat.includes('"/s/" + encodeURIComponent(slug)'));
 assert.ok(!compat.includes('"LUKKAJA"'));
});
test("P3.3 public Delivery legacy COD is globally disabled in both checkout and canonical callable, PromptPay remains pending verification",()=>{
 const page=file("react-app/src/pages/DeliveryPage.jsx");
 const server=file("functions/public-delivery-submit.js");
 assert.ok(page.includes("const codEnabled = false;"));
 assert.ok(server.includes('if(order.paymentMethod === "cod")'));
 assert.ok(server.includes('DELIVERY_COD_DISABLED'));
 assert.ok(server.includes('paymentStatus: order.paymentMethod === "promptpay" ? "pending_verification" : "unpaid"'));
 assert.ok(server.includes('M7_PUBLIC_STOREFRONT_SUSPENDED'));
 assert.ok(!server.includes("status: \"paid\""));
});
test("P3.3 Source customer success shows original line & net, before discount, cancellation actor, and unverified warning without forged receipt",()=>{
 const page=file("react-app/src/pages/DeliverySuccessPage.jsx");
 for(const fragment of ["ReceiptOriginalItemRow","RevisedOrderNet","OrderCancellationWatermark",
  "receiptBeforeDiscountTotal","deliveryReceiptTotals(order,subtotal)",
  "receiptDeliveryPromotionDiscount","data-public-order-unverified",
  "ยังไม่ยืนยันรับเงิน","โปรดอย่าโอนเงินซ้ำ"])
  assert.ok(page.includes(fragment),fragment);
 assert.ok(!page.includes("patch.paymentStatus="));
});
