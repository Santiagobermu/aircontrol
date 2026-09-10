import { useState } from 'react';
import { 
  Bell, 
  X, 
  ArrowRightLeft, 
  Trash2, 
  Megaphone, 
  Check, 
  CheckCheck, 
  RotateCcw, 
  CheckCircle2, 
  Inbox 
} from 'lucide-react';
import { deleteManualAlertDB } from '../utils/db';

export default function NotificationCenterModal({
  isOpen,
  onClose,
  notificationsState,
  onTabSelect
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'

  if (!isOpen || !notificationsState) return null;

  const {
    allNotifications,
    unreadNotifications,
    unreadCount,
    totalCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    isEncargado
  } = notificationsState;

  const displayedNotifications = activeFilter === 'unread' ? unreadNotifications : allNotifications;
  const displayedAlerts = displayedNotifications.filter(n => n.category === 'alert');
  const displayedPendingTrades = displayedNotifications.filter(n => n.category === 'trade_pending');
  const displayedResolvedTrades = displayedNotifications.filter(n => n.category === 'trade_resolved');

  const handleDeleteAlert = async (id) => {
    if (window.confirm('¿Deseas eliminar esta alerta del turno para todos los controladores?')) {
      await deleteManualAlertDB(id);
    }
  };

  const handleOpenTradeDetail = (notificationId) => {
    markAsRead(notificationId);
    if (onClose) onClose();
    if (onTabSelect) {
      onTabSelect('trades');
    }
  };

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />

        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Bell size={18} color={unreadCount > 0 ? 'var(--status-warning)' : 'var(--accent-cyan)'} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
              Centro de Notificaciones
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="notif-action-btn primary"
                style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                title="Marcar todas las notificaciones como leídas"
              >
                <CheckCheck size={14} />
                <span>Marcar todas</span>
              </button>
            )}
            <button 
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              aria-label="Cerrar notificaciones"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sub-cabecera con resumen y selector de filtro (Todas / No leídas) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
            {unreadCount > 0 ? (
              <span style={{ color: 'var(--status-warning)', fontWeight: '700' }}>
                ● {unreadCount} notificación{unreadCount > 1 ? 'es' : ''} pendiente{unreadCount > 1 ? 's' : ''} por leer
              </span>
            ) : (
              <span style={{ color: 'var(--status-success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={13} /> Todas las notificaciones al día
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              Total: {totalCount}
            </span>
          </div>

          {/* Selector de Filtro */}
          <div className="notif-filter-tabs">
            <button 
              className={`notif-filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              Todas ({totalCount})
            </button>
            <button 
              className={`notif-filter-tab ${activeFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveFilter('unread')}
            >
              No leídas ({unreadCount})
            </button>
          </div>
        </div>

        {/* Contenido de Notificaciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* 1. MENSAJES DEL ENCARGADO DE TURNO */}
          <div>
            <h4 style={{ 
              fontSize: '0.8rem', 
              fontWeight: '800', 
              margin: '0 0 0.5rem', 
              color: 'var(--accent-cyan)', 
              textTransform: 'uppercase', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Megaphone size={14} />
                Mensajes del Encargado ({displayedAlerts.length})
              </span>
            </h4>

            {displayedAlerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {displayedAlerts.map((item) => (
                  <div 
                    key={item.id} 
                    className={`notif-card ${item.isRead ? 'read' : 'unread alert'}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                          {item.title}
                        </span>
                        {item.isRead ? (
                          <span className="notif-pill-read">
                            <Check size={10} /> Leída
                          </span>
                        ) : (
                          <span className="notif-pill-unread">
                            ● Nueva
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {isEncargado && (
                          <button
                            onClick={() => handleDeleteAlert(item.rawId)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', padding: '0.1rem' }}
                            title="Eliminar aviso de la guardia"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.84rem', color: item.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: '1.4' }}>
                      {item.content}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                      {item.timestamp ? (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Publicado: {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                        </span>
                      ) : <span />}

                      {/* Botón marcar / desmarcar como leída */}
                      <div>
                        {item.isRead ? (
                          <button 
                            onClick={() => markAsUnread(item.id)}
                            className="notif-action-btn ghost"
                            title="Marcar como no leída"
                          >
                            <RotateCcw size={11} />
                            <span>No leída</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => markAsRead(item.id)}
                            className="notif-action-btn"
                            title="Marcar como leída"
                          >
                            <Check size={12} color="var(--accent-cyan)" />
                            <span>Marcar leída</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                {activeFilter === 'unread' ? 'No hay avisos sin leer del encargado.' : 'No hay mensajes del encargado de turno.'}
              </p>
            )}
          </div>

          {/* 2. SOLICITUDES DE CAMBIO DE TURNO PENDIENTES */}
          <div>
            <h4 style={{ 
              fontSize: '0.8rem', 
              fontWeight: '800', 
              margin: '0 0 0.5rem', 
              color: 'var(--status-warning)', 
              textTransform: 'uppercase', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem' 
            }}>
              <ArrowRightLeft size={14} />
              Solicitudes de Permuta Pendientes ({displayedPendingTrades.length})
            </h4>

            {displayedPendingTrades.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {displayedPendingTrades.map((item) => (
                  <div 
                    key={item.id} 
                    className={`notif-card ${item.isRead ? 'read' : 'unread trade'}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {item.title}
                        </span>
                        {item.isRead ? (
                          <span className="notif-pill-read">
                            <Check size={10} /> Leída
                          </span>
                        ) : (
                          <span className="notif-pill-unread warning">
                            ● Nueva
                          </span>
                        )}
                      </div>
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {item.content}
                    </span>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', gap: '0.5rem' }}>
                      <div>
                        {item.isRead ? (
                          <button 
                            onClick={() => markAsUnread(item.id)}
                            className="notif-action-btn ghost"
                            title="Marcar como no leída"
                          >
                            <RotateCcw size={11} />
                            <span>No leída</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => markAsRead(item.id)}
                            className="notif-action-btn"
                            title="Marcar como leída"
                          >
                            <Check size={12} color="var(--status-warning)" />
                            <span>Marcar leída</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenTradeDetail(item.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '800' }}
                      >
                        Ver Solicitud
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                {activeFilter === 'unread' ? 'No tienes solicitudes de cambio sin leer.' : 'No tienes solicitudes de cambio de turno pendientes.'}
              </p>
            )}
          </div>

          {/* 3. RESPUESTAS A TUS SOLICITUDES RECIENTES (SI EXISTEN) */}
          {displayedResolvedTrades.length > 0 && (
            <div>
              <h4 style={{ 
                fontSize: '0.8rem', 
                fontWeight: '800', 
                margin: '0 0 0.5rem', 
                color: 'var(--text-primary)', 
                textTransform: 'uppercase', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.35rem' 
              }}>
                <CheckCircle2 size={14} color="var(--status-success)" />
                Respuestas a tus Solicitudes ({displayedResolvedTrades.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {displayedResolvedTrades.map((item) => (
                  <div 
                    key={item.id} 
                    className={`notif-card ${item.isRead ? 'read' : 'unread'}`}
                    style={{ borderLeft: item.status.includes('APROB') || item.status.includes('approv') ? '3px solid var(--status-success)' : '3px solid var(--status-danger)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      {item.isRead ? (
                        <span className="notif-pill-read"><Check size={10} /> Leída</span>
                      ) : (
                        <span className="notif-pill-unread">● Nueva</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {item.content}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {item.isRead ? (
                          <button onClick={() => markAsUnread(item.id)} className="notif-action-btn ghost">
                            <RotateCcw size={11} /> No leída
                          </button>
                        ) : (
                          <button onClick={() => markAsRead(item.id)} className="notif-action-btn">
                            <Check size={12} /> Marcar leída
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenTradeDetail(item.id)}
                          className="notif-action-btn"
                          style={{ background: 'var(--bg-tertiary)' }}
                        >
                          Ver en Cambios
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado vacío si no hay ninguna notificación en el filtro seleccionado */}
          {displayedNotifications.length === 0 && (
            <div style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              border: '1px dashed var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Inbox size={28} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {activeFilter === 'unread' ? '¡Estás completamente al día!' : 'No hay notificaciones'}
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                {activeFilter === 'unread' 
                  ? 'No tienes notificaciones pendientes por leer.' 
                  : 'No hay mensajes ni avisos operativos para mostrar.'}
              </p>
              {activeFilter === 'unread' && totalCount > 0 && (
                <button 
                  onClick={() => setActiveFilter('all')}
                  className="btn btn-secondary"
                  style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.74rem' }}
                >
                  Ver historial completo ({totalCount})
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
