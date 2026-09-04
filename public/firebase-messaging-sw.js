// Service Worker para Firebase Cloud Messaging (AirControl SKBO)
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDYg4_HddIkdsBuMk8td_2A-sOYS8tb8O8",
  authDomain: "aircontrol-skbo-sbg.firebaseapp.com",
  projectId: "aircontrol-skbo-sbg",
  storageBucket: "aircontrol-skbo-sbg.firebasestorage.app",
  messagingSenderId: "588241571134",
  appId: "1:588241571134:web:c830794477a968392a306f",
  measurementId: "G-XXZ19PF4WH"
};

// Inicializar Firebase en el Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Manejo de mensajes cuando la app está en segundo plano o cerrada
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación recibida en background:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'AirControl SKBO';
  const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva actualización en AirControl.';
  const icon = payload.notification?.icon || payload.data?.icon || '/favicon.svg';
  const tag = payload.data?.tag || 'aircontrol-general';

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: '/favicon.svg',
    tag: tag,
    data: payload.data || {},
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: false
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Manejo de clic en la notificación para abrir o enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetTab = event.notification.data?.tab || 'trades';
  const relativeUrl = `/?tab=${targetTab}`;
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana abierta de AirControl, enfocarla y navegar a la pestaña
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
