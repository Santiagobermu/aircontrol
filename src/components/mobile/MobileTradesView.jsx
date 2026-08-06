import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Clock, XCircle, Plus, ArrowRightLeft, ShieldCheck, X, User } from 'lucide-react';
import { getSlotAcronym } from '../../utils/schedulerEngine';

export default function MobileTradesView({ 
  currentUser, 
  trades = [], 
  controllers = [],
  scheduleMonth = {},
  initialTradeData = null,
  onAddTrade,
  onAcceptTrade,
  onRejectTrade 
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'approved'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados del Formulario de Nuevo Cambio
  const [tradeType, setTradeType] = useState('COVER'); // 'COVER' | 'SWAP'
  const [tradeDate, setTradeDate] = useState('');
  const [selectedMyShift, setSelectedMyShift] = useState('');
  const [targetShiftToSwap, setTargetShiftToSwap] = useState('');
  const [selectedColleagueSig, setSelectedColleagueSig] = useState('OPEN');
  const [tradeComment, setTradeComment] = useState('');

  // Reaccionar cuando viene una redirección desde "Mi Roster"
  useEffect(() => {
    if (initialTradeData && initialTradeData.date) {
      setTradeDate(initialTradeData.date);
      setTradeType(initialTradeData.type || 'COVER');
      setSelectedMyShift('');
      setTargetShiftToSwap('');
      setSelectedColleagueSig('OPEN');
      setIsModalOpen(true);
    }
  }, [initialTradeData]);

  // Helper para obtener la firma / iniciales de un controlador de forma segura
  const getCtrlSig = (ctrl) => {
    if (!ctrl) return '';
    return (ctrl.signature || ctrl.id || ctrl.name || '').toString().trim();
  };

  // Helper para comparar si dos objetos o siglas pertenecen al mismo controlador
  const isSameCtrl = (ctrlA, ctrlB) => {
    if (!ctrlA || !ctrlB) return false;
    const sigA = (typeof ctrlA === 'string' ? ctrlA : getCtrlSig(ctrlA)).toUpperCase();
    const sigB = (typeof ctrlB === 'string' ? ctrlB : getCtrlSig(ctrlB)).toUpperCase();
    return sigA && sigB && sigA === sigB;
  };

  // Helper para determinar la habilidad / certificación requerida por una posición
  const getRequiredSkillForSlot = (slotKey, shift) => {
    if (!slotKey) return null;
    const code = slotKey.toUpperCase();
    const acronym = getSlotAcronym(slotKey, shift);

    if (acronym === 'LNT' || acronym === 'LST' || acronym === 'LPT' || code.includes('TWR') || code.includes('LNT') || code.includes('LST')) return 'TWR';
    if (acronym === 'GNT' || acronym === 'GST' || acronym === 'GPT' || code.includes('GND') || code.includes('GNT') || code.includes('GST')) return 'GND';
    if (acronym === 'DPT' || acronym === 'DPR' || code.includes('DEL') || code.includes('DPT') || code.includes('DPR')) return 'DEL';
    if (acronym === 'FPT' || acronym === 'FPR' || acronym === 'FPA' || code.includes('FIC') || code.includes('FPT')) return 'FIC';
    if (acronym === 'CTE' || code.includes('CTE')) return 'CTE';
    if (acronym === 'ACC' || code.includes('ACC')) return 'ACC';
    if (acronym === 'SIM' || code.includes('SIM')) return 'SIM';
    return null;
  };

  // Helper para verificar si un controlador tiene la certificación requerida
  const isControllerQualified = (ctrl, requiredSkill) => {
    if (!ctrl) return false;
    if (!requiredSkill) return true; // Si no hay restricción de posición, está habilitado
    
    const skills = ctrl.skills || [];
    if (requiredSkill === 'CTE') {
      return ctrl.isSupervisor || ctrl.isAdmin || skills.includes('CTE');
    }
    return skills.includes(requiredSkill) || skills.includes(requiredSkill.toUpperCase());
  };

  // Turnos propios asignados el día seleccionado
  const getMyShiftsForDate = (dateStr) => {
    if (!dateStr || !scheduleMonth || !scheduleMonth[dateStr] || !currentUser) return [];
    const daySched = scheduleMonth[dateStr];
    const myShifts = [];

    ['M', 'T', 'N', 'A'].forEach(shift => {
      const slots = daySched[shift] || {};
      Object.entries(slots).forEach(([slotKey, assignedId]) => {
        if (assignedId && (isSameCtrl(assignedId, currentUser))) {
          const acronym = getSlotAcronym(slotKey, shift);
          const fullCode = `${shift}${acronym}`;
          const requiredSkill = getRequiredSkillForSlot(slotKey, shift);
          myShifts.push({
            shift,
            slotKey,
            fullCode,
            requiredSkill
          });
        }
      });
    });
    return myShifts;
  };

  // Turnos asignados a OTROS controladores ese día (Para SWAP)
  const getOtherAssignedShiftsOnDate = (dateStr) => {
    if (!dateStr || !scheduleMonth || !scheduleMonth[dateStr] || !currentUser) return [];
    const daySched = scheduleMonth[dateStr];
    const result = [];

    ['M', 'T', 'N', 'A'].forEach(shift => {
      const slots = daySched[shift] || {};
      Object.entries(slots).forEach(([slotKey, assignedId]) => {
        if (assignedId && !isSameCtrl(assignedId, currentUser)) {
          const ctrlObj = controllers.find(c => isSameCtrl(c, assignedId)) || { name: assignedId, signature: assignedId };
          const name = ctrlObj.name || assignedId;
          const sig = getCtrlSig(ctrlObj);
          const acronym = getSlotAcronym(slotKey, shift);
          const fullCode = `${shift}${acronym}`;
          const requiredSkill = getRequiredSkillForSlot(slotKey, shift);

          result.push({
            shift,
            slotKey,
            fullCode,
            ctrlId: assignedId,
            ctrlSig: sig,
            ctrlName: name,
            requiredSkill,
            ctrlObj
          });
        }
      });
    });

    return result;
  };

  const myAvailableShifts = getMyShiftsForDate(tradeDate);
  const otherAssignedShifts = getOtherAssignedShiftsOnDate(tradeDate);

  // Determinar el turno propio seleccionado y su habilidad requerida
  const selectedMyShiftObj = myAvailableShifts.find(s => s.fullCode === selectedMyShift) || {
    shift: selectedMyShift?.slice(0, 1) || 'M',
    slotKey: 'TWR-1',
    fullCode: selectedMyShift || '',
    requiredSkill: getRequiredSkillForSlot(selectedMyShift)
  };
  const requiredSkillForMyShift = selectedMyShiftObj.requiredSkill || getRequiredSkillForSlot(selectedMyShiftObj.slotKey, selectedMyShiftObj.shift);

  // Filtrar controladores HABILITADOS para asumir mi turno (Excluyéndome a mí mismo)
  const availableOthers = controllers.filter(c => !isSameCtrl(c, currentUser));
  
  const qualifiedOthers = availableOthers.filter(c => isControllerQualified(c, requiredSkillForMyShift));
  
  // Si ningún controlador tiene cargadas las habilidades o si está vacío, usar todos los compañeros como resguardo
  const displayedColleagues = qualifiedOthers.length > 0 ? qualifiedOthers : availableOthers;

  // Al enviar la solicitud
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!tradeDate || !selectedMyShift) {
      alert('Por favor selecciona la fecha y tu turno a ceder.');
      return;
    }

    const targetCtrl = controllers.find(c => isSameCtrl(c, selectedColleagueSig));
    const targetSig = targetCtrl ? getCtrlSig(targetCtrl) : (selectedColleagueSig === 'OPEN' ? 'Abierta' : selectedColleagueSig);
    const targetName = selectedColleagueSig === 'OPEN' 
      ? 'Abierta a cualquier compañero habilitado' 
      : (targetCtrl ? targetCtrl.name : selectedColleagueSig);

    const newTradeObj = {
      id: `trade_${Date.now()}`,
      type: tradeType,
      dateStr: tradeDate,
      date: tradeDate,
      requesterSignature: getCtrlSig(currentUser) || 'ATC',
      requesterName: currentUser?.name || 'Controlador',
      requesterShift: selectedMyShift,
      targetSignature: targetSig,
      targetName: targetName,
      targetShift: tradeType === 'COVER' ? 'Reemplazo' : (targetShiftToSwap || 'Por acordar'),
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
    setTargetShiftToSwap('');
    setSelectedColleagueSig('OPEN');
    setTradeComment('');
    alert('¡Solicitud de cambio registrada exitosamente!');
  };

  // Mapeo y Normalización unificada de campos (Soporta esquema Desktop y Móvil)
  const normalizedTrades = trades.map(t => {
    const fromSig = t.requesterSignature || t.fromControllerSignature || t.fromControllerId || t.requesterId || '';
    const fromName = t.requesterName || t.fromControllerName || controllers.find(c => isSameCtrl(c, fromSig))?.name || (fromSig ? fromSig : 'Solicitante');
    const fromShift = t.requesterShift || t.fromShiftCode || t.fromShift || 'Turno';

    const toSig = t.targetSignature || t.toControllerSignature || t.toControllerId || t.targetId || 'OPEN';
    const toName = t.targetName || t.toControllerName || (toSig === 'OPEN' || toSig === 'ALL' || t.isPublic ? 'Abierta a cualquier compañero habilitado' : (controllers.find(c => isSameCtrl(c, toSig))?.name || toSig));
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
  }).filter(t => t.fromSig && t.fromSig.trim() !== '');

  // Filtrar permutas/cambios estrictamente relevantes para el controlador logueado
  const userTrades = normalizedTrades.filter(t => {
    const isMyRequest = isSameCtrl(t.fromSig, currentUser);
    const isTargetingMe = isSameCtrl(t.toSig, currentUser);
    const isOpenPending = Boolean(t.isPublic && t.status === 'pending');

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
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Intercambios (SWAP) y Reemplazos (COVER)</span>
        </div>

        <button
          onClick={() => {
            setTradeDate('');
            setSelectedMyShift('');
            setTargetShiftToSwap('');
            setSelectedColleagueSig('OPEN');
            setTradeType('COVER');
            setIsModalOpen(true);
          }}
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

      {/* LISTA DE TARJETAS DE CAMBIO */}
      {userTrades.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {userTrades.map((trade, idx) => {
            const statusInfo = getStatusBadge(trade.status);
            const StatusIcon = statusInfo.icon;
            const isTarget = isSameCtrl(trade.toSig, currentUser);

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
              
              {/* Tipo de Cambio (REEMPLAZO / INTERCAMBIO) */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Tipo de Solicitud
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
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
                      fontWeight: '800',
                      fontSize: '0.78rem'
                    }}
                  >
                    Reemplazo (COVER)
                  </button>
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
                      fontWeight: '800',
                      fontSize: '0.78rem'
                    }}
                  >
                    Intercambio (SWAP)
                  </button>
                </div>
              </div>

              {/* Fecha del Cambio */}
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
                    setTargetShiftToSwap('');
                  }}
                  required
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Mi Turno a Ceder */}
              {tradeDate && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block', color: 'var(--accent-cyan)' }}>
                    Mi Turno Asignado a Ceder:
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
                          Turno {s.fullCode} ({s.slotKey}) {s.requiredSkill ? `· Req: ${s.requiredSkill}` : ''}
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

              {/* SECCIÓN ESPECÍFICA DE INTERCAMBIO (SWAP): Selección de Turno Destino */}
              {tradeType === 'SWAP' && tradeDate && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block', color: 'var(--status-warning)' }}>
                    Turno Asignado esa Fecha para Intercambiar:
                  </label>
                  {otherAssignedShifts.length > 0 ? (
                    <select
                      className="form-input"
                      value={targetShiftToSwap}
                      onChange={e => {
                        const shiftVal = e.target.value;
                        setTargetShiftToSwap(shiftVal);
                        const match = otherAssignedShifts.find(s => s.fullCode === shiftVal);
                        if (match) {
                          setSelectedColleagueSig(match.ctrlSig);
                        }
                      }}
                      style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--status-warning)', borderRadius: '10px', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Selecciona el turno asignado al que deseas cambiar --</option>
                      {otherAssignedShifts.map((s, idx) => (
                        <option key={idx} value={s.fullCode}>
                          Turno {s.fullCode} ({s.slotKey}) · {s.ctrlName} ({s.ctrlSig})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                      No hay otros turnos programados en el roster para esa fecha.
                    </p>
                  )}
                </div>
              )}

              {/* Compañero Receptor Habilitado */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Compañero Habilitado Receptor:
                </label>
                <select
                  className="form-input"
                  value={selectedColleagueSig}
                  onChange={e => setSelectedColleagueSig(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                >
                  <option value="OPEN">📢 Abierta a cualquier compañero habilitado</option>
                  {displayedColleagues.map(c => {
                    const sig = getCtrlSig(c);
                    return (
                      <option key={sig} value={sig}>
                        {c.name || sig} ({sig}) {requiredSkillForMyShift ? `· Habilitado ${requiredSkillForMyShift}` : ''}
                      </option>
                    );
                  })}
                </select>
                {requiredSkillForMyShift && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', display: 'block', marginTop: '0.2rem' }}>
                    * Se muestran los controladores con certificación en {requiredSkillForMyShift}.
                  </span>
                )}
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
