import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Clock, XCircle, Plus, ArrowRightLeft, ShieldCheck, X, User } from 'lucide-react';
import { getSlotAcronym } from '../../utils/schedulerEngine';

export default function MobileTradesView({ 
  currentUser, 
  trades = [], 
  controllers = [],
  scheduleMonth = {},
  initialTradeData = null,
  userRole = 'controller',
  onAddTrade,
  onAcceptTrade,
  onApproveTrade,
  onRejectTrade 
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'approved'
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isEncargado = userRole === 'admin' || currentUser?.isSupervisor || currentUser?.isAdmin || (currentUser?.skills && currentUser.skills.includes('CTE'));

  // Estados del Formulario de Nuevo Cambio
  const [tradeType, setTradeType] = useState('COVER'); // 'COVER' | 'SWAP'
  const [tradeDate, setTradeDate] = useState('');
  const [selectedMyShift, setSelectedMyShift] = useState('');
  const [targetShiftToSwap, setTargetShiftToSwap] = useState('');
  const [selectedColleagueSig, setSelectedColleagueSig] = useState('OPEN');
  const [tradeComment, setTradeComment] = useState('');

  // Reaccionar cuando viene una redirección desde "Mi Roster" o "Roster General"
  useEffect(() => {
    if (initialTradeData && initialTradeData.date) {
      setTradeDate(initialTradeData.date);
      setTradeType(initialTradeData.type || 'COVER');
      setSelectedMyShift(initialTradeData.selectedMyShift || '');
      setTargetShiftToSwap(initialTradeData.targetShift || '');
      setSelectedColleagueSig(initialTradeData.targetSig || 'OPEN');
      setTradeComment(initialTradeData.comment || '');
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

    if (code.startsWith('TWR') || ['LNT', 'LST', 'LPT'].includes(acronym) || code.includes('TWR')) return 'TWR';
    if (code.startsWith('GND') || ['GNT', 'GST', 'GPT'].includes(acronym) || code.includes('GND')) return 'GND';
    if (code.startsWith('DEL') || ['DPT', 'DPR'].includes(acronym) || code.includes('DEL')) return 'DEL';
    if (code.startsWith('FIC') || ['FPT', 'FPR', 'FPA'].includes(acronym) || code.includes('FIC')) return 'FIC';
    if (code.startsWith('CTE') || acronym === 'CTE' || code.includes('CTE')) return 'CTE';
    if (code.startsWith('ACC') || acronym.includes('ACC') || code.includes('ACC')) return 'ACC';
    if (code.startsWith('SIM') || acronym.includes('SIM') || code.includes('SIM')) return 'SIM';
    if (code.startsWith('ENT') || acronym === 'ENT') return 'ENT';
    return null;
  };

  // Helper para verificar si un controlador tiene la certificación requerida
  const isControllerQualified = (ctrl, requiredSkill) => {
    if (!ctrl) return false;
    if (!requiredSkill) return true; // Si no hay restricción de posición, está habilitado
    
    if (requiredSkill === 'ENT') {
      return Boolean(ctrl.trainingPreferred);
    }

    const skills = ctrl.skills || [];
    if (requiredSkill === 'CTE') {
      return Boolean(ctrl.isSupervisor || ctrl.isAdmin || skills.includes('CTE'));
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
        if (assignedId && isSameCtrl(assignedId, currentUser)) {
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
  const selectedMyShiftObj = myAvailableShifts.find(s => s.fullCode === selectedMyShift) || (selectedMyShift ? {
    shift: selectedMyShift?.slice(0, 1) || 'M',
    slotKey: 'TWR-1',
    fullCode: selectedMyShift,
    requiredSkill: getRequiredSkillForSlot(selectedMyShift)
  } : null);

  const requiredSkillForMyShift = selectedMyShiftObj ? (selectedMyShiftObj.requiredSkill || getRequiredSkillForSlot(selectedMyShiftObj.slotKey, selectedMyShiftObj.shift)) : null;

  // Filtrar controladores HABILITADOS para recibir mi turno (Excluyéndome a mí mismo y filtrando por habilidad requerida)
  const availableOthers = controllers.filter(c => c.active !== false && !isSameCtrl(c, currentUser));
  
  const qualifiedOthers = requiredSkillForMyShift
    ? availableOthers.filter(c => isControllerQualified(c, requiredSkillForMyShift))
    : availableOthers;
  
  const displayedColleagues = qualifiedOthers;

  // Filtrar los turnos del compañero receptor seleccionado (solo aquellos para los que currentUser está habilitado)
  const availableColleagueShifts = selectedColleagueSig && selectedColleagueSig !== 'OPEN'
    ? otherAssignedShifts.filter(s => isSameCtrl(s.ctrlObj || s.ctrlSig, selectedColleagueSig) && isControllerQualified(currentUser, s.requiredSkill))
    : [];

  // Al enviar la solicitud
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!tradeDate || !selectedMyShift) {
      alert(tradeType === 'COVER' ? 'Por favor selecciona la fecha y el turno a cubrir.' : 'Por favor selecciona la fecha y tu turno a ceder.');
      return;
    }

    if (tradeType === 'SWAP' && selectedColleagueSig !== 'OPEN' && !targetShiftToSwap) {
      alert('Por favor selecciona el turno a intercambiar con el receptor.');
      return;
    }

    const targetCtrl = controllers.find(c => isSameCtrl(c, selectedColleagueSig));
    const targetSig = targetCtrl ? getCtrlSig(targetCtrl) : (selectedColleagueSig === 'OPEN' ? 'Abierta' : selectedColleagueSig);
    const targetName = selectedColleagueSig === 'OPEN' 
      ? 'Abierta a cualquier compañero habilitado' 
      : (targetCtrl ? targetCtrl.name : selectedColleagueSig);

    const targetOtherShiftObj = tradeType === 'SWAP' && selectedColleagueSig !== 'OPEN' ? otherAssignedShifts.find(s => s.fullCode === targetShiftToSwap) : null;

    const newTradeObj = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: tradeType, // 'SWAP' | 'COVER'
      dateStr: tradeDate,
      date: tradeDate,
      fromControllerId: currentUser?.id || getCtrlSig(currentUser) || 'ATC',
      fromControllerSignature: getCtrlSig(currentUser) || 'ATC',
      requesterSignature: getCtrlSig(currentUser) || 'ATC',
      requesterName: currentUser?.name || 'Controlador',
      requesterShift: selectedMyShift,
      fromSlot: selectedMyShiftObj ? { shift: selectedMyShiftObj.shift, slotKey: selectedMyShiftObj.slotKey } : { shift: 'M', slotKey: 'TWR-1' },
      toControllerId: selectedColleagueSig === 'OPEN' ? 'OPEN' : (targetCtrl?.id || targetSig),
      toControllerSignature: targetSig,
      targetSignature: targetSig,
      targetName: targetName,
      targetShift: tradeType === 'COVER' ? 'Reemplazo' : (selectedColleagueSig === 'OPEN' ? 'Abierta' : (targetShiftToSwap || 'Por acordar')),
      toSlot: tradeType === 'SWAP' && targetOtherShiftObj ? { shift: targetOtherShiftObj.shift, slotKey: targetOtherShiftObj.slotKey } : null,
      isPublic: selectedColleagueSig === 'OPEN',
      comment: tradeComment.trim(),
      status: 'PENDIENTE_ACEPTACION',
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
    alert(tradeType === 'COVER' ? '¡Solicitud de reemplazo (COVER) registrada exitosamente!' : '¡Solicitud de intercambio (SWAP) registrada exitosamente!');
  };

  // Mapeo y Normalización unificada de campos (Soporta esquema Desktop y Móvil)
  const normalizedTrades = trades.map(t => {
    const fromSig = t.requesterSignature || t.fromControllerSignature || t.fromControllerId || t.requesterId || '';
    const fromName = t.requesterName || t.fromControllerName || controllers.find(c => isSameCtrl(c, fromSig))?.name || (fromSig ? fromSig : 'Solicitante');
    
    let fromShift = t.requesterShift || t.fromShiftCode || t.fromShift || '';
    if (!fromShift && t.fromSlot) {
      fromShift = `${t.fromSlot.shift}${getSlotAcronym(t.fromSlot.slotKey, t.fromSlot.shift)}`;
    }
    if (!fromShift) fromShift = 'Turno';

    const toSig = t.targetSignature || t.toControllerSignature || t.toControllerId || t.targetId || 'OPEN';
    const toName = t.targetName || t.toControllerName || (toSig === 'OPEN' || toSig === 'ALL' || t.isPublic ? 'Abierta a cualquier compañero habilitado' : (controllers.find(c => isSameCtrl(c, toSig))?.name || toSig));
    
    let toShift = t.targetShift || t.toShiftCode || t.toShift || '';
    if (!toShift && t.toSlot) {
      toShift = `${t.toSlot.shift}${getSlotAcronym(t.toSlot.slotKey, t.toSlot.shift)}`;
    }
    if (!toShift) toShift = (t.type === 'COVER' ? 'Reemplazo' : 'Por acordar');

    const isPublic = Boolean(t.isPublic || toSig === 'OPEN' || toSig === 'ALL' || !t.toControllerId || toSig === 'Abierta');
    const dateStr = t.dateStr || t.date || '';

    const isPendingPeer = t.status === 'pending' || t.status === 'PENDIENTE_ACEPTACION' || !t.status;
    const isPendingAdmin = t.status === 'PENDIENTE_APROBACION';
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
      status: isApproved ? 'approved' : isRejected ? 'rejected' : (isPendingAdmin ? 'pending_admin' : 'pending'),
      rawStatus: t.status || 'PENDIENTE_ACEPTACION'
    };
  }).filter(t => t.fromSig && t.fromSig.trim() !== '');

  // Filtrar permutas/cambios estrictamente relevantes para el controlador logueado
  const userTrades = normalizedTrades.filter(t => {
    const isMyRequest = isSameCtrl(t.fromSig, currentUser);
    const isTargetingMe = isSameCtrl(t.toSig, currentUser);
    const isOpenPending = Boolean(t.isPublic && (t.status === 'pending' || t.status === 'pending_admin'));
    const isSupervisorPending = Boolean(isEncargado && t.status === 'pending_admin');

    const isRelevant = isMyRequest || isTargetingMe || isOpenPending || isSupervisorPending;
    if (!isRelevant) return false;

    if (filter === 'pending') return t.status === 'pending' || t.status === 'pending_admin';
    if (filter === 'approved') return t.status === 'approved';
    return true;
  });

  const getStatusBadge = (trade) => {
    if (trade.status === 'approved') {
      return { label: 'Aprobado & Aplicado', color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 };
    }
    if (trade.status === 'rejected') {
      return { label: 'Rechazado', color: 'var(--status-danger)', bg: 'rgba(244, 63, 94, 0.15)', icon: XCircle };
    }
    if (trade.status === 'pending_admin' || trade.rawStatus === 'PENDIENTE_APROBACION') {
      return { label: 'Esperando Jefatura', color: 'var(--accent-cyan)', bg: 'rgba(6, 182, 212, 0.15)', icon: Clock };
    }
    return { label: 'Pendiente Aceptación', color: 'var(--status-warning)', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock };
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
            const statusInfo = getStatusBadge(trade);
            const StatusIcon = statusInfo.icon;
            const isTarget = isSameCtrl(trade.toSig, currentUser);
            const isMyRequest = isSameCtrl(trade.fromSig, currentUser);

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

                {/* Acciones según el rol y estado de la solicitud */}
                
                {/* 1. Solicitud pendiente de aceptación dirigida a mí */}
                {isTarget && (trade.status === 'pending' || trade.rawStatus === 'PENDIENTE_ACEPTACION') && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => onAcceptTrade && onAcceptTrade(trade.id)}
                      style={{
                        flex: 1,
                        background: 'rgba(16, 185, 129, 0.18)',
                        border: '1px solid var(--status-success)',
                        color: 'var(--status-success)',
                        borderRadius: '8px',
                        padding: '0.55rem',
                        fontWeight: '800',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Aceptar Solicitud
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Deseas rechazar esta propuesta de cambio?')) {
                          onRejectTrade && onRejectTrade(trade.id);
                        }
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid var(--status-danger)',
                        color: 'var(--status-danger)',
                        borderRadius: '8px',
                        padding: '0.55rem',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <XCircle size={16} />
                      Rechazar
                    </button>
                  </div>
                )}

                {/* 2. Solicitud acordada entre compañeros, pendiente de aprobación de jefatura (si soy encargado/admin) */}
                {isEncargado && (trade.status === 'pending_admin' || trade.rawStatus === 'PENDIENTE_APROBACION') && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => onApproveTrade && onApproveTrade(trade.id)}
                      style={{
                        flex: 1,
                        background: 'rgba(6, 182, 212, 0.2)',
                        border: '1px solid var(--accent-cyan)',
                        color: 'var(--accent-cyan)',
                        borderRadius: '8px',
                        padding: '0.55rem',
                        fontWeight: '800',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <ShieldCheck size={16} />
                      Aprobar y Aplicar al Roster
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Deseas rechazar esta propuesta de cambio?')) {
                          onRejectTrade && onRejectTrade(trade.id);
                        }
                      }}
                      style={{
                        padding: '0.55rem 0.8rem',
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid var(--status-danger)',
                        color: 'var(--status-danger)',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Rechazar propuesta"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                )}

                {/* 3. Solicitud enviada por mí que sigue pendiente: opción para cancelarla */}
                {isMyRequest && (trade.status === 'pending' || trade.status === 'pending_admin') && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Deseas cancelar esta propuesta de cambio enviada?')) {
                          onRejectTrade && onRejectTrade(trade.id);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--text-muted)',
                        color: 'var(--text-muted)',
                        borderRadius: '8px',
                        padding: '0.35rem 0.7rem',
                        fontWeight: '600',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar Solicitud
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
              
              {/* Tipo de Solicitud */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Tipo de Solicitud:
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTradeType('COVER');
                      setTargetShiftToSwap('');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: tradeType === 'COVER' ? 'var(--accent-cyan)' : 'transparent',
                      color: tradeType === 'COVER' ? '#000' : 'var(--text-secondary)',
                      fontWeight: '800',
                      fontSize: '0.78rem'
                    }}
                  >
                    Hacer el Turno (COVER)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTradeType('SWAP');
                      setTargetShiftToSwap('');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
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

              {/* 1. Fecha del Cambio */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  1. Fecha del Cambio:
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={tradeDate}
                  onChange={e => {
                    setTradeDate(e.target.value);
                    setSelectedMyShift('');
                    setTargetShiftToSwap('');
                    setSelectedColleagueSig('OPEN');
                  }}
                  required
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              {/* 2. Turno a Ceder / Cubrir */}
              {tradeDate && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block', color: 'var(--accent-cyan)' }}>
                    {tradeType === 'COVER' ? '2. Turno a Solicitar que sea Cubierto:' : '2. Turno a Ceder:'}
                  </label>
                  {myAvailableShifts.length > 0 ? (
                    <select
                      className="form-input"
                      value={selectedMyShift}
                      onChange={e => {
                        setSelectedMyShift(e.target.value);
                        setTargetShiftToSwap('');
                        setSelectedColleagueSig('OPEN');
                      }}
                      required
                      style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--accent-cyan)', borderRadius: '10px', color: 'var(--text-primary)' }}
                    >
                      <option value="">-- Selecciona el turno --</option>
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

              {/* 3. Controlador que Recibirá el Turno (Filtrado por Habilitación) */}
              {tradeDate && selectedMyShift && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block', color: 'var(--accent-indigo)' }}>
                    {tradeType === 'COVER' ? '3. Controlador que Recibirá el Turno:' : '3. Controlador Receptor:'}
                  </label>
                  <select
                    className="form-input"
                    value={selectedColleagueSig}
                    onChange={e => {
                      setSelectedColleagueSig(e.target.value);
                      setTargetShiftToSwap('');
                    }}
                    required
                    style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--accent-indigo)', borderRadius: '10px', color: 'var(--text-primary)' }}
                  >
                    <option value="OPEN">📢 Solicitud Abierta a cualquier compañero habilitado</option>
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
                      * Se muestran únicamente controladores con habilitación en <strong>{requiredSkillForMyShift}</strong>.
                    </span>
                  )}
                </div>
              )}

              {/* 4. Turno a Intercambiar con Receptor (SOLO PARA SWAP) */}
              {tradeType === 'SWAP' && tradeDate && selectedMyShift && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block', color: 'var(--status-warning)' }}>
                    4. Turno a Intercambiar con Receptor:
                  </label>
                  {selectedColleagueSig === 'OPEN' ? (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(6, 182, 212, 0.08)',
                      border: '1px dashed var(--accent-cyan)',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      📢 <strong>Solicitud Abierta:</strong> Cualquier compañero habilitado para <strong>{requiredSkillForMyShift || 'el turno'}</strong> que tenga turno programado en esta fecha podrá postularlo para completar el intercambio.
                    </div>
                  ) : (
                    availableColleagueShifts.length > 0 ? (
                      <select
                        className="form-input"
                        value={targetShiftToSwap}
                        onChange={e => setTargetShiftToSwap(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--status-warning)', borderRadius: '10px', color: 'var(--text-primary)' }}
                      >
                        <option value="">-- Selecciona el turno del receptor para intercambiar --</option>
                        {availableColleagueShifts.map((s, idx) => (
                          <option key={idx} value={s.fullCode}>
                            Turno {s.fullCode} ({s.slotKey}) {s.requiredSkill ? `· Pos: ${s.requiredSkill}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{
                        padding: '0.65rem',
                        background: 'rgba(244, 63, 94, 0.08)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        color: 'var(--status-danger)'
                      }}>
                        ⚠️ El receptor seleccionado no tiene turnos programados en esta fecha para los cuales cuentes con habilitación.
                      </div>
                    )
                  )}
                </div>
              )}

              {/* 5. Comentarios */}
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Comentarios / Justificación (Opcional):
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Motivo o detalle de la solicitud..."
                  value={tradeComment}
                  onChange={e => setTradeComment(e.target.value)}
                  style={{ width: '100%', resize: 'none', padding: '0.55rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem' }}>
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={!tradeDate || !selectedMyShift || (tradeType === 'SWAP' && selectedColleagueSig !== 'OPEN' && (!targetShiftToSwap || availableColleagueShifts.length === 0))}
                  style={{ flex: 1, padding: '0.65rem', fontWeight: '700' }}
                >
                  {tradeType === 'COVER' ? 'Enviar Solicitud de COVER' : 'Enviar Solicitud de SWAP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
