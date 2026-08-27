import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase.js';

/**
 * Normaliza y compara dos referencias de controlador (por id, signature o nombre).
 */
export const isSameCtrl = (ctrlA, ctrlB) => {
  if (!ctrlA || !ctrlB) return false;
  const sigA = (typeof ctrlA === 'string' ? ctrlA : (ctrlA.signature || ctrlA.id || ctrlA.name || '')).toString().trim().toUpperCase();
  const sigB = (typeof ctrlB === 'string' ? ctrlB : (ctrlB.signature || ctrlB.id || ctrlB.name || '')).toString().trim().toUpperCase();
  if (sigA && sigB && sigA === sigB) return true;
  const idA = (typeof ctrlA === 'object' ? (ctrlA.id || ctrlA.signature) : ctrlA).toString().trim().toUpperCase();
  const idB = (typeof ctrlB === 'object' ? (ctrlB.id || ctrlB.signature) : ctrlB).toString().trim().toUpperCase();
  return idA && idB && idA === idB;
};

/**
 * Obtiene la sigla operacional de una posición de turno.
 */
export const getSlotAcronym = (slotKey, shift) => {
  if (!slotKey) return '';
  const pos = slotKey.split('-')[0];
  if (pos === 'ACC') return `${shift || ''}ACC`;
  if (pos === 'CAE') return `${shift || 'M'}CAE`;
  if (pos === 'OFI') return `${shift || 'M'}OFI`;
  if (pos === 'CHC' || pos === 'CHEC') return `${shift || ''}CHC`;
  if (pos === 'SIM') return `${shift || ''}SIM`;
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
    case 'FIC-2': return 'FPR';
    case 'FIC-3': return 'FPA';
    case 'CTE-1': return 'CTE';
    case 'ENT-1': return 'ENT';
    case 'INS-1': return 'INS';
    default: return slotKey.split('-')[0];
  }
};

/**
 * Obtiene la descripción detallada de una posición.
 */
export const getSlotDescription = (slotKey) => {
  if (!slotKey) return '';
  if (slotKey.startsWith('ENT-')) return 'Entrenamiento Alumno';
  if (slotKey.startsWith('INS-')) return 'Instrucción Operativa';
  const pos = slotKey.split('-')[0];
  if (pos === 'CAE') return 'Capacitación Especial';
  if (pos === 'OFI') return 'Turno de Oficina / Administrativo';
  if (pos === 'CHC' || pos === 'CHEC') return 'Chequeo / Evaluación';
  if (pos === 'SIM') return 'Simulador / Pseudopiloto';
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
    case 'FIC-2': return 'FIC Reserva';
    case 'FIC-3': return 'FIC Apoyo';
    case 'CTE-1': return 'Encargado de Turno';
    default: return slotKey;
  }
};

/**
 * Recolecta TODOS los turnos y excepciones asignados a un controlador a lo largo de TODOS los meses disponibles
 * (incluyendo mes anterior, mes actual, Septiembre y futuros).
 */
export const getAllShiftsForController = (controller, schedule = {}, exceptions = {}) => {
  if (!controller) return {};

  const ctrlId = (controller.id || '').toString().trim().toUpperCase();
  const ctrlSig = (controller.signature || '').toString().trim().toUpperCase();
  const ctrlName = (controller.name || '').toString().trim().toUpperCase();

  const isMatched = (assigned) => {
    if (!assigned) return false;
    const a = assigned.toString().trim().toUpperCase();
    return a === ctrlId || a === ctrlSig || a === ctrlName || isSameCtrl(assigned, controller);
  };

  // 1. Recopilar todas las fechas únicas disponibles
  const dateSet = new Set();

  // Fechas en el cuadrante general
  Object.keys(schedule || {}).forEach(dateStr => {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dateSet.add(dateStr);
    }
  });

  // Fechas en las excepciones de este controlador
  const ctrlExceptions = {
    ...(exceptions?.[controller.id] || {}),
    ...(exceptions?.[controller.signature] || {}),
    ...(ctrlId ? exceptions?.[ctrlId] : {}),
    ...(ctrlSig ? exceptions?.[ctrlSig] : {})
  };

  Object.keys(ctrlExceptions).forEach(dateStr => {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dateSet.add(dateStr);
    }
  });

  // Rango continuo asegurado: desde 1 mes atrás hasta 3 meses hacia adelante
  const today = new Date();
  const startRange = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endRange = new Date(today.getFullYear(), today.getMonth() + 4, 0);

  for (let d = new Date(startRange); d <= endRange; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateSet.add(`${y}-${m}-${day}`);
  }

  const sortedDates = Array.from(dateSet).sort();
  const fullMap = {};
  const SHIFTS = ['A', 'M', 'T', 'N'];

  sortedDates.forEach(dateStr => {
    fullMap[dateStr] = [];

    // Excepciones (Descansos, Licencias, Vacaciones, etc.)
    const exc = ctrlExceptions[dateStr];
    if (exc && exc !== 'OPERATIVO') {
      fullMap[dateStr].push({ type: 'EXCEPTION', status: exc });
    }

    // Turnos de Cuadrante
    const daySched = schedule?.[dateStr];
    if (daySched) {
      SHIFTS.forEach(shift => {
        const slots = daySched[shift] || {};
        Object.keys(slots).forEach(slotKey => {
          if (isMatched(slots[slotKey])) {
            fullMap[dateStr].push({
              type: 'SHIFT',
              shift,
              slotKey,
              acronym: getSlotAcronym(slotKey, shift),
              description: getSlotDescription(slotKey)
            });
          }
        });
      });
    }
  });

  return fullMap;
};

/**
 * Obtiene los turnos mensuales de un controlador para un mes específico (mantiene compatibilidad).
 */
export const getMonthlyShiftsForController = (controller, year, month, schedule = {}, exceptions = {}) => {
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const monthlyMap = {};
  const count = getDaysInMonth(year, month);
  const monthStr = String(month + 1).padStart(2, '0');

  const ctrlId = (controller.id || '').toString().trim().toUpperCase();
  const ctrlSig = (controller.signature || '').toString().trim().toUpperCase();
  const isMatched = (assigned) => {
    if (!assigned) return false;
    const a = assigned.toString().trim().toUpperCase();
    return a === ctrlId || a === ctrlSig || isSameCtrl(assigned, controller);
  };

  const ctrlExceptions = {
    ...(exceptions?.[controller.id] || {}),
    ...(exceptions?.[controller.signature] || {}),
    ...(ctrlId ? exceptions?.[ctrlId] : {}),
    ...(ctrlSig ? exceptions?.[ctrlSig] : {})
  };

  for (let i = 1; i <= count; i++) {
    const dayStr = String(i).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    monthlyMap[dateStr] = [];

    const exc = ctrlExceptions[dateStr];
    if (exc && exc !== 'OPERATIVO') {
      monthlyMap[dateStr].push({ type: 'EXCEPTION', status: exc });
    }

    const daySched = schedule[dateStr];
    if (daySched) {
      const SHIFTS = ['A', 'M', 'T', 'N'];
      SHIFTS.forEach(shift => {
        const slots = daySched[shift] || {};
        Object.keys(slots).forEach(slotKey => {
          if (isMatched(slots[slotKey])) {
            monthlyMap[dateStr].push({ 
              type: 'SHIFT', 
              shift, 
              slotKey,
              acronym: getSlotAcronym(slotKey, shift),
              description: getSlotDescription(slotKey)
            });
          }
        });
      });
    }
  }

  return monthlyMap;
};

/**
 * Convierte un mapa de turnos y excepciones de un controlador a formato iCalendar (.ics).
 * Soporta invocación directa con mapa multi-mes o la firma legacy (controller, year, month, shiftsMap, options).
 */
export const generateICS = (controller, ...args) => {
  let shiftsMap = {};
  let options = {};

  if (args.length >= 3 && typeof args[0] === 'number') {
    // Firma legacy: (controller, year, month, myMonthlyShifts, options)
    shiftsMap = args[2] || {};
    options = args[3] || {};
  } else if (args.length >= 1) {
    // Firma multi-mes directa: (controller, shiftsMap, options)
    shiftsMap = args[0] || {};
    options = args[1] || {};
  }

  const { includeOps = true, includeExceptions = true } = options;
  const ctrlDisplayName = controller?.name || controller?.signature || 'Controlador ATC';
  const ctrlIdOrSig = controller?.id || controller?.signature || 'atc';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AirControl//SKBO//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Horario AirControl - ${ctrlDisplayName}`,
    'X-WR-CALDESC:Programación de turnos y descansos operacionales ATC SKBO',
    'X-WR-TIMEZONE:America/Bogota',
    'X-PUBLISHED-TTL:PT15M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'BEGIN:VTIMEZONE',
    'TZID:America/Bogota',
    'X-LIC-LOCATION:America/Bogota',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0500',
    'TZNAME:-05',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  const formatDateStr = (dateStr) => dateStr.replace(/-/g, '');

  const getNextDayFormatStr = (dateStr) => {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const getShiftTimes = (shift, dateStr) => {
    const dStr = formatDateStr(dateStr);
    switch (shift) {
      case 'A': // Amanecida: 00:00 - 06:00
        return { start: `${dStr}T000000`, end: `${dStr}T060000` };
      case 'M': // Mañana: 06:00 - 12:00
        return { start: `${dStr}T060000`, end: `${dStr}T120000` };
      case 'T': // Tarde: 12:00 - 18:00
        return { start: `${dStr}T120000`, end: `${dStr}T180000` };
      case 'N': // Noche: 18:00 - 00:00 del día siguiente
        const nextDStr = getNextDayFormatStr(dateStr);
        return { start: `${dStr}T180000`, end: `${nextDStr}T000000` };
      default:
        return { start: `${dStr}T080000`, end: `${dStr}T140000` };
    }
  };

  const escapeText = (str) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\n/g, '\\n');
  };

  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Iterar todos los días del mapa de turnos (multi-mes)
  const sortedDates = Object.keys(shiftsMap).sort();

  sortedDates.forEach(dateStr => {
    const items = shiftsMap[dateStr] || [];
    
    items.forEach((item, index) => {
      if (item.type === 'SHIFT' && includeOps) {
        const { start, end } = getShiftTimes(item.shift, dateStr);
        const shiftLabel = 
          item.shift === 'A' ? 'Amanecida' :
          item.shift === 'M' ? 'Mañana' :
          item.shift === 'T' ? 'Tarde' : 'Noche';
        
        const uid = `shift-${ctrlIdOrSig}-${dateStr}-${item.shift}-${item.slotKey || index}@aircontrol.skbo`;

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:${uid}`);
        icsLines.push(`DTSTAMP:${nowStr}`);
        icsLines.push(`DTSTART;TZID=America/Bogota:${start}`);
        icsLines.push(`DTEND;TZID=America/Bogota:${end}`);
        icsLines.push(`SUMMARY:Turno ${shiftLabel} - ${item.acronym}`);
        icsLines.push(`DESCRIPTION:Posición: ${escapeText(item.description)}\\nSigla: ${item.acronym}\\nJornada: ${shiftLabel} (${item.shift})\\nTorre de Control SKBO`);
        icsLines.push('LOCATION:Torre de Control Eldorado SKBO');
        icsLines.push('STATUS:CONFIRMED');
        icsLines.push('SEQUENCE:1');
        icsLines.push('END:VEVENT');
      } 
      else if (item.type === 'EXCEPTION' && includeExceptions) {
        const dStr = formatDateStr(dateStr);
        const nextDStr = getNextDayFormatStr(dateStr);
        const uid = `exc-${ctrlIdOrSig}-${dateStr}-${index}@aircontrol.skbo`;
        const summaryText = item.status === 'DESCANSO' ? '🏖️ Descanso Reglamentario' : `📋 Estado: ${escapeText(item.status)}`;
        
        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:${uid}`);
        icsLines.push(`DTSTAMP:${nowStr}`);
        icsLines.push(`DTSTART;VALUE=DATE:${dStr}`);
        icsLines.push(`DTEND;VALUE=DATE:${nextDStr}`);
        icsLines.push(`SUMMARY:${summaryText}`);
        icsLines.push(`DESCRIPTION:Novedad / Estado de personal: ${escapeText(item.status)}`);
        icsLines.push('STATUS:CONFIRMED');
        icsLines.push('SEQUENCE:1');
        icsLines.push('END:VEVENT');
      }
    });
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
};

/**
 * Sube el archivo ICS de un controlador a Firebase Storage con cabeceras de no-cache.
 */
export const uploadCalendarToStorage = async (controllerId, icsContent) => {
  const fileKey = controllerId || 'general';
  const storageRef = ref(storage, `calendars/${fileKey}.ics`);
  await uploadString(storageRef, icsContent, 'raw', {
    contentType: 'text/calendar;charset=utf-8',
    customMetadata: {
      'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate'
    }
  });
  return await getDownloadURL(storageRef);
};

/**
 * Dispara la regeneración y subida del archivo ICS si el controlador tiene sincronización activa.
 * Soporta firmas flexibles y procesa automáticamente todos los meses activos.
 */
export const triggerCalendarSyncIfEnabled = async (controllerId, controllers, ...args) => {
  let schedule = {};
  let exceptions = {};

  if (args.length >= 4) {
    // Legacy: (controllerId, controllers, year, month, schedule, exceptions)
    schedule = args[2] || {};
    exceptions = args[3] || {};
  } else if (args.length >= 2) {
    // Direct: (controllerId, controllers, schedule, exceptions)
    schedule = args[0] || {};
    exceptions = args[1] || {};
  } else if (args.length === 1 && typeof args[0] === 'object') {
    schedule = args[0].schedule || {};
    exceptions = args[0].exceptions || {};
  }

  const ctrl = controllers.find(c => isSameCtrl(c, controllerId));
  if (ctrl && ctrl.calendarSyncEnabled) {
    console.log(`Sincronización de calendario multi-mes activa para ${ctrl.name}...`);
    try {
      const allShifts = getAllShiftsForController(ctrl, schedule, exceptions);
      const ics = generateICS(ctrl, allShifts);
      const url = await uploadCalendarToStorage(ctrl.id || ctrl.signature, ics);
      console.log(`Calendario multi-mes actualizado exitosamente en la nube para ${ctrl.name}.`);
      return url;
    } catch (e) {
      console.error(`Error en sincronización automática de calendario para ${ctrl.name}:`, e);
    }
  }
};

/**
 * Sincroniza en lote los calendarios de todos los controladores que tengan la sincronización habilitada.
 */
export const syncAllEnabledCalendars = async (controllers = [], schedule = {}, exceptions = {}) => {
  if (!controllers || controllers.length === 0) return [];
  const syncPromises = controllers
    .filter(c => c.calendarSyncEnabled)
    .map(c => triggerCalendarSyncIfEnabled(c.id, controllers, schedule, exceptions));
  return await Promise.allSettled(syncPromises);
};
