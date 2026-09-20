import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Clock, XCircle, Plus, ArrowRightLeft, ShieldCheck, X, User, FileText, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { getSlotAcronym } from '../../utils/schedulerEngine';
import BoletaPreviewModal from '../BoletaPreviewModal';

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

  // Estados para Modal de Boleta Oficial GSAN
  const [selectedBoletaTrade, setSelectedBoletaTrade] = useState(null);
  const [isBoletaModalOpen, setIsBoletaModalOpen] = useState(false);

  // Estados y manejadores para Modal de Aceptación de Propuesta (Directa o Abierta)
  const [tradeToAccept, setTradeToAccept] = useState(null);
  const [selectedSwapSlot, setSelectedSwapSlot] = useState(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);

  // Estados y manejadores para Modal de Aprobación de Supervisor (Mobile)
  const [tradeToApprove, setTradeToApprove] = useState(null);
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const [isCtePanelExpanded, setIsCtePanelExpanded] = useState(true);

  const handleStartAcceptTrade = (trade) => {
    setTradeToAccept(trade);
    const isTradeOpen = Boolean(trade.isPublic || trade.toSig === 'OPEN' || trade.toSig === 'ALL' || trade.rawTrade?.toControllerId === 'OPEN');
    const targetDate = (trade.dateStr || trade.date || trade.rawTrade?.dateStr || trade.rawTrade?.date || '').trim();

    if (trade.type === 'SWAP') {
      const myShifts = getMyShiftsForDate(targetDate);
      const fromCtrl = controllers.find(c => isSameCtrl(c, trade.fromSig));
      // Preseleccionar el primer turno compatible del usuario en esa fecha
      const compatible = myShifts.find(s => isControllerQualified(fromCtrl, s.requiredSkill)) || myShifts[0] || null;
      setSelectedSwapSlot(compatible);
    } else {
      setSelectedSwapSlot(null);
    }

    setIsAcceptModalOpen(true);
  };

  const handleConfirmAcceptTrade = () => {
    if (!tradeToAccept) return;
    const isTradeOpen = Boolean(tradeToAccept.isPublic || tradeToAccept.toSig === 'OPEN' || tradeToAccept.toSig === 'ALL' || tradeToAccept.rawTrade?.toControllerId === 'OPEN');

    if (tradeToAccept.type === 'SWAP') {
      if (!selectedSwapSlot) {
        alert('Debes tener y seleccionar un turno asignado para realizar el intercambio.');
        return;
      }
      onAcceptTrade && onAcceptTrade(tradeToAccept.id, currentUser, {
        shift: selectedSwapSlot.shift,
        slotKey: selectedSwapSlot.slotKey
      });
    } else {
      onAcceptTrade && onAcceptTrade(tradeToAccept.id, currentUser, null);
    }

    setIsAcceptModalOpen(false);
    setTradeToAccept(null);
    setSelectedSwapSlot(null);
  };

  const isEncargado = userRole === 'admin' || currentUser?.isSupervisor || currentUser?.isAdmin || (currentUser?.skills && currentUser.skills.includes('CTE'));

  const handleStartApproval = (trade) => {
    setTradeToApprove(trade);
    const fromShift = trade.fromSlot?.shift;
    const dateStr = trade.date;
    const shiftCteId = scheduleMonth?.[dateStr]?.[fromShift]?.['CTE-1'];
    const allSupervisors = controllers.filter(c => c.isSupervisor || (c.skills && c.skills.includes('CTE')));
    
    // Si el usuario actual es CTE/supervisor legítimo, preseleccionarlo a él
    const isCurrentSup = currentUser && (currentUser.isSupervisor || (currentUser.skills && currentUser.skills.includes('CTE')));
    const defaultSup = isCurrentSup 
      ? currentUser.id 
      : ((shiftCteId && allSupervisors.find(c => isSameCtrl(c, shiftCteId, controllers)))
          ? shiftCteId
          : (allSupervisors[0]?.id || ''));
    setSelectedApproverId(defaultSup);
  };

  const handleConfirmApproval = () => {
    if (!tradeToApprove) return;
    onApproveTrade && onApproveTrade(tradeToApprove.id, selectedApproverId);
    setTradeToApprove(null);
  };

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

  // Helper para buscar el controlador canónico en controllers
  const findController = (ctrlRef) => {
    if (!ctrlRef) return null;
    if (typeof ctrlRef === 'object') {
      const match = controllers.find(c => 
        (c.id && (c.id === ctrlRef.id || c.id === ctrlRef.ctrlId)) ||
        (c.signature && (c.signature === ctrlRef.signature || c.signature === ctrlRef.sig || c.signature === ctrlRef.ctrlSig)) ||
        (c.email && ctrlRef.email && c.email.toLowerCase() === ctrlRef.email.toLowerCase())
      );
      return match || ctrlRef;
    }
    const clean = ctrlRef.toString().trim().toUpperCase();
    return controllers.find(c => 
      (c.id && c.id.toUpperCase() === clean) ||
      (c.signature && c.signature.toUpperCase() === clean) ||
      (c.name && c.name.toUpperCase() === clean) ||
      (c.email && c.email.toUpperCase() === clean) ||
      (c.documentId && c.documentId === clean)
    ) || null;
  };

  // Helper para obtener la firma / iniciales de un controlador de forma segura
  const getCtrlSig = (ctrl) => {
    if (!ctrl) return '';
    const obj = findController(ctrl);
    if (obj) {
      return (obj.signature || obj.name || obj.id || '').toString().trim();
    }
    if (typeof ctrl === 'object') {
      return (ctrl.signature || ctrl.sig || ctrl.ctrlSig || ctrl.name || ctrl.id || '').toString().trim();
    }
    return ctrl.toString().trim();
  };

  // Helper para comparar si dos objetos o siglas pertenecen al mismo controlador de manera omnisciente
  const isSameCtrl = (ctrlA, ctrlB) => {
    if (!ctrlA || !ctrlB) return false;
    if (ctrlA === ctrlB) return true;

    const getIdentifiers = (item) => {
      const set = new Set();
      if (!item) return set;

      if (typeof item === 'string') {
        const clean = item.trim().toUpperCase();
        if (clean) {
          set.add(clean);
          if (clean.includes('@')) set.add(clean.split('@')[0]);
        }
        const found = controllers.find(c => 
          (c.id && c.id.toUpperCase() === clean) ||
          (c.signature && c.signature.toUpperCase() === clean) ||
          (c.name && c.name.toUpperCase() === clean) ||
          (c.email && c.email.toUpperCase() === clean)
        );
        if (found) {
          if (found.id) set.add(found.id.toString().trim().toUpperCase());
          if (found.signature) set.add(found.signature.toString().trim().toUpperCase());
          if (found.name) set.add(found.name.toString().trim().toUpperCase());
          if (found.email) set.add(found.email.toString().trim().toUpperCase());
        }
      } else if (typeof item === 'object') {
        if (item.id) set.add(item.id.toString().trim().toUpperCase());
        if (item.ctrlId) set.add(item.ctrlId.toString().trim().toUpperCase());
        if (item.signature) set.add(item.signature.toString().trim().toUpperCase());
        if (item.sig) set.add(item.sig.toString().trim().toUpperCase());
        if (item.ctrlSig) set.add(item.ctrlSig.toString().trim().toUpperCase());
        if (item.name) set.add(item.name.toString().trim().toUpperCase());
        if (item.ctrlName) set.add(item.ctrlName.toString().trim().toUpperCase());
        if (item.email) set.add(item.email.toString().trim().toUpperCase());
        if (item.ctrl && typeof item.ctrl === 'object') {
          const nested = getIdentifiers(item.ctrl);
          nested.forEach(v => set.add(v));
        }
        const found = controllers.find(c => 
          (c.id && (c.id === item.id || c.id === item.ctrlId)) ||
          (c.signature && (c.signature === item.signature || c.signature === item.sig || c.signature === item.ctrlSig)) ||
          (c.email && c.email === item.email)
        );
        if (found) {
          if (found.id) set.add(found.id.toString().trim().toUpperCase());
          if (found.signature) set.add(found.signature.toString().trim().toUpperCase());
          if (found.name) set.add(found.name.toString().trim().toUpperCase());
          if (found.email) set.add(found.email.toString().trim().toUpperCase());
        }
      }
      return set;
    };

    const setA = getIdentifiers(ctrlA);
    const setB = getIdentifiers(ctrlB);

    for (const valA of setA) {
      if (setB.has(valA)) return true;
    }
    return false;
  };

  // Helper para determinar la habilidad / certificación requerida por una posición
  const getRequiredSkillForSlot = (slotKey, shift) => {
    if (!slotKey) return null;
    const code = slotKey.toUpperCase();
    const acronym = getSlotAcronym(slotKey, shift);

    if (code.startsWith('TWR') || ['LNT', 'LST', 'LPT'].includes(acronym) || code.includes('TWR') || code.includes('LNT') || code.includes('LST') || code.includes('LPT')) return 'TWR';
    if (code.startsWith('GND') || ['GNT', 'GST', 'GPT'].includes(acronym) || code.includes('GND') || code.includes('GNT') || code.includes('GST') || code.includes('GPT')) return 'GND';
    if (code.startsWith('DEL') || ['DPT', 'DPR'].includes(acronym) || code.includes('DEL') || code.includes('DPT') || code.includes('DPR')) return 'DEL';
    if (code.startsWith('FIC') || ['FPT', 'FPR', 'FPA'].includes(acronym) || code.includes('FIC') || code.includes('FPT') || code.includes('FPR') || code.includes('FPA')) return 'FIC';
    if (code.startsWith('CTE') || acronym === 'CTE' || code.includes('CTE')) return 'CTE';
    if (code.startsWith('ACC') || acronym.includes('ACC') || code.includes('ACC')) return 'ACC';
    if (code.startsWith('SIM') || acronym.includes('SIM') || code.includes('SIM')) return 'SIM';
    if (code.startsWith('ENT') || acronym === 'ENT' || code.includes('ENT')) return 'ENT';
    return null;
  };

  // Helper para verificar si un controlador tiene la certificación requerida
  const isControllerQualified = (ctrlRef, requiredSkill) => {
    if (!ctrlRef) return false;
    if (!requiredSkill) return true; // Si no hay restricción de posición, está habilitado
    
    const ctrl = (typeof ctrlRef === 'object' && ctrlRef.skills) ? ctrlRef : (findController(ctrlRef) || ctrlRef);
    if (!ctrl) return true;

    if (requiredSkill === 'ENT') {
      return Boolean(ctrl.trainingPreferred);
    }

    const skills = ctrl.skills || [];
    if (requiredSkill === 'CTE') {
      return Boolean(ctrl.isSupervisor || ctrl.isAdmin || skills.includes('CTE') || skills.includes('cte'));
    }

    if (skills.length === 0 && !ctrl.isAdmin && !ctrl.isSupervisor) {
      return true;
    }

    return skills.some(s => s && s.toString().toUpperCase() === requiredSkill.toUpperCase());
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
          const ctrlObj = findController(assignedId) || controllers.find(c => isSameCtrl(c, assignedId)) || { name: assignedId, signature: assignedId, id: assignedId };
          const name = ctrlObj.fullName || ctrlObj.name || assignedId;
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

  // Auto-seleccionar mi turno si solo hay 1 disponible en la fecha seleccionada
  useEffect(() => {
    if (tradeDate && myAvailableShifts.length === 1 && !selectedMyShift) {
      setSelectedMyShift(myAvailableShifts[0].fullCode);
    }
  }, [tradeDate, myAvailableShifts, selectedMyShift]);

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

  // Auto-seleccionar el turno del receptor si solo hay 1 disponible para ese receptor en la fecha
  useEffect(() => {
    if (tradeType === 'SWAP' && selectedColleagueSig && selectedColleagueSig !== 'OPEN' && availableColleagueShifts.length === 1 && !targetShiftToSwap) {
      setTargetShiftToSwap(availableColleagueShifts[0].fullCode);
    }
  }, [tradeType, selectedColleagueSig, availableColleagueShifts, targetShiftToSwap]);

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
      rawStatus: t.status || 'PENDIENTE_ACEPTACION',
      createdAt: t.createdAt || t.timestamp || null
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

  // Ordenar los cambios: los más recientes de primeros y los más antiguos de último
  const sortedTrades = [...userTrades].sort((a, b) => {
    // 1. Prioridad: Fecha del turno/cambio (dateStr / date) en orden descendente (más reciente primero)
    const dateA = (a.dateStr || a.date || a.rawTrade?.dateStr || a.rawTrade?.date || '').trim();
    const dateB = (b.dateStr || b.date || b.rawTrade?.dateStr || b.rawTrade?.date || '').trim();

    if (dateA && dateB && dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // 2. Desempate: Fecha y hora de creación/registro de la solicitud (createdAt / timestamp / epoch de ID)
    const getCreationTime = (item) => {
      const created = item.createdAt || item.rawTrade?.createdAt || item.rawTrade?.timestamp;
      if (created) {
        const time = new Date(created).getTime();
        if (!isNaN(time) && time > 0) return time;
      }
      if (item.id) {
        const match = item.id.match(/\d{10,13}/);
        if (match) {
          const num = Number(match[0]);
          if (!isNaN(num) && num > 1000000000000) return num;
        }
      }
      return 0;
    };

    const timeA = getCreationTime(a);
    const timeB = getCreationTime(b);
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    return (b.id || '').localeCompare(a.id || '');
  });

  // Solicitudes pendientes de aprobación CTE / Jefatura (Panel CTE)
  const ctePendingTrades = normalizedTrades
    .filter(t => t.status === 'pending_admin' || t.rawStatus === 'PENDIENTE_APROBACION')
    .sort((a, b) => {
      const dateA = (a.dateStr || a.date || a.rawTrade?.dateStr || a.rawTrade?.date || '').trim();
      const dateB = (b.dateStr || b.date || b.rawTrade?.dateStr || b.rawTrade?.date || '').trim();

      if (dateA && dateB && dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;

      const getCreationTime = (item) => {
        const created = item.createdAt || item.rawTrade?.createdAt || item.rawTrade?.timestamp;
        if (created) {
          const time = new Date(created).getTime();
          if (!isNaN(time) && time > 0) return time;
        }
        if (item.id) {
          const match = item.id.match(/\d{10,13}/);
          if (match) {
            const num = Number(match[0]);
            if (!isNaN(num) && num > 1000000000000) return num;
          }
        }
        return 0;
      };

      return getCreationTime(b) - getCreationTime(a);
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
    const isTradeOpen = Boolean(trade.isPublic || trade.toSig === 'OPEN' || trade.toSig === 'ALL' || trade.rawTrade?.toControllerId === 'OPEN');
    if (isTradeOpen) {
      return { label: 'Oferta Abierta', color: 'var(--accent-cyan)', bg: 'rgba(6, 182, 212, 0.15)', icon: ArrowRightLeft };
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

        <div style={{ display: 'flex', gap: '0.4rem' }}>

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
      </div>

      {/* SECCIÓN DEDICADA: Solicitudes por Aprobar (Panel CTE) */}
      {isEncargado && (
        <div style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderLeft: '4px solid var(--accent-cyan)',
          borderRadius: '14px',
          padding: '0.9rem',
          boxShadow: 'var(--glass-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {/* Header del Panel CTE */}
          <div 
            onClick={() => setIsCtePanelExpanded(!isCtePanelExpanded)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="var(--accent-cyan)" />
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  Solicitudes por Aprobar (Panel CTE)
                </h3>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Supervisión y aplicación al Roster oficial
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: '800',
                backgroundColor: ctePendingTrades.length > 0 ? 'rgba(6, 182, 212, 0.18)' : 'rgba(16, 185, 129, 0.15)',
                color: ctePendingTrades.length > 0 ? 'var(--accent-cyan)' : 'var(--status-success)',
                padding: '0.15rem 0.5rem',
                borderRadius: '99px',
                border: ctePendingTrades.length > 0 ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                {ctePendingTrades.length} {ctePendingTrades.length === 1 ? 'pendiente' : 'pendientes'}
              </span>
              {isCtePanelExpanded ? (
                <ChevronUp size={18} color="var(--text-muted)" />
              ) : (
                <ChevronDown size={18} color="var(--text-muted)" />
              )}
            </div>
          </div>

          {/* Lista de Solicitudes Pendientes CTE */}
          {isCtePanelExpanded && (
            <>
              {ctePendingTrades.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.2rem' }}>
                  {ctePendingTrades.map((trade) => {
                    const isSwap = trade.type === 'SWAP';

                    return (
                      <div 
                        key={`cte_${trade.id}`}
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '12px',
                          padding: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.55rem'
                        }}
                      >
                        {/* Tipo y Fecha */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            backgroundColor: isSwap ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: isSwap ? 'var(--accent-cyan)' : 'var(--status-warning)',
                            padding: '0.18rem 0.45rem',
                            borderRadius: '6px'
                          }}>
                            {isSwap ? 'INTERCAMBIO (SWAP)' : 'REEMPLAZO (COVER)'}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                            Fecha: {trade.dateStr || 'Sin fecha'}
                          </span>
                        </div>

                        {/* Detalle de Solicitante y Receptor */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center',
                          background: 'var(--bg-primary)',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '10px',
                          gap: '0.5rem',
                          fontSize: '0.78rem'
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

                        {/* Comentario si existe */}
                        {trade.comment && (
                          <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            "{trade.comment}"
                          </p>
                        )}

                        {/* Botones de Acción */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <button
                            onClick={() => handleStartApproval(trade)}
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              fontSize: '0.78rem',
                              fontWeight: '800',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              borderRadius: '8px'
                            }}
                          >
                            <ShieldCheck size={15} />
                            Aprobar
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBoletaTrade(trade.rawTrade || trade);
                              setIsBoletaModalOpen(true);
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.5rem 0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              borderRadius: '8px'
                            }}
                            title="Ver Boleta Oficial GSAN"
                          >
                            <FileText size={14} color="var(--accent-cyan)" />
                            Boleta
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm('¿Deseas rechazar esta solicitud de cambio como Supervisor CTE?')) {
                                onRejectTrade && onRejectTrade(trade.id);
                              }
                            }}
                            className="btn btn-danger-outline"
                            style={{
                              padding: '0.5rem 0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              borderRadius: '8px'
                            }}
                          >
                            <XCircle size={14} />
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '0.85rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  fontStyle: 'italic',
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px dashed rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px'
                }}>
                  ✨ No hay solicitudes pendientes de aprobación de jefatura.
                </div>
              )}
            </>
          )}
        </div>
      )}

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
      {sortedTrades.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {sortedTrades.map((trade, idx) => {
            const statusInfo = getStatusBadge(trade);
            const StatusIcon = statusInfo.icon;
            const isTarget = isSameCtrl(trade.toSig, currentUser);
            const isMyRequest = isSameCtrl(trade.fromSig, currentUser);
            const isOpen = Boolean(trade.isPublic || trade.toSig === 'OPEN' || trade.toSig === 'ALL' || trade.rawTrade?.toControllerId === 'OPEN');

            return (
              <div key={trade.id || idx} style={{
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <ArrowRightLeft size={16} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Fecha: {trade.dateStr || 'Sin fecha'}
                    </span>
                    {isOpen && (
                      <span style={{
                        background: 'rgba(6, 182, 212, 0.12)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: 'var(--accent-cyan)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '6px',
                        fontSize: '0.65rem',
                        fontWeight: '800'
                      }}>
                        🌐 Abierta
                      </span>
                    )}
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
                
                {/* 1. Solicitud pendiente de aceptación dirigida directamente a mí */}
                {isTarget && (trade.status === 'pending' || trade.rawStatus === 'PENDIENTE_ACEPTACION') && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => handleStartAcceptTrade(trade)}
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

                {/* 2. Solicitud abierta a cualquier compañero y yo NO soy el solicitante */}
                {isOpen && !isMyRequest && (trade.status === 'pending' || trade.rawStatus === 'PENDIENTE_ACEPTACION') && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => handleStartAcceptTrade(trade)}
                      style={{
                        flex: 1,
                        background: trade.type === 'COVER' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(6, 182, 212, 0.18)',
                        border: `1px solid ${trade.type === 'COVER' ? 'var(--status-success)' : 'var(--accent-cyan)'}`,
                        color: trade.type === 'COVER' ? 'var(--status-success)' : 'var(--accent-cyan)',
                        borderRadius: '8px',
                        padding: '0.55rem',
                        fontWeight: '800',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                      }}
                    >
                      {trade.type === 'COVER' ? (
                        <>
                          <CheckCircle2 size={16} />
                          Tomar Turno (Cubrir)
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft size={16} />
                          Aceptar Intercambio (SWAP)
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 3. Solicitud acordada entre compañeros, pendiente de aprobación de jefatura (si soy encargado/admin) */}
                {isEncargado && (trade.status === 'pending_admin' || trade.rawStatus === 'PENDIENTE_APROBACION') && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => handleStartApproval(trade)}
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

                {/* 4. Solicitud enviada por mí que sigue pendiente: opción para cancelarla */}
                {isMyRequest && (trade.status === 'pending' || trade.status === 'pending_admin') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    {isOpen ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontStyle: 'italic' }}>
                        Esperando que un compañero tome la oferta abierta
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Esperando respuesta del compañero
                      </span>
                    )}
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBoletaTrade(trade.rawTrade || trade);
                      setIsBoletaModalOpen(true);
                    }}
                    style={{
                      background: 'rgba(6, 182, 212, 0.08)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      color: 'var(--accent-cyan)',
                      borderRadius: '8px',
                      padding: '0.3rem 0.6rem',
                      fontWeight: '700',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <FileText size={12} /> Boleta Oficial GSAN
                  </button>
                </div>
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
                      const displayName = c.fullName ? `${c.fullName} (${sig})` : (c.name && c.name !== sig ? `${c.name} (${sig})` : sig);
                      return (
                        <option key={sig} value={sig}>
                          {displayName} {requiredSkillForMyShift ? `· Habilitado ${requiredSkillForMyShift}` : ''}
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

      {/* Modal de Previsualización de Boleta Oficial GSAN */}
      <BoletaPreviewModal
        isOpen={isBoletaModalOpen}
        onClose={() => setIsBoletaModalOpen(false)}
        trade={selectedBoletaTrade}
        controllers={controllers}
      />

      {/* Modal de Selección y Confirmación del Encargado de Turno que aprueba (Mobile) */}
      {tradeToApprove && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            background: '#0d131f',
            borderRadius: '16px',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.6rem' }}>
              <ShieldCheck size={22} color="var(--accent-cyan)" />
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '800' }}>
                  Aprobación Oficial de Cambio
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Indica el Encargado de Turno (Supervisor) que autoriza esta boleta.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
              lineHeight: '1.4'
            }}>
              <div><strong>Trámite:</strong> {tradeToApprove.type === 'SWAP' ? 'Cambio de Secuencia (SWAP)' : 'Hechura de Turno (COVER)'}</div>
              <div><strong>Fecha:</strong> {tradeToApprove.date}</div>
              <div><strong>Turno:</strong> {tradeToApprove.fromSlot?.shift}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                Encargado de Turno (Supervisor) que Autoriza:
              </label>
              <select
                value={selectedApproverId}
                onChange={(e) => setSelectedApproverId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '8px',
                  backgroundColor: '#161e2e',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                {controllers
                  .filter(c => c.isSupervisor || (c.skills && c.skills.includes('CTE')))
                  .map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} - {sup.fullName || sup.name} {sup.signatureDataUrl || sup.signatureUrl ? '✓ (Firma digital registrada)' : '(Pendiente firma electrónica)'}
                    </option>
                  ))
                }
              </select>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                * Su firma electrónica se estampará exclusivamente en la boleta oficial GSAN.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setTradeToApprove(null)}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.45rem 1rem', fontWeight: '800' }}
              >
                Confirmar y Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aceptar Propuesta (Directa o Abierta) */}
      {isAcceptModalOpen && tradeToAccept && (() => {
        const isTradeOpen = Boolean(tradeToAccept.isPublic || tradeToAccept.toSig === 'OPEN' || tradeToAccept.toSig === 'ALL' || tradeToAccept.rawTrade?.toControllerId === 'OPEN');
        const fromCtrl = controllers.find(c => isSameCtrl(c, tradeToAccept.fromSig));
        const targetDate = (tradeToAccept.dateStr || tradeToAccept.date || tradeToAccept.rawTrade?.dateStr || tradeToAccept.rawTrade?.date || '').trim();
        const myShiftsOnDate = getMyShiftsForDate(targetDate);

        // Determinar habilidad requerida para el turno que deja fromCtrl
        const fromShiftObj = tradeToAccept.rawTrade?.fromSlot;
        const requiredSkillForFromShift = fromShiftObj 
          ? getRequiredSkillForSlot(fromShiftObj.slotKey, fromShiftObj.shift)
          : getRequiredSkillForSlot(tradeToAccept.fromShift);

        const isCurrentQualified = isControllerQualified(currentUser, requiredSkillForFromShift);

        // En COVER: verificar si el usuario ya tiene un turno en la misma jornada (ej: ambos turno Mañana M)
        const hasSameShiftConflict = tradeToAccept.type === 'COVER' && fromShiftObj && myShiftsOnDate.some(s => s.shift === fromShiftObj.shift);

        // En SWAP: verificar si fromCtrl está habilitado para el turno seleccionado del usuario actual
        const isFromCtrlQualifiedForSelected = selectedSwapSlot 
          ? isControllerQualified(fromCtrl, selectedSwapSlot.requiredSkill)
          : true;

        const canConfirm = tradeToAccept.type === 'COVER' 
          ? !hasSameShiftConflict 
          : (myShiftsOnDate.length > 0 && selectedSwapSlot !== null);

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '1rem'
          }}>
            <div className="glass-panel" style={{
              maxWidth: '480px',
              width: '100%',
              background: '#0d131f',
              borderRadius: '16px',
              border: `1px solid ${tradeToAccept.type === 'COVER' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)'}`,
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {tradeToAccept.type === 'COVER' ? (
                    <CheckCircle2 size={22} color="var(--status-success)" />
                  ) : (
                    <ArrowRightLeft size={22} color="var(--accent-cyan)" />
                  )}
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '800' }}>
                      {tradeToAccept.type === 'COVER' ? 'Aceptar Reemplazo (COVER)' : 'Aceptar Intercambio (SWAP)'}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: isTradeOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                      {isTradeOpen ? '🌐 Solicitud abierta a cualquier compañero' : 'Solicitud directa'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAcceptModalOpen(false);
                    setTradeToAccept(null);
                    setSelectedSwapSlot(null);
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Resumen del Turno Solicitado */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                fontSize: '0.76rem',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}>
                <div><strong>Solicitante:</strong> {tradeToAccept.fromName} ({tradeToAccept.fromSig})</div>
                <div><strong>Fecha:</strong> {tradeToAccept.dateStr}</div>
                <div>
                  <strong>Turno a recibir / cubrir:</strong>{' '}
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                    {tradeToAccept.fromShift}
                  </span>
                </div>
                {tradeToAccept.comment && (
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                    "{tradeToAccept.comment}"
                  </div>
                )}
              </div>

              {/* Advertencia de Habilitación para el usuario actual */}
              {!isCurrentQualified && requiredSkillForFromShift && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--status-warning)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.72rem',
                  color: 'var(--status-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Aviso: No tienes registrada la habilitación operativa <strong>{requiredSkillForFromShift}</strong> para este turno.
                  </span>
                </div>
              )}

              {/* LÓGICA ESPECÍFICA SEGÚN TIPO */}
              {tradeToAccept.type === 'COVER' ? (
                <div>
                  {hasSameShiftConflict ? (
                    <div style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid var(--status-danger)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      fontSize: '0.72rem',
                      color: 'var(--status-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <XCircle size={16} style={{ flexShrink: 0 }} />
                      <span>
                        Conflicto de horario: Ya tienes un turno asignado en la jornada ({fromShiftObj?.shift}) en esta misma fecha. No es posible cubrir dos posiciones al mismo tiempo.
                      </span>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Al aceptar, te comprometes a cubrir el turno de <strong>{tradeToAccept.fromName}</strong> el día <strong>{tradeToAccept.dateStr}</strong>.
                      La solicitud quedará acordada y se remitirá a Jefatura/Supervisor para su aprobación y aplicación en el Roster oficial.
                    </p>
                  )}
                </div>
              ) : (
                /* SWAP */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Selecciona tu turno a ceder ({currentUser?.name}):
                  </label>

                  {myShiftsOnDate.length === 0 ? (
                    <div style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid var(--status-danger)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      fontSize: '0.72rem',
                      color: 'var(--status-danger)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.4rem'
                    }}>
                      <XCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong>No tienes turno asignado este día ({tradeToAccept.dateStr}).</strong>
                        <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9 }}>
                          Para realizar un intercambio (SWAP) debes tener una posición asignada en esa fecha para entregar a cambio.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {myShiftsOnDate.map((slot, idx) => {
                        const isSelected = selectedSwapSlot && selectedSwapSlot.shift === slot.shift && selectedSwapSlot.slotKey === slot.slotKey;
                        const isFromQualified = isControllerQualified(fromCtrl, slot.requiredSkill);

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSwapSlot(slot)}
                            style={{
                              background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-tertiary)',
                              border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--glass-border)'}`,
                              borderRadius: '8px',
                              padding: '0.6rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)' }} />}
                              </div>
                              <div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '0.82rem', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                                  {slot.fullCode}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
                                  Posición: {slot.slotKey} (Jornada {slot.shift})
                                </span>
                              </div>
                            </div>

                            {!isFromQualified && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--status-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                                Sin hab. {slot.requiredSkill}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!isFromCtrlQualifiedForSelected && selectedSwapSlot && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid var(--status-warning)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      fontSize: '0.7rem',
                      color: 'var(--status-warning)'
                    }}>
                      ⚠️ Advertencia: {tradeToAccept.fromName} no tiene registrada la certificación ({selectedSwapSlot.requiredSkill}) para el turno seleccionado.
                    </div>
                  )}
                </div>
              )}

              {/* Botones de Acción */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsAcceptModalOpen(false);
                    setTradeToAccept(null);
                    setSelectedSwapSlot(null);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.5rem 0.9rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={handleConfirmAcceptTrade}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.5rem 1.1rem',
                    fontWeight: '800',
                    opacity: canConfirm ? 1 : 0.5,
                    cursor: canConfirm ? 'pointer' : 'not-allowed',
                    background: tradeToAccept.type === 'COVER' ? 'var(--status-success)' : 'var(--accent-cyan)',
                    color: '#000'
                  }}
                >
                  Confirmar y Acordar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
