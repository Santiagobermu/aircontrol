import { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  User, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  ChevronRight, 
  UserCheck, 
  UserX, 
  BookOpen 
} from 'lucide-react';
import { getSlotAcronym, getSlotDescription } from '../utils/schedulerEngine';

// Helper function outside component to avoid impure calls during render analysis
function generateSettleTrade(debtorId, creditorId) {
  return {
    id: `trade-settle-${Date.now()}`,
    date: new Date().toISOString().substring(0, 10),
    type: 'COVER_SETTLE',
    fromControllerId: creditorId, // B le cede virtualmente para netear
    toControllerId: debtorId,    // A recibe virtualmente para netear
    fromSlot: null,
    toSlot: null,
    status: 'APROBADO' // Aprobada automáticamente al crearse ya que es virtual
  };
}

export default function TradePanel({ 
  controllers, 
  schedule, 
  trades, 
  onAddTrade, 
  onDeleteTrade, 
  onApproveTrade,
  userRole
}) {
  const [type, setType] = useState('SWAP'); // 'SWAP' | 'COVER'
  const [date, setDate] = useState('');
  const [ctrlAId, setCtrlAId] = useState('');
  const [slotAKey, setSlotAKey] = useState(''); // "shift|slotKey"
  const [ctrlBId, setCtrlBId] = useState('');
  const [slotBKey, setSlotBKey] = useState(''); // "shift|slotKey" (solo para SWAP)

  // 1. Obtener los turnos programados reales del controlador A en la fecha seleccionada
  const ctrlASlots = useMemo(() => {
    if (!date || !ctrlAId || !schedule[date]) return [];
    
    const list = [];
    const shifts = ['M', 'T', 'N', 'A'];
    shifts.forEach(shift => {
      const slots = schedule[date][shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === ctrlAId) {
          list.push({ shift, slotKey });
        }
      });
    });
    return list;
  }, [date, ctrlAId, schedule]);

  // 2. Obtener los turnos programados reales del controlador B en la fecha seleccionada (para SWAP)
  const ctrlBSlots = useMemo(() => {
    if (!date || !ctrlBId || !schedule[date] || type !== 'SWAP') return [];
    
    const list = [];
    const shifts = ['M', 'T', 'N', 'A'];
    shifts.forEach(shift => {
      const slots = schedule[date][shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === ctrlBId) {
          list.push({ shift, slotKey });
        }
      });
    });

    const ctrlA = controllers.find(c => c.id === ctrlAId);
    if (!ctrlA) return [];

    return list.filter(s => {
      const posB = s.slotKey.split('-')[0];
      if (posB === 'ENT') {
        return !!ctrlA.trainingPreferred;
      }
      return ctrlA.skills && ctrlA.skills.includes(posB);
    });
  }, [date, ctrlBId, schedule, type, ctrlAId, controllers]);

  // Filtrar controladores activos y excluir a A de las opciones de B
  const activeControllers = useMemo(() => {
    return controllers.filter(c => c.active);
  }, [controllers]);

  const controllersForB = useMemo(() => {
    let list = activeControllers.filter(c => c.id !== ctrlAId);
    if (slotAKey) {
      const parts = slotAKey.split('|');
      const keyA = parts[1] || parts[0];
      const posA = keyA.split('-')[0];
      
      list = list.filter(c => {
        if (posA === 'ENT') {
          return !!c.trainingPreferred;
        }
        return c.skills && c.skills.includes(posA);
      });
    }
    return list;
  }, [activeControllers, ctrlAId, slotAKey]);

  // 3. Registrar una solicitud
  const handleRegisterTrade = (e) => {
    e.preventDefault();
    if (!date || !ctrlAId || !ctrlBId || !slotAKey) return;
    if (type === 'SWAP' && !slotBKey) return;

    const [shiftA, keyA] = slotAKey.split('|');
    let shiftB = '';
    let keyB = '';
    
    if (type === 'SWAP') {
      const parts = slotBKey.split('|');
      shiftB = parts[0];
      keyB = parts[1];
    }

    // Validar habilidades de B para el slot de A
    const posA = keyA.split('-')[0];
    const ctrlB = controllers.find(c => c.id === ctrlBId);
    if (posA !== 'ENT' && (!ctrlB || !ctrlB.skills || !ctrlB.skills.includes(posA))) {
      alert(`El controlador ${ctrlB?.name || ctrlBId} no cuenta con la habilitación en ${posA} para cubrir este slot.`);
      return;
    }

    // Validar habilidades de A para el slot de B (en caso de SWAP)
    if (type === 'SWAP') {
      const posB = keyB.split('-')[0];
      const ctrlA = controllers.find(c => c.id === ctrlAId);
      if (posB !== 'ENT' && (!ctrlA || !ctrlA.skills || !ctrlA.skills.includes(posB))) {
        alert(`El controlador ${ctrlA?.name || ctrlAId} no cuenta con la habilitación en ${posB} para cubrir el slot del compañero.`);
        return;
      }
    }

    const tradeId = `trade-${Date.now()}`;
    const newTrade = {
      id: tradeId,
      date,
      type,
      fromControllerId: ctrlAId,
      toControllerId: ctrlBId,
      fromSlot: { shift: shiftA, slotKey: keyA },
      toSlot: type === 'SWAP' ? { shift: shiftB, slotKey: keyB } : null,
      status: userRole === 'admin' || userRole === 'supervisor' ? 'PENDIENTE_APROBACION' : 'PENDIENTE'
    };

    onAddTrade(newTrade);

    // Resetear form local
    setCtrlAId('');
    setSlotAKey('');
    setCtrlBId('');
    setSlotBKey('');
  };

  // 4. Calcular Balances de Deudas y Devoluciones
  const debtBalances = useMemo(() => {
    const balances = {};

    // Inicializar matriz de pares
    controllers.forEach(c1 => {
      controllers.forEach(c2 => {
        if (c1.id < c2.id) {
          const pairKey = `${c1.id}_${c2.id}`;
          balances[pairKey] = {
            ctrl1: c1.id,
            ctrl2: c2.id,
            balance: 0 // Positivo: ctrl1 le debe a ctrl2. Negativo: ctrl2 le debe a ctrl1
          };
        }
      });
    });

    trades.forEach(t => {
      if (t.type === 'COVER' && t.status === 'APROBADO') {
        // En un COVER aprobado, 'toControllerId' (B) cubre a 'fromControllerId' (A).
        // Por lo tanto, A le debe un turno a B.
        // fromControllerId -> Deudor, toControllerId -> Acreedor
        const id1 = t.fromControllerId;
        const id2 = t.toControllerId;

        if (id1 !== id2) {
          const pairKey = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
          if (balances[pairKey]) {
            if (id1 < id2) {
              balances[pairKey].balance += 1; // ctrl1 (id1) debe a ctrl2 (id2)
            } else {
              balances[pairKey].balance -= 1; // ctrl2 (id1) debe a ctrl1 (id2)
            }
          }
        }
      }

      if (t.type === 'COVER_SETTLE' && t.status === 'APROBADO') {
        // En una Devolución (COVER_SETTLE) aprobada, el balance se reduce.
        // deudor (A) le cede virtualmente un turno al acreedor (B).
        // fromControllerId es el Acreedor original (que cede virtualmente), toControllerId es el Deudor (que recibe virtualmente).
        const creditorId = t.fromControllerId;
        const debtorId = t.toControllerId;

        if (debtorId !== creditorId) {
          const pairKey = debtorId < creditorId ? `${debtorId}_${creditorId}` : `${creditorId}_${debtorId}`;
          if (balances[pairKey]) {
            if (debtorId < creditorId) {
              balances[pairKey].balance -= 1; // Se reduce la deuda de ctrl1 (debtorId) hacia ctrl2 (creditorId)
            } else {
              balances[pairKey].balance += 1; // Se reduce la deuda de ctrl2 (debtorId) hacia ctrl1 (creditorId)
            }
          }
        }
      }
    });

    return Object.values(balances).filter(b => b.balance !== 0).map(b => {
      const c1Name = controllers.find(c => c.id === b.ctrl1)?.name || b.ctrl1;
      const c2Name = controllers.find(c => c.id === b.ctrl2)?.name || b.ctrl2;

      return {
        ...b,
        debtorId: b.balance > 0 ? b.ctrl1 : b.ctrl2,
        debtorName: b.balance > 0 ? c1Name : c2Name,
        creditorId: b.balance > 0 ? b.ctrl2 : b.ctrl1,
        creditorName: b.balance > 0 ? c2Name : c1Name,
        amount: Math.abs(b.balance)
      };
    });
  }, [trades, controllers]);

  // 5. Saldar deuda de forma virtual
  const handleSettleDebt = (debtorId, creditorId) => {
    // Al hacer clic, registramos una transacción COVER_SETTLE virtual
    // donde el deudor (A) le cede un turno virtual al acreedor (B) para neutralizar el balance
    const settleTrade = generateSettleTrade(debtorId, creditorId);

    onAddRequestSettle(settleTrade);
  };

  // Wrapper para inyectar la transacción COVER_SETTLE directamente al flujo de trades
  const onAddRequestSettle = (newTrade) => {
    onAddTrade(newTrade);
  };

  const getDaySimpleName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dayNames[date.getDay()];
  };

  const formatCalendarDayName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${getDaySimpleName(dateStr)} (${date.getDate()} ${monthNamesShort[date.getMonth()]})`;
  };

  // Agrupar trades
  const pendingTrades = useMemo(() => trades.filter(t => t.status === 'PENDIENTE_APROBACION'), [trades]);
  const approvedTrades = useMemo(() => trades.filter(t => t.status === 'APROBADO' && t.type !== 'COVER_SETTLE'), [trades]);

  return (
    <div className="dashboard-grid">
      
      {/* Columna Izquierda: Formulario e Historial */}
      {userRole === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Formulario */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <RefreshCw size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem' }}>
              Registrar Cambio de Turno
            </h3>
          </div>

          <form onSubmit={handleRegisterTrade} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Tipo de cambio */}
            <div className="form-group">
              <label>Tipo de Operación</label>
              <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setType('SWAP')}
                  className={`filter-btn ${type === 'SWAP' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: '700' }}
                >
                  Intercambio (SWAP)
                </button>
                <button
                  type="button"
                  onClick={() => setType('COVER')}
                  className={`filter-btn ${type === 'COVER' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: '700' }}
                >
                  Hacer el Turno (COVER)
                </button>
              </div>
            </div>

            {/* Fecha */}
            <div className="form-group">
              <label htmlFor="trade-date" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CalendarIcon size={14} /> Fecha del Cambio
              </label>
              <input
                id="trade-date"
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Controlador A (Solicitante) */}
            <div className="form-group">
              <label htmlFor="ctrl-a" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={14} /> Controlador A (Cede / Cambia)
              </label>
              <select
                id="ctrl-a"
                className="form-input"
                value={ctrlAId}
                onChange={(e) => {
                  setCtrlAId(e.target.value);
                  setSlotAKey('');
                }}
                required
              >
                <option value="">-- Selecciona Controlador A --</option>
                {activeControllers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Turnos Programados Reales de A */}
            {ctrlAId && date && (
              <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                <label htmlFor="slot-a" style={{ color: 'var(--accent-cyan)' }}>Turno Programado de A hoy:</label>
                {ctrlASlots.length > 0 ? (
                  <select
                    id="slot-a"
                    className="form-input"
                    value={slotAKey}
                    onChange={(e) => setSlotAKey(e.target.value)}
                    required
                    style={{ borderColor: 'var(--accent-cyan)' }}
                  >
                    <option value="">-- Selecciona el slot a entregar --</option>
                    {ctrlASlots.map(s => (
                      <option key={`${s.shift}|${s.slotKey}`} value={`${s.shift}|${s.slotKey}`}>
                        {s.shift === 'A' ? 'Madrugada (A)' : s.shift === 'M' ? 'Mañana (M)' : s.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} - {getSlotDescription(s.slotKey)} ({getSlotAcronym(s.slotKey)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', margin: 0, fontStyle: 'italic' }}>
                    * El controlador A no tiene turnos programados en esta fecha.
                  </p>
                )}
              </div>
            )}

            {/* Controlador B (Aceptante) */}
            <div className="form-group">
              <label htmlFor="ctrl-b" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={14} /> Controlador B (Cubre / Recibe)
              </label>
              <select
                id="ctrl-b"
                className="form-input"
                value={ctrlBId}
                onChange={(e) => {
                  setCtrlBId(e.target.value);
                  setSlotBKey('');
                }}
                required
                disabled={!ctrlAId}
              >
                <option value="">-- Selecciona Controlador B --</option>
                {controllersForB.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Turnos Programados Reales de B (Solo para SWAP) */}
            {type === 'SWAP' && ctrlBId && date && (
              <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                <label htmlFor="slot-b" style={{ color: 'var(--accent-indigo)' }}>Turno Programado de B hoy:</label>
                {ctrlBSlots.length > 0 ? (
                  <select
                    id="slot-b"
                    className="form-input"
                    value={slotBKey}
                    onChange={(e) => setSlotBKey(e.target.value)}
                    required
                    style={{ borderColor: 'var(--accent-indigo)' }}
                  >
                    <option value="">-- Selecciona el slot de B para intercambiar --</option>
                    {ctrlBSlots.map(s => (
                      <option key={`${s.shift}|${s.slotKey}`} value={`${s.shift}|${s.slotKey}`}>
                        {s.shift === 'A' ? 'Madrugada (A)' : s.shift === 'M' ? 'Mañana (M)' : s.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} - {getSlotDescription(s.slotKey)} ({getSlotAcronym(s.slotKey)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', margin: 0, fontStyle: 'italic' }}>
                    * El controlador B no tiene turnos programados en esta fecha para realizar un intercambio.
                  </p>
                )}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontWeight: '700' }}
              disabled={!ctrlAId || !ctrlBId || !date || !slotAKey || (type === 'SWAP' && !slotBKey)}
            >
              Registrar Solicitud
            </button>
          </form>
        </div>

      </div>
      )}

      {/* Columna Derecha: Libro de Deudas y Listados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Libro de Deudas */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <BookOpen size={22} style={{ color: 'var(--accent-fic)' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem' }}>
              Libro de Deudas (Saldos de Turnos)
            </h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
            Listado de turnos cubiertos entre controladores. Se calcula dinámicamente el balance neto acumulado:
          </p>

          {debtBalances.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {debtBalances.map((b) => (
                <div 
                  key={`${b.ctrl1}|${b.ctrl2}`} 
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.02)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {b.debtorName} <ChevronRight size={12} style={{ display: 'inline', margin: '0 0.25rem', color: 'var(--status-warning)' }} /> {b.creditorName}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Debe: <strong style={{ color: 'var(--status-warning)' }}>{b.amount} {b.amount === 1 ? 'turno' : 'turnos'}</strong>
                    </span>
                  </div>

                  <button
                    onClick={() => handleSettleDebt(b.debtorId, b.creditorId)}
                    className="btn"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--status-success)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '6px'
                    }}
                  >
                    Saldar 1 Turno
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-tertiary)' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--status-success)' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Todos los saldos de turnos están balanceados (0 deudas).
              </p>
            </div>
          )}
        </div>

        {/* Solicitudes Pendientes */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <RefreshCw size={22} style={{ color: 'var(--accent-indigo)' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Solicitudes Pendientes
              <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-indigo)', padding: '0.15rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.15)' }}>
                {pendingTrades.length} pendientes
              </span>
            </h3>
          </div>

          {pendingTrades.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '250px', overflowY: 'auto' }}>
              {pendingTrades.map((t) => {
                const ctrlA = controllers.find(c => c.id === t.fromControllerId);
                const ctrlB = controllers.find(c => c.id === t.toControllerId);
                
                return (
                  <div 
                    key={t.id} 
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        backgroundColor: t.type === 'SWAP' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: t.type === 'SWAP' ? 'var(--accent-cyan)' : 'var(--accent-fic)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        fontWeight: '800'
                      }}>
                        {t.type === 'SWAP' ? 'INTERCAMBIO (SWAP)' : 'REEMPLAZO (COVER)'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                        {formatCalendarDayName(t.date)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4', margin: '0.2rem 0' }}>
                      {t.type === 'SWAP' ? (
                        <>
                          <strong>{ctrlA?.name || t.fromControllerId}</strong> cede <em>{t.fromSlot.shift} - {getSlotDescription(t.fromSlot.slotKey)}</em> e intercambia por <em>{t.toSlot.shift} - {getSlotDescription(t.toSlot.slotKey)}</em> de <strong>{ctrlB?.name || t.toControllerId}</strong>.
                        </>
                      ) : (
                        <>
                          <strong>{ctrlB?.name || t.toControllerId}</strong> asume el turno de <em>{t.fromSlot.shift} - {getSlotDescription(t.fromSlot.slotKey)}</em> original de <strong>{ctrlA?.name || t.fromControllerId}</strong> (SMG cede, SBG hace el turno).
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        onClick={() => onApproveTrade(t.id)}
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                      >
                        <UserCheck size={14} /> Aprobar y Ejecutar
                      </button>
                      <button
                        onClick={() => onDeleteTrade(t.id)}
                        className="btn btn-danger-outline"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <UserX size={14} /> Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
              No hay solicitudes de cambios de turno pendientes de aprobación.
            </p>
          )}
        </div>

        {/* Historial Aprobado */}
        {approvedTrades.length > 0 && (
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <CheckCircle2 size={22} style={{ color: 'var(--status-success)' }} />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem' }}>
                Historial de Cambios Aprobados
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
              {approvedTrades.map((t) => {
                const ctrlA = controllers.find(c => c.id === t.fromControllerId);
                const ctrlB = controllers.find(c => c.id === t.toControllerId);
                
                return (
                  <div 
                    key={t.id} 
                    style={{
                      borderLeft: t.type === 'SWAP' ? '3px solid var(--accent-cyan)' : '3px solid var(--accent-fic)',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid var(--color-border)',
                      borderLeftWidth: '3px',
                      borderRadius: '8px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: '700' }}>{t.type}</span>
                      <span>{t.date}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {t.type === 'SWAP' ? (
                        <>
                          <strong>{ctrlA?.name || t.fromControllerId}</strong> 🔄 <strong>{ctrlB?.name || t.toControllerId}</strong> ({t.fromSlot.shift} por {t.toSlot.shift})
                        </>
                      ) : (
                        <>
                          <strong>{ctrlB?.name || t.toControllerId}</strong> cubrió a <strong>{ctrlA?.name || t.fromControllerId}</strong> ({t.fromSlot.shift})
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
