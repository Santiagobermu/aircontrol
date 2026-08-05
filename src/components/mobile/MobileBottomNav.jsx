import { Calendar, Radio, RefreshCw, AlertTriangle, User } from 'lucide-react';

export default function MobileBottomNav({ activeTab, onTabSelect, pendingTradesCount = 0 }) {
  const navItems = [
    { id: 'roster', label: 'Mi Roster', icon: Calendar },
    { id: 'guardia', label: 'En Turno', icon: Radio },
    { id: 'trades', label: 'Cambios', icon: RefreshCw, badge: pendingTradesCount },
    { id: 'notams', label: 'NOTAMs', icon: AlertTriangle },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`mobile-nav-tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabSelect(item.id)}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icon size={20} />
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  fontSize: '0.55rem',
                  fontWeight: '800',
                  borderRadius: '99px',
                  padding: '0.05rem 0.25rem',
                  lineHeight: 1
                }}>
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
