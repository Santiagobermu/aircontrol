import { useState, useEffect } from 'react';
import { Radio, Clock, Bell, X, AlertTriangle, ArrowRightLeft, Trash2, Megaphone, RefreshCw } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { deleteManualAlertDB } from '../../utils/db';

export default function MobileHeader({ 
  currentUser, 
  onTabSelect, 
  trades = [], 
  manualAlerts = [],
  userRole = 'controller'
}) {
  const [utcTime, setUtcTime] = useState('');
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds} UTC`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const initials = currentUser?.signature || currentUser?.name?.slice(0, 3)?.toUpperCase() || 'ATC';

  const isSameCtrl = (ctrlA, ctrlB) => {
    if (!ctrlA || !ctrlB) return false;
    const sigA = (typeof ctrlA === 'string' ? ctrlA : (ctrlA.signature || ctrlA.id || ctrlA.name || '')).toString().trim().toUpperCase();
    const sigB = (typeof ctrlB === 'string' ? ctrlB : (ctrlB.signature || ctrlB.id || ctrlB.name || '')).toString().trim().toUpperCase();
    if (sigA && sigB && sigA === sigB) return true;
    const idA = (typeof ctrlA === 'object' ? (ctrlA.id || ctrlA.signature) : ctrlA).toString().trim().toUpperCase();
    const idB = (typeof ctrlB === 'object' ? (ctrlB.id || ctrlB.signature) : ctrlB).toString().trim().toUpperCase();
    return idA && idB && idA === idB;
  };

  const isEncargado = userRole === 'admin' || currentUser?.isSupervisor || currentUser?.isAdmin || (currentUser?.skills && currentUser.skills.includes('CTE'));

  // 1. Filtrar solicitudes de permuta pendientes dirigidas al usuario o públicas
  const pendingTrades = trades.filter(t => {
    const isTargetMe = isSameCtrl(t.targetSignature || t.toControllerSignature || t.toControllerId, currentUser);
    const isOpen = Boolean(t.isPublic || t.targetSignature === 'OPEN' || t.toControllerId === 'OPEN');
    const isPendingPeer = (t.status === 'pending' || t.status === 'PENDIENTE_ACEPTACION' || !t.status) && (isTargetMe || isOpen);
    const isPendingAdmin = t.status === 'PENDIENTE_APROBACION' && isEncargado;
    return isPendingPeer || isPendingAdmin;
  });

  // 2. Filtrar mensajes del encargado de turno / alertas manuales activas
  const now = new Date();
  const activeManualAlerts = manualAlerts.filter(a => {
    if (!a.expiresAt) return true;
    return new Date(a.expiresAt) > now;
  });

  // Contador total solo de solicitudes de cambio de turno o mensajes del encargado
  const totalNotificationBadgeCount = pendingTrades.length + activeManualAlerts.length;

  const handleDeleteAlert = async (id) => {
    if (window.confirm('¿Deseas eliminar esta alerta del turno?')) {
      await deleteManualAlertDB(id);
    }
  };

  const handleRefreshApp = () => {
    window.location.reload();
  };

  return (
    <>
      <header className="mobile-header-bar">
        <div className="mobile-header-brand">
          <div className="mobile-header-logo">
            <Radio size={20} className="pulse-animation" />
          </div>
          <div>
            <h1 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              AirControl <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>SKBO</span>
            </h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {initials} · Torre El Dorado
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Reloj UTC */}
          <div className="utc-clock-badge">
            <Clock size={13} />
            <span>{utcTime}</span>
          </div>

          {/* Botón Refrescar */}
          <button
            onClick={handleRefreshApp}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.35rem',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Refrescar datos de la aplicación"
          >
            <RefreshCw size={14} />
          </button>

          <ThemeToggle 
            style={{ 
              padding: '0.35rem 0.55rem', 
              borderRadius: '8px', 
              fontSize: '0.7rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)' 
            }} 
          />

          {/* Botón de Campana de Notificaciones */}
          <button 
            onClick={() => setIsAlertsModalOpen(true)}
            style={{
              position: 'relative',
              background: 'var(--bg-tertiary)',
              border: totalNotificationBadgeCount > 0 ? '1px solid var(--status-warning)' : '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.4rem',
              color: totalNotificationBadgeCount > 0 ? 'var(--status-warning)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Ver Avisos y Notificaciones"
          >
            <Bell size={17} />
            {totalNotificationBadgeCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--status-warning)',
                color: '#000',
                fontSize: '0.62rem',
                fontWeight: '800',
                borderRadius: '99px',
                padding: '0.05rem 0.35rem',
                lineHeight: 1
              }}>
                {totalNotificationBadgeCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Modal Bottom Sheet de Avisos y Notificaciones Operativas */}
      {isAlertsModalOpen && (
        <div className="bottom-sheet-backdrop" onClick={() => setIsAlertsModalOpen(null)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bell size={18} color="var(--status-warning)" />
                Centro de Notificaciones Operativas
              </h3>
              <button 
                onClick={() => setIsAlertsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* 1. MENSAJES DEL ENCARGADO DE TURNO */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: '800', margin: '0 0 0.5rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Megaphone size={15} />
                  Mensajes del Encargado de Turno ({activeManualAlerts.length})
                </h4>

                {activeManualAlerts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeManualAlerts.map((alert, idx) => (
                      <div key={idx} style={{
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                            📢 {alert.createdBy || 'Supervisor de Guardia'}
                          </span>
                          {isEncargado && (
                            <button
                              onClick={() => handleDeleteAlert(alert.id)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', padding: 0 }}
                              title="Eliminar aviso"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                          {alert.content}
                        </p>
                        {alert.createdAt && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                            Publicado: {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                    No hay mensajes nuevos del encargado de turno en este momento.
                  </p>
                )}
              </div>

              {/* 2. SOLICITUDES DE CAMBIO DE TURNO PENDIENTES */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: '800', margin: '0 0 0.5rem', color: 'var(--status-warning)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowRightLeft size={15} />
                  Solicitudes de Permuta Pendientes ({pendingTrades.length})
                </h4>

                {pendingTrades.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pendingTrades.map((trade, idx) => (
                      <div key={idx} style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>
                            {trade.requesterName || trade.requesterSignature} solicita permuta
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            Fecha: {trade.dateStr} · Turno: {trade.requesterShift}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setIsAlertsModalOpen(false);
                            onTabSelect('trades');
                          }}
                          className="btn btn-primary"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: '700' }}
                        >
                          Ver Solicitud
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                    No tienes solicitudes de cambio de turno pendientes.
                  </p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
