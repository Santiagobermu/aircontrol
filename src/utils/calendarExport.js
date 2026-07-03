import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Convierte un mapa de turnos y excepciones de un controlador a formato iCalendar (.ics).
 */
export const generateICS = (controller, year, month, myMonthlyShifts, options = {}) => {
  const { includeOps = true, includeExceptions = true } = options;
  
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AirControl//SKBO//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Horario AirControl - ' + controller.name,
    'X-WR-TIMEZONE:America/Bogota'
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
      case 'A': // Madrugada: 00:00 - 06:00
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

  // Iterar los días del mes
  Object.keys(myMonthlyShifts).forEach(dateStr => {
    const items = myMonthlyShifts[dateStr] || [];
    
    items.forEach((item, index) => {
      const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const uid = `event-${controller.id}-${dateStr}-${item.type}-${index}@aircontrol.skbo`;
      
      if (item.type === 'SHIFT' && includeOps) {
        const { start, end } = getShiftTimes(item.shift, dateStr);
        const shiftLabel = 
          item.shift === 'A' ? 'Madrugada' :
          item.shift === 'M' ? 'Mañana' :
          item.shift === 'T' ? 'Tarde' : 'Noche';
        
        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:${uid}`);
        icsLines.push(`DTSTAMP:${nowStr}`);
        icsLines.push(`DTSTART;TZID=America/Bogota:${start}`);
        icsLines.push(`DTEND;TZID=America/Bogota:${end}`);
        icsLines.push(`SUMMARY:Turno ${shiftLabel} - ${item.acronym}`);
        icsLines.push(`DESCRIPTION:Posición: ${escapeText(item.description)}\\nSigla: ${item.acronym}\\nJornada: ${shiftLabel}`);
        icsLines.push('LOCATION:Torre de Control Eldorado SKBO');
        icsLines.push('STATUS:CONFIRMED');
        icsLines.push('END:VEVENT');
      } 
      else if (item.type === 'EXCEPTION' && includeExceptions) {
        const dStr = formatDateStr(dateStr);
        const nextDStr = getNextDayFormatStr(dateStr);
        
        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:${uid}`);
        icsLines.push(`DTSTAMP:${nowStr}`);
        icsLines.push(`DTSTART;VALUE=DATE:${dStr}`);
        icsLines.push(`DTEND;VALUE=DATE:${nextDStr}`);
        icsLines.push(`SUMMARY:Estado - ${escapeText(item.status)}`);
        icsLines.push(`DESCRIPTION:Estado de asistencia especial: ${escapeText(item.status)}`);
        icsLines.push('STATUS:CONFIRMED');
        icsLines.push('END:VEVENT');
      }
    });
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
};

/**
 * Sube el archivo ICS de un controlador a Firebase Storage y retorna su URL de descarga.
 */
export const uploadCalendarToStorage = async (controllerId, icsContent) => {
  const storageRef = ref(storage, `calendars/${controllerId}.ics`);
  await uploadString(storageRef, icsContent, 'raw', {
    contentType: 'text/calendar;charset=utf-8'
  });
  return await getDownloadURL(storageRef);
};

/**
 * Obtiene los turnos mensuales de un controlador de forma independiente.
 */
export const getMonthlyShiftsForController = (controller, year, month, schedule, exceptions) => {
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  
  const getSlotAcronym = (slotKey, shift) => {
    if (!slotKey) return '';
    const pos = slotKey.split('-')[0];
    if (pos === 'ACC') return `${shift || ''}ACC`;
    if (pos === 'CAE') return 'MCAE';
    if (pos === 'CHEC') return `${shift || ''}CHEC`;
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
      default: return slotKey.split('-')[0];
    }
  };

  const getSlotDescription = (slotKey) => {
    if (!slotKey) return '';
    if (slotKey.startsWith('ENT-')) return 'Entrenamiento Alumno';
    if (slotKey.startsWith('INS-')) return 'Instrucción';
    const pos = slotKey.split('-')[0];
    if (pos === 'CAE') return 'Capacitación Especial';
    if (pos === 'CHEC') return 'Chequeo';
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
      default: return slotKey;
    }
  };

  const monthlyMap = {};
  const count = getDaysInMonth(year, month);
  const monthStr = String(month + 1).padStart(2, '0');

  for (let i = 1; i <= count; i++) {
    const dayStr = String(i).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    monthlyMap[dateStr] = [];

    const exc = exceptions[controller.id]?.[dateStr];
    if (exc && exc !== 'OPERATIVO') {
      monthlyMap[dateStr].push({ type: 'EXCEPTION', status: exc });
    }

    const daySched = schedule[dateStr];
    if (daySched) {
      const SHIFTS = ['A', 'M', 'T', 'N'];
      SHIFTS.forEach(shift => {
        const slots = daySched[shift] || {};
        Object.keys(slots).forEach(slotKey => {
          if (slots[slotKey] === controller.id) {
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
 * Dispara la regeneración y subida del archivo ICS si el controlador tiene sincronización activa.
 */
export const triggerCalendarSyncIfEnabled = async (controllerId, controllers, year, month, schedule, exceptions) => {
  const ctrl = controllers.find(c => c.id === controllerId);
  if (ctrl && ctrl.calendarSyncEnabled) {
    console.log(`Sincronización de calendario activa para ${ctrl.name}...`);
    try {
      const monthlyMap = getMonthlyShiftsForController(ctrl, year, month, schedule, exceptions);
      const ics = generateICS(ctrl, year, month, monthlyMap);
      await uploadCalendarToStorage(ctrl.id, ics);
      console.log(`Calendario actualizado exitosamente en la nube para ${ctrl.name}.`);
    } catch (e) {
      console.error(`Error en sincronización automática de calendario para ${ctrl.name}:`, e);
    }
  }
};
