import { app, auth, db, doc, setDoc, serverTimestamp } from "./firebase-config.js?v=20260630-073";
import { getUserProfile, waitForAuth } from "./auth-service.js";
import { resolveTenantContext } from "./tenant-context.js";
import { toast } from "./ui.js";
import {
  getMessaging, getToken, isSupported, onMessage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

const PUSH_ENABLED_KEY = "food_order_push_enabled";
const DEVICE_ID_KEY = "food_order_push_device_id";
const VAPID_KEY = "BO08woSr5mK0mGRi8ZGynOyw6w9kfb4XCESQCOiNq4TZ9j0a7Kkn0jaz1DiM5W2mMnS0-iGRr8RA9qD_v2i1sAc";
let foregroundListenerInstalled = false;

function getDeviceId() {
  let value = localStorage.getItem(DEVICE_ID_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, value);
  }
  return value;
}

function tokenDocumentId(uid) {
  return `${uid}_${getDeviceId()}`;
}

function setEnabled(value) {
  localStorage.setItem(PUSH_ENABLED_KEY, value ? "1" : "0");
}

export function pushEnabled() {
  return localStorage.getItem(PUSH_ENABLED_KEY) === "1";
}

export async function registerPushNotifications() {
  if (!(await isSupported())) throw new Error("PUSH_NOT_SUPPORTED");
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    throw new Error("PUSH_NOT_SUPPORTED");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("PUSH_PERMISSION_DENIED");

  const user = auth.currentUser || await waitForAuth();
  if (!user) throw new Error("AUTH_REQUIRED");
  const profile = await getUserProfile(user);
  if (!profile?.role) throw new Error("PROFILE_REQUIRED");

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const options = { serviceWorkerRegistration: registration };
  if (VAPID_KEY) options.vapidKey = VAPID_KEY;
  const token = await getToken(messaging, options);
  if (!token) throw new Error("FCM_TOKEN_UNAVAILABLE");

  const tenant = resolveTenantContext();
  await setDoc(doc(db, "tenants", tenant.id, "notificationTokens", tokenDocumentId(user.uid)), {
    token,
    uid: user.uid,
    email: user.email || profile.email || "",
    role: profile.role,
    tenantId: tenant.id,
    deviceId: getDeviceId(),
    userAgent: navigator.userAgent,
    active: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  setEnabled(true);
  installForegroundListener(messaging);
  return token;
}

export async function disablePushNotifications() {
  const user = auth.currentUser || await waitForAuth();
  if (!user) return;
  const tenant = resolveTenantContext();
  await setDoc(doc(db, "tenants", tenant.id, "notificationTokens", tokenDocumentId(user.uid)), {
    active: false,
    updatedAt: serverTimestamp()
  }, { merge: true });
  setEnabled(false);
}

export async function restorePushNotifications() {
  if (!pushEnabled() || Notification.permission !== "granted") return false;
  try {
    await registerPushNotifications();
    return true;
  } catch (error) {
    console.warn("Unable to restore push notifications", error);
    return false;
  }
}

function installForegroundListener(messaging) {
  if (foregroundListenerInstalled) return;
  foregroundListenerInstalled = true;
  onMessage(messaging, payload => {
    const title = payload.notification?.title || "มีออเดอร์ Delivery ใหม่";
    const body = payload.notification?.body || "มีรายการใหม่เข้ามา";
    toast(`${title}: ${body}`);
  });
}

export function pushErrorMessage(error) {
  if (error?.message === "PUSH_NOT_SUPPORTED") return "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Push Notification";
  if (error?.message === "PUSH_PERMISSION_DENIED") return "กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์";
  if (error?.message === "AUTH_REQUIRED") return "กรุณาเข้าสู่ระบบก่อนเปิด Push Notification";
  return "เปิด Push Notification ไม่สำเร็จ";
}
