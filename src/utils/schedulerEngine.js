/* ==========================================================================
   AirControl - Motor de Validación y Auto-Completar con Secuencias (ElDorado)
   ========================================================================== */

// Lista de días de la semana y turnos fijos
export const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHIFTS = ['A', 'M', 'T', 'N'];

// Estructura de requerimientos de slots por turno y posición (Se añade ENT-1 para entrenamiento y FIC-3 para M y T)
export const SHIFT_REQUIREMENTS = {
  A: { CTE: 0, TWR: 3, GND: 3, DEL: 1, ENT: 1, ACC: 1 },
  M: { CTE: 1, TWR: 3, GND: 3, DEL: 2, FIC: 3, ENT: 1, INS: 1, CAE: 1, CHEC: 1, ACC: 1 },
  T: { CTE: 1, TWR: 3, GND: 3, DEL: 2, FIC: 3, ENT: 1, INS: 1, CHEC: 1, ACC: 1 },
  N: { CTE: 1, TWR: 3, GND: 3, DEL: 2, ENT: 1, ACC: 1 }
};

// Fecha ancla para cálculo de desfase rotativo de 6 días (Lunes 2026-05-25)
const ANCHOR_DATE_STR = '2026-05-25';

/**
 * Retorna la sigla oficial de la sub-posición a partir del slotKey (ej. 'TWR-1' -> 'LNT')
 */
export const getSlotAcronym = (slotKey, shift) => {
  if (!slotKey) return '';
  const pos = slotKey.split('-')[0];
  if (pos === 'ACC') {
    return `${shift || ''}ACC`;
  }
  if (pos === 'CAE') {
    return 'MCAE';
  }
  if (pos === 'CHEC') {
    return `${shift || ''}CHEC`;
  }
  switch (slotKey) {
    case 'TWR-1': return 'LNT';
    case 'TWR-2': return 'LST';
    case 'TWR-3': return 'LPT';
    case 'GND-1': return 'GNT';
    case 'GND-2': return 'GST';
    case 'GND-3': return 'GPT';
    case 'DEL-1': return 'DPT';
    case 'DEL-2': return 'DPR';
    case 'FIC-1': return 'FPT';
    case 'FIC-2': return 'FPA';
    case 'FIC-3': return 'FPR';
    case 'CTE-1': return 'CTE';
    case 'ENT-1': return 'ENT';
    default:
      return slotKey.split('-')[0];
  }
};

/**
 * Retorna la descripción operativa en Eldorado a partir del slotKey (ej. 'TWR-1' -> 'Torre Norte')
 */
export const getSlotDescription = (slotKey, shift) => {
  if (!slotKey) return '';
  if (slotKey.startsWith('ENT-')) return 'Entrenamiento Alumno';
  if (slotKey.startsWith('INS-')) return 'Instrucción';
  const pos = slotKey.split('-')[0];
  if (pos === 'CAE') return 'Capacitación Especial';
  if (pos === 'CHEC') return 'Chequeo';
  if (pos === 'ACC') {
    const shiftName = 
      shift === 'A' ? 'Madrugada' :
      shift === 'M' ? 'Mañana' :
      shift === 'T' ? 'Tarde' : 'Noche';
    return `Centro Control Área - ${shiftName} (${shift || ''}ACC)`;
  }
  switch (slotKey) {
    case 'TWR-1': return 'Torre Norte';
    case 'TWR-2': return 'Torre Sur';
    case 'TWR-3': return 'Torre Reserva';
    case 'GND-1': return 'Ground Norte';
    case 'GND-2': return 'Ground Sur';
    case 'GND-3': return 'Ground Reserva';
    case 'DEL-1': return 'Autorizaciones Titular';
    case 'DEL-2': return 'Autorizaciones Reserva';
    case 'FIC-1': return 'FIC Titular';
    case 'FIC-2': return 'FIC Apoyo';
    case 'FIC-3': return 'FIC Reserva';
    case 'CTE-1': return 'Encargado de Turno';
    default: {
      const parts = slotKey.split('-');
      return `${parts[0]} ${parts[1] || ''}`;
    }
  }
};

/**
 * Algoritmo de barajado Fisher-Yates
 */
export const shuffleArray = (arr) => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Algoritmo de Butcher para calcular el Domingo de Pascua (Easter)
 */
export const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

/**
 * Calcula todos los festivos de Colombia para un año específico (Ley Emiliani + Pascua)
 */
export const getColombianHolidays = (year) => {
  const holidays = {};

  const addHoliday = (date, name) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    holidays[`${yyyy}-${mm}-${dd}`] = name;
  };

  const getNextMonday = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    if (day !== 1) { // 1 es Lunes
      const diff = (day === 0) ? 1 : (8 - day);
      result.setDate(result.getDate() + diff);
    }
    return result;
  };

  const addEmilianiHoliday = (month, day, name) => {
    const holidayDate = new Date(year, month - 1, day);
    if (holidayDate.getDay() !== 1) {
      addHoliday(getNextMonday(holidayDate), name);
    } else {
      addHoliday(holidayDate, name);
    }
  };

  // 1. Fijos (No se trasladan)
  addHoliday(new Date(year, 0, 1), 'Año Nuevo');
  addHoliday(new Date(year, 4, 1), 'Día del Trabajo');
  addHoliday(new Date(year, 6, 20), 'Día de la Independencia');
  addHoliday(new Date(year, 7, 7), 'Batalla de Boyacá');
  addHoliday(new Date(year, 11, 8), 'Inmaculada Concepción');
  addHoliday(new Date(year, 11, 25), 'Navidad');

  // 2. Ley Emiliani (Se trasladan al siguiente lunes si no caen en lunes)
  addEmilianiHoliday(1, 6, 'Reyes Magos');
  addEmilianiHoliday(3, 19, 'San José');
  addEmilianiHoliday(6, 29, 'San Pedro y San Pablo');
  addEmilianiHoliday(8, 15, 'Asunción de la Virgen');
  addEmilianiHoliday(10, 12, 'Día de la Raza');
  addEmilianiHoliday(11, 1, 'Todos los Santos');
  addEmilianiHoliday(11, 11, 'Independencia de Cartagena');

  // 3. Festivos variables basados en la Pascua (Easter)
  const easter = getEasterDate(year);
  
  // Jueves Santo
  const juevesSanto = new Date(easter);
  juevesSanto.setDate(easter.getDate() - 3);
  addHoliday(juevesSanto, 'Jueves Santo');

  // Viernes Santo
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);
  addHoliday(viernesSanto, 'Viernes Santo');

  // Ascensión del Señor (Pascua + 43 días)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 43);
  addHoliday(ascension, 'Ascensión del Señor');

  // Corpus Christi (Pascua + 64 días)
  const corpus = new Date(easter);
  corpus.setDate(easter.getDate() + 64);
  addHoliday(corpus, 'Corpus Christi');

  // Sagrado Corazón de Jesús (Pascua + 71 días)
  const sagradoCorazon = new Date(easter);
  sagradoCorazon.setDate(easter.getDate() + 71);
  addHoliday(sagradoCorazon, 'Sagrado Corazón de Jesús');

  return holidays;
};

const holidaysCache = {};

/**
 * Indica si una fecha YYYY-MM-DD es festivo en Colombia
 */
export const isColombianHoliday = (dateStr) => {
  if (!dateStr) return { isHoliday: false, name: '' };
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]);
  if (!holidaysCache[year]) {
    holidaysCache[year] = getColombianHolidays(year);
  }
  const holidayName = holidaysCache[year][dateStr];
  return {
    isHoliday: !!holidayName,
    name: holidayName || ''
  };
};

/**
 * Calcula los días transcurridos entre dos fechas YYYY-MM-DD.
 */
export const getDaysElapsed = (dateStr) => {
  const anchor = new Date(ANCHOR_DATE_STR + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffTime = target - anchor;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Retorna las 7 fechas YYYY-MM-DD de la semana que contiene a la fecha dateStr (Lunes a Domingo).
 */
export const getWeekDaysOfDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0 es Domingo, 1 es Lunes...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para Lunes
  
  const mon = new Date(date.setDate(diff));
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    week.push(`${yyyy}-${mm}-${dd}`);
  }
  return week;
};

/**
 * Obtiene el día de la secuencia de 6 días (0 a 5) para un controlador y una fecha específicos.
 */
export const getSequenceDayIndex = (controllerIndex, dateStr) => {
  const elapsed = getDaysElapsed(dateStr);
  const offset = controllerIndex % 6; // 6 subgrupos de desfase
  return ((elapsed + offset) % 6 + 6) % 6;
};

/**
 * Ajusta los slots dinámicos (ENT o INS) para que sean consecutivos (PFX-1, PFX-2, etc.)
 * y que siempre haya exactamente un slot vacío al final (si el turno lo permite o si ya hay asignaciones).
 */
export const adjustDynamicSlots = (shiftSchedule, prefix, shift) => {
  if (!shiftSchedule) return {};
  
  const newShiftSchedule = { ...shiftSchedule };

  // Obtener todas las llaves de slots del prefijo (ej. 'ENT-' o 'INS-')
  const keys = Object.keys(newShiftSchedule)
    .filter(k => k.startsWith(`${prefix}-`))
    .sort((a, b) => {
      const numA = parseInt(a.split('-')[1], 10);
      const numB = parseInt(b.split('-')[1], 10);
      return numA - numB;
    });
    
  // Filtrar las que tienen controladores asignados (no null)
  const assignedKeys = keys.filter(k => newShiftSchedule[k] !== null);
  
  // Eliminar todas las llaves viejas
  keys.forEach(k => {
    delete newShiftSchedule[k];
  });
  
  // Re-insertar las asignadas ordenadamente
  assignedKeys.forEach((oldKey, idx) => {
    newShiftSchedule[`${prefix}-${idx + 1}`] = shiftSchedule[oldKey];
  });
  
  // Determinar si debemos agregar el primer slot vacío
  const shouldHaveAtLeastOne = (prefix === 'ENT') || 
                               (prefix === 'INS' && (shift === 'M' || shift === 'T')) ||
                               (prefix === 'CAE' && shift === 'M') ||
                               (prefix === 'CHEC' && (shift === 'M' || shift === 'T'));
  
  if (assignedKeys.length > 0 || shouldHaveAtLeastOne) {
    newShiftSchedule[`${prefix}-${assignedKeys.length + 1}`] = null;
  }
  
  return newShiftSchedule;
};

/**
 * Inicializa un cuadrante vacío para una fecha específica.
 */
export const createEmptyDaySchedule = (dateStr) => {
  if (!dateStr) {
    // Permite inicializar sin fecha si es necesario
  }
  const daySchedule = {};
  SHIFTS.forEach(shift => {
    daySchedule[shift] = {};
    const req = SHIFT_REQUIREMENTS[shift];
    Object.keys(req).forEach(position => {
      const count = req[position];
      for (let i = 1; i <= count; i++) {
        daySchedule[shift][`${position}-${i}`] = null;
      }
    });
  });
  return daySchedule;
};

/**
 * Valida una asignación individual en una fecha YYYY-MM-DD.
 */
export const validateAssignment = (controllerId, dateStr, targetShift, targetSlot, schedule, controllers, exceptions = {}, isManual = false) => {
  const controller = controllers.find(c => c.id === controllerId);
  if (!controller) {
    return { isValid: false, error: 'Controlador no encontrado.' };
  }

  if (!controller.active) {
    return { isValid: false, error: `${controller.name} está inactivo.` };
  }

  const position = targetSlot.split('-')[0]; // Extrae 'CTE', 'TWR', 'ENT', etc.

  // Validar que la posición INS solo se programe en Mañana (M) o Tarde (T)
  if (position === 'INS' && targetShift !== 'M' && targetShift !== 'T') {
    return { isValid: false, error: `La posición de Instrucción (INS) solo se permite en jornadas de Mañana (M) o Tarde (T).` };
  }

  // Validar que la posición CAE solo se programe en Mañana (M)
  if (position === 'CAE' && targetShift !== 'M') {
    return { isValid: false, error: `La posición de Capacitación Especial (CAE) solo se permite en la jornada de Mañana (M).` };
  }

  // Validar que la posición CHEC solo se programe en Mañana (M) o Tarde (T)
  if (position === 'CHEC' && targetShift !== 'M' && targetShift !== 'T') {
    return { isValid: false, error: `La posición de Chequeo (CHEC) solo se permite en las jornadas de Mañana (M) o Tarde (T).` };
  }

  // 1. Validar Habilidad / Certificación de la Posición
  if (position === 'ENT') {
    if (!controller.trainingPreferred) {
      return { isValid: false, error: `${controller.name} no está seleccionado para entrenamiento (no es Alumno).` };
    }
  } else if (position === 'INS' || position === 'CAE' || position === 'CHEC') {
    // Cualquier controlador puede recibir la posición, por lo tanto no hay validación
  } else if (!controller.skills || !controller.skills.includes(position)) {
    return { isValid: false, error: `${controller.name} no está certificado para la posición ${position}.` };
  }

  // 2. Validar Estados Especiales de la Fecha (Vacaciones, Capacitación, Inoperatividad, Licencias)
  const dateException = exceptions[controllerId]?.[dateStr] || 'OPERATIVO';
  if (dateException !== 'OPERATIVO') {
    let errorMsg = `${controller.name} tiene un estado especial de ${dateException} el día ${dateStr}.`;
    if (dateException === 'VACACIONES') errorMsg = `${controller.name} está en VACACIONES el día ${dateStr}.`;
    else if (dateException === 'CAPACITACION') errorMsg = `${controller.name} está en CAPACITACIÓN el día ${dateStr}.`;
    else if (dateException === 'NO_OPERATIVO') errorMsg = `${controller.name} está marcado como NO OPERATIVO el día ${dateStr}.`;
    else if (dateException === 'DESCANSO') errorMsg = `${controller.name} tiene un DESCANSO programado el día ${dateStr}.`;
    else if (dateException === 'LICR') errorMsg = `${controller.name} tiene una Licencia Remunerada (LICR) el día ${dateStr}.`;
    else if (dateException === 'LICN') errorMsg = `${controller.name} tiene una Licencia No Remunerada (LICN) el día ${dateStr}.`;
    else if (dateException === 'CMED') errorMsg = `${controller.name} tiene Chequeo Médico (CMED) el día ${dateStr}.`;
    else if (dateException === 'SIND') errorMsg = `${controller.name} tiene Sindicato (SIND) el día ${dateStr}.`;
    
    return { isValid: false, error: errorMsg };
  }

  // Obtener todas las asignaciones en esta fecha específica
  const dayAssignments = [];
  SHIFTS.forEach(shift => {
    const slots = schedule[dateStr]?.[shift] || {};
    Object.keys(slots).forEach(slotKey => {
      // Ignorar el slot actual que estamos intentando ocupar
      if (shift === targetShift && slotKey === targetSlot) return;
      
      if (slots[slotKey] === controllerId) {
        dayAssignments.push({ shift, slot: slotKey });
      }
    });
  });

  // 3. Validar Duplicidad en el mismo Bloque de Turno
  const inSameShift = dayAssignments.some(a => a.shift === targetShift);
  if (inSameShift) {
    return { isValid: false, error: `${controller.name} ya está programado en otra posición en el turno ${targetShift}.` };
  }

  // 4. Validar Límite de 12 Horas Diarias (máximo 2 turnos) e Incompatibilidad de Turno Suplementario en Domingos/Festivos
  const holiday = isColombianHoliday(dateStr);
  const dateObj = new Date(dateStr + 'T00:00:00');
  const isSunday = dateObj.getDay() === 0;
  const isSpecialDay = holiday.isHoliday || isSunday;

  if (isSpecialDay && dayAssignments.length >= 1 && !isManual) {
    return { isValid: false, error: `No se permiten turnos suplementarios (dobles turnos) en domingos o festivos especiales.` };
  }

  if (dayAssignments.length >= 2) {
    return { isValid: false, error: `${controller.name} ya ha alcanzado el límite máximo de 12 horas diarias (2 turnos).` };
  }

  // 4b. Validar Límite de 8 Jornadas Suplementarias (turnos dobles) al Mes por Controlador
  if (dayAssignments.length === 1) {
    // Si estamos agregando un segundo turno, se convertirá en un doble turno. Verificar límite mensual de 8 dobles
    const monthPrefix = dateStr.substring(0, 7); // e.g. "2026-05"
    let doubleShiftsInMonth = 0;
    
    Object.keys(schedule).forEach(day => {
      if (day.startsWith(monthPrefix) && day !== dateStr) {
        let countOnDay = 0;
        SHIFTS.forEach(s => {
          const slots = schedule[day]?.[s] || {};
          if (Object.values(slots).includes(controllerId)) {
            countOnDay++;
          }
        });
        if (countOnDay >= 2) {
          doubleShiftsInMonth++;
        }
      }
    });

    if (doubleShiftsInMonth >= 8) {
      return { isValid: false, error: `${controller.name} ya ha alcanzado el límite máximo de 8 jornadas suplementarias (turnos dobles) en el mes.` };
    }
  }

  // 5. Validar Regla de Entrenamiento Único en el Día - ELIMINADO
  // Se permite que estén entrenando en varias jornadas el mismo día y sin limitación de cantidad.

  // 6. Validar Regla del Turno Nocturno (A)
  if (targetShift === 'A' && dayAssignments.length > 0) {
    return { isValid: false, error: `${controller.name} no puede hacer el turno A si ya tiene otros turnos programados hoy.` };
  }
  const hasWorkedA = dayAssignments.some(a => a.shift === 'A');
  if (hasWorkedA) {
    return { isValid: false, error: `${controller.name} trabajó el turno A (00:00-06:00) y no puede laborar más turnos hoy.` };
  }

  // 7. Validar Turnos Dobles Consecutivos (si trabaja 2 turnos, deben ser consecuentes)
  if (dayAssignments.length === 1) {
    const existingShift = dayAssignments[0].shift;
    const isConsecutive = 
      (existingShift === 'M' && targetShift === 'T') ||
      (existingShift === 'T' && targetShift === 'M') ||
      (existingShift === 'T' && targetShift === 'N') ||
      (existingShift === 'N' && targetShift === 'T');
      
    if (!isConsecutive) {
      return { 
        isValid: false, 
        error: `Los turnos dobles deben ser consecutivamente contiguos (M+T o T+N). Prohibidos turnos separados.` 
      };
    }
  }

  // 8. Validar Límite de Días Laborados en la Semana (los 2 descansos obligatorios de Lunes a Sábado, o Martes a Sábado si el Lunes es festivo)
  const weekDays = getWeekDaysOfDate(dateStr);
  const mondayStr = weekDays[0];
  const isMondayHoliday = isColombianHoliday(mondayStr).isHoliday;

  // Definir la ventana de días hábiles de lunes a sábado para el descanso obligatorio
  const windowDays = [];
  const startIdx = isMondayHoliday ? 1 : 0; // Si el lunes es festivo, la ventana empieza el martes (index 1)
  for (let i = startIdx; i <= 5; i++) { // 5 es Sábado
    windowDays.push(weekDays[i]);
  }

  // Contar días laborados en la ventana (excluyendo la fecha actual)
  let workedDaysInWindow = 0;
  windowDays.forEach(wDay => {
    if (wDay === dateStr) return;
    
    let hasShiftsOnDay = false;
    SHIFTS.forEach(shift => {
      const slots = schedule[wDay]?.[shift] || {};
      if (Object.values(slots).includes(controllerId)) {
        hasShiftsOnDay = true;
      }
    });
    if (hasShiftsOnDay) workedDaysInWindow++;
  });

  const maxWorkedDaysInWindow = isMondayHoliday ? 3 : 4; // Ventana de 5 días (máx 3 trabajados) o 6 días (máx 4 trabajados)
  const isTargetInWindow = windowDays.includes(dateStr);

  if (isTargetInWindow && workedDaysInWindow >= maxWorkedDaysInWindow) {
    const windowLabel = isMondayHoliday ? 'Martes a Sábado' : 'Lunes a Sábado';
    return { 
      isValid: false, 
      error: `${controller.name} debe cumplir con sus 2 descansos semanales de ${windowLabel}. Límite de días laborados superado.` 
    };
  }

  // 9a. Restricciones de Transición: Día Anterior
  const date = new Date(dateStr + 'T00:00:00');
  const prevDate = new Date(date);
  prevDate.setDate(date.getDate() - 1);
  const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
  
  if (schedule[prevDateStr]) {
    let workedNPrev = false;
    let workedTPrev = false;
    
    SHIFTS.forEach(s => {
      const slots = schedule[prevDateStr][s] || {};
      if (Object.values(slots).includes(controllerId)) {
        if (s === 'N') workedNPrev = true;
        if (s === 'T') workedTPrev = true;
      }
    });
    
    if (workedNPrev && targetShift === 'M') {
      return { isValid: false, error: `${controller.name} laboró el turno N (Noche) ayer y no puede hacer el turno M (Mañana) hoy (Descanso mínimo insuficiente).` };
    }
    
    if (workedTPrev && targetShift === 'A') {
      return { isValid: false, error: `${controller.name} laboró el turno T (Tarde) ayer y no puede hacer el turno A (Madrugada) hoy (Descanso mínimo insuficiente).` };
    }
  }

  // 9b. Restricciones de Transición: Día Siguiente (Bidireccional)
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + 1);
  const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
  
  if (schedule[nextDateStr]) {
    let worksMNext = false;
    let worksANext = false;
    
    SHIFTS.forEach(s => {
      const slots = schedule[nextDateStr][s] || {};
      if (Object.values(slots).includes(controllerId)) {
        if (s === 'M') worksMNext = true;
        if (s === 'A') worksANext = true;
      }
    });
    
    if (targetShift === 'N' && worksMNext) {
      return { isValid: false, error: `${controller.name} ya está programado en el turno M (Mañana) mañana y no puede laborar el turno N (Noche) hoy.` };
    }
    
    if (targetShift === 'T' && worksANext) {
      return { isValid: false, error: `${controller.name} ya está programado en el turno A (Madrugada) mañana y no puede laborar el turno T (Tarde) hoy.` };
    }
  }

  return { isValid: true, error: null };
};

/**
 * Algoritmo Inteligente de Auto-Completar basado en la Secuencia Ajustable de 6 Días.
 * Llama a la lógica mensual robusta para garantizar la consistencia en pasadas de 7 días.
 */
export const runAutoSchedulerForWeek = (weekDays, controllers, exceptions = {}, sequencePattern = []) => {
  return runAutoSchedulerForMonth(weekDays, controllers, exceptions, sequencePattern);
};

/**
 * Algoritmo Inteligente de Auto-Completar para un MES COMPLETO de calendario real.
 * Programa secuencialmente cada día del mes usando un pipeline de 5 pasadas diarias
 * orientado a secuencias estrictas, acoplamiento de dobles turnos y balanceo de cargas.
 */
export const runAutoSchedulerForMonth = (daysInMonth, controllers, exceptions = {}, sequencePattern = [], requests = []) => {
  const updatedSchedule = {};
  
  // Inicializar slots vacíos para todo el mes
  daysInMonth.forEach(day => {
    updatedSchedule[day] = createEmptyDaySchedule(day);
  });

  // Contador de cargas de trabajo (mensual)
  const workLoads = {};
  controllers.forEach(c => {
    workLoads[c.id] = 0;
  });

  // Registro de jornadas suplementarias (turnos dobles) al mes por controlador
  const doubleShiftsCount = {};
  controllers.forEach(c => {
    doubleShiftsCount[c.id] = 0;
  });

  // Recorrer secuencialmente cada día del mes
  for (let dIndex = 0; dIndex < daysInMonth.length; dIndex++) {
    const day = daysInMonth[dIndex];

    const holiday = isColombianHoliday(day);
    const dateObj = new Date(day + 'T00:00:00');
    const isSunday = dateObj.getDay() === 0;
    const isSpecialDay = holiday.isHoliday || isSunday;

    // Helper reactivo para saltarse el descanso teórico o turnos compuestos en domingos o festivos
    const getOverriddenPattern = (c, dayStr) => {
      const idx = controllers.indexOf(c);
      const seqDay = getSequenceDayIndex(idx, dayStr);
      const pat = sequencePattern[seqDay] || 'DESCANSO';
      
      if (isSpecialDay) {
        // En domingos y festivos especiales, nadie descansa de forma teórica en la secuencia
        // ni trabaja dobles estrictos. Todo se flexibiliza a Cualquiera.
        if (pat === 'DESCANSO' || pat === 'M+T' || pat === 'T+N') {
          return 'Cualquiera';
        }
      }
      return pat;
    };

    // --- PASADA 0: Pre-asignación de Peticiones Especiales (Fase 9) ---
    const dayRequests = requests.filter(r => r.date === day);
    dayRequests.forEach(req => {
      const c = controllers.find(ctrl => ctrl.id === req.controllerId);
      if (c && c.active) {
        // Determinar turnos a intentar
        const shiftsToTry = (req.shift && req.shift !== 'Cualquiera')
          ? [req.shift]
          : ['M', 'T', 'N', 'A'];

        // Determinar posiciones a intentar
        const positionsToTry = (req.position && req.position !== 'Cualquiera')
          ? [req.position]
          : (c.skills ? [...c.skills] : []);

        let satisfied = false;

        // Intentar las combinaciones de turno y posición
        for (const shift of shiftsToTry) {
          const slots = updatedSchedule[day][shift] || {};
          
          for (const pos of positionsToTry) {
            // Encontrar todos los slots de esta posición en este turno que estén vacantes
            const posSlots = Object.keys(slots).filter(k => k.startsWith(pos) && slots[k] === null);
            
            // Barajarlos para cumplir con la asignación aleatoria
            const shuffledSlots = shuffleArray(posSlots);

            for (const slotKey of shuffledSlots) {
              slots[slotKey] = c.id;

              const val = validateAssignment(c.id, day, shift, slotKey, updatedSchedule, controllers, exceptions);
              if (val.isValid) {
                workLoads[c.id]++;
                satisfied = true;
                break;
              } else {
                slots[slotKey] = null;
              }
            }
            if (satisfied) break;
          }
          if (satisfied) break;
        }
      }
    });

    // --- PASADA 1: Asignación de Jornadas Dobles Estrictas (M+T y T+N) ---
    // NOTA: Se omite por completo en domingos o festivos especiales
    if (!isSpecialDay) {
      const doubleShiftControllers = controllers.filter(c => {
        if (!c.active) return false;
        const pat = getOverriddenPattern(c, day);
        return pat === 'M+T' || pat === 'T+N';
      });

      // Ordenar priorizando por menor cantidad de dobles turnos al mes, luego menor carga general
      doubleShiftControllers.sort((a, b) => {
        if (doubleShiftsCount[a.id] !== doubleShiftsCount[b.id]) {
          return doubleShiftsCount[a.id] - doubleShiftsCount[b.id];
        }
        return workLoads[a.id] - workLoads[b.id];
      });

      doubleShiftControllers.forEach(c => {
        const pat = getOverriddenPattern(c, day);
        const shift1 = pat === 'M+T' ? 'M' : 'T';
        const shift2 = pat === 'M+T' ? 'T' : 'N';

        const slots1 = updatedSchedule[day][shift1] || {};
        const slots2 = updatedSchedule[day][shift2] || {};

        let assigned = false;

        for (const slotKey1 of shuffleArray(Object.keys(slots1))) {
          if (slotKey1.startsWith('ENT')) continue;
          if (slots1[slotKey1] !== null) continue;

          for (const slotKey2 of shuffleArray(Object.keys(slots2))) {
            if (slotKey2.startsWith('ENT')) continue;
            if (slots2[slotKey2] !== null) continue;

            slots1[slotKey1] = c.id;
            slots2[slotKey2] = c.id;

            const val1 = validateAssignment(c.id, day, shift1, slotKey1, updatedSchedule, controllers, exceptions);
            const val2 = validateAssignment(c.id, day, shift2, slotKey2, updatedSchedule, controllers, exceptions);

            if (val1.isValid && val2.isValid) {
              workLoads[c.id] += 2;
              assigned = true;
              break;
            } else {
              slots1[slotKey1] = null;
              slots2[slotKey2] = null;
            }
          }
          if (assigned) break;
        }
      });
    }

    // --- PASADA 2: Asignación de Jornadas Sencillas Estrictas (M, T, N, A) ---
    const singleShiftControllers = controllers.filter(c => {
      if (!c.active) return false;
      const pat = getOverriddenPattern(c, day);
      return pat === 'M' || pat === 'T' || pat === 'N' || pat === 'A';
    });

    singleShiftControllers.sort((a, b) => workLoads[a.id] - workLoads[b.id]);

    singleShiftControllers.forEach(c => {
      const targetShift = getOverriddenPattern(c, day);

      const slots = updatedSchedule[day][targetShift] || {};
      for (const slotKey of shuffleArray(Object.keys(slots))) {
        if (slotKey.startsWith('ENT')) continue;
        if (slots[slotKey] !== null) continue;

        slots[slotKey] = c.id;
        const val = validateAssignment(c.id, day, targetShift, slotKey, updatedSchedule, controllers, exceptions);
        if (val.isValid) {
          workLoads[c.id]++;
          break;
        } else {
          slots[slotKey] = null;
        }
      }
    });

    // --- PASADA 3: Cobertura con Patrón "Cualquiera" y Jornadas Suplementarias ---
    const cualquieraControllers = controllers.filter(c => {
      if (!c.active) return false;
      const pat = getOverriddenPattern(c, day);
      return pat === 'Cualquiera';
    });

    // Ordenar priorizando menor número de dobles turnos, luego menor carga general
    cualquieraControllers.sort((a, b) => {
      if (doubleShiftsCount[a.id] !== doubleShiftsCount[b.id]) {
        return doubleShiftsCount[a.id] - doubleShiftsCount[b.id];
      }
      return workLoads[a.id] - workLoads[b.id];
    });

    cualquieraControllers.forEach(c => {
      let assignedDouble = false;

      // Intentar turnos dobles únicamente si NO es un Domingo/Festivo
      if (!isSpecialDay) {
        // Intentar M+T
        const slotsM = updatedSchedule[day]['M'] || {};
        const slotsT = updatedSchedule[day]['T'] || {};
        
        for (const slotKeyM of shuffleArray(Object.keys(slotsM))) {
          if (slotKeyM.startsWith('ENT')) continue;
          if (slotsM[slotKeyM] !== null) continue;

          for (const slotKeyT of shuffleArray(Object.keys(slotsT))) {
            if (slotKeyT.startsWith('ENT')) continue;
            if (slotsT[slotKeyT] !== null) continue;

            slotsM[slotKeyM] = c.id;
            slotsT[slotKeyT] = c.id;

            const valM = validateAssignment(c.id, day, 'M', slotKeyM, updatedSchedule, controllers, exceptions);
            const valT = validateAssignment(c.id, day, 'T', slotKeyT, updatedSchedule, controllers, exceptions);

            if (valM.isValid && valT.isValid) {
              workLoads[c.id] += 2;
              assignedDouble = true;
              break;
            } else {
              slotsM[slotKeyM] = null;
              slotsT[slotKeyT] = null;
            }
          }
          if (assignedDouble) break;
        }

        if (!assignedDouble) {
          // Intentar T+N
          const slotsN = updatedSchedule[day]['N'] || {};
          for (const slotKeyT of shuffleArray(Object.keys(slotsT))) {
            if (slotKeyT.startsWith('ENT')) continue;
            if (slotsT[slotKeyT] !== null) continue;

            for (const slotKeyN of shuffleArray(Object.keys(slotsN))) {
              if (slotKeyN.startsWith('ENT')) continue;
              if (slotsN[slotKeyN] !== null) continue;

              slotsT[slotKeyT] = c.id;
              slotsN[slotKeyN] = c.id;

              const valT = validateAssignment(c.id, day, 'T', slotKeyT, updatedSchedule, controllers, exceptions);
              const valN = validateAssignment(c.id, day, 'N', slotKeyN, updatedSchedule, controllers, exceptions);

              if (valT.isValid && valN.isValid) {
                workLoads[c.id] += 2;
                assignedDouble = true;
                break;
              } else {
                slotsT[slotKeyT] = null;
                slotsN[slotKeyN] = null;
              }
            }
            if (assignedDouble) break;
          }
        }
      }

      // Si no se le pudo asignar o no está permitido un doble turno, intentar asignarle un turno sencillo
      if (!assignedDouble) {
        let assignedSingle = false;
        const shiftsOrdered = ['M', 'T', 'N', 'A'].sort((sA, sB) => {
          const vacantA = Object.keys(updatedSchedule[day][sA]).filter(k => !k.startsWith('ENT') && updatedSchedule[day][sA][k] === null).length;
          const vacantB = Object.keys(updatedSchedule[day][sB]).filter(k => !k.startsWith('ENT') && updatedSchedule[day][sB][k] === null).length;
          return vacantB - vacantA;
        });

        for (const shift of shiftsOrdered) {
          const slots = updatedSchedule[day][shift] || {};
          for (const slotKey of shuffleArray(Object.keys(slots))) {
            if (slotKey.startsWith('ENT')) continue;
            if (slots[slotKey] !== null) continue;

            slots[slotKey] = c.id;
            const val = validateAssignment(c.id, day, shift, slotKey, updatedSchedule, controllers, exceptions);
            if (val.isValid) {
              workLoads[c.id]++;
              assignedSingle = true;
              break;
            } else {
              slots[slotKey] = null;
            }
          }
          if (assignedSingle) break;
        }
      }
    });

    // --- PASADA 4: Soporte y Fallback de Cobertura General ---
    for (const shift of SHIFTS) {
      const slots = updatedSchedule[day][shift] || {};
      for (const slotKey of shuffleArray(Object.keys(slots))) {
        if (slotKey.startsWith('ENT')) continue;
        if (slots[slotKey] !== null) continue;

        const position = slotKey.split('-')[0];
        const candidates = controllers.filter(c => {
          if (!c.active) return false;
          if (!c.skills || !c.skills.includes(position)) return false;
          slots[slotKey] = c.id;
          const val = validateAssignment(c.id, day, shift, slotKey, updatedSchedule, controllers, exceptions);
          slots[slotKey] = null;
          return val.isValid;
        });

        candidates.sort((a, b) => workLoads[a.id] - workLoads[b.id]);

        if (candidates.length > 0) {
          const chosen = candidates[0];
          slots[slotKey] = chosen.id;
          workLoads[chosen.id]++;
        }
      }
    }

    // --- PASADA 5: Asignación de Alumnos y Entrenamiento (ENT) ---
    for (const shift of SHIFTS) {
      const slots = updatedSchedule[day][shift] || {};
      const entSlotKeys = Object.keys(slots).filter(k => k.startsWith('ENT'));

      for (const slotKey of entSlotKeys) {
        if (slots[slotKey] !== null) continue;

        const candidates = controllers.filter(c => {
          if (!c.active) return false;
          slots[slotKey] = c.id;
          const val = validateAssignment(c.id, day, shift, slotKey, updatedSchedule, controllers, exceptions);
          slots[slotKey] = null;
          return val.isValid;
        });

        candidates.sort((a, b) => {
          if (a.trainingPreferred && !b.trainingPreferred) return -1;
          if (!a.trainingPreferred && b.trainingPreferred) return 1;
          return workLoads[a.id] - workLoads[b.id];
        });

        if (candidates.length > 0) {
          const chosen = candidates[0];
          slots[slotKey] = chosen.id;
          workLoads[chosen.id]++;
        }
      }
      
      // Ajustar slots de entrenamiento después de la pasada de asignación
      updatedSchedule[day][shift] = adjustDynamicSlots(updatedSchedule[day][shift], 'ENT', shift);
    }

    // --- POST-BARAJADO DIARIO DE SUB-POSICIONES (ALEATORIZACIÓN) ---
    SHIFTS.forEach(shift => {
      const slots = updatedSchedule[day][shift] || {};
      const positionGroups = {};
      Object.keys(slots).forEach(slotKey => {
        const pos = slotKey.split('-')[0];
        if (['TWR', 'GND', 'DEL', 'FIC'].includes(pos)) {
          if (!positionGroups[pos]) positionGroups[pos] = [];
          positionGroups[pos].push(slotKey);
        }
      });

      Object.keys(positionGroups).forEach(pos => {
        const keys = positionGroups[pos];
        const currentAssignments = keys.map(k => slots[k]);
        const shuffledAssignments = shuffleArray(currentAssignments);
        keys.forEach((k, idx) => {
          slots[k] = shuffledAssignments[idx];
        });
      });
    });

    // --- EVALUAR JORNADAS SUPLEMENTARIAS REALIZADAS HOY ---
    controllers.forEach(c => {
      let countOnDay = 0;
      SHIFTS.forEach(shift => {
        const slots = updatedSchedule[day][shift] || {};
        if (Object.values(slots).includes(c.id)) {
          countOnDay++;
        }
      });
      if (countOnDay >= 2) {
        doubleShiftsCount[c.id]++;
      }
    });
  }

  return updatedSchedule;
};
