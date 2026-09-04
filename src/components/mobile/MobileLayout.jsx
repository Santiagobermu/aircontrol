import { useState } from 'react';
import { Calendar, Users } from 'lucide-react';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import MobileRosterView from './MobileRosterView';
import MobileGeneralRosterView from './MobileGeneralRosterView';
import MobileGuardiaView from './MobileGuardiaView';
import MobileTradesView from './MobileTradesView';
import MobileNotamsView from './MobileNotamsView';
import MobileProfileView from './MobileProfileView';

export default function MobileLayout({
  currentUser,
  scheduleMonth,
  exceptions = {},
  controllers,
  trades = [],
  publishState = {},
  notamsData = { notams: [], adClosedNotams: [], flowNotams: [], ashtamNotams: [] },
  manualAlerts = [],
  controllerNotes = {},
  onSaveNote,
  onDeleteNote,
  userRole = 'controller',
  onLogout,
  onChangePassword,
  onOpenTradeModal,
  onAddTrade,
  onAcceptTrade,
  onApproveTrade,
  onRejectTrade,
  onUpdateController
}) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['roster', 'guardia', 'trades', 'notams', 'profile'].includes(tab)) {
        return tab;
      }
    }
    return 'roster';
  });
  const [rosterSubTab, setRosterSubTab] = useState('personal'); // 'personal' | 'general'
  const [tradeInitialData, setTradeInitialData] = useState({ date: '', type: 'COVER' });

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

  const handleOpenTradeForDate = (dateStr, type = 'COVER', extraOptions = {}) => {
    setTradeInitialData({ date: dateStr || '', type: type || 'COVER', ...extraOptions });
    setActiveTab('trades');
  };

  const pendingTradesCount = trades.filter(t => {
    const isPendingPeer = (t.status === 'pending' || t.status === 'PENDIENTE_ACEPTACION' || !t.status) && 
      (isSameCtrl(t.targetSignature || t.toControllerSignature || t.toControllerId, currentUser) || t.isPublic);
    const isPendingAdmin = t.status === 'PENDIENTE_APROBACION' && isEncargado;
    return isPendingPeer || isPendingAdmin;
  }).length;

  return (
    <div className="mobile-app-wrapper">
      {/* Header Superior Móvil */}
      <MobileHeader 
        currentUser={currentUser} 
        onTabSelect={setActiveTab}
        trades={trades}
        manualAlerts={manualAlerts}
        userRole={userRole}
      />

      {/* Cuerpo Principal según pestaña activa */}
      <main style={{ flex: 1, paddingBottom: '1rem' }}>
        {activeTab === 'roster' && (
          <div style={{ padding: '0.8rem 1rem 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {/* Switcher Superior: Mi Roster / Roster General */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '0.25rem',
              border: '1px solid var(--glass-border)'
            }}>
              <button
                onClick={() => setRosterSubTab('personal')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  border: 'none',
                  borderRadius: '9px',
                  background: rosterSubTab === 'personal' ? 'var(--accent-cyan)' : 'transparent',
                  color: rosterSubTab === 'personal' ? '#000' : 'var(--text-secondary)',
                  fontWeight: '800',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Calendar size={16} />
                Mi Roster
              </button>
              <button
                onClick={() => setRosterSubTab('general')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  border: 'none',
                  borderRadius: '9px',
                  background: rosterSubTab === 'general' ? 'var(--accent-cyan)' : 'transparent',
                  color: rosterSubTab === 'general' ? '#000' : 'var(--text-secondary)',
                  fontWeight: '800',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Users size={16} />
                Roster General
              </button>
            </div>

            {/* Vista según sub-tab */}
            {rosterSubTab === 'personal' ? (
              <MobileRosterView 
                currentUser={currentUser}
                scheduleMonth={scheduleMonth}
                exceptions={exceptions}
                controllers={controllers}
                controllerNotes={controllerNotes}
                onSaveNote={onSaveNote}
                onDeleteNote={onDeleteNote}
                onOpenTradeModal={handleOpenTradeForDate}
                onUpdateController={onUpdateController}
              />
            ) : (
              <MobileGeneralRosterView
                currentUser={currentUser}
                scheduleMonth={scheduleMonth}
                exceptions={exceptions}
                controllers={controllers}
                publishState={publishState}
                userRole={userRole}
                onOpenTradeModal={handleOpenTradeForDate}
              />
            )}
          </div>
        )}

        {activeTab === 'guardia' && (
          <MobileGuardiaView 
            scheduleMonth={scheduleMonth}
            controllers={controllers}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'trades' && (
          <MobileTradesView 
            currentUser={currentUser}
            trades={trades}
            controllers={controllers}
            scheduleMonth={scheduleMonth}
            initialTradeData={tradeInitialData}
            userRole={userRole}
            onAddTrade={onAddTrade}
            onAcceptTrade={onAcceptTrade}
            onApproveTrade={onApproveTrade}
            onRejectTrade={onRejectTrade}
          />
        )}

        {activeTab === 'notams' && (
          <MobileNotamsView 
            notamsData={notamsData}
            currentUser={currentUser}
            userRole={userRole}
          />
        )}

        {activeTab === 'profile' && (
          <MobileProfileView 
            currentUser={currentUser}
            userRole={userRole}
            scheduleMonth={scheduleMonth}
            exceptions={exceptions}
            onLogout={onLogout}
            onChangePassword={onChangePassword}
            onUpdateController={onUpdateController}
          />
        )}
      </main>

      {/* Navegación Inferior Móvil (Bottom Nav Bar) */}
      <MobileBottomNav 
        activeTab={activeTab} 
        onTabSelect={setActiveTab}
        pendingTradesCount={pendingTradesCount}
      />
    </div>
  );
}
