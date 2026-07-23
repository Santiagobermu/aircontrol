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
  Trash2,
  Upload,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SHIFTS, SHIFT_REQUIREMENTS, isColombianHoliday, validateAssignment, getSlotAcronym, getSlotDescription, adjustDynamicSlots } from '../utils/schedulerEngine';

export default function MonthlyGrid({ 
  schedule, 
  controllers, 
  exceptions,
  publishState = {},
  onTogglePublishMonth,
  onUpdateController,
  onAssignController,
  onUpdateException,
  onBulkImport,
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

  // Excel Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { assignments: [], warnings: [] }
  const [isImporting, setIsImporting] = useState(false);
  const [customMappings, setCustomMappings] = useState({});
  const [unmappedTokens, setUnmappedTokens] = useState([]);
  const [tempMappings, setTempMappings] = useState({});
  const [tempRows, setTempRows] = useState(null);
  const [tempDayCols, setTempDayCols] = useState(null);

  const handleTempMappingChange = (token, mapping) => {
    setTempMappings(prev => ({
      ...prev,
      [token]: mapping
    }));
  };

  const applyCustomMappings = () => {
    setCustomMappings(prev => ({
      ...prev,
      ...tempMappings
    }));
    setUnmappedTokens([]);
    if (tempRows && tempDayCols) {
      processRowsWithMappings(tempRows, tempDayCols, { ...customMappings, ...tempMappings });
    }
  };

  // Mapear celdas de Excel a posición del sistema
  const parseCellToAssignment = (cellValue) => {
    if (!cellValue) return null;
    const val = cellValue.trim().toUpperCase();
    
    if (val === 'LICR') return { exception: 'LICR' };
    if (val === 'LICN') return { exception: 'LICN' };
    if (val === 'MCAE') return { shift: 'M', slotKey: 'CAE-1' };
    if (val === 'MCHEC') return { shift: 'M', slotKey: 'CHEC-1' };
    if (val === 'TCHEC') return { shift: 'T', slotKey: 'CHEC-1' };
    if (val === 'CMED') return { exception: 'CMED' };
    if (val === 'SIND') return { exception: 'SIND' };
    if (val === 'DESCANSO' || val === 'D' || val === 'DESC' || val === 'TROP') return { exception: 'DESCANSO' };
    if (val === 'VACACIONES' || val === 'V' || val === 'VAC' || val === 'VACA') return { exception: 'VACACIONES' };
    if (val === 'CAPACITACION' || val === 'CAP' || val === 'CAPA') return { exception: 'CAPACITACION' };
    if (val === 'NO_OPERATIVO' || val === 'N/O') return { exception: 'NO_OPERATIVO' };
    if (val === 'OPERATIVO' || val === '-' || val === '') return { exception: 'OPERATIVO' };
    
    const shift = val[0];
    if (!['M', 'T', 'N', 'A'].includes(shift)) {
      return null;
    }
    
    const rest = val.substring(1);
    if (rest === 'ACC') {
      return { shift, slotKey: 'ACC-1' };
    }
    
    const posLetter = rest[0];
    const detail = rest.substring(1);
    
    let pos;
    let idx = 1;
    
    if (posLetter === 'L') {
      pos = 'TWR';
      if (detail === 'NT') idx = 1;
      else if (detail === 'ST') idx = 2;
      else if (detail === 'PT') idx = 3;
    } else if (posLetter === 'G') {
      pos = 'GND';
      if (detail === 'NT') idx = 1;
      else if (detail === 'ST') idx = 2;
      else if (detail === 'PT') idx = 3;
    } else if (posLetter === 'D') {
      pos = 'DEL';
      if (detail === 'PT') idx = 1;
      else if (detail === 'PR') idx = 2;
    } else if (posLetter === 'F') {
      pos = 'FIC';
      if (detail === 'PT') idx = 1;
      else if (detail === 'PR') idx = 2;
      else if (detail === 'PA') idx = 3;
    } else if (rest.startsWith('CTE')) {
      pos = 'CTE';
      idx = 1;
    } else {
      if (rest.startsWith('ENT')) {
        pos = 'ENT';
        const num = parseInt(rest.split('-')[1] || '1', 10);
        idx = isNaN(num) ? 1 : num;
      } else if (rest.startsWith('INS')) {
        pos = 'INS';
        const num = parseInt(rest.split('-')[1] || '1', 10);
        idx = isNaN(num) ? 1 : num;
      } else {
        return null;
      }
    }
    
    return { shift, slotKey: `${pos}-${idx}` };
  };

  const validateParsedData = (assignments, warnings) => {
    const tempSchedule = JSON.parse(JSON.stringify(schedule));
    const tempExceptions = JSON.parse(JSON.stringify(exceptions));
    
    assignments.forEach(asg => {
      if (asg.parsed.exception) {
        if (!tempExceptions[asg.ctrlId]) tempExceptions[asg.ctrlId] = {};
        tempExceptions[asg.ctrlId][asg.dateStr] = asg.parsed.exception;
      }
    });
    
    assignments.forEach(asg => {
      if (asg.parsed.exception) return;
      
      const { ctrlId, ctrlName, dateStr, dayNum, cellVal, parsed } = asg;
      const { shift, slotKey } = parsed;
      const position = slotKey.split('-')[0];
      
      const ctrl = controllers.find(c => c.id === ctrlId);
      
      if (position === 'ENT' && !ctrl.trainingPreferred) {
        warnings.push({
          type: 'warning',
          msg: `Día ${dayNum} · ${ctrlName}: Programado en ENT pero no es Alumno/Trainee.`
        });
      } else if (position !== 'ENT' && position !== 'INS' && position !== 'ACC' && (!ctrl.skills || !ctrl.skills.includes(position))) {
        warnings.push({
          type: 'warning',
          msg: `Día ${dayNum} · ${ctrlName}: Programado en ${position} (${cellVal}) pero no está certificado.`
        });
      } else if (position === 'ACC' && (!ctrl.skills || !ctrl.skills.includes('ACC'))) {
        warnings.push({
          type: 'warning',
          msg: `Día ${dayNum} · ${ctrlName}: Programado en ACC (${cellVal}) pero no está certificado.`
        });
      }
      
      const validation = validateAssignment(
        ctrlId, 
        dateStr, 
        shift, 
        slotKey, 
        tempSchedule, 
        controllers, 
        tempExceptions, 
        true
      );
      
      if (!validation.isValid) {
        warnings.push({
          type: 'warning',
          msg: `Día ${dayNum} · ${ctrlName} (${cellVal}): Conflicto de reglas - ${validation.error}`
        });
      }
      
      if (!tempSchedule[dateStr]) {
        tempSchedule[dateStr] = { A: {}, M: {}, T: {}, N: {} };
      }
      if (!tempSchedule[dateStr][shift]) tempSchedule[dateStr][shift] = {};
      tempSchedule[dateStr][shift][slotKey] = ctrlId;
    });
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rows.length === 0) {
          alert('El archivo de Excel está vacío.');
          return;
        }
        
        // Buscar fila de cabecera que contenga días (1, 2, 3...)
        let headerRowIdx = -1;
        let dayCols = {}; // dayNum -> [colIdx1, colIdx2]
        
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          let tempDayCols = {};
          let numericIndices = [];
          for (let c = 1; c < row.length; c++) {
            const cellVal = parseInt(row[c], 10);
            if (!isNaN(cellVal) && cellVal >= 1 && cellVal <= 31) {
              tempDayCols[cellVal] = c;
              numericIndices.push(c);
            }
          }
          if (numericIndices.length >= 10) {
            headerRowIdx = r;
            
            // Determinar si es de dos columnas
            let spacingByTwo = 0;
            for (let i = 1; i < numericIndices.length; i++) {
              if (numericIndices[i] - numericIndices[i-1] === 2) {
                spacingByTwo++;
              }
            }
            
            if (spacingByTwo >= 5) {
              Object.keys(tempDayCols).forEach(dayNum => {
                const c = tempDayCols[dayNum];
                dayCols[dayNum] = [c - 1, c];
              });
            } else {
              Object.keys(tempDayCols).forEach(dayNum => {
                const c = tempDayCols[dayNum];
                dayCols[dayNum] = [c];
              });
            }
            break;
          }
        }
        
        if (headerRowIdx === -1) {
          const firstRow = rows[0];
          let colIdx = 1;
          for (let c = 1; c < firstRow.length; c++) {
            const num = parseInt(firstRow[c], 10);
            if (!isNaN(num)) {
              dayCols[num] = [c];
            } else {
              dayCols[colIdx++] = [c];
            }
          }
          headerRowIdx = 0;
        }
        
        // Escanear códigos no reconocidos
        const scanUnmappedTokens = [];
        
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          
          const val0 = String(row[0] || '').trim();
          const val1 = String(row[1] || '').trim();
          
          const ctrl = controllers.find(c => c.name.toUpperCase() === val0.toUpperCase()) || 
                       controllers.find(c => c.name.toUpperCase() === val1.toUpperCase());
          if (!ctrl) continue;
          
          Object.keys(dayCols).forEach(dayNum => {
            const cols = dayCols[dayNum];
            cols.forEach(colIdx => {
              const cellVal = String(row[colIdx] || '').trim();
              if (!cellVal || cellVal === '-') return;
              
              const parts = cellVal.split(new RegExp('[/,+]'));
              parts.forEach(part => {
                const token = part.trim();
                if (!token || token === '-') return;
                
                const standard = parseCellToAssignment(token);
                const existingMapping = customMappings[token];
                if (!standard && !existingMapping && !scanUnmappedTokens.includes(token)) {
                  scanUnmappedTokens.push(token);
                }
              });
            });
          });
        }
        
        setTempRows(rows);
        setTempDayCols(dayCols);
        
        if (scanUnmappedTokens.length > 0) {
          const initialTemp = {};
          scanUnmappedTokens.forEach(t => {
            initialTemp[t] = { type: 'ACC' };
          });
          setTempMappings(initialTemp);
          setUnmappedTokens(scanUnmappedTokens);
        } else {
          processRowsWithMappings(rows, dayCols, customMappings);
        }
        
      } catch (err) {
        console.error(err);
        alert('Error al leer el archivo Excel. Verifica el formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processRowsWithMappings = (rows, dayCols, mappings) => {
    const parsedAssignments = [];
    const warnings = [];
    
    let headerRowIdx = -1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      let count = 0;
      for (let c = 1; c < row.length; c++) {
        const val = parseInt(row[c], 10);
        if (!isNaN(val) && val >= 1 && val <= 31) count++;
      }
      if (count >= 10) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;

    const parseToken = (token) => {
      const custom = mappings[token];
      if (custom) {
        if (custom.type === 'SKIP') return null;
        if (custom.type === 'SPEC') return { exception: custom.exception };
        if (custom.type === 'ACC') {
          const shift = ['M', 'T', 'N', 'A'].includes(token[0]) ? token[0] : 'M';
          return { shift, slotKey: 'ACC-1' };
        }
        if (custom.type === 'OP') {
          const [shift, slotKey] = custom.position.split('|');
          return { shift, slotKey };
        }
      }
      return parseCellToAssignment(token);
    };

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      
      const val0 = String(row[0] || '').trim();
      const val1 = String(row[1] || '').trim();
      
      let ctrl = controllers.find(c => c.name.toUpperCase() === val0.toUpperCase());
      let sigla = val0;
      if (!ctrl) {
        ctrl = controllers.find(c => c.name.toUpperCase() === val1.toUpperCase());
        sigla = val1;
      }
      
      if (!ctrl) {
        const isLikeSigla = /^[A-Z]{2,4}$/i.test(val0) || /^[A-Z]{2,4}$/i.test(val1);
        if (isLikeSigla) {
          warnings.push({
            type: 'danger',
            msg: `Controlador con siglas "${val0 || val1}" (fila ${r + 1}) no está registrado en el sistema. Se omitieron sus asignaciones.`
          });
        }
        continue;
      }
      
      Object.keys(dayCols).forEach(dayNum => {
        const cols = dayCols[dayNum];
        const dayStr = String(dayNum).padStart(2, '0');
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
        
        cols.forEach(colIdx => {
          const cellVal = String(row[colIdx] || '').trim();
          if (!cellVal || cellVal === '-') return;
          
          const parts = cellVal.split(new RegExp('[/,+]'));
          parts.forEach(part => {
            const token = part.trim();
            if (!token || token === '-') return;
            
            const parsed = parseToken(token);
            if (!parsed) {
              const custom = mappings[token];
              if (custom && custom.type === 'SKIP') return;
              
              warnings.push({
                type: 'warning',
                msg: `Celda [Día ${dayNum}, Ctrl ${sigla}]: Valor "${token}" no reconocido. Se omitió.`
              });
              return;
            }
            
            parsedAssignments.push({
              ctrlId: ctrl.id,
              ctrlName: ctrl.name,
              dateStr,
              dayNum,
              cellVal: token,
              parsed
            });
          });
        });
      });
    }
    
    validateParsedData(parsedAssignments, warnings);
    
    setImportPreview({
      assignments: parsedAssignments,
      warnings
    });
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.assignments.length === 0) return;
    
    setIsImporting(true);
    
    const scheduleUpdates = {};
    const exceptionUpdates = {};
    
    importPreview.assignments.forEach(asg => {
      const { ctrlId, dateStr, parsed } = asg;
      
      if (parsed.exception) {
        if (!exceptionUpdates[ctrlId]) exceptionUpdates[ctrlId] = {};
        exceptionUpdates[ctrlId][dateStr] = parsed.exception;
        
        if (parsed.exception !== 'OPERATIVO') {
          if (!scheduleUpdates[dateStr]) {
            scheduleUpdates[dateStr] = schedule[dateStr] ? JSON.parse(JSON.stringify(schedule[dateStr])) : { A: {}, M: {}, T: {}, N: {} };
          }
          const daySched = scheduleUpdates[dateStr];
          SHIFTS.forEach(s => {
            if (daySched[s]) {
              Object.keys(daySched[s]).forEach(slotKey => {
                if (daySched[s][slotKey] === ctrlId) {
                  daySched[s][slotKey] = null;
                }
              });
            }
          });
        }
      } else {
        const { shift, slotKey } = parsed;
        
        if (!scheduleUpdates[dateStr]) {
          scheduleUpdates[dateStr] = schedule[dateStr] ? JSON.parse(JSON.stringify(schedule[dateStr])) : { A: {}, M: {}, T: {}, N: {} };
        }
        
        const daySched = scheduleUpdates[dateStr];
        if (!daySched[shift]) daySched[shift] = {};
        
        daySched[shift][slotKey] = ctrlId;
      }
    });
    
    Object.keys(scheduleUpdates).forEach(dateStr => {
      const daySched = scheduleUpdates[dateStr];
      SHIFTS.forEach(shift => {
        if (daySched[shift]) {
          daySched[shift] = adjustDynamicSlots(daySched[shift], 'ENT', shift);
          daySched[shift] = adjustDynamicSlots(daySched[shift], 'INS', shift);
          daySched[shift] = adjustDynamicSlots(daySched[shift], 'CAE', shift);
          daySched[shift] = adjustDynamicSlots(daySched[shift], 'CHEC', shift);
        }
      });
    });
    
    try {
      await onBulkImport(scheduleUpdates, exceptionUpdates);
      setIsImportModalOpen(false);
      setImportPreview(null);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al guardar los datos importados.');
    } finally {
      setIsImporting(false);
    }
  };

  const getPositionColorClass = (pos) => {
    switch (pos) {
      case 'CTE': return 'cyan';
      case 'TWR': return 'indigo';
      case 'GND': return 'emerald';
      case 'DEL': return 'purple';
      case 'FIC': return 'fic';
      case 'INS': return 'ins';
      case 'ACC': return 'acc';
      case 'CAE': return 'mcae';
      case 'CHEC': return 'mchec';
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
      email: editEmail.trim().toLowerCase()
    };
    if (editPassword) {
      updated.password = editPassword;
    }

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
    if (dayExc === 'LICR') return { type: 'LICR', label: 'LR', color: 'var(--accent-purple)', details: 'Licencia Remunerada' };
    if (dayExc === 'LICN') return { type: 'LICN', label: 'LN', color: 'var(--accent-fic)', details: 'Licencia No Remunerada' };
    if (dayExc === 'CMED') return { type: 'CMED', label: 'MED', color: 'var(--accent-cmed)', details: 'Chequeo Médico' };
    if (dayExc === 'SIND') return { type: 'SIND', label: 'SIND', color: 'var(--accent-sind)', details: 'Sindicato' };

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

    // Si tiene instrucción (INS)
    const hasInstruction = assignedSlots.some(s => s.slotKey.startsWith('INS'));
    if (hasInstruction && activeShifts.length === 1) {
      return { 
        type: 'INSTRUCCION', 
        label: 'I', 
        color: 'var(--accent-ins)',
        details: `Instrucción hoy en turno ${activeShifts[0]}`
      };
    }

    if (activeShifts.length === 2) {
      // Turno Doble
      const isMT = activeShifts.includes('M') && activeShifts.includes('T');
      const isTN = activeShifts.includes('T') && activeShifts.includes('N');
      
      let label = isMT ? 'MT' : isTN ? 'TN' : '2T';
      if (hasTraining) label += 'e';
      if (hasInstruction) label += 'i';
      
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
          {!isGridReadOnly && (
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
            >
              <Upload size={16} />
              <span>Importar Excel</span>
            </button>
          )}
          {userRole === 'admin' && onTogglePublishMonth && (
            <button 
              onClick={() => onTogglePublishMonth(currentYear, currentMonth)}
              className="btn"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.4rem 1rem', 
                fontSize: '0.8rem',
                fontWeight: '700',
                borderRadius: '8px',
                cursor: 'pointer',
                border: 'none',
                color: 'white',
                backgroundColor: publishState[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`] ? 'var(--status-danger)' : 'var(--status-success)',
                transition: 'all 0.2s ease',
                boxShadow: publishState[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`] ? 'none' : '0 0 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              {publishState[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`] ? (
                <>
                  <EyeOff size={16} />
                  <span>Revertir a Borrador</span>
                </>
              ) : (
                <>
                  <Eye size={16} />
                  <span>Publicar Oficialmente</span>
                </>
              )}
            </button>
          )}
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
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-ins)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.6rem' }}>I</span>
          <span>Instrucción</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--status-warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.6rem' }}>V</span>
          <span>Vacaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.55rem' }}>LR</span>
          <span>Licencia Remunerada</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: 'var(--accent-fic)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '0.55rem' }}>LN</span>
          <span>Licencia No Remunerada</span>
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
                  {['OPERATIVO', 'VACACIONES', 'CAPACITACION', 'NO_OPERATIVO', 'DESCANSO', 'LICR', 'LICN', 'CMED', 'SIND'].map(status => {
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
                      if (status === 'LICR') { activeBg = 'rgba(168, 85, 247, 0.15)'; activeBorder = 'var(--accent-purple)'; }
                      if (status === 'LICN') { activeBg = 'rgba(245, 158, 11, 0.15)'; activeBorder = 'var(--accent-fic)'; }
                      if (status === 'CMED') { activeBg = 'rgba(239, 68, 68, 0.15)'; activeBorder = 'var(--accent-cmed)'; }
                      if (status === 'SIND') { activeBg = 'rgba(6, 182, 212, 0.15)'; activeBorder = 'var(--accent-sind)'; }
                    }

                    const labelMap = {
                      OPERATIVO: 'Operativo',
                      VACACIONES: 'Vacaciones',
                      CAPACITACION: 'Capacitación',
                      NO_OPERATIVO: 'No Operativo',
                      DESCANSO: 'Descanso',
                      LICR: 'Lic. Remunerada (LICR)',
                      LICN: 'Lic. No Remunerada (LICN)',
                      CMED: 'Chequeo Médico (CMED)',
                      SIND: 'Sindicato (SIND)'
                    };

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
                        {labelMap[status] || status}
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
                      const isInstruction = position === 'INS';
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
                              backgroundColor: isTraining ? 'rgba(99, 102, 241, 0.1)' : isInstruction ? 'rgba(236, 72, 153, 0.1)' : `rgba(255, 255, 255, 0.05)`,
                              color: isTraining ? 'var(--accent-indigo)' : isInstruction ? 'var(--accent-ins)' : `var(--accent-${getPositionColorClass(position)})`,
                              border: isTraining ? '1px solid rgba(99, 102, 241, 0.2)' : isInstruction ? '1px solid rgba(236, 72, 153, 0.2)' : `1px solid rgba(255, 255, 255, 0.1)`
                            }}>
                              {shift}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                              {isTraining ? 'Entrenamiento' : isInstruction ? 'Instrucción' : getSlotDescription(slotKey, shift)} ({getSlotAcronym(slotKey, shift)})
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
                          const isInstruction = position === 'INS';
                          const shiftLabel = 
                            shift === 'A' ? 'Madrugada (A)' :
                            shift === 'M' ? 'Mañana (M)' :
                            shift === 'T' ? 'Tarde (T)' : 'Noche (N)';
                          
                          const slotDesc = isTraining ? 'Entrenamiento' : isInstruction ? 'Instrucción' : getSlotDescription(slotKey, shift);
                          
                          return (
                            <option key={`${shift}|${slotKey}`} value={`${shift}|${slotKey}`}>
                              {shiftLabel} - {slotDesc} ({getSlotAcronym(slotKey, shift)})
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

      {/* Modal de Importación desde Excel */}
      {isImportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '650px',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportPreview(null);
              }}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <Upload size={22} style={{ color: 'var(--accent-cyan)' }} />
              <span>Importar Roster de Excel ({monthNames[currentMonth]} {currentYear})</span>
            </h3>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Sube un archivo de Excel con formato <strong>Matriz (Opción B)</strong> para cargar de forma masiva los turnos del mes seleccionado:
              </p>
              <ul style={{ paddingLeft: '1.2rem', margin: '0 0 1rem 0' }}>
                <li>La primera fila del archivo debe contener los días del mes (1 al 31).</li>
                <li>La primera columna debe contener las siglas (firmas) de los controladores (ej: <code>JZA</code>, <code>GMB</code>).</li>
                <li>Los códigos de turno deben seguir el estándar: <strong>Jornada + Posición</strong> (ej. <code>MLNT</code> = Mañana TWR Norte, <code>TGST</code> = Tarde GND Sur, <code>MACC</code> = Mañana ACC, <code>LICR</code> = Lic. Remunerada, <code>D</code> = Descanso).</li>
                <li>Si un controlador tiene doble turno en el mismo día, sepáralos con una barra inclinada (ej: <code>MLNT / TGST</code>).</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="excel-file-input" style={{ fontSize: '0.85rem', fontWeight: '700' }}>Selecciona archivo de Excel (.xlsx, .xls)</label>
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx, .xls"
                className="form-input"
                onChange={handleExcelUpload}
                style={{ padding: '0.5rem' }}
              />
            </div>

            {unmappedTokens.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--color-border)'
              }}>
                <h4 style={{ margin: 0, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                  <AlertCircle size={18} />
                  <span>Códigos no reconocidos encontrados ({unmappedTokens.length})</span>
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Se encontraron códigos en el Excel que no corresponden a posiciones estándar. Por favor, selecciona cómo deseas procesar cada uno:
                </p>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginTop: '0.5rem',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  paddingRight: '0.5rem'
                }}>
                  {unmappedTokens.map(token => {
                    const currentMapping = tempMappings[token] || { type: 'ACC' };
                    return (
                      <div key={token} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.8rem', color: 'white' }}>
                            Código: <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--accent-cyan)' }}>{token}</code>
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <button
                            type="button"
                            className={`btn ${currentMapping.type === 'ACC' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleTempMappingChange(token, { type: 'ACC' })}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                          >
                            Categoría ACC
                          </button>
                          <button
                            type="button"
                            className={`btn ${currentMapping.type === 'OP' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleTempMappingChange(token, { type: 'OP', position: 'M|TWR-1' })}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                          >
                            Turno Operativo
                          </button>
                          <button
                            type="button"
                            className={`btn ${currentMapping.type === 'SPEC' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleTempMappingChange(token, { type: 'SPEC', exception: 'DESCANSO' })}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                          >
                            Turno Especial / Licencia
                          </button>
                          <button
                            type="button"
                            className={`btn ${currentMapping.type === 'SKIP' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleTempMappingChange(token, { type: 'SKIP' })}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                          >
                            Ignorar / Omitir
                          </button>
                        </div>
                        
                        {currentMapping.type === 'OP' && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Asignar a posición:</span>
                            <select
                              value={currentMapping.position || 'M|TWR-1'}
                              onChange={(e) => handleTempMappingChange(token, { type: 'OP', position: e.target.value })}
                              className="form-input"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', width: 'auto', height: 'auto' }}
                            >
                              {SHIFTS.map(s => {
                                const req = SHIFT_REQUIREMENTS[s];
                                return Object.keys(req).flatMap(pos => {
                                  const count = req[pos];
                                  const list = [];
                                  for (let i = 1; i <= count; i++) {
                                    list.push({ shift: s, slotKey: `${pos}-${i}` });
                                  }
                                  return list;
                                }).map(({ shift, slotKey }) => {
                                  const label = shift === 'A' ? 'Madrugada' : shift === 'M' ? 'Mañana' : shift === 'T' ? 'Tarde' : 'Noche';
                                  return (
                                    <option key={`${shift}|${slotKey}`} value={`${shift}|${slotKey}`}>
                                      {label} - {getSlotDescription(slotKey, shift)} ({getSlotAcronym(slotKey, shift)})
                                    </option>
                                  );
                                });
                              })}
                            </select>
                          </div>
                        )}
                        
                        {currentMapping.type === 'SPEC' && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Asignar a estado:</span>
                            <select
                              value={currentMapping.exception || 'DESCANSO'}
                              onChange={(e) => handleTempMappingChange(token, { type: 'SPEC', exception: e.target.value })}
                              className="form-input"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', width: 'auto', height: 'auto' }}
                            >
                              <option value="DESCANSO">Descanso / Receso Operativo (D)</option>
                              <option value="VACACIONES">Vacaciones (V)</option>
                              <option value="CAPACITACION">Capacitación (C)</option>
                              <option value="NO_OPERATIVO">No Operativo (N/O)</option>
                              <option value="LICR">Licencia Remunerada (LICR)</option>
                              <option value="LICN">Licencia No Remunerada (LICN)</option>
                              <option value="CMED">Chequeo Médico (CMED)</option>
                              <option value="SIND">Sindicato (SIND)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={applyCustomMappings}
                    style={{ padding: '0.4rem 1.5rem', fontSize: '0.8rem' }}
                  >
                    Aplicar Mapeo y Continuar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {importPreview && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700' }}>
                      <span>Asignaciones encontradas: {importPreview.assignments.length}</span>
                      <span style={{ color: importPreview.warnings.length > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                        Advertencias: {importPreview.warnings.length}
                      </span>
                    </div>

                    {importPreview.warnings.length > 0 && (
                      <div style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        fontSize: '0.75rem'
                      }}>
                        {importPreview.warnings.map((warn, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.4rem',
                            color: warn.type === 'danger' ? 'var(--status-danger)' : 'var(--status-warning)'
                          }}>
                            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '0.05rem' }} />
                            <span>{warn.msg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isImporting}
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportPreview(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isImporting || !importPreview || importPreview.assignments.length === 0}
                    onClick={handleConfirmImport}
                  >
                    {isImporting ? 'Importando...' : 'Confirmar Importación'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
