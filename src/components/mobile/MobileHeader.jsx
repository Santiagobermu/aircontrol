import { useState, useEffect } from 'react';
import { Radio, Clock, Bell, RefreshCw } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { useNotifications } from '../../utils/useNotifications';
import NotificationCenterModal from '../NotificationCenterModal';

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

  // Hook centralizado para cálculo de notificaciones, conteos y estado leído/no leído
  const notificationsState = useNotifications({
    currentUser,
    manualAlerts,
    trades,
    userRole
  });

  const { unreadCount } = notificationsState;

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
              border: unreadCount > 0 ? '1px solid var(--status-warning)' : '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.4rem',
              color: unreadCount > 0 ? 'var(--status-warning)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            title={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Centro de Notificaciones'}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
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
                lineHeight: 1,
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Modal Bottom Sheet del Centro de Notificaciones */}
      <NotificationCenterModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        notificationsState={notificationsState}
        onTabSelect={onTabSelect}
      />
    </>
  );
}
