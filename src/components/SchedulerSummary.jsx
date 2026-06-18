import { useState, useMemo } from 'react';
import { 
  BarChart2, 
  ShieldAlert, 
  GraduationCap,
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  Calendar,
  Layers,
  Trash2,
  AlertOctagon
} from 'lucide-react';
import { SHIFTS, getWeekDaysOfDate, isColombianHoliday } from '../utils/schedulerEngine';

export default function SchedulerSummary({ 
  schedule, 
  controllers, 
  exceptions, 
  currentYear,
  currentMonth,
  onUpdateException 
}) {
  const [activeSubTab, setActiveSubTab] = useState('summary'); // 'summary' | 'exceptions' | 'disponibles'
  const [exceptionCtrlId, setExceptionCtrlId] = useState(controllers[0]?.id || '');
  const [excType, setExcType] = useState('VACACIONES');
  
  // Rango de fechas o mes completo
  const [selectionMode, setSelectionMode] = useState('days'); // 'days' | 'month'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [prevMonth, setPrevMonth] = useState(currentMonth);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  if (currentMonth !== prevMonth) {
    setPrevMonth(currentMonth);
    setSelectedMonth(currentMonth);
  }

  const [prevYear, setPrevYear] = useState(currentYear);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  if (currentYear !== prevYear) {
    setPrevYear(currentYear);
    setSelectedYear(currentYear);
  }

  const daysInActiveMonth = useMemo(() => {
    const lastDayDate = new Date(currentYear, currentMonth + 1, 0);
    const count = lastDayDate.getDate();
    const days = [];
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    for (let i = 1; i <= count; i++) {
      const dayStr = String(i).padStart(2, '0');
      days.push(`${currentYear}-${monthStr}-${dayStr}`);
    }
    return days;
  }, [currentYear, currentMonth]);

  const weeksOfActiveMonth = useMemo(() => {
    const uniqueWeeks = [];
    const seenWeeks = new Set();

    daysInActiveMonth.forEach(day => {
      const week = getWeekDaysOfDate(day);
      const weekKey = week[0]; // use Monday's date string as the unique key
      if (!seenWeeks.has(weekKey)) {
        seenWeeks.add(weekKey);
        uniqueWeeks.push(week);
      }
    });

    return uniqueWeeks;
  }, [daysInActiveMonth]);

  const [disponibleDay, setDisponibleDay] = useState(daysInActiveMonth[0] || '');
  const activeDisponibleDay = daysInActiveMonth.includes(disponibleDay) ? disponibleDay : (daysInActiveMonth[0] || '');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

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



  // Enviar el formulario de rango de excepciones
  const handleRegisterRange = (e) => {
    e.preventDefault();

    let finalStartDate = startDate;
    let finalEndDate = endDate;

    if (selectionMode === 'month') {
      const firstDay = '01';
      const lastDayDate = new Date(selectedYear, selectedMonth + 1, 0);
      const lastDay = String(lastDayDate.getDate()).padStart(2, '0');
      const monthStr = String(selectedMonth + 1).padStart(2, '0');
      finalStartDate = `${selectedYear}-${monthStr}-${firstDay}`;
      finalEndDate = `${selectedYear}-${monthStr}-${lastDay}`;
    }

    if (!finalStartDate || !finalEndDate || !exceptionCtrlId) return;

    const start = new Date(finalStartDate + 'T00:00:00');
    const end = new Date(finalEndDate + 'T00:00:00');

    if (end < start) {
      alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    const ctrl = controllers.find(c => c.id === exceptionCtrlId);
    
    // Generar la lista de fechas en el rango
    const datesToUpdate = [];
    const current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const currentMonthVal = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      datesToUpdate.push(`${yyyy}-${currentMonthVal}-${dd}`);
      current.setDate(current.getDate() + 1);
    }

    // Guardar en el padre en lote
    onUpdateException(exceptionCtrlId, datesToUpdate, excType);

    const label = excType === 'NO_OPERATIVO' ? 'NO OPERATIVO' : excType;
    if (selectionMode === 'month') {
      alert(`Se ha registrado el periodo de ${label} para ${ctrl.name} para el mes completo de ${monthNames[selectedMonth]} ${selectedYear} (${datesToUpdate.length} días).`);
    } else {
      alert(`Se ha registrado el periodo de ${label} para ${ctrl.name} del ${finalStartDate} al ${finalEndDate} (${datesToUpdate.length} días).`);
    }
    
    // Resetear formulario si es por rango de días
    if (selectionMode === 'days') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Calcular métricas para un controlador específico en el mes activo
  const getControllerMetricsForMonth = (ctrlId) => {
    let shiftsCount = 0;
    let trainingCount = 0;
    let doubleShiftsCount = 0; // Días con 2 jornadas (operativo o entrenamiento)
    const daysWorked = new Set();
    const daysOff = [];
    const daysExc = { VACACIONES: [], CAPACITACION: [], NO_OPERATIVO: [], DESCANSO: [] };

    daysInActiveMonth.forEach(day => {
      let assignmentsCountOnDay = 0;
      let workedToday = false;
      
      SHIFTS.forEach(shift => {
        const slots = schedule[day]?.[shift] || {};
        Object.keys(slots).forEach(slotKey => {
          if (slots[slotKey] === ctrlId) {
            shiftsCount++;
            assignmentsCountOnDay++;
            workedToday = true;
            if (slotKey.startsWith('ENT')) {
              trainingCount++;
            }
          }
        });
      });

      if (assignmentsCountOnDay >= 2) {
        doubleShiftsCount++;
      }

      const excType = exceptions[ctrlId]?.[day] || 'OPERATIVO';

      if (workedToday) {
        daysWorked.add(day);
      } else {
        if (excType === 'VACACIONES') {
          daysExc.VACACIONES.push(day);
        } else if (excType === 'CAPACITACION') {
          daysExc.CAPACITACION.push(day);
        } else if (excType === 'NO_OPERATIVO') {
          daysExc.NO_OPERATIVO.push(day);
        } else if (excType === 'DESCANSO') {
          daysExc.DESCANSO.push(day);
        } else {
          daysOff.push(day);
        }
      }
    });

    const totalDaysOff = daysOff.length + daysExc.DESCANSO.length + daysExc.VACACIONES.length + 
                        daysExc.CAPACITACION.length + daysExc.NO_OPERATIVO.length;

    return {
      shiftsCount,
      hoursCount: shiftsCount * 6,
      trainingCount,
      doubleShiftsCount,
      daysWorkedCount: daysWorked.size,
      totalDaysOff,
      daysExc
    };
  };

  const getExceptionBadge = (type) => {
    switch (type) {
      case 'VACACIONES':
        return <span style={{ color: 'var(--status-warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>VACACIONES</span>;
      case 'CAPACITACION':
        return <span style={{ color: 'var(--accent-cyan)', backgroundColor: 'rgba(6, 182, 212, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>CAPACITACIÓN</span>;
      case 'NO_OPERATIVO':
        return <span style={{ color: 'var(--status-danger)', backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>NO OPERATIVO</span>;
      case 'DESCANSO':
        return <span style={{ color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>DESCANSO</span>;
      default:
        return <span style={{ color: 'var(--status-success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>OPERATIVO</span>;
    }
  };

  // Listar controladores en standby (Disponibles) para un día
  const getDisponiblesForDay = (day) => {
    if (!day) return [];
    
    return controllers.filter(c => {
      if (!c.active) return false;
      
      const dayExc = exceptions[c.id]?.[day] || 'OPERATIVO';
      if (dayExc !== 'OPERATIVO') return false;

      let hasShiftsToday = false;
      SHIFTS.forEach(shift => {
        const slots = schedule[day]?.[shift] || {};
        if (Object.values(slots).includes(c.id)) {
          hasShiftsToday = true;
        }
      });

      return !hasShiftsToday;
    });
  };

  const selectedController = controllers.find(c => c.id === exceptionCtrlId);
  const standbyList = getDisponiblesForDay(activeDisponibleDay);

  // Obtener historial de excepciones registradas para el controlador seleccionado
  const controllerExceptionsList = useMemo(() => {
    if (!selectedController || !exceptions[selectedController.id]) return [];
    const list = [];
    Object.keys(exceptions[selectedController.id]).forEach(dateStr => {
      const type = exceptions[selectedController.id][dateStr];
      if (type !== 'OPERATIVO') {
        list.push({ dateStr, type });
      }
    });
    return list.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
  }, [selectedController, exceptions]);

  return (
    <div className="glass-panel" style={{ marginTop: '2.5rem' }}>
      
      {/* Cabecera del Panel */}
      <div className="panel-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '1rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart2 size={22} />
          KPIs y Registro de Rangos Especiales (SKBO)
        </h3>

        {/* Sub-Navegación */}
        <div className="filter-group">
          <button 
            onClick={() => setActiveSubTab('summary')} 
            className={`filter-btn ${activeSubTab === 'summary' ? 'active' : ''}`}
          >
            Resumen Mensual
          </button>
          <button 
            onClick={() => setActiveSubTab('exceptions')} 
            className={`filter-btn ${activeSubTab === 'exceptions' ? 'active' : ''}`}
          >
            Rangos de Turnos Especiales
          </button>
          <button 
            onClick={() => setActiveSubTab('disponibles')} 
            className={`filter-btn ${activeSubTab === 'disponibles' ? 'active' : ''}`}
          >
            Disponibles y Entrenamiento
          </button>
        </div>
      </div>

      {/* VISTA 1: RESUMEN MENSUAL */}
      {activeSubTab === 'summary' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Balance del mes activo ({monthNames[currentMonth]} {currentYear}). Cada controlador debe cumplir con sus **2 días de descanso** reglamentarios en cada una de las semanas calendario que cruzan el mes.
          </p>

          <div style={{ overflowX: 'auto', maxHeight: '400px', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
              textAlign: 'left'
            }}>
              <thead style={{
                backgroundColor: 'var(--bg-secondary)',
                position: 'sticky',
                top: 0,
                borderBottom: '1px solid var(--color-border)'
              }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Firma / ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Atributos</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Turnos Op.</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Turnos Suplem.</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Entrenamientos</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Horas Totales</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Días Libres</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cumplimiento Descanso</th>
                </tr>
              </thead>
              <tbody>
                {controllers.map((c) => {
                  const metrics = getControllerMetricsForMonth(c.id);
                  
                  // Verificar cumplimiento semanal del descanso (los 2 descansos obligatorios de Lunes a Sábado, o Martes a Sábado si el Lunes es festivo)
                  const nonCompliantWeeks = [];
                  weeksOfActiveMonth.forEach((week, wIdx) => {
                    const mondayStr = week[0];
                    const isMondayHoliday = isColombianHoliday(mondayStr).isHoliday;
                    
                    const windowDays = [];
                    const startIdx = isMondayHoliday ? 1 : 0;
                    for (let i = startIdx; i <= 5; i++) {
                      windowDays.push(week[i]);
                    }

                    let workedDaysInWindow = 0;
                    windowDays.forEach(dayStr => {
                      let worked = false;
                      SHIFTS.forEach(shift => {
                        const slots = schedule[dayStr]?.[shift] || {};
                        if (Object.values(slots).includes(c.id)) {
                          worked = true;
                        }
                      });
                      if (worked) workedDaysInWindow++;
                    });

                    const daysOffInWindow = windowDays.length - workedDaysInWindow;
                    if (daysOffInWindow < 2) {
                      nonCompliantWeeks.push({ weekIndex: wIdx, daysOff: daysOffInWindow, week });
                    }
                  });

                  const hasRestDeficiency = nonCompliantWeeks.length > 0;

                  return (
                    <tr key={c.id} style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      backgroundColor: hasRestDeficiency ? 'rgba(244, 63, 94, 0.02)' : 'transparent',
                      transition: 'var(--transition-fast)'
                    }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700' }}>{c.name}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.id}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {(c.skills || []).map(s => (
                            <span key={s} className={`skill-chip ${s.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '0.05rem 0.25rem' }}>
                              {s}
                            </span>
                          ))}
                          {c.trainingPreferred && (
                            <span style={{
                              fontSize: '0.65rem',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: 'var(--accent-indigo)',
                              padding: '0.05rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: '700',
                              border: '1px solid rgba(99, 102, 241, 0.15)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.1rem'
                            }}>
                              <GraduationCap size={10} /> Alumno
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '700' }}>
                        {metrics.shiftsCount - metrics.trainingCount}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '700', color: '#f59e0b' }}>
                        {metrics.doubleShiftsCount > 0 ? `${metrics.doubleShiftsCount} dobles` : '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '700', color: 'var(--accent-indigo)' }}>
                        {metrics.trainingCount > 0 ? `${metrics.trainingCount} turnos` : '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        {metrics.hoursCount}h
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '700' }}>
                        {metrics.totalDaysOff} días
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {hasRestDeficiency ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              color: 'var(--status-danger)',
                              fontWeight: '600',
                              fontSize: '0.75rem',
                              backgroundColor: 'rgba(244, 63, 94, 0.08)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              width: 'fit-content'
                            }}>
                              <ShieldAlert size={12} />
                              Crítico
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {nonCompliantWeeks.length} semana(s) con &lt;2 libres
                            </span>
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: 'var(--status-success)',
                            fontWeight: '600',
                            fontSize: '0.75rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px'
                          }}>
                            <CheckCircle2 size={12} />
                            Conforme
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: FORMULARIO DE RANGOS DE EXCEPCIONES */}
      {activeSubTab === 'exceptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: 'rgba(244, 63, 94, 0.05)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <AlertOctagon size={24} style={{ color: 'var(--status-danger)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Registro Eficiente de Excepciones ATC:</strong> Agrega periodos especiales en bloques. Puedes registrar inhabilitaciones seleccionando <strong>"Por Rango de Días"</strong> con fecha de inicio y fin, o seleccionar <strong>"Mes Completo"</strong> para marcar a un controlador como ausente todo un mes calendario de una sola vez.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '1.5rem'
          }}>
            {selectedController && (
              <form onSubmit={handleRegisterRange} style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={18} style={{ color: 'var(--accent-cyan)' }} />
                  Programar Ausencia / Inoperancia
                </h4>

                {/* Selector de Modo: Por Rango de Días o Mes Completo */}
                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.25rem',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  alignSelf: 'flex-start',
                  marginBottom: '0.25rem'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('days');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className={`filter-btn ${selectionMode === 'days' ? 'active' : ''}`}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      fontWeight: '700'
                    }}
                  >
                    Por Rango de Días
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode('month');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className={`filter-btn ${selectionMode === 'month' ? 'active' : ''}`}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      fontWeight: '700'
                    }}
                  >
                    Mes Completo
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Controlador */}
                  <div className="form-group">
                    <label htmlFor="range-ctrl">Controlador</label>
                    <select
                      id="range-ctrl"
                      className="form-input"
                      value={exceptionCtrlId}
                      onChange={(e) => setExceptionCtrlId(e.target.value)}
                    >
                      {controllers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Estado especial */}
                  <div className="form-group">
                    <label htmlFor="range-status">Estado del Periodo</label>
                    <select
                      id="range-status"
                      className="form-input"
                      value={excType}
                      onChange={(e) => setExcType(e.target.value)}
                    >
                      <option value="VACACIONES">Vacaciones (V)</option>
                      <option value="CAPACITACION">Capacitación / Curso (C)</option>
                      <option value="NO_OPERATIVO">NO OPERATIVO (N/O)</option>
                      <option value="DESCANSO">Descanso Programado (D)</option>
                    </select>
                  </div>
                </div>

                {/* Formulario Dinámico según el Modo de Selección */}
                {selectionMode === 'days' ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                  }}>
                    <div className="form-group">
                      <label htmlFor="range-start">Fecha de Inicio</label>
                      <input
                        id="range-start"
                        type="date"
                        className="form-input"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="range-end">Fecha de Fin</label>
                      <input
                        id="range-end"
                        type="date"
                        className="form-input"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                  }}>
                    <div className="form-group">
                      <label htmlFor="range-year">Año</label>
                      <select
                        id="range-year"
                        className="form-input"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      >
                        <option value={currentYear - 1}>{currentYear - 1}</option>
                        <option value={currentYear}>{currentYear}</option>
                        <option value={currentYear + 1}>{currentYear + 1}</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="range-month">Mes Completo</label>
                      <select
                        id="range-month"
                        className="form-input"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      >
                        {monthNames.map((name, index) => (
                          <option key={index} value={index}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.6rem 1.5rem' }}>
                  Guardar Período Especial
                </button>
              </form>
            )}

            {/* Listado de Excepciones del controlador */}
            {selectedController && (
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                padding: '1.5rem'
              }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserCheck size={18} style={{ color: 'var(--accent-cyan)' }} />
                  Fechas Bloqueadas Activas: {selectedController.name}
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--status-danger)', padding: '0.15rem 0.5rem', borderRadius: '10px', marginLeft: '0.5rem' }}>
                    {controllerExceptionsList.length} días
                  </span>
                </h4>

                {controllerExceptionsList.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '0.75rem',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    paddingRight: '0.25rem'
                  }}>
                    {controllerExceptionsList.map(({ dateStr, type }) => (
                      <div 
                        key={dateStr}
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>{dateStr}</span>
                          {getExceptionBadge(type)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onUpdateException(selectedController.id, dateStr, 'OPERATIVO')}
                          className="btn btn-danger-outline btn-icon-only"
                          style={{ width: '24px', height: '24px', borderRadius: '4px' }}
                          title="Habilitar fecha"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    Este controlador no tiene inhabilitaciones registradas en el sistema.
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* VISTA 3: DISPONIBLES Y ENTRENAMIENTO DEL DIA */}
      {activeSubTab === 'disponibles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <GraduationCap size={24} style={{ color: 'var(--accent-indigo)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Apoyo en Tierra y Entrenamiento de Refuerzo:</strong> Aquellos controladores operativos con 0 turnos en torre en la fecha son catalogados como **"DISPONIBLES"** (soporte). Si tienes disponibilidad de personal, el panel te permite programarlos en turnos especiales de **Entrenamiento** en cualquier fecha.
            </p>
          </div>

          {/* Selector de Fecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-tertiary)', padding: '0.85rem 1.25rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Consultar disponibilidad del:</span>
            </div>
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '260px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', borderRadius: '8px' }}
              value={activeDisponibleDay}
              onChange={(e) => setDisponibleDay(e.target.value)}
            >
              {daysInActiveMonth.map((day) => {
                const holidayInfo = isColombianHoliday(day);
                const isSun = new Date(day + 'T00:00:00').getDay() === 0;
                const label = formatCalendarDayName(day);
                const suffix = holidayInfo.isHoliday ? ` [FESTIVO: ${holidayInfo.name}]` : isSun ? ' [DOMINGO]' : '';
                return (
                  <option key={day} value={day}>
                    {label}{suffix}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
              Roster de Personal Disponible (Standby) - {formatCalendarDayName(activeDisponibleDay)}
              <span style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                color: 'var(--accent-cyan)',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                marginLeft: '0.5rem',
                border: '1px solid rgba(6, 182, 212, 0.15)'
              }}>
                {standbyList.length} disponibles
              </span>
            </h4>

            {standbyList.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '1rem'
              }}>
                {standbyList.map((c) => {
                  return (
                    <div 
                      key={c.id} 
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{c.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({c.id})</span>
                          {c.trainingPreferred && (
                            <GraduationCap size={14} style={{ color: 'var(--accent-indigo)' }} title="Entrenamiento Preferente" />
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: 'var(--status-success)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: '700'
                        }}>
                          DISPONIBLE
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', margin: '0.2rem 0' }}>
                        {(c.skills || []).map(s => (
                          <span key={s} className={`skill-chip ${s.toLowerCase()}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.2rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>

                      <div style={{ 
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
                        paddingTop: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mover a Estado Especial:</span>
                        <select
                          className="form-input"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px', width: 'auto' }}
                          value={exceptions[c.id]?.[activeDisponibleDay] || 'OPERATIVO'}
                          onChange={(e) => onUpdateException(c.id, activeDisponibleDay, e.target.value)}
                        >
                          <option value="OPERATIVO">Dejar en Standby</option>
                          <option value="CAPACITACION">Capacitación</option>
                          <option value="VACACIONES">Vacaciones</option>
                          <option value="NO_OPERATIVO">No Operativo</option>
                          <option value="DESCANSO">Descanso</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <AlertTriangle size={32} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Todo el personal operativo ha sido programado en slots de torre el día {getDaySimpleName(activeDisponibleDay)}. No hay personal libre de reserva hoy.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
