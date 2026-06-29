import { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  Trash2, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle,
  GraduationCap,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { SHIFTS, SHIFT_REQUIREMENTS, validateAssignment, getSequenceDayIndex, isColombianHoliday, getSlotAcronym, getSlotDescription } from '../utils/schedulerEngine';

const getPositionPriority = (slotKey) => {
  const pos = slotKey.split('-')[0];
  switch (pos) {
    case 'CTE': return 1;
    case 'TWR': return 2;
    case 'GND': return 3;
    case 'DEL': return 4;
    case 'FIC': return 5;
    case 'ENT': return 6;
    default: return 99;
  }
};

export default function SchedulerGrid({ 
  schedule, 
  controllers, 
  exceptions, 
  currentYear,
  currentMonth,
  onNavigateMonth,
  onAssignController, 
  onAutoScheduleMonth, 
  onClearScheduleMonth,
  sequencePattern,
  onUpdateSequence,
  onAddCustomSlot,
  onRemoveCustomSlot,
  userRole
}) {
  const [selectedDayStr, setSelectedDayStr] = useState('');
  const [activeAssignSlot, setActiveAssignSlot] = useState(null); // { day, shift, slotKey }
  const [showPatternPanel, setShowPatternPanel] = useState(false);
  const [activeAddPositionShift, setActiveAddPositionShift] = useState(null); // 'A', 'M', 'T', 'N' or null
  const [selectedNewPosition, setSelectedNewPosition] = useState('ENT'); // default to 'ENT'

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Calcular dinámicamente todos los días del mes actual en formato YYYY-MM-DD
  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth + 1, 0);
    const count = date.getDate();
    
    const days = [];
    for (let i = 1; i <= count; i++) {
      const dayStr = String(i).padStart(2, '0');
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      days.push(`${currentYear}-${monthStr}-${dayStr}`);
    }
    return days;
  }, [currentYear, currentMonth]);

  const activeSelectedDayStr = daysInMonth.includes(selectedDayStr) ? selectedDayStr : (daysInMonth[0] || '');

  const handleOpenAssign = (day, shift, slotKey) => {
    setActiveAssignSlot({ day, shift, slotKey });
  };

  const handleCloseAssign = () => {
    setActiveAssignSlot(null);
  };

  const handleSelectController = (controllerId) => {
    if (activeAssignSlot) {
      const { day, shift, slotKey } = activeAssignSlot;
      onAssignController(day, shift, slotKey, controllerId);
      handleCloseAssign();
    }
  };

  const getPositionColorClass = (pos) => {
    switch (pos) {
      case 'CTE': return 'cte';
      case 'TWR': return 'twr';
      case 'GND': return 'gnd';
      case 'DEL': return 'del';
      case 'FIC': return 'fic';
      case 'ENT': return 'del'; // Entrenamiento
      case 'INS': return 'ins'; // Instrucción
      case 'CAE': return 'mcae'; // Capacitación Especial
      case 'CHEC': return 'mchec'; // Chequeo
      case 'ACC': return 'acc'; // Centro de Control de Área
      default: return '';
    }
  };



  const getShiftTimeLabel = (shift) => {
    switch (shift) {
      case 'A': return '00:00 - 06:00 (Madrugada)';
      case 'M': return '06:00 - 12:00 (Mañana)';
      case 'T': return '12:00 - 18:00 (Tarde)';
      case 'N': return '18:00 - 24:00 (Noche)';
      default: return '';
    }
  };

  const formatCalendarDayName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dayNames[date.getDay()]} (${date.getDate()} ${monthNamesShort[date.getMonth()]})`;
  };

  const getDaySimpleName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dayNames[date.getDay()];
  };

  const getDayNumber = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.split('-')[2];
  };

  // Generar lista de candidatos válidos con diagnósticos para el selector
  const getCandidatesForActiveSlot = () => {
    if (!activeAssignSlot) return [];
    const { day, shift, slotKey } = activeAssignSlot;
    const position = slotKey.split('-')[0];

    return controllers.map(c => {
      const validation = validateAssignment(c.id, day, shift, slotKey, schedule, controllers, exceptions, true);
      
      // Contar turnos actuales programados para esta semana (para dar contexto de carga)
      let weeklyShifts = 0;
      // Obtener los días de la semana de esta fecha específica
      let weekDaysOfDate = [];
      try {
        const date = new Date(day + 'T00:00:00');
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const mon = new Date(date.setDate(diff));
        for (let i = 0; i < 7; i++) {
          const d = new Date(mon);
          d.setDate(mon.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          weekDaysOfDate.push(`${yyyy}-${mm}-${dd}`);
        }
      } catch {
        weekDaysOfDate = [day];
      }

      weekDaysOfDate.forEach(d => {
        SHIFTS.forEach(s => {
          if (schedule[d]?.[s] && Object.values(schedule[d][s]).includes(c.id)) {
            weeklyShifts++;
          }
        });
      });

      const ctrlIdx = controllers.indexOf(c);
      const seqDayIdx = getSequenceDayIndex(ctrlIdx, day);
      const targetPattern = sequencePattern[seqDayIdx] || 'DESCANSO';

      return {
        controller: c,
        isValid: validation.isValid,
        error: validation.error,
        weeklyShifts,
        targetPattern,
        seqDayNum: seqDayIdx + 1
      };
    }).sort((a, b) => {
      if (a.isValid !== b.isValid) return b.isValid - a.isValid;

      const aMatches = a.targetPattern === shift || a.targetPattern === 'Cualquiera' || 
                       (a.targetPattern === 'M+T' && (shift === 'M' || shift === 'T')) ||
                       (a.targetPattern === 'T+N' && (shift === 'T' || shift === 'N'));
      const bMatches = b.targetPattern === shift || b.targetPattern === 'Cualquiera' ||
                       (b.targetPattern === 'M+T' && (shift === 'M' || shift === 'T')) ||
                       (b.targetPattern === 'T+N' && (shift === 'T' || shift === 'N'));

      if (aMatches !== bMatches) return bMatches ? 1 : -1;

      if (position === 'ENT' && a.controller.trainingPreferred !== b.controller.trainingPreferred) {
        return b.controller.trainingPreferred ? 1 : -1;
      }

      if (a.isValid) return a.weeklyShifts - b.weeklyShifts;
      return 0;
    });
  };

  const activeCandidates = getCandidatesForActiveSlot();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Barra superior de herramientas del programador */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--color-border)',
        padding: '1rem 1.5rem',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CalendarIcon size={20} style={{ color: 'var(--accent-cyan)' }} />
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Planificador Mensual ElDorado</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Cuadrante por mes calendario. Mes seleccionado: **{monthNames[currentMonth]} {currentYear}**.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Navegador de Meses */}
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            <button 
              onClick={() => onNavigateMonth('prev')} 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 0.75rem', borderRadius: 0, border: 'none' }}
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => onNavigateMonth('next')} 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 0.75rem', borderRadius: 0, border: 'none', borderLeft: '1px solid var(--color-border)' }}
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {userRole === 'admin' && (
            <>
              <button 
                onClick={() => setShowPatternPanel(!showPatternPanel)} 
                className={`btn ${showPatternPanel ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
              >
                <Sliders size={16} />
                Secuencia Rotativa
              </button>
              <button 
                onClick={onAutoScheduleMonth} 
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                <Sparkles size={16} />
                Auto-Completar Mes
              </button>
              <button 
                onClick={onClearScheduleMonth} 
                className="btn btn-secondary btn-danger-outline"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                <Trash2 size={16} />
                Limpiar Mes
              </button>
            </>
          )}
        </div>
      </div>

      {/* PANEL DE CONTROL: SECUENCIA DE 6 DIAS AJUSTABLE */}
      {showPatternPanel && (
        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--accent-cyan)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Sliders size={18} style={{ color: 'var(--accent-cyan)' }} />
            Configurador de Secuencia Rotativa de 6 Días
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
            Ajusta los turnos del patrón de 6 días. El algoritmo agrupará a los 61 controladores en 6 subgrupos desfasados para cubrir el Roster operativo en torre las 24 horas.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem'
          }}>
            {Array.from({ length: 6 }).map((_, idx) => {
              const currentValue = sequencePattern[idx] || 'DESCANSO';
              return (
                <div 
                  key={idx} 
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                    DÍA {idx + 1} del Ciclo
                  </span>
                  <select
                    className="form-input"
                    style={{ padding: '0.4rem', fontSize: '0.8rem', borderRadius: '6px' }}
                    value={currentValue}
                    onChange={(e) => onUpdateSequence(idx, e.target.value)}
                  >
                    <option value="M">M (Mañana)</option>
                    <option value="T">T (Tarde)</option>
                    <option value="N">N (Noche)</option>
                    <option value="A">A (Madrugada)</option>
                    <option value="M+T">M + T (Doble)</option>
                    <option value="T+N">T + N (Doble)</option>
                    <option value="Cualquiera">Cualquiera</option>
                    <option value="DESCANSO">Descanso</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTOR EN CUADRICULA DEL DIA DEL MES (Estilo Calendario Compacto) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Selecciona un Día de {monthNames[currentMonth]} para Programar slots:
        </span>
        
        <div 
          className="calendar-grid-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.4rem',
            backgroundColor: 'rgba(11, 15, 25, 0.4)',
            border: '1px solid var(--color-border)',
            padding: '0.6rem',
            borderRadius: '16px'
          }}
        >
          {daysInMonth.map((dayStr) => {
            const isSelected = activeSelectedDayStr === dayStr;
            const dayNum = getDayNumber(dayStr);
            const simpleName = getDaySimpleName(dayStr).substring(0, 2); // Lu, Ma, Mi...
            
            const holiday = isColombianHoliday(dayStr);
            const isSunday = new Date(dayStr + 'T00:00:00').getDay() === 0;

            // Colores dinámicos
            let dayNumColor = 'var(--text-primary)';
            let simpleNameColor = 'var(--text-muted)';
            let dayBorder = '1px solid var(--color-border)';
            let dayBg = 'var(--bg-secondary)';

            if (isSelected) {
              dayNumColor = 'var(--bg-primary)';
              simpleNameColor = 'var(--bg-primary)';
              dayBorder = '1px solid var(--accent-cyan)';
              dayBg = 'var(--accent-cyan)';
            } else if (holiday.isHoliday) {
              dayNumColor = '#f59e0b'; // Gold
              simpleNameColor = '#f59e0b';
              dayBorder = '1px solid #f59e0b';
              dayBg = 'rgba(245, 158, 11, 0.05)';
            } else if (isSunday) {
              dayNumColor = '#fb7185'; // Coral
              simpleNameColor = '#fb7185';
              dayBorder = '1px solid rgba(251, 113, 133, 0.4)';
              dayBg = 'rgba(251, 113, 133, 0.03)';
            }

            // Contar si el día está totalmente programado o cuántos slots faltan
            let emptySlotsCount = 0;
            SHIFTS.forEach(s => {
              const slots = schedule[dayStr]?.[s] || {};
              Object.values(slots).forEach(val => {
                if (val === null) emptySlotsCount++;
              });
            });

            return (
              <button
                key={dayStr}
                className="calendar-grid-btn"
                onClick={() => setSelectedDayStr(dayStr)}
                title={holiday.isHoliday ? `Día Festivo: ${holiday.name}` : isSunday ? 'Domingo' : undefined}
                style={{
                  backgroundColor: dayBg,
                  border: dayBorder,
                  color: dayNumColor,
                  borderRadius: '10px',
                  padding: '0.5rem 0.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.15rem',
                  minWidth: '40px',
                  transition: 'var(--transition-fast)',
                  boxShadow: isSelected ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = holiday.isHoliday ? '#f59e0b' : isSunday ? '#fb7185' : 'var(--text-muted)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = holiday.isHoliday ? '#f59e0b' : isSunday ? 'rgba(251, 113, 133, 0.4)' : 'var(--color-border)';
                    e.currentTarget.style.backgroundColor = dayBg;
                  }
                }}
              >
                <span style={{ fontSize: '0.6rem', color: isSelected ? 'var(--bg-primary)' : simpleNameColor, fontWeight: '700' }}>
                  {simpleName}
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>
                  {dayNum}
                </span>
                
                {/* Indicador de cobertura */}
                {emptySlotsCount === 0 ? (
                  <CheckCircle2 size={11} style={{ color: isSelected ? 'var(--bg-primary)' : 'var(--status-success)' }} />
                ) : (
                  <span style={{
                    fontSize: '0.6rem',
                    backgroundColor: isSelected ? 'rgba(0,0,0,0.2)' : 'rgba(244, 63, 94, 0.1)',
                    color: isSelected ? 'var(--bg-primary)' : 'var(--status-danger)',
                    padding: '0.05rem 0.25rem',
                    borderRadius: '4px',
                    fontWeight: '800'
                  }}>
                    {emptySlotsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cuadrícula detallada del día del mes seleccionado */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.25rem'
      }}>
        {SHIFTS.map((shift) => {
          const slots = schedule[activeSelectedDayStr]?.[shift] || {};
          const isShiftA = shift === 'A';

          return (
            <div key={shift} className="glass-panel" style={{ padding: '1.25rem', minHeight: '350px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <h4 style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    color: isShiftA ? 'var(--status-warning)' : 'var(--text-primary)',
                    fontSize: '1.05rem'
                  }}>
                    <Clock size={15} />
                    Turno {shift}
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    {getShiftTimeLabel(shift)}
                  </span>
                </div>
                {userRole === 'admin' && (
                  <button
                    onClick={() => {
                      setSelectedNewPosition('ENT');
                      setActiveAddPositionShift(shift);
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      backgroundColor: 'rgba(6, 182, 212, 0.05)',
                      border: '1px solid rgba(6, 182, 212, 0.15)',
                      color: 'var(--accent-cyan)',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    + Posición
                  </button>
                )}
              </div>

              {/* Lista de Slots de la Jornada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.keys(slots)
                  .sort((a, b) => {
                    const prioA = getPositionPriority(a);
                    const prioB = getPositionPriority(b);
                    if (prioA !== prioB) return prioA - prioB;
                    return a.localeCompare(b);
                  })
                  .map((slotKey) => {
                  const position = slotKey.split('-')[0];
                  const index = parseInt(slotKey.split('-')[1], 10);
                  const defaultCount = SHIFT_REQUIREMENTS[shift]?.[position] || 0;
                  const isCustomSlot = index > defaultCount;
                  
                  const assignedId = slots[slotKey];
                  const assignedController = assignedId 
                    ? controllers.find(c => c.id === assignedId)
                    : null;
                  const isTrainingSlot = position === 'ENT';
                  const isInstructionSlot = position === 'INS';
                  const isCaeSlot = position === 'CAE';
                  const isChecSlot = position === 'CHEC';
                  const isSpecialSlot = isTrainingSlot || isInstructionSlot || isCaeSlot || isChecSlot;

                  return (
                    <div 
                      key={slotKey}
                      style={{
                        backgroundColor: isTrainingSlot ? 'rgba(99, 102, 241, 0.02)' : isInstructionSlot ? 'rgba(236, 72, 153, 0.02)' : isCaeSlot ? 'rgba(168, 85, 247, 0.02)' : isChecSlot ? 'rgba(236, 72, 153, 0.02)' : 'var(--bg-tertiary)',
                        border: isSpecialSlot ? (isTrainingSlot ? '1px dashed rgba(99, 102, 241, 0.2)' : isInstructionSlot ? '1px dashed rgba(236, 72, 153, 0.2)' : isCaeSlot ? '1px dashed rgba(168, 85, 247, 0.2)' : '1px dashed rgba(236, 72, 153, 0.2)') : '1px solid var(--color-border)',
                        borderRadius: '10px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        position: 'relative',
                        borderLeft: isTrainingSlot 
                          ? '3px solid var(--accent-indigo)' 
                          : isInstructionSlot
                            ? '3px solid var(--accent-ins)'
                            : isCaeSlot
                              ? '3px solid var(--accent-mcae)'
                              : isChecSlot
                                ? '3px solid var(--accent-mchec)'
                                : `3px solid var(--accent-${getPositionColorClass(position)})`,
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      {/* Cabecera del Slot */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className={`skill-chip ${position.toLowerCase()}`} style={{ 
                            fontSize: '0.6rem', 
                            padding: '0.1rem 0.35rem',
                            backgroundColor: isTrainingSlot ? 'rgba(99, 102, 241, 0.1)' : isInstructionSlot ? 'rgba(236, 72, 153, 0.1)' : isCaeSlot ? 'rgba(168, 85, 247, 0.1)' : isChecSlot ? 'rgba(236, 72, 153, 0.1)' : '',
                            color: isTrainingSlot ? 'var(--accent-indigo)' : isInstructionSlot ? 'var(--accent-ins)' : isCaeSlot ? 'var(--accent-mcae)' : isChecSlot ? 'var(--accent-mchec)' : '',
                            borderColor: isTrainingSlot ? 'rgba(99, 102, 241, 0.2)' : isInstructionSlot ? 'rgba(236, 72, 153, 0.2)' : isCaeSlot ? 'rgba(168, 85, 247, 0.2)' : isChecSlot ? 'rgba(236, 72, 153, 0.2)' : ''
                          }}>
                            {isTrainingSlot ? `ENTRENAMIENTO ${index}` : isInstructionSlot ? `INSTRUCCIÓN ${index}` : isCaeSlot ? `MCAE ${index}` : isChecSlot ? `${shift}CHEC ${index}` : getSlotAcronym(slotKey, shift)}
                          </span>
                          {isCustomSlot && (
                            <span style={{ 
                              fontSize: '0.55rem', 
                              padding: '0.05rem 0.25rem', 
                              borderRadius: '4px', 
                              backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                              color: 'var(--accent-cyan)', 
                              border: '1px solid rgba(6, 182, 212, 0.2)', 
                              fontWeight: '800' 
                            }}>
                              ADICIONAL
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                            {getSlotDescription(slotKey)}
                          </span>
                          {isCustomSlot && !assignedId && userRole === 'admin' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`¿Estás seguro de cerrar la posición adicional ${slotKey}?`)) {
                                  onRemoveCustomSlot(activeSelectedDayStr, shift, slotKey);
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--status-danger)',
                                transition: 'color 0.2s',
                              }}
                              title="Cerrar posición"
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--status-danger)'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cuerpo del Slot (Asignación) */}
                      {assignedController ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{assignedController.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({assignedController.id})</span>
                            {assignedController.trainingPreferred && (
                              <GraduationCap size={13} style={{ color: 'var(--accent-indigo)' }} title="Entrenamiento Preferente" />
                            )}
                          </div>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleOpenAssign(activeSelectedDayStr, shift, slotKey)}
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', borderRadius: '6px' }}
                            >
                              Cambiar
                            </button>
                          )}
                        </div>
                      ) : (
                        <div 
                          onClick={() => userRole === 'admin' && handleOpenAssign(activeSelectedDayStr, shift, slotKey)}
                          style={{
                            border: '1px dashed var(--text-muted)',
                            borderRadius: '6px',
                            padding: '0.45rem',
                            textAlign: 'center',
                            cursor: userRole === 'admin' ? 'pointer' : 'default',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '600',
                            marginTop: '0.1rem',
                            transition: 'var(--transition-fast)'
                          }}
                          onMouseEnter={(e) => {
                            if (userRole === 'admin') e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                          }}
                          onMouseLeave={(e) => {
                            if (userRole === 'admin') e.currentTarget.style.borderColor = 'var(--text-muted)';
                          }}
                        >
                          {userRole === 'admin' 
                            ? (isTrainingSlot ? '[ Programar Alumno ]' : '[ Asignar Personal ]')
                            : '[ Sin Asignar ]'
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Asignación Inteligente */}
      {activeAssignSlot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }} onClick={handleCloseAssign}>
          <div 
            className="glass-panel" 
            style={{ 
              maxWidth: '520px', 
              width: '100%', 
              maxHeight: '80vh', 
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header" style={{ marginBottom: '1rem', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                  Asignar Personal Técnico
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {formatCalendarDayName(activeAssignSlot.day)} · Turno {activeAssignSlot.shift} · Posición {getSlotDescription(activeAssignSlot.slotKey, activeAssignSlot.shift)} ({getSlotAcronym(activeAssignSlot.slotKey, activeAssignSlot.shift)})
                </p>
              </div>
              <button 
                onClick={handleCloseAssign}
                className="filter-btn active"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Cerrar
              </button>
            </div>

            {/* Listado de candidatos calificados */}
            <div style={{ 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem',
              paddingRight: '0.25rem',
              flex: 1
            }}>
              
              <div 
                onClick={() => handleSelectController(null)}
                style={{
                  backgroundColor: 'rgba(244, 63, 94, 0.05)',
                  border: '1px dashed rgba(244, 63, 94, 0.25)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--status-danger)',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                <Trash2 size={16} />
                Vaciar este Slot / Eliminar Asignación
              </div>

              <div style={{ 
                fontSize: '0.7rem', 
                fontWeight: '700', 
                color: 'var(--text-muted)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                margin: '0.5rem 0 0.25rem 0'
              }}>
                Candidatos Certificados
              </div>

              {activeCandidates.map(({ controller, isValid, error, weeklyShifts, targetPattern, seqDayNum }) => {
                const matchesPattern = 
                  targetPattern === activeAssignSlot.shift || 
                  targetPattern === 'Cualquiera' ||
                  (targetPattern === 'M+T' && (activeAssignSlot.shift === 'M' || activeAssignSlot.shift === 'T')) ||
                  (targetPattern === 'T+N' && (activeAssignSlot.shift === 'T' || activeAssignSlot.shift === 'N'));

                return (
                  <div
                    key={controller.id}
                    onClick={() => isValid && handleSelectController(controller.id)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      cursor: isValid ? 'pointer' : 'not-allowed',
                      opacity: isValid ? 1 : 0.45,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      transition: 'var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                      if (isValid) {
                        e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                        e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.03)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isValid) {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{controller.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({controller.id})</span>
                        {controller.trainingPreferred && (
                          <GraduationCap size={15} style={{ color: 'var(--accent-indigo)' }} title="Entrenamiento Preferente" />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {matchesPattern && isValid && (
                          <span style={{
                            fontSize: '0.65rem',
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(6, 182, 212, 0.2)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            fontWeight: '700'
                          }}>
                            ✓ Patrón (Día {seqDayNum})
                          </span>
                        )}

                        {isValid ? (
                          <span style={{
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: 'var(--status-success)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}>
                            {weeklyShifts} turnos
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(244, 63, 94, 0.1)',
                            color: 'var(--status-danger)',
                            border: '1px solid rgba(244, 63, 94, 0.2)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}>
                            <AlertCircle size={10} /> Incompatible
                          </span>
                        )}
                      </div>
                    </div>

                    {isValid && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Día de secuencia: **Día {seqDayNum}** (Patrón: **{targetPattern}**).
                      </span>
                    )}

                    {!isValid && error && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--status-danger)', 
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: '0.15rem'
                      }}>
                        {error}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Abrir Posición Adicional */}
      {activeAddPositionShift && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }} onClick={() => setActiveAddPositionShift(null)}>
          <div 
            className="glass-panel" 
            style={{ 
              maxWidth: '450px', 
              width: '100%', 
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '0.75rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Abrir Posición Adicional
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {formatCalendarDayName(activeSelectedDayStr)} · Turno {activeAddPositionShift}
                </p>
              </div>
              <button 
                onClick={() => setActiveAddPositionShift(null)}
                className="filter-btn active"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Cancelar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Selecciona la Posición Operativa:
              </label>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                marginTop: '0.25rem'
              }}>
                {[
                  { id: 'ENT', name: 'Entrenamiento (ENT)', color: 'var(--accent-indigo)', bg: 'rgba(99, 102, 241, 0.1)' },
                  ...((activeAddPositionShift === 'M' || activeAddPositionShift === 'T') ? [
                    { id: 'INS', name: 'Instrucción (INS)', color: 'var(--accent-ins)', bg: 'rgba(236, 72, 153, 0.1)' },
                    { id: 'CHEC', name: 'Chequeo (CHEC)', color: 'var(--accent-mchec)', bg: 'rgba(236, 72, 153, 0.1)' }
                  ] : []),
                  ...(activeAddPositionShift === 'M' ? [
                    { id: 'CAE', name: 'Cap. Especial (CAE)', color: 'var(--accent-mcae)', bg: 'rgba(168, 85, 247, 0.1)' }
                  ] : []),
                  { id: 'ACC', name: 'Ruta / ACC (ACC)', color: 'var(--accent-acc)', bg: 'rgba(56, 189, 248, 0.1)' },
                  { id: 'CTE', name: 'Centro de Control (CTE)', color: 'var(--accent-cte)', bg: 'rgba(59, 130, 246, 0.1)' },
                  { id: 'TWR', name: 'Torre de Control (TWR)', color: 'var(--accent-twr)', bg: 'rgba(236, 72, 153, 0.1)' },
                  { id: 'GND', name: 'Superficie / Ground (GND)', color: 'var(--accent-gnd)', bg: 'rgba(16, 185, 129, 0.1)' },
                  { id: 'DEL', name: 'Autorizaciones (DEL)', color: 'var(--accent-del)', bg: 'rgba(245, 158, 11, 0.1)' },
                  { id: 'FIC', name: 'Info de Vuelo / FIC (FIC)', color: 'var(--accent-fic)', bg: 'rgba(139, 92, 246, 0.1)' }
                ].map((pos) => {
                  const isSelected = selectedNewPosition === pos.id;
                  return (
                    <div
                      key={pos.id}
                      onClick={() => setSelectedNewPosition(pos.id)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '8px',
                        border: isSelected ? `2px solid ${pos.color}` : '1px solid var(--color-border)',
                        backgroundColor: isSelected ? pos.bg : 'var(--bg-tertiary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: '0.25rem',
                        transition: 'var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = pos.color;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isSelected ? pos.color : 'var(--text-primary)' }}>
                        {pos.id}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        {pos.name.split(' (')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '0.5rem'
            }}>
              <button
                onClick={() => {
                  onAddCustomSlot(activeSelectedDayStr, activeAddPositionShift, selectedNewPosition);
                  setActiveAddPositionShift(null);
                }}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem', fontWeight: '600' }}
              >
                Abrir Posición
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
