import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import app, { db } from './firebase';

let messagingInstance = null;
let isMessagingSupported = null;

/**
 * Comprueba si el entorno actual soporta Web Push y Service Workers.
 */
export const checkPushSupport = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }
  if (isMessagingSupported === null) {
    try {
      isMessagingSupported = await isSupported();
    } catch (err) {
      console.warn('Error verificando soporte de Firebase Messaging:', err);
      isMessagingSupported = false;
    }
  }
  return isMessagingSupported;
};

/**
 * Obtiene o inicializa la instancia de Firebase Messaging de forma segura.
 */
export const getMessagingInstance = async () => {
  const supported = await checkPushSupport();
  if (!supported) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};

/**
 * Registra el Service Worker de Firebase Messaging en la raíz de la app.
 */
export const registerMessagingServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    console.log('[Push Notifications] Service Worker registrado exitosamente con scope:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push Notifications] Error registrando Service Worker:', error);
    return null;
  }
};

/**
 * Devuelve el estado actual de los permisos de notificación del navegador.
 */
export const getPermissionStatus = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'granted', 'denied', o 'default'
};

/**
 * Solicita permiso de notificaciones push, obtiene el token FCM y lo vincula al controlador en Firestore.
 * @param {string} controllerId - Identificador del controlador (ej. 'ATC-024')
 * @param {string} [vapidKey] - Clave pública VAPID opcional de Firebase Console
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export const requestPushPermission = async (controllerId, vapidKey = null) => {
  try {
    const supported = await checkPushSupport();
    if (!supported) {
      return { success: false, error: 'Tu navegador no soporta notificaciones push web o requiere HTTPS/PWA.' };
    }

    // Solicitar permiso al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permiso de notificaciones denegado por el usuario.' };
    }

    // Asegurar Service Worker
    const swRegistration = await registerMessagingServiceWorker();
    const messaging = await getMessagingInstance();

    if (!messaging) {
      return { success: false, error: 'No se pudo inicializar Firebase Messaging.' };
    }

    const tokenOptions = {};
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }
    if (vapidKey) {
      tokenOptions.vapidKey = vapidKey;
    }

    // Obtener Token FCM del dispositivo
    const token = await getToken(messaging, tokenOptions);

    if (!token) {
      return { success: false, error: 'No se pudo generar el token de notificación del dispositivo.' };
    }

    // Guardar token en localStorage
    localStorage.setItem('aircontrol_fcm_token', token);

    // Guardar o asociar token al controlador en Firestore
    if (controllerId) {
      const controllerRef = doc(db, 'controllers', controllerId);
      const controllerSnap = await getDoc(controllerRef);
      
      if (controllerSnap.exists()) {
        await updateDoc(controllerRef, {
          fcmTokens: arrayUnion(token),
          lastNotificationUpdate: new Date().toISOString()
        });
      }
    }

    console.log('[Push Notifications] Token FCM registrado con éxito para', controllerId, token);
    return { success: true, token };
  } catch (error) {
    console.error('[Push Notifications] Error al solicitar permiso o registrar token:', error);
    return { success: false, error: error.message || 'Error inesperado al activar notificaciones.' };
  }
};

/**
 * Desuscribe y remueve el token FCM actual del controlador en Firestore.
 */
export const disablePushNotifications = async (controllerId) => {
  try {
    const currentToken = localStorage.getItem('aircontrol_fcm_token');
    if (currentToken && controllerId) {
      const controllerRef = doc(db, 'controllers', controllerId);
      await updateDoc(controllerRef, {
        fcmTokens: arrayRemove(currentToken)
      });
    }
    localStorage.removeItem('aircontrol_fcm_token');
    return { success: true };
  } catch (error) {
    console.error('[Push Notifications] Error desactivando notificaciones:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Escucha notificaciones recibidas en primer plano (Foreground) cuando la app está abierta.
 * @param {Function} callback - Función que recibe el payload de la notificación
 * @returns {Function} Función para cancelar la suscripción (unsubscribe)
 */
export const subscribeToForegroundMessages = (callback) => {
  let unsubscribe = null;
  getMessagingInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Push Notifications] Mensaje en primer plano:', payload);
        if (callback) {
          callback(payload);
        }
      });
    }
  });

  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
};

/**
 * Envía una notificación local de prueba inmediata utilizando la Notification API del navegador.
 */
export const triggerLocalTestNotification = (title = 'AirControl SKBO', body = '¡Notificaciones configuradas correctamente!') => {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'test-notification'
    });
    return true;
  }
  return false;
};

/**
 * Envía una notificación push a través de la Cloud Function backend de AirControl.
 */
export const sendPushNotificationViaBackend = async ({ controllerId, controllerIds, title, body, data = {} }) => {
  try {
    const res = await fetch('https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/send_push_notification_api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controllerId,
        controllerIds,
        title,
        body,
        data
      })
    });
    return await res.json();
  } catch (err) {
    console.error('[Push Notifications] Error enviando notificación vía backend:', err);
    return { success: false, error: err.message };
  }
};
