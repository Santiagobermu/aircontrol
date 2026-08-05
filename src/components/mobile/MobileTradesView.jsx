import { useState } from 'react';
import { RefreshCw, CheckCircle2, Clock, XCircle, Plus, ArrowRightLeft, ShieldCheck, X, User } from 'lucide-react';
import { getSlotAcronym } from '../../utils/schedulerEngine';

export default function MobileTradesView({ 
  currentUser, 
  trades = [], 
  controllers = [],
  scheduleMonth = {},
  onAddTrade,
  onAcceptTrade,
  onRejectTrade 
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'approved'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados del Formulario de Nuevo Cambio
  const [tradeType, setTradeType] = useState('SWAP'); // 'SWAP' | 'COVER'
  const [tradeDate, setTradeDate] = useState('');
  const [selectedMyShift, setSelectedMyShift] = useState('');
  const [selectedColleagueSig, setSelectedColleagueSig] = useState('OPEN');
  const [tradeComment, setTradeComment] = useState('');

  // Obtenemos los turnos del usuario para la fecha seleccionada en el formulario
  const getMyShiftsForDate = (dateStr) => {
    if (!dateStr || !scheduleMonth || !scheduleMonth[dateStr] || !currentUser) return [];
    const daySched = scheduleMonth[dateStr];
    const ctrlId = currentUser.id || currentUser.signature;
    const myShifts = [];

    ['M', 'T', 'N', 'A'].forEach(shift => {
      const slots = daySched[shift] || {};
      Object.entries(slots).forEach(([slotKey, assignedId]) => {
        if (assignedId && (assignedId === ctrlId || assignedId === currentUser.signature)) {
          const acronym = getSlotAcronym(slotKey, shift);
          myShifts.push({
            shift,
            slotKey,
            fullCode: `${shift}${acronym}`
          });
        }
      });
    });
    return myShifts;
  };

  const myAvailableShifts = getMyShiftsForDate(tradeDate);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!tradeDate || !selectedMyShift) {
      alert('Por favor selecciona la fecha y tu turno a ceder.');
      return;
    }

    const targetCtrl = controllers.find(c => c.signature === selectedColleagueSig);
    const newTradeObj = {
      id: `trade_${Date.now()}`,
      type: tradeType,
      dateStr: tradeDate,
      date: tradeDate,
      requesterSignature: currentUser?.signature || 'ATC',
      requesterName: currentUser?.name || 'Controlador',
      requesterShift: selectedMyShift,
      targetSignature: selectedColleagueSig === 'OPEN' ? 'Abierta' : selectedColleagueSig,
      targetName: selectedColleagueSig === 'OPEN' ? 'Abierta a cualquier compañero' : (targetCtrl ? targetCtrl.name : selectedColleagueSig),
      targetShift: tradeType === 'COVER' ? 'Reemplazo' : 'Por acordar',
      isPublic: selectedColleagueSig === 'OPEN',
      comment: tradeComment.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    if (onAddTrade) {
      await onAddTrade(newTradeObj);
    }
    
    setIsModalOpen(false);
    setTradeDate('');
    setSelectedMyShift('');
    setTradeComment('');
    alert('¡Solicitud de cambio registrada exitosamente!');
  };

  // 1. Mapeo y Normalización unificada de campos (Soporta esquema Desktop y Móvil)
  const normalizedTrades = trades.map(t => {
    const fromSig = t.requesterSignature || t.fromControllerSignature || t.fromControllerId || t.requesterId || '';
    const fromName = t.requesterName || t.fromControllerName || controllers.find(c => c.id === fromSig || c.signature === fromSig)?.name || (fromSig ? fromSig : 'Solicitante');
    const fromShift = t.requesterShift || t.fromShiftCode || t.fromShift || 'Turno';

    const toSig = t.targetSignature || t.toControllerSignature || t.toControllerId || t.targetId || 'OPEN';
    const toName = t.targetName || t.toControllerName || (toSig === 'OPEN' || toSig === 'ALL' || t.isPublic ? 'Abierta a cualquier compañero' : (controllers.find(c => c.id === toSig || c.signature === toSig)?.name || toSig));
    const toShift = t.targetShift || t.toShiftCode || t.toShift || (t.type === 'COVER' ? 'Reemplazo' : 'Por acordar');

    const isPublic = Boolean(t.isPublic || toSig === 'OPEN' || toSig === 'ALL' || !t.toControllerId);
    const dateStr = t.dateStr || t.date || '';

    const isPending = t.status === 'pending' || t.status === 'PENDIENTE_APROBACION' || t.status === 'PENDIENTE_ACEPTACION';
    const isApproved = t.status === 'approved' || t.status === 'APROBADO';
    const isRejected = t.status === 'rejected' || t.status === 'RECHAZADO';

    return {
      rawTrade: t,
      id: t.id,
      type: t.type || 'SWAP',
      dateStr,
      fromSig,
      fromName,
      fromShift,
      toSig,
      toName,
      toShift,
      isPublic,
      comment: t.comment || t.comments || '',
      status: isApproved ? 'approved' : isRejected ? 'rejected' : 'pending',
      rawStatus: t.status
    };
  }).filter(t => t.fromSig && t.fromSig.trim() !== ''); // Descartar solicitudes corruptas o sin solicitante

  // 2. Filtrar permutas/cambios estrictamente relevantes para el controlador logueado
  const userTrades = normalizedTrades.filter(t => {
    const mySig = currentUser?.signature;
    const myId = currentUser?.id;

    const isMyRequest = Boolean((mySig && t.fromSig === mySig) || (myId && t.fromSig === myId));
    const isTargetingMe = Boolean((mySig && t.toSig === mySig) || (myId && t.toSig === myId));
    const isOpenPending = Boolean(t.isPublic && t.status === 'pending');

    // Una solicitud solo debe mostrarse si la creó el usuario, va dirigida al usuario, o es una solicitud pública pendiente
    const isRelevant = isMyRequest || isTargetingMe || isOpenPending;
    if (!isRelevant) return false;

    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'approved') return t.status === 'approved';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return { label: 'Aprobado', color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 };
      case 'rejected':
        return { label: 'Rechazado', color: 'var(--status-danger)', bg: 'rgba(244, 63, 94, 0.15)', icon: XCircle };
      default:
        return { label: 'Pendiente', color: 'var(--status-warning)', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock };
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Encabezado y Acción Crear Cambio */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Gestión de Cambios</h2>
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Intercambios (SWAP) y Coberturas (COVER)</span>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{
            padding: '0.5rem 0.8rem',
            borderRadius: '10px',
            fontSize: '0.78rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <Plus size={16} />
          Nuevo cambio
        </button>
      </div>

      {/* Tabs de Filtro */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '0.2rem', border: '1px solid var(--glass-border)' }}>
        {[
          { id: 'all', label: 'Todos' },
          { id: 'pending', label: 'Pendientes' },
          { id: 'approved', label: 'Aprobados' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              flex: 1,
              padding: '0.45rem',
              border: 'none',
              borderRadius: '8px',
              background: filter === tab.id ? 'var(--accent-cyan)' : 'transparent',
              color: filter === tab.id ? '#000' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* LISTA DE TARJETAS DE CAMBIO (Limpia: Si no hay elementos, no muestra recuadros vacíos) */}
      {userTrades.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {userTrades.map((trade, idx) => {
            const statusInfo = getStatusBadge(trade.status);
            const StatusIcon = statusInfo.icon;
            const isTarget = (currentUser?.signature && trade.toSig === currentUser.signature) || (currentUser?.id && trade.toSig === currentUser.id);

            return (
              <div key={idx} style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '14px',
                padding: '0.9rem',
                boxShadow: 'var(--glass-shadow)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ArrowRightLeft size={16} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Fecha: {trade.dateStr || 'Sin fecha'}
                    </span>
                  </div>
                  <span style={{
                    background: statusInfo.bg,
                    color: statusInfo.color,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}>
                    <StatusIcon size={12} />
                    {statusInfo.label}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                  padding: '0.65rem',
                  borderRadius: '10px',
                  gap: '0.5rem',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Solicitante</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{trade.fromName}</strong>
                    <span style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: '800' }}>
                      {trade.fromShift}
                    </span>
                  </div>

                  <ArrowRightLeft size={16} color="var(--text-muted)" />

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Receptor</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{trade.toName}</strong>
                    <span style={{ display: 'block', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: '800' }}>
                      {trade.toShift}
                    </span>
                  </div>
                </div>

                {trade.comment && (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    "{trade.comment}"
                  </p>
                )}

                {/* Acciones para el receptor */}
                {isTarget && trade.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => onAcceptTrade && onAcceptTrade(trade.id)}
                      style={{
                        flex: 1,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid var(--status-success)',
                        color: 'var(--status-success)',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        fontWeight: '700',
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      Aceptar Cambio
                    </button>
                    <button
                      onClick={() => onRejectTrade && onRejectTrade(trade.id)}
                      style={{
                        flex: 1,
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid var(--status-danger)',
                        color: 'var(--status-danger)',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        fontWeight: '700',
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            No tienes solicitudes de cambio activas o relevantes en esta categoría.
          </p>
        </div>
      )}

      {/* BOTTOM SHEET MODAL DE FORMULARIO NUEVO CAMBIO */}
      {isModalOpen && (
        <div className="bottom-sheet-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowRightLeft size={18} color="var(--accent-cyan)" />
                Nueva Solicitud de Cambio
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tipo de Cambio */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Tipo de Solicitud
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <button
                    type="button"
                    onClick={() => setTradeType('SWAP')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: tradeType === 'SWAP' ? 'var(--accent-cyan)' : 'transparent',
                      color: tradeType === 'SWAP' ? '#000' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '0.78rem'
                    }}
                  >
                    Intercambio (SWAP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType('COVER')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: tradeType === 'COVER' ? 'var(--accent-cyan)' : 'transparent',
                      color: tradeType === 'COVER' ? '#000' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '0.78rem'
                    }}
                  >
                    Reemplazo (COVER)
                  </button>
                </div>
              </div>

              {/* Fecha */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Fecha del Cambio:
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={tradeDate}
                  onChange={e => {
                    setTradeDate(e.target.value);
                    setSelectedMyShift('');
                  }}
                  required
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Mi Turno a Ceder */}
              {tradeDate && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block', color: 'var(--accent-cyan)' }}>
                    Mi Turno Asignado esa Fecha:
                  </label>
                  {myAvailableShifts.length > 0 ? (
                    <select
                      className="form-input"
                      value={selectedMyShift}
                      onChange={e => setSelectedMyShift(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--accent-cyan)', borderRadius: '10px', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Selecciona tu turno a ceder --</option>
                      {myAvailableShifts.map((s, idx) => (
                        <option key={idx} value={s.fullCode}>
                          Turno {s.fullCode} ({s.slotKey})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej. MLNT o TLST (Escribe tu turno si no aparece)"
                      value={selectedMyShift}
                      onChange={e => setSelectedMyShift(e.target.value.toUpperCase())}
                      required
                      style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                    />
                  )}
                </div>
              )}

              {/* Compañero Receptor */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Compañero Destino (Opcional):
                </label>
                <select
                  className="form-input"
                  value={selectedColleagueSig}
                  onChange={e => setSelectedColleagueSig(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                >
                  <option value="OPEN">📢 Abierta a cualquier compañero del equipo</option>
                  {controllers.filter(c => c.signature !== currentUser?.signature).map(c => (
                    <option key={c.id || c.signature} value={c.signature}>
                      {c.name} ({c.signature})
                    </option>
                  ))}
                </select>
              </div>

              {/* Comentarios */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Comentarios / Justificación:
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Justificación o motivo de la solicitud..."
                  value={tradeComment}
                  onChange={e => setTradeComment(e.target.value)}
                  style={{ width: '100%', resize: 'none', padding: '0.55rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.65rem', fontWeight: '700' }}>
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
