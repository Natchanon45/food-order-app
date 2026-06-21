importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAX4e6-nbiS9Y8tpqW8rKbMkryAwZXSmCo",
  authDomain: "chat-45754.firebaseapp.com",
  projectId: "chat-45754",
  storageBucket: "chat-45754.firebasestorage.app",
  messagingSenderId: "1046915702525",
  appId: "1:1046915702525:web:869e1a0d1407375610e894"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || "มีออเดอร์ Delivery ใหม่";
  const options = {
    body: notification.body || "แตะเพื่อเปิดดูรายการ",
    icon: "/assets/images/icon-192.png",
    badge: "/assets/images/icon-192.png",
    tag: data.orderId ? `delivery-${data.orderId}` : "delivery-order",
    renotify: true,
    data: {
      url: data.url || "/cashier/",
      orderId: data.orderId || "",
      tenantId: data.tenantId || ""
    }
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/cashier/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});
