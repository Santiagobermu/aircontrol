import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Users, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Sparkles, 
  ArrowRightLeft, 
  ShieldCheck, 
  EyeOff, 
  UserCheck, 
  X, 
  Check, 
  Filter, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { getSlotAcronym, getSlotDescription } from '../../utils/schedulerEngine';

export default function MobileGeneralRosterView({
  currentUser,
  scheduleMonth = {},
  exceptions = {},
  controllers = [],
  publishState = {},
  userRole = 'controller',
  onOpenTradeModal
}) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'DESC' | 'M' | 'T' | 'N' | 'A' | 'EXC'
  const [skillFilter, setSkillFilter] = useState('ALL'); // 'ALL' | 'TWR' | 'GND' | 'DEL' | 'FIC' | 'CTE'
  const [isSmartAssistantActive, setIsSmartAssistantActive] = useState(false);
  const [selectedMyShiftToCover, setSelectedMyShiftToCover] = useState(null);

  const carouselRef = useRef(null);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Asegurar que el día seleccionado sea válido dentro del mes
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth, selectedDay]);

  // Centrar el día seleccionado en el carrusel
  useEffect(() => {
    if (carouselRef.current) {
      const activeElement = carouselRef.current.querySelector(`.day-pill-active`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDay, selectedMonth, selectedYear]);

  // Verificar si el mes está publicado oficialmente
  const isEncargado = userRole === 'admin' || currentUser?.isSupervisor || currentUser?.isAdmin || (currentUser?.skills && currentUser.skills.includes('CTE'));
  const isMonthPublished = Boolean(publishState && publishState[monthKey]);
  const canViewRoster = isMonthPublished || isEncargado;

  const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
    setSelectedDay(1);
  };

  // Helper para comparar controladores
  const isSameCtrl = (ctrlA, ctrlB) => {
    if (!ctrlA || !ctrlB) return false;
    const sigA = (typeof ctrlA === 'string' ? ctrlA : (ctrlA.signature || ctrlA.id || ctrlA.name || '')).toString().trim().toUpperCase();
    const sigB = (typeof ctrlB === 'string' ? ctrlB : (ctrlB.signature || ctrlB.id || ctrlB.name || '')).toString().trim().toUpperCase();
    if (sigA && sigB && sigA === sigB) return true;
    const idA = (typeof ctrlA === 'object' ? (ctrlA.id || ctrlA.signature) : ctrlA).toString().trim().toUpperCase();
    const idB = (typeof ctrlB === 'object' ? (ctrlB.id || ctrlB.signature) : ctrlB).toString().trim().toUpperCase();
    return idA && idB && idA === idB;
  };

  // Helper para determinar la habilidad requerida por una posición
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
    if (!requiredSkill) return true;
    const skills = ctrl.skills || [];
    if (requiredSkill === 'CTE') {
      return ctrl.isSupervisor || ctrl.isAdmin || skills.includes('CTE');
    }
    return skills.includes(requiredSkill) || skills.includes(requiredSkill.toUpperCase());
  };

  // Obtener los turnos del usuario logueado en la fecha seleccionada
  const myShiftsOnDate = useMemo(() => {
    if (!currentUser || !scheduleMonth || !scheduleMonth[dateKey]) return [];
    const daySched = scheduleMonth[dateKey];
    const found = [];

    ['M', 'T', 'N', 'A'].forEach(shift => {
      const slots = daySched[shift] || {};
      Object.entries(slots).forEach(([slotKey, assignedId]) => {
        if (assignedId && isSameCtrl(assignedId, currentUser)) {
          const acronym = getSlotAcronym(slotKey, shift);
          const fullCode = `${shift}${acronym}`;
          const requiredSkill = getRequiredSkillForSlot(slotKey, shift);
          found.push({
            shift,
            slotKey,
            acronym,
            fullCode,
            requiredSkill
          });
        }
      });
    });

    return found;
  }, [currentUser, scheduleMonth, dateKey]);

  // Actualizar el turno propio a cubrir cuando cambie la fecha o los turnos
  useEffect(() => {
    if (myShiftsOnDate.length > 0) {
      setSelectedMyShiftToCover(myShiftsOnDate[0]);
    } else {
      setSelectedMyShiftToCover(null);
    }
  }, [dateKey, myShiftsOnDate]);

  // Mapear el estado de cada controlador para el día seleccionado
  const controllersRosterData = useMemo(() => {
    if (!scheduleMonth) return [];
    const daySched = scheduleMonth[dateKey] || {};

    return controllers.map(ctrl => {
      const ctrlId = ctrl.id || ctrl.signature;
      const ctrlSig = (ctrl.signature || ctrl.id || ctrl.name || '').toString().trim();
      const isMe = isSameCtrl(ctrl, currentUser);

      // 1. Revisar si tiene excepción o descanso registrado
      const exc = exceptions?.[ctrlId]?.[dateKey] || exceptions?.[ctrlSig]?.[dateKey];
      let exceptionStatus = null;
      if (exc && exc !== 'OPERATIVO') {
        exceptionStatus = exc;
      }

      // 2. Revisar turnos asignados en el schedule
      const assignedShifts = [];
      ['M', 'T', 'N', 'A'].forEach(shift => {
        const slots = daySched[shift] || {};
        Object.entries(slots).forEach(([slotKey, assigned]) => {
          if (assigned && isSameCtrl(assigned, ctrl)) {
            const acronym = getSlotAcronym(slotKey, shift);
            const fullCode = `${shift}${acronym}`;
            const posDescription = getSlotDescription(slotKey, shift);
            const requiredSkill = getRequiredSkillForSlot(slotKey, shift);
            assignedShifts.push({
              shift,
              slotKey,
              acronym,
              fullCode,
              posDescription,
              requiredSkill
            });
          }
        });
      });

      // 3. Determinar estado global
      let statusCategory = 'DESC'; // 'DESC' | 'M' | 'T' | 'N' | 'A' | 'EXC'
      let statusLabel = 'DESCANSO / LIBRE';

      if (exceptionStatus) {
        statusCategory = exceptionStatus === 'DESCANSO' ? 'DESC' : 'EXC';
        statusLabel = exceptionStatus;
      } else if (assignedShifts.length > 0) {
        statusCategory = assignedShifts[0].shift;
        statusLabel = assignedShifts.map(s => s.fullCode).join(' + ');
      }

      const skills = ctrl.skills || [];
      const hasCTE = ctrl.isSupervisor || ctrl.isAdmin || skills.includes('CTE');

      return {
        ctrl,
        id: ctrlId,
        sig: ctrlSig,
        name: ctrl.name || ctrlSig,
        isMe,
        exceptionStatus,
        assignedShifts,
        statusCategory,
        statusLabel,
        skills,
        hasCTE
      };
    });
  }, [controllers, scheduleMonth, exceptions, dateKey, currentUser]);

  // Contadores resumen del día
  const statsCounters = useMemo(() => {
    const counts = { total: controllersRosterData.length, DESC: 0, M: 0, T: 0, N: 0, A: 0, EXC: 0 };
    controllersRosterData.forEach(item => {
      if (counts[item.statusCategory] !== undefined) {
        counts[item.statusCategory]++;
      }
    });
    return counts;
  }, [controllersRosterData]);

  // Filtrar y ordenar controladores
  const filteredControllers = useMemo(() => {
    return controllersRosterData.filter(item => {
      // Filtro de Búsqueda por Texto (Nombre o Sigla)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesSig = item.sig.toLowerCase().includes(query);
        const matchesShift = item.assignedShifts.some(s => s.fullCode.toLowerCase().includes(query));
        if (!matchesName && !matchesSig && !matchesShift) return false;
      }

      // Filtro por Estado (Descanso / Jornadas / Excepciones)
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DESC' && item.statusCategory !== 'DESC') return false;
        if (statusFilter === 'M' && item.statusCategory !== 'M') return false;
        if (statusFilter === 'T' && item.statusCategory !== 'T') return false;
        if (statusFilter === 'N' && item.statusCategory !== 'N') return false;
        if (statusFilter === 'A' && item.statusCategory !== 'A') return false;
        if (statusFilter === 'EXC' && item.statusCategory !== 'EXC') return false;
      }

      // Filtro por Habilidad / Certificación
      if (skillFilter !== 'ALL') {
        if (!isControllerQualified(item.ctrl, skillFilter)) return false;
      }

      // Filtro del Asistente Inteligente ("Buscar quién puede cubrirme")
      if (isSmartAssistantActive && selectedMyShiftToCover) {
        // Excluirse a uno mismo
        if (item.isMe) return false;

        const reqSkill = selectedMyShiftToCover.requiredSkill;
        // Debe tener la habilidad requerida
        if (reqSkill && !isControllerQualified(item.ctrl, reqSkill)) return false;

        // No debe estar trabajando en el mismo turno
        const isWorkingSameShift = item.assignedShifts.some(s => s.shift === selectedMyShiftToCover.shift);
        if (isWorkingSameShift) return false;
      }

      return true;
    }).sort((a, b) => {
      // Si el asistente inteligente está activo, priorizar los que están en DESCANSO primero
      if (isSmartAssistantActive) {
        if (a.statusCategory === 'DESC' && b.statusCategory !== 'DESC') return -1;
        if (a.statusCategory !== 'DESC' && b.statusCategory === 'DESC') return 1;
      }
      // Poner al usuario logueado al inicio en la vista general
      if (a.isMe) return -1;
      if (b.isMe) return 1;

      // Ordenar por categoría (Turnos primero, luego descansos)
      const order = { 'M': 1, 'T': 2, 'N': 3, 'A': 4, 'DESC': 5, 'EXC': 6 };
      const rankA = order[a.statusCategory] || 99;
      const rankB = order[b.statusCategory] || 99;
      if (rankA !== rankB) return rankA - rankB;

      return a.name.localeCompare(b.name);
    });
  }, [controllersRosterData, searchQuery, statusFilter, skillFilter, isSmartAssistantActive, selectedMyShiftToCover]);

  // Estilos de badge por código de turno
  const getShiftBadgeStyle = (shiftCode) => {
    switch (shiftCode) {
      case 'M': return { bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.4)', color: 'var(--shift-manana)', label: 'MAÑANA (06:00 - 12:00)' };
      case 'T': return { bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)', color: 'var(--shift-tarde)', label: 'TARDE (12:00 - 18:00)' };
      case 'N': return { bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.4)', color: 'var(--shift-noche)', label: 'NOCHE (18:00 - 24:00)' };
      case 'A': return { bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.4)', color: 'var(--shift-madrugada)', label: 'MADRUGADA (00:00 - 06:00)' };
      default: return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', color: 'var(--status-success)', label: 'DESCANSO / LIBRE' };
    }
  };

  // Manejar solicitud directa de Reemplazo (COVER)
  const handleRequestCover = (targetCtrl) => {
    if (!onOpenTradeModal) return;
    const myShiftCode = selectedMyShiftToCover ? selectedMyShiftToCover.fullCode : (myShiftsOnDate[0]?.fullCode || '');
    onOpenTradeModal(dateKey, 'COVER', {
      targetSig: targetCtrl.sig,
      selectedMyShift: myShiftCode,
      comment: `Solicitud de reemplazo para el día ${dateKey}`
    });
  };

  // Manejar solicitud directa de Permuta (SWAP)
  const handleRequestSwap = (targetCtrl, targetShiftObj) => {
    if (!onOpenTradeModal) return;
    const myShiftCode = selectedMyShiftToCover ? selectedMyShiftToCover.fullCode : (myShiftsOnDate[0]?.fullCode || '');
    const targetShiftCode = targetShiftObj ? targetShiftObj.fullCode : (targetCtrl.assignedShifts[0]?.fullCode || '');

    onOpenTradeModal(dateKey, 'SWAP', {
      targetSig: targetCtrl.sig,
      targetShift: targetShiftCode,
      selectedMyShift: myShiftCode,
      comment: `Propuesta de permuta (${myShiftCode} ⇄ ${targetShiftCode}) para el día ${dateKey}`
    });
  };

  // Si el mes no está publicado y el usuario no es encargado
  if (!canViewRoster) {
    return (
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: 'var(--glass-shadow)',
        margin: '0.5rem 0'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--status-danger)'
        }}>
          <EyeOff size={28} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            Malla en Planificación
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '320px' }}>
            El Roster General para <strong>{monthNames[selectedMonth]} {selectedYear}</strong> se encuentra en borrador y no está publicado oficialmente por Jefatura.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            onClick={handlePrevMonth}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ← Mes Anterior
          </button>
          <button
            onClick={() => {
              setSelectedMonth(today.getMonth());
              setSelectedYear(today.getFullYear());
              setSelectedDay(today.getDate());
            }}
            style={{
              background: 'var(--accent-cyan)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              color: '#000',
              fontSize: '0.78rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Ver Mes Actual
          </button>
        </div>
      </div>
    );
  }

  const dayOfWeekNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      
      {/* 1. CABECERA: SELECTOR DE MES Y BOTÓN HOY */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '0.75rem 0.9rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--glass-shadow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CalendarIcon size={18} color="var(--accent-cyan)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {monthNames[selectedMonth]} {selectedYear}
            </h3>
            <span style={{ fontSize: '0.68rem', color: 'var(--status-success)', fontWeight: '700' }}>
              ● Roster Publicado Oficial
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => {
              setSelectedMonth(today.getMonth());
              setSelectedYear(today.getFullYear());
              setSelectedDay(today.getDate());
            }}
            style={{
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              borderRadius: '7px',
              padding: '0.3rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>
          <button
            onClick={handlePrevMonth}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              borderRadius: '7px',
              padding: '0.3rem',
              cursor: 'pointer'
            }}
            title="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              borderRadius: '7px',
              padding: '0.3rem',
              cursor: 'pointer'
            }}
            title="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 2. CARRUSEL HORIZONTAL DE DÍAS DEL MES */}
      <div
        ref={carouselRef}
        style={{
          display: 'flex',
          gap: '0.4rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dNum = i + 1;
          const dObj = new Date(selectedYear, selectedMonth, dNum);
          const dayOfWeek = dayOfWeekNames[dObj.getDay()];
          const isSelected = dNum === selectedDay;
          const isToday = dNum === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
          const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

          return (
            <button
              key={dNum}
              onClick={() => setSelectedDay(dNum)}
              className={isSelected ? 'day-pill-active' : ''}
              style={{
                flex: '0 0 auto',
                width: '52px',
                padding: '0.45rem 0.2rem',
                borderRadius: '12px',
                border: isSelected 
                  ? '2px solid var(--accent-cyan)' 
                  : isToday 
                    ? '1.5px solid var(--accent-cyan)' 
                    : '1px solid var(--glass-border)',
                background: isSelected 
                  ? 'var(--accent-cyan)' 
                  : isToday 
                    ? 'rgba(6, 182, 212, 0.12)' 
                    : 'var(--bg-secondary)',
                color: isSelected 
                  ? '#000' 
                  : isToday 
                    ? 'var(--accent-cyan)' 
                    : 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.15rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: isSelected ? '0 0 12px rgba(6, 182, 212, 0.4)' : 'none'
              }}
            >
              <span style={{
                fontSize: '0.62rem',
                fontWeight: '700',
                color: isSelected ? '#000' : isWeekend ? 'var(--status-warning)' : 'var(--text-muted)',
                textTransform: 'uppercase'
              }}>
                {dayOfWeek}
              </span>
              <span style={{
                fontSize: '1rem',
                fontWeight: '800',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1
              }}>
                {dNum}
              </span>
              {isToday && (
                <span style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: isSelected ? '#000' : 'var(--accent-cyan)',
                  marginTop: '0.1rem'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. ASISTENTE INTELIGENTE: "¿QUIÉN PUEDE CUBRIRME HOY?" */}
      <div style={{
        background: isSmartAssistantActive 
          ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)' 
          : 'var(--glass-bg)',
        border: isSmartAssistantActive 
          ? '1.5px solid var(--accent-cyan)' 
          : '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '0.8rem 0.9rem',
        boxShadow: isSmartAssistantActive ? '0 0 16px rgba(6, 182, 212, 0.25)' : 'var(--glass-shadow)',
        transition: 'all 0.25s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Sparkles size={18} color="var(--accent-cyan)" />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Asistente de Reemplazo
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Encuentra colegas habilitados y disponibles para tu turno
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsSmartAssistantActive(!isSmartAssistantActive)}
            style={{
              background: isSmartAssistantActive ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
              border: `1px solid ${isSmartAssistantActive ? 'var(--accent-cyan)' : 'var(--glass-border)'}`,
              color: isSmartAssistantActive ? '#000' : 'var(--text-secondary)',
              borderRadius: '99px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.72rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s ease'
            }}
          >
            {isSmartAssistantActive ? <Check size={14} /> : <Sparkles size={14} />}
            {isSmartAssistantActive ? 'Filtro Activo' : 'Buscar Reemplazo'}
          </button>
        </div>

        {/* Detalles del Asistente cuando está activo */}
        {isSmartAssistantActive && (
          <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {myShiftsOnDate.length > 0 ? (
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Selecciona tu turno a cubrir el <strong>Día {selectedDay}</strong>:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {myShiftsOnDate.map((s, idx) => {
                    const isSelected = selectedMyShiftToCover?.fullCode === s.fullCode;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedMyShiftToCover(s)}
                        style={{
                          background: isSelected ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                          color: isSelected ? '#000' : 'var(--text-primary)',
                          border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          padding: '0.3rem 0.6rem',
                          fontWeight: '800',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer'
                        }}
                      >
                        {s.fullCode} ({s.requiredSkill || 'General'})
                      </button>
                    );
                  })}
                </div>
                {selectedMyShiftToCover && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: 'var(--accent-cyan)', fontStyle: 'italic' }}>
                    💡 Mostrando colegas habilitados en <strong>{selectedMyShiftToCover.requiredSkill || 'General'}</strong> que están en descanso o sin turno simultáneo.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-warning)', fontSize: '0.75rem' }}>
                <AlertCircle size={15} />
                <span>Estás libre/descanso este día. Mostrando todos los controladores habilitados.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. BUSCADOR Y CHIPS DE FILTRO RÁPIDO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        
        {/* Barra de Búsqueda */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '0.45rem 0.75rem',
          gap: '0.5rem'
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Buscar controlador por nombre o sigla (ej. BER)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8rem'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Chips de Filtro por Estado */}
        <div style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: '0.2rem'
        }}>
          {[
            { id: 'ALL', label: `Todos (${statsCounters.total})` },
            { id: 'DESC', label: `🟢 Descanso (${statsCounters.DESC})` },
            { id: 'M', label: `☀️ Mañana (${statsCounters.M})` },
            { id: 'T', label: `🌅 Tarde (${statsCounters.T})` },
            { id: 'N', label: `🌙 Noche (${statsCounters.N})` },
            { id: 'A', label: `🌌 Madrugada (${statsCounters.A})` },
            { id: 'EXC', label: `Excepciones (${statsCounters.EXC})` }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id)}
              style={{
                flex: '0 0 auto',
                background: statusFilter === chip.id ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
                color: statusFilter === chip.id ? '#000' : 'var(--text-secondary)',
                border: statusFilter === chip.id ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.3rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chips de Filtro por Habilitación Operativa */}
        <div style={{
          display: 'flex',
          gap: '0.35rem',
          alignItems: 'center',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', flex: '0 0 auto', marginRight: '0.1rem' }}>
            Habilitación:
          </span>
          {['ALL', 'TWR', 'GND', 'DEL', 'FIC', 'CTE'].map(skill => (
            <button
              key={skill}
              onClick={() => setSkillFilter(skill)}
              style={{
                flex: '0 0 auto',
                background: skillFilter === skill ? 'var(--bg-tertiary)' : 'transparent',
                color: skillFilter === skill ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: skillFilter === skill ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.68rem',
                fontWeight: '800',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer'
              }}
            >
              {skill === 'ALL' ? 'Todas' : skill}
            </button>
          ))}
        </div>

      </div>

      {/* 5. LISTA DE CONTROLADORES PARA EL DÍA SELECCIONADO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.2rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            Día {selectedDay} de {monthNames[selectedMonth]} · {filteredControllers.length} controladores
          </span>
          {(searchQuery || statusFilter !== 'ALL' || skillFilter !== 'ALL' || isSmartAssistantActive) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setSkillFilter('ALL');
                setIsSmartAssistantActive(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.72rem',
                fontWeight: '700',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filteredControllers.length > 0 ? (
          filteredControllers.map((item, idx) => {
            const isMe = item.isMe;
            const isDescanso = item.statusCategory === 'DESC';
            const hasShift = item.assignedShifts.length > 0;
            const primaryShift = item.assignedShifts[0];
            const badgeStyle = getShiftBadgeStyle(item.statusCategory);

            // Compatibilidad para el asistente inteligente
            const isIdealCandidate = isSmartAssistantActive && isDescanso;

            return (
              <div
                key={item.id || idx}
                style={{
                  background: isMe 
                    ? 'rgba(6, 182, 212, 0.08)' 
                    : isIdealCandidate 
                      ? 'rgba(16, 185, 129, 0.08)' 
                      : 'var(--glass-bg)',
                  border: isMe 
                    ? '1.5px solid var(--accent-cyan)' 
                    : isIdealCandidate 
                      ? '1.5px solid var(--status-success)' 
                      : '1px solid var(--glass-border)',
                  borderRadius: '14px',
                  padding: '0.85rem',
                  boxShadow: 'var(--glass-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Fila Superior: Datos del Controlador y Estado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {/* Avatar con Sigla */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: isMe ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                      color: isMe ? '#000' : 'var(--text-primary)',
                      border: '1px solid var(--glass-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {item.sig}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: isMe ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          {item.name}
                        </strong>
                        {isMe && (
                          <span style={{
                            background: 'var(--accent-cyan)',
                            color: '#000',
                            fontSize: '0.62rem',
                            fontWeight: '800',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px'
                          }}>
                            TÚ
                          </span>
                        )}
                        {item.hasCTE && (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: 'var(--status-warning)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            fontSize: '0.62rem',
                            fontWeight: '800',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px'
                          }}>
                            CTE
                          </span>
                        )}
                      </div>
                      
                      {/* Habilitaciones */}
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        {item.skills && item.skills.length > 0 ? (
                          item.skills.map(sk => (
                            <span key={sk} style={{
                              fontSize: '0.62rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: '700',
                              color: 'var(--text-muted)',
                              background: 'var(--bg-tertiary)',
                              padding: '0.05rem 0.3rem',
                              borderRadius: '4px'
                            }}>
                              {sk}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Sin habilitaciones</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badge de Estado / Turno */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                    {hasShift ? (
                      item.assignedShifts.map((sh, sIdx) => {
                        const shStyle = getShiftBadgeStyle(sh.shift);
                        return (
                          <span key={sIdx} style={{
                            background: shStyle.bg,
                            border: `1px solid ${shStyle.border}`,
                            color: shStyle.color,
                            padding: '0.25rem 0.55rem',
                            borderRadius: '7px',
                            fontWeight: '800',
                            fontSize: '0.78rem',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {sh.fullCode}
                          </span>
                        );
                      })
                    ) : item.exceptionStatus ? (
                      <span style={{
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid rgba(244, 63, 94, 0.35)',
                        color: 'var(--status-danger)',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '7px',
                        fontWeight: '800',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {item.exceptionStatus}
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: 'var(--status-success)',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '7px',
                        fontWeight: '800',
                        fontSize: '0.72rem'
                      }}>
                        🟢 Libre / DESC
                      </span>
                    )}

                    {isIdealCandidate && (
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: '800',
                        color: 'var(--status-success)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}>
                        <Sparkles size={10} /> Ideal para Reemplazo
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalle de Posición si está en turno */}
                {hasShift && primaryShift && (
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <Clock size={13} color="var(--accent-cyan)" />
                    <span>{primaryShift.posDescription} · {badgeStyle.label}</span>
                  </div>
                )}

                {/* BOTÓN DE ACCIÓN DIRECTA (Solo para otros controladores) */}
                {!isMe && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem' }}>
                    {isDescanso ? (
                      <button
                        onClick={() => handleRequestCover(item)}
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Sparkles size={14} />
                        Solicitar Reemplazo (COVER)
                      </button>
                    ) : hasShift ? (
                      <button
                        onClick={() => handleRequestSwap(item, primaryShift)}
                        style={{
                          flex: 1,
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid var(--status-warning)',
                          color: 'var(--status-warning)',
                          padding: '0.5rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <ArrowRightLeft size={14} />
                        Solicitar Permuta (SWAP con {primaryShift?.fullCode})
                      </button>
                    ) : null}
                  </div>
                )}

              </div>
            );
          })
        ) : (
          <div style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '14px',
            padding: '2rem 1rem',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              No se encontraron controladores con los filtros aplicados para esta fecha.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
