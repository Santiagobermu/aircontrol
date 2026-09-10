import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getUserReadNotificationsDB, 
  markNotificationAsReadDB, 
  markAllNotificationsAsReadDB, 
  markNotificationAsUnreadDB 
} from './db';

/**
 * Helper para verificar si dos identificadores de controlador coinciden.
 */
export const isSameCtrl = (ctrlA, ctrlB) => {
  if (!ctrlA || !ctrlB) return false;
  const sigA = (typeof ctrlA === 'string' ? ctrlA : (ctrlA.signature || ctrlA.id || ctrlA.name || '')).toString().trim().toUpperCase();
  const sigB = (typeof ctrlB === 'string' ? ctrlB : (ctrlB.signature || ctrlB.id || ctrlB.name || '')).toString().trim().toUpperCase();
  if (sigA && sigB && sigA === sigB) return true;
  const idA = (typeof ctrlA === 'object' ? (ctrlA.id || ctrlA.signature) : ctrlA).toString().trim().toUpperCase();
  const idB = (typeof ctrlB === 'object' ? (ctrlB.id || ctrlB.signature) : ctrlB).toString().trim().toUpperCase();
  return Boolean(idA && idB && idA === idB);
};

/**
 * Hook centralizado para gestionar las notificaciones y el estado de lectura (read/unread).
 */
export function useNotifications({
  currentUser,
  manualAlerts = [],
  trades = [],
  userRole = 'controller'
}) {
  const userId = useMemo(() => {
    return currentUser?.id || currentUser?.signature || currentUser?.email || 'anonymous';
  }, [currentUser]);

  const storageKey = useMemo(() => `aircontrol_read_notifs_${userId}`, [userId]);

  // 1. Estado local de IDs leídos con inicialización síncrona desde localStorage
  const [readIds, setReadIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(`aircontrol_read_notifs_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.warn('Error leyendo notificaciones leídas de localStorage:', e);
    }
    return new Set();
  });

  // 2. Sincronizar con Firestore en segundo plano (cross-device)
  useEffect(() => {
    if (!userId || userId === 'anonymous') return;

    let isMounted = true;
    getUserReadNotificationsDB(userId).then(cloudIds => {
      if (!isMounted || !cloudIds || cloudIds.length === 0) return;
      setReadIds(prev => {
        const next = new Set([...prev, ...cloudIds]);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch (e) {
          // Ignore quota or private mode errors
        }
        return next;
      });
    }).catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [userId, storageKey]);

  const isEncargado = Boolean(
    userRole === 'admin' || 
    currentUser?.isSupervisor || 
    currentUser?.isAdmin || 
    (currentUser?.skills && currentUser.skills.includes('CTE'))
  );

  // 3. Filtrar y procesar alertas manuales vigentes
  const activeManualAlerts = useMemo(() => {
    const now = new Date();
    return (manualAlerts || []).filter(a => {
      if (!a.expiresAt) return true;
      return new Date(a.expiresAt) > now;
    });
  }, [manualAlerts]);

  // 4. Filtrar solicitudes de permuta pendientes dirigidas o públicas
  const pendingTrades = useMemo(() => {
    return (trades || []).filter(t => {
      const isTargetMe = isSameCtrl(t.targetSignature || t.toControllerSignature || t.toControllerId, currentUser);
      const isOpen = Boolean(t.isPublic || t.targetSignature === 'OPEN' || t.toControllerId === 'OPEN');
      const isPendingPeer = (t.status === 'pending' || t.status === 'PENDIENTE_ACEPTACION' || !t.status) && (isTargetMe || isOpen);
      const isPendingAdmin = t.status === 'PENDIENTE_APROBACION' && isEncargado;
      return isPendingPeer || isPendingAdmin;
    });
  }, [trades, currentUser, isEncargado]);

  // 5. Permutas recientemente resueltas que involucran al usuario
  const resolvedTrades = useMemo(() => {
    return (trades || []).filter(t => {
      const isMyTrade = isSameCtrl(t.requesterSignature || t.requesterId, currentUser);
      const isResolved = ['APROBADA', 'RECHAZADA', 'approved', 'rejected'].includes(t.status);
      if (!isMyTrade || !isResolved) return false;
      // Mostrar solo si fue resuelta en los últimos 7 días
      if (t.updatedAt || t.approvedAt || t.rejectedAt || t.createdAt) {
        const time = new Date(t.updatedAt || t.approvedAt || t.rejectedAt || t.createdAt).getTime();
        const diffDays = (Date.now() - time) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      return true;
    });
  }, [trades, currentUser]);

  // 6. Lista unificada de todas las notificaciones
  const allNotificationItems = useMemo(() => {
    const list = [];

    // Alertas manuales del turno
    activeManualAlerts.forEach(alert => {
      const notifId = `alert_${alert.id}`;
      list.push({
        id: notifId,
        rawId: alert.id,
        category: 'alert',
        title: alert.createdBy ? `📢 Mensaje de ${alert.createdBy}` : '📢 Aviso de Guardia',
        content: alert.content,
        timestamp: alert.createdAt,
        expiresAt: alert.expiresAt,
        isRead: readIds.has(notifId),
        raw: alert
      });
    });

    // Solicitudes de permuta pendientes
    pendingTrades.forEach(trade => {
      const notifId = `trade_${trade.id}_${trade.status || 'pending'}`;
      list.push({
        id: notifId,
        rawId: trade.id,
        category: 'trade_pending',
        title: `${trade.requesterName || trade.requesterSignature || 'Un colega'} solicita permuta`,
        content: `Fecha: ${trade.dateStr} · Turno: ${trade.requesterShift}${trade.comment ? ` · "${trade.comment}"` : ''}`,
        timestamp: trade.createdAt || trade.dateStr,
        isRead: readIds.has(notifId),
        status: trade.status || 'PENDIENTE_ACEPTACION',
        raw: trade
      });
    });

    // Permutas resueltas
    resolvedTrades.forEach(trade => {
      const notifId = `trade_resolved_${trade.id}_${trade.status}`;
      const isApproved = trade.status === 'APROBADA' || trade.status === 'approved';
      list.push({
        id: notifId,
        rawId: trade.id,
        category: 'trade_resolved',
        title: isApproved ? `✅ Permuta Aprobada (${trade.dateStr})` : `❌ Permuta Rechazada (${trade.dateStr})`,
        content: isApproved
          ? `Tu cambio para el turno ${trade.requesterShift} fue aprobado satisfactoriamente.`
          : `Tu solicitud de cambio para el turno ${trade.requesterShift} no fue aprobada.`,
        timestamp: trade.updatedAt || trade.approvedAt || trade.rejectedAt || trade.createdAt,
        isRead: readIds.has(notifId),
        status: trade.status,
        raw: trade
      });
    });

    // Ordenar por fecha más reciente primero
    list.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [activeManualAlerts, pendingTrades, resolvedTrades, readIds]);

  // 7. Acciones de marcado
  const markAsRead = useCallback((notificationId) => {
    if (!notificationId) return;
    const strId = String(notificationId);

    setReadIds(prev => {
      if (prev.has(strId)) return prev;
      const next = new Set(prev);
      next.add(strId);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (e) {}
      return next;
    });

    if (userId && userId !== 'anonymous') {
      markNotificationAsReadDB(userId, strId).catch(console.error);
    }
  }, [userId, storageKey]);

  const markAsUnread = useCallback((notificationId) => {
    if (!notificationId) return;
    const strId = String(notificationId);

    setReadIds(prev => {
      if (!prev.has(strId)) return prev;
      const next = new Set(prev);
      next.delete(strId);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (e) {}
      return next;
    });

    if (userId && userId !== 'anonymous') {
      markNotificationAsUnreadDB(userId, strId).catch(console.error);
    }
  }, [userId, storageKey]);

  const markAllAsRead = useCallback(() => {
    const unreadIds = allNotificationItems.filter(item => !item.isRead).map(item => item.id);
    if (unreadIds.length === 0) return;

    setReadIds(prev => {
      const next = new Set([...prev, ...unreadIds]);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (e) {}
      return next;
    });

    if (userId && userId !== 'anonymous') {
      markAllNotificationsAsReadDB(userId, unreadIds).catch(console.error);
    }
  }, [allNotificationItems, userId, storageKey]);

  // 8. Conteos
  const unreadItems = useMemo(() => {
    return allNotificationItems.filter(item => !item.isRead);
  }, [allNotificationItems]);

  const unreadCount = unreadItems.length;
  const totalCount = allNotificationItems.length;

  return {
    allNotifications: allNotificationItems,
    unreadNotifications: unreadItems,
    activeManualAlerts,
    pendingTrades,
    unreadCount,
    totalCount,
    isRead: useCallback((id) => readIds.has(String(id)), [readIds]),
    markAsRead,
    markAsUnread,
    markAllAsRead,
    isEncargado
  };
}
