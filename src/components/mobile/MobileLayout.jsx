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
  onRejectTrade,
  onUpdateController
}) {
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'guardia' | 'trades' | 'notams' | 'profile'
  const [tradeInitialData, setTradeInitialData] = useState({ date: '', type: 'COVER' });

  const handleOpenTradeForDate = (dateStr, type = 'COVER') => {
    setTradeInitialData({ date: dateStr || '', type: type || 'COVER' });
    setActiveTab('trades');
  };

  const pendingTradesCount = trades.filter(t => t.status === 'pending' && (t.targetSignature === currentUser?.signature || t.isPublic)).length;

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
            onAddTrade={onAddTrade}
            onAcceptTrade={onAcceptTrade}
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
