import { useState } from 'react';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import MobileRosterView from './MobileRosterView';
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
  notamsData = { notams: [], adClosedNotams: [], flowNotams: [], ashtamNotams: [] },
  manualAlerts = [],
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
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'guardia' | 'trades' | 'notams' | 'profile'
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

  const handleOpenTradeForDate = (dateStr, type = 'COVER') => {
    setTradeInitialData({ date: dateStr || '', type: type || 'COVER' });
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
          <MobileRosterView 
            currentUser={currentUser}
            scheduleMonth={scheduleMonth}
            exceptions={exceptions}
            controllers={controllers}
            onOpenTradeModal={handleOpenTradeForDate}
            onUpdateController={onUpdateController}
          />
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
