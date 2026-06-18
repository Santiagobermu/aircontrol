import { useState, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  GraduationCap,
  X,
  User,
  Trash2
} from 'lucide-react';
import { SHIFTS, isColombianHoliday, validateAssignment, getSlotAcronym, getSlotDescription } from '../utils/schedulerEngine';

export default function MonthlyGrid({ 
  schedule, 
  controllers, 
  exceptions,
  onUpdateController,
  onAssignController,
  onUpdateException,
  readOnly = false,
  userRole
}) {
  const isGridReadOnly = readOnly || userRole === 'supervisor';
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(4); // 4 = Mayo (0-indexed en JS Date)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLicenseFilter, setSelectedLicenseFilter] = useState('ALL');
  const [hoveredCell, setHoveredCell] = useState(null); // { ctrlId, dateStr, details }

  // States para modal de edición de controlador
  const [editingCtrl, setEditingCtrl] = useState(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSkills, setEditSkills] = useState([]);
  const [editTrainingPreferred, setEditTrainingPreferred] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // States para gestión manual de celdas
  const [activeCell, setActiveCell] = useState(null); // { ctrl, dayStr }
  const [selectedNewSlot, setSelectedNewSlot] = useState('');

  const getPositionColorClass = (pos) => {
    switch (pos) {
      case 'CTE': return 'cyan';
      case 'TWR': return 'indigo';
      case 'GND': return 'emerald';
      case 'DEL': return 'purple';
      case 'FIC': return 'fic';
      default: return 'muted';
    }
  };

  const handleEditControllerClick = (ctrl) => {
    setEditingCtrl(ctrl);
    setEditName(ctrl.name);
    setEditActive(ctrl.active !== false);
    setEditSkills(ctrl.skills || []);
    setEditTrainingPreferred(!!ctrl.trainingPreferred);
    setEditEmail(ctrl.email || '');
    setEditPassword('');
  };

  const handleSaveEditController = (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    if (!editEmail.trim()) {
      alert('El correo electrónico de acceso es obligatorio.');
      return;
    }

    const updated = {
      ...editingCtrl,
      name: editName.trim(),
      active: editActive,
      skills: editSkills,
      trainingPreferred: editTrainingPreferred,
      email: editEmail.trim().toLowerCase(),
      password: editPassword
    };

    onUpdateController(updated);
    setEditingCtrl(null);
  };

  const handleCellClick = (ctrl, dayStr) => {
    setActiveCell({ ctrl, dayStr });
    setSelectedNewSlot('');
  };

  const getActiveAssignmentsForCell = (ctrlId, dayStr) => {
    const list = [];
    SHIFTS.forEach(shift => {
      const slots = schedule[dayStr]?.[shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === ctrlId) {
          list.push({ shift, slotKey });
        }
      });
    });
    return list;
  };

  const getVacantAndValidSlotsForCell = (ctrlId, dayStr) => {
    const list = [];
    SHIFTS.forEach(shift => {
      const slots = schedule[dayStr]?.[shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === null) {
          const val = validateAssignment(ctrlId, dayStr, shift, slotKey, schedule, controllers, exceptions, true);
          if (val.isValid) {
            list.push({ shift, slotKey });
          }
        }
      });
    });
    return list;
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Calcular la lista de días en el mes seleccionado
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

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Filtrado y ordenamiento de controladores por prioridad de licencia
  const filteredControllers = useMemo(() => {
    const list = controllers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLicense = selectedLicenseFilter === 'ALL' || (c.skills && c.skills.includes(selectedLicenseFilter));
      
      return matchesSearch && matchesLicense;
    });

    const getSkillPriority = (skill) => {
      switch (skill) {
        case 'CTE': return 1;
        case 'TWR': return 2;
        case 'GND': return 3;
        case 'DEL': return 4;
        case 'FIC': return 5;
        default: return 99;
      }
    };

    const getControllerPriority = (ctrl) => {
      if (!ctrl.skills || ctrl.skills.length === 0) return 999;
      return Math.min(...ctrl.skills.map(getSkillPriority));
    };

    return [...list].sort((a, b) => {
      const prioA = getControllerPriority(a);
      const prioB = getControllerPriority(b);
      
      if (prioA !== prioB) {
        return prioA - prioB; // Mayor prioridad (menor número) va primero
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [controllers, searchQuery, selectedLicenseFilter]);

  // Obtener la información de turnos de un controlador para una fecha
  const getCellData = (ctrlId, dateStr) => {
    const dayExc = exceptions[ctrlId]?.[dateStr] || 'OPERATIVO';
    
    if (dayExc === 'VACACIONES') return { type: 'VACACIONES', label: 'V', color: 'var(--status-warning)' };
    if (dayExc === 'CAPACITACION') return { type: 'CAPACITACION', label: 'C', color: 'var(--text-muted)' };
    if (dayExc === 'NO_OPERATIVO') return { type: 'NO_OPERATIVO', label: 'N/O', color: 'var(--status-danger)', details: 'Inhabilitado como NO OPERATIVO' };
    if (dayExc === 'DESCANSO') return { type: 'DESCANSO', label: 'D', color: 'rgba(255, 255, 255, 0.05)' };

    // Buscar asignaciones en los turnos
    const activeShifts = [];
    const assignedSlots = [];
    
    SHIFTS.forEach(shift => {
      const slots = schedule[dateStr]?.[shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === ctrlId) {
          activeShifts.push(shift);
          assignedSlots.push({ shift, slotKey });
        }
      });
    });

    if (activeShifts.length === 0) {
      return { type: 'LIBRE', label: '-', color: 'transparent' };
    }

    // Si tiene entrenamiento
    const hasTraining = assignedSlots.some(s => s.slotKey.startsWith('ENT'));
    if (hasTraining && activeShifts.length === 1) {
      return { 
        type: 'ENTRENAMIENTO', 
        label: 'E', 
        color: 'var(--accent-indigo)',
        details: `Entrenamiento hoy en turno ${activeShifts[0]}`
      };
    }

    if (activeShifts.length === 2) {
      // Turno Doble
      const isMT = activeShifts.includes('M') && activeShifts.includes('T');
      const isTN = activeShifts.includes('T') && activeShifts.includes('N');
      
      let label = isMT ? 'MT' : isTN ? 'TN' : '2T';
      if (hasTraining) label += 'e';
      
      const slotsDesc = assignedSlots.map(s => `${s.shift}: ${s.slotKey.split('-')[0]}`).join(', ');

      return { 
        type: 'DOBLE', 
        label, 
        color: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))',
        details: `Turno Doble (${slotsDesc})`
      };
    }

    // Turno Único Operativo
    const shift = activeShifts[0];
    const slot = assignedSlots[0].slotKey.split('-')[0];
    let color = 'var(--text-muted)';
    if (shift === 'A') color = 'var(--accent-cyan)';
    if (shift === 'M') color = 'var(--accent-indigo)';
    if (shift === 'T') color = 'var(--accent-emerald)';
    if (shift === 'N') color = 'var(--accent-purple)';

    return { 
      type: 'OPERATIVO', 
      label: shift, 
      color,
      details: `Jornada única en ${shift} (Posición: ${slot})`
    };
  };

  const getDayLetter = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return days[date.getDay()];
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

  const getDayNumber = (dateStr) => {
    return dateStr.split('-')[2];
  };

  const isWeekend = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();
    return day === 0 || day === 6; // Domingo o Sábado
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      
      {/* Controles del Navegador de Meses */}
      <div 
        className="malla-month-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Calendar size={22} style={{ color: 'var(--accent-cyan)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={handlePrevMonth} className="btn btn-secondary btn-icon-only" style={{ width: '32px', height: '32px' }}>
              <ChevronLeft size={16} />
            </button>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', width: '160px', textAlign: 'center', fontFamily: 'var(--font-heading)' }}>
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <button onClick={handleNextMonth} className="btn btn-secondary btn-icon-only" style={{ width: '32px', height: '32px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Búsqueda y Filtros Rápidos */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <div className="search-wrapper" style={{ maxWidth: '300px', flex: 1 }}>
            <Search className="search-icon" />
            <input
              type="text"
              className="form-input search-input"
              style={{ padding: '0.5rem 0.5rem 0.5rem 2.2rem', fontSize: '0.85rem' }}
              placeholder="Buscar controlador por firma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            {['ALL', 'CTE', 'TWR', 'GND', 'DEL', 'FIC'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedLicenseFilter(filter)}
                className={`filter-btn ${selectedLicenseFilter === filter ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              >
                {filter === 'ALL' ? 'Todos' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RENDER DE LA MALLA MENSUAL GLOBAL (Con Sticky Columns) */}
      <div style={{
        position: 'relative',
        overflow: 'visible',
        marginBottom: '1.5rem'
      }}>
        {/* Contenedor con Scroll Horizontal */}
        <div style={{
          overflowX: 'auto',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          backgroundColor: 'rgba(11, 15, 25, 0.2)',
          maxHeight: '600px'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: '0.75rem'
          }}>
            
            {/* Cabecera del Roster */}
            <thead style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '2px solid var(--color-border)'
            }}>
              <tr>
                {/* Columna Sticky de Nombres */}
                <th style={{
                  padding: '0.75rem 1rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 4,
                  backgroundColor: 'var(--bg-secondary)',
                  borderRight: '2px solid var(--color-border)',
                  width: '140px',
                  minWidth: '140px',
                  textAlign: 'left'
                }}>
                  Firma / Licencia
                </th>

                {/* Días del Mes */}
                {daysInMonth.map((dayStr) => {
                  const dayNum = getDayNumber(dayStr);
                  const letter = getDayLetter(dayStr);
                  const weekend = isWeekend(dayStr);
                  
                  const holiday = isColombianHoliday(dayStr);
                  const isSunday = new Date(dayStr + 'T00:00:00').getDay() === 0;

                  let headerColor = 'var(--text-muted)';
                  let numColor = 'var(--text-primary)';
                  let headerBg = 'transparent';

                  if (holiday.isHoliday) {
                    headerColor = '#f59e0b';
                    numColor = '#f59e0b';
                    headerBg = 'rgba(245, 158, 11, 0.05)';
                  } else if (isSunday) {
                    headerColor = '#fb7185';
                    numColor = '#fb7185';
                    headerBg = 'rgba(251, 113, 133, 0.05)';
                  } else if (weekend) {
                    headerBg = 'rgba(255, 255, 255, 0.02)';
                  }

                  return (
                    <th 
                      key={dayStr}
                      title={holiday.isHoliday ? `Festivo: ${holiday.name}` : isSunday ? 'Domingo' : undefined}
                      style={{
                        padding: '0.5rem 0.25rem',
                        fontWeight: '700',
                        textAlign: 'center',
                        minWidth: '35px',
                        width: '35px',
                        backgroundColor: headerBg,
                        borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: headerColor }}>
                          {letter}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: numColor, fontFamily: 'var(--font-heading)', fontWeight: '700' }}>
                          {dayNum}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Cuerpo del Roster */}
            <tbody>
              {filteredControllers.length > 0 ? (
                filteredControllers.map((ctrl) => (
                  <tr 
                    key={ctrl.id} 
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Columna Sticky de Nombres */}
                    <td style={{
                      padding: '0.6rem 1rem',
                      fontWeight: '700',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: 'var(--bg-secondary)',
                      borderRight: '2px solid var(--color-border)',
                      boxShadow: '4px 0 10px rgba(0, 0, 0, 0.2)',
                      textAlign: 'left'
                    }}>
                      <div 
                        style={{ display: 'flex', flexDirection: 'column', cursor: isGridReadOnly ? 'default' : 'pointer' }}
                        title={isGridReadOnly ? undefined : "Haga clic para editar los atributos de este controlador"}
                        onClick={isGridReadOnly ? undefined : () => handleEditControllerClick(ctrl)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: '700', textDecoration: 'underline' }}>{ctrl.name}</span>
                          {ctrl.trainingPreferred && (
                            <GraduationCap size={12} style={{ color: 'var(--accent-indigo)' }} title="Entrenamiento Preferente" />
                          )}
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{ctrl.id}</span>
                      </div>
                    </td>

                    {/* Celdas del Mes */}
                    {daysInMonth.map((dayStr) => {
                      const cell = getCellData(ctrl.id, dayStr);
                      const weekend = isWeekend(dayStr);

                      const holiday = isColombianHoliday(dayStr);
                      const isSunday = new Date(dayStr + 'T00:00:00').getDay() === 0;

                      let cellBg = 'transparent';
                      if (holiday.isHoliday) {
                        cellBg = 'rgba(245, 158, 11, 0.02)';
                      } else if (isSunday) {
                        cellBg = 'rgba(251, 113, 133, 0.02)';
                      } else if (weekend) {
                        cellBg = 'rgba(255, 255, 255, 0.01)';
                      }

                      return (
                        <td 
                          key={dayStr}
                          onMouseEnter={() => cell.details && setHoveredCell({
                            ctrlId: ctrl.id,
                            ctrlName: ctrl.name,
                            dateStr: dayStr,
                            details: cell.details
                          })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={isGridReadOnly ? undefined : () => handleCellClick(ctrl, dayStr)}
                          title={isGridReadOnly ? undefined : "Haga clic para gestionar turnos de este día"}
                          style={{
                            padding: '0.4rem 0.15rem',
                            textAlign: 'center',
                            borderRight: '1px solid rgba(255, 255, 255, 0.03)',
                            backgroundColor: cellBg,
                            verticalAlign: 'middle',
                            cursor: isGridReadOnly ? 'default' : 'pointer',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          <div 
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '800',
                              fontSize: '0.7rem',
                              fontFamily: 'var(--font-heading)',
                              color: cell.type === 'LIBRE' ? 'var(--text-muted)' : 'white',
                              background: cell.color,
                              border: cell.type === 'LIBRE' ? '1px dashed rgba(255, 255, 255, 0.08)' : 'none',
                              boxShadow: cell.type !== 'LIBRE' && cell.type !== 'DESCANSO' ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
                              transition: 'var(--transition-fast)'
                            }}
                          >
                            {cell.label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={daysInMonth.length + 1} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron controladores en el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Panel Flotante Tooltip/Detalle al pasar el mouse por una celda */}
        {hoveredCell && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--accent-cyan)',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            animation: 'fadeIn 0.15s ease'
          }}>
            <Info size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>
              <strong>{hoveredCell.ctrlName}</strong> el {formatCalendarDayName(hoveredCell.dateStr)}: {hoveredCell.details}
            </span>
          </div>
        )}
      </div>

      {/* Convenciones / Leyenda Visual al pie */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--color-border)',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        fontSize: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}>
          <span>Convenciones:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-cyan)', display: 'inline-block' }} />
          <span>A (Madrugada)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-indigo)', display: 'inline-block' }} />
          <span>M (Mañana)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-emerald)', display: 'inline-block' }} />
          <span>T (Tarde)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-purple)', display: 'inline-block' }} />
          <span>N (Noche)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))', display: 'inline-block' }} />
          <span>MT / TN (Doble)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-indigo)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.6rem' }}>E</span>
          <span>Entrenamiento</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--status-warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.6rem' }}>V</span>
          <span>Vacaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.6rem' }}>C</span>
          <span>Capacitación</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--status-danger)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.55rem' }}>N/O</span>
          <span>No Operativo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.08)', display: 'inline-block' }} />
          <span>D / - (Descanso / Libre)</span>
        </div>
      </div>

      {/* MODAL 1: EDITAR ATRIBUTOS DEL CONTROLADOR */}
      {editingCtrl && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '2rem',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative'
          }}>
            <button 
              onClick={() => setEditingCtrl(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <User size={22} style={{ color: 'var(--accent-cyan)' }} />
              Editar Atributos: {editingCtrl.id}
            </h3>

            <form onSubmit={handleSaveEditController} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Correo Electrónico (Acceso)</label>
                <input 
                  type="email" 
                  className="form-input"
                  placeholder="Ej: sbg@aircontrol.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nueva Contraseña (Dejar en blanco para no cambiar)</label>
                <input 
                  type="password" 
                  className="form-input"
                  placeholder="••••••••"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  minLength={6}
                />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  id="modal-active"
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="modal-active" style={{ cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
                  Controlador Activo / Operativo en Planta
                </label>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  id="modal-training"
                  type="checkbox"
                  checked={editTrainingPreferred}
                  onChange={(e) => setEditTrainingPreferred(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="modal-training" style={{ cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
                  Personal de Entrenamiento Preferente (Alumno / Trainee)
                </label>
              </div>

              <div className="form-group">
                <label>Certificaciones / Skills Activas</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {['CTE', 'TWR', 'GND', 'DEL', 'FIC'].map(skill => {
                    const isChecked = editSkills.includes(skill);
                    return (
                      <label 
                        key={skill} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.4rem 0.6rem',
                          border: isChecked ? `1px solid var(--accent-${skill.toLowerCase()})` : '1px solid var(--color-border)',
                          borderRadius: '8px',
                          backgroundColor: isChecked ? `rgba(255, 255, 255, 0.03)` : 'transparent',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: isChecked ? '700' : 'normal'
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditSkills(editSkills.filter(s => s !== skill));
                            } else {
                              setEditSkills([...editSkills, skill]);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{skill}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingCtrl(null)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GESTIÓN MANUAL DE TURNOS DIARIOS DESDE CELDA */}
      {activeCell && (() => {
        const { ctrl, dayStr } = activeCell;
        const currentAssignments = getActiveAssignmentsForCell(ctrl.id, dayStr);
        const vacantValidSlots = getVacantAndValidSlotsForCell(ctrl.id, dayStr);
        const currentException = exceptions[ctrl.id]?.[dayStr] || 'OPERATIVO';

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '520px',
              padding: '2rem',
              border: '1px solid var(--accent-indigo)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              position: 'relative'
            }}>
              <button 
                onClick={() => setActiveCell(null)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>

              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                <Calendar size={22} style={{ color: 'var(--accent-indigo)' }} />
                <span>Gestión Diaria: {ctrl.name}</span>
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-1.25rem' }}>
                Fecha: <strong>{formatCalendarDayName(dayStr)}</strong> (Licencia: {ctrl.id})
              </span>

              {/* Sección 1: Excepción/Estado Especial del Día */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>1. Estado Especial de Asistencia:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {['OPERATIVO', 'VACACIONES', 'CAPACITACION', 'NO_OPERATIVO', 'DESCANSO'].map(status => {
                    const isActive = currentException === status;
                    let activeBg = 'var(--bg-tertiary)';
                    let activeBorder = 'rgba(255,255,255,0.05)';
                    let color = 'var(--text-secondary)';

                    if (isActive) {
                      color = 'white';
                      if (status === 'OPERATIVO') { activeBg = 'rgba(16, 185, 129, 0.15)'; activeBorder = 'var(--status-success)'; }
                      if (status === 'VACACIONES') { activeBg = 'rgba(245, 158, 11, 0.15)'; activeBorder = 'var(--status-warning)'; }
                      if (status === 'CAPACITACION') { activeBg = 'rgba(6, 182, 212, 0.15)'; activeBorder = 'var(--accent-cyan)'; }
                      if (status === 'NO_OPERATIVO') { activeBg = 'rgba(244, 63, 94, 0.15)'; activeBorder = 'var(--status-danger)'; }
                      if (status === 'DESCANSO') { activeBg = 'rgba(255, 255, 255, 0.08)'; activeBorder = 'var(--text-muted)'; }
                    }

                    return (
                      <button
                        key={status}
                        onClick={() => {
                          onUpdateException(ctrl.id, dayStr, status);
                        }}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderRadius: '8px',
                          border: `1px solid ${activeBorder}`,
                          backgroundColor: activeBg,
                          color: color,
                          fontSize: '0.75rem',
                          fontWeight: isActive ? '700' : 'normal',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        {status === 'CAPACITACION' ? 'CAPACITACIÓN' : status === 'NO_OPERATIVO' ? 'NO OPERATIVO' : status}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sección 2: Asignaciones de Turno del Día */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>2. Turnos Asignados Hoy:</strong>
                
                {currentException !== 'OPERATIVO' ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--status-warning)', margin: 0, fontStyle: 'italic' }}>
                    * El controlador está marcado como {currentException} hoy y no puede realizar turnos operativos.
                  </p>
                ) : currentAssignments.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                    No tiene turnos asignados para este día.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {currentAssignments.map(({ shift, slotKey }) => {
                      const position = slotKey.split('-')[0];
                      const isTraining = position === 'ENT';
                      return (
                        <div 
                          key={`${shift}-${slotKey}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '800',
                              backgroundColor: isTraining ? 'rgba(99, 102, 241, 0.1)' : `rgba(255, 255, 255, 0.05)`,
                              color: isTraining ? 'var(--accent-indigo)' : `var(--accent-${getPositionColorClass(position)})`,
                              border: isTraining ? '1px solid rgba(99, 102, 241, 0.2)' : `1px solid rgba(255, 255, 255, 0.1)`
                            }}>
                              {shift}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                              {isTraining ? 'Entrenamiento' : getSlotDescription(slotKey)} ({getSlotAcronym(slotKey)})
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              onAssignController(dayStr, shift, slotKey, null);
                            }}
                            className="btn btn-icon-only"
                            style={{
                              padding: '0.25rem',
                              color: 'var(--status-danger)',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            title="Quitar turno"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sección 3: Asignar Nuevo Turno */}
              {currentException === 'OPERATIVO' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>3. Asignar Nuevo Turno:</strong>
                  
                  {currentAssignments.length >= 2 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', margin: 0, fontStyle: 'italic' }}>
                      * Límite OACI de 12 horas alcanzado (máximo 2 turnos diarios).
                    </p>
                  ) : vacantValidSlots.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                      No hay turnos vacantes o permitidos por reglas de descanso para este controlador hoy.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        className="form-input"
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                        value={selectedNewSlot}
                        onChange={(e) => setSelectedNewSlot(e.target.value)}
                      >
                        <option value="">-- Selecciona una posición libre --</option>
                        {vacantValidSlots.map(({ shift, slotKey }) => {
                          const position = slotKey.split('-')[0];
                          const isTraining = position === 'ENT';
                          const shiftLabel = 
                            shift === 'A' ? 'Madrugada (A)' :
                            shift === 'M' ? 'Mañana (M)' :
                            shift === 'T' ? 'Tarde (T)' : 'Noche (N)';
                          
                          return (
                            <option key={`${shift}|${slotKey}`} value={`${shift}|${slotKey}`}>
                              {shiftLabel} - {isTraining ? 'Entrenamiento' : getSlotDescription(slotKey)} ({getSlotAcronym(slotKey)})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!selectedNewSlot}
                        onClick={() => {
                          if (!selectedNewSlot) return;
                          const [shift, slotKey] = selectedNewSlot.split('|');
                          onAssignController(dayStr, shift, slotKey, ctrl.id);
                          setSelectedNewSlot('');
                        }}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveCell(null)} style={{ padding: '0.4rem 1.5rem' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
