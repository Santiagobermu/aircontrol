/**
 * notamUtils.js - Utilidades para manejo, parseo y validación de NOTAMs
 * Proyecto AirControl - SKBO El Dorado
 */

/**
 * Parsea una cadena de fecha aeronáutica a un objeto Date (UTC).
 * Soporta:
 * - ISO string: '2026-08-01T03:00:00Z', '2026-08-01T03:00:00+00:00', '2026-08-01 03:00'
 * - Aerocivil 10 dígitos YYMMDDHHMM: '2608010300'
 * - Aerocivil 6 dígitos YYMMDD: '260801'
 * - FAA formato MM/DD/YYYY HHMM: '08/01/2026 0300'
 * - Retorna 'PERM' si es una fecha permanente / indefinida.
 * - Retorna null si no se puede parsear.
 */
export const parseNotamDate = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str || str === '/' || str.toUpperCase() === 'UFN') return null;
  if (str.toUpperCase().includes('PERM')) return 'PERM';

  // Eliminar sufijo EST si existe (ej. "2608311200 EST")
  const cleanStr = str.replace(/\s+EST$/i, '').trim();

  // 1. Formato ISO / Estándar YYYY-MM-DD
  if (cleanStr.includes('-') || cleanStr.includes('T')) {
    // Si viene en formato 'YYYY-MM-DD HH:MM'
    const normalized = cleanStr.includes('T') ? cleanStr : cleanStr.replace(' ', 'T') + (cleanStr.length === 10 ? 'T00:00:00Z' : (cleanStr.includes(':') && !cleanStr.endsWith('Z') && !cleanStr.includes('+') ? 'Z' : ''));
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
    
    // Intento directo con new Date
    const dFallback = new Date(cleanStr);
    if (!isNaN(dFallback.getTime())) return dFallback;
  }

  // 2. Formato FAA MM/DD/YYYY HHMM o MM/DD/YYYY
  const faaMatch = cleanStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})(\d{2}))?/);
  if (faaMatch) {
    const [, mm, dd, yyyy, hh = '00', min = '00'] = faaMatch;
    const d = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), parseInt(hh, 10), parseInt(min, 10)));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Formato Aerocivil 10 dígitos YYMMDDHHMM (ej. 2608010300 -> 01/Ago/2026 03:00 UTC)
  const aero10Match = cleanStr.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (aero10Match) {
    const [, yy, mm, dd, hh, min] = aero10Match;
    const yyyy = parseInt('20' + yy, 10);
    const d = new Date(Date.UTC(yyyy, parseInt(mm, 10) - 1, parseInt(dd, 10), parseInt(hh, 10), parseInt(min, 10)));
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Formato Aerocivil 6 dígitos YYMMDD (ej. 260801 -> 01/Ago/2026 00:00 UTC)
  const aero6Match = cleanStr.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (aero6Match) {
    const [, yy, mm, dd] = aero6Match;
    const yyyy = parseInt('20' + yy, 10);
    const d = new Date(Date.UTC(yyyy, parseInt(mm, 10) - 1, parseInt(dd, 10), 0, 0));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
};

/**
 * Extrae las fechas de inicio, fin y permanencia de un objeto NOTAM.
 */
export const extractNotamDates = (notam) => {
  if (!notam) return { startDate: null, endDate: null, isPerm: false, schedule: '' };

  let startDate = parseNotamDate(notam.start_date);
  let endDate = parseNotamDate(notam.end_date);
  let isPerm = notam.end_date === 'PERM' || endDate === 'PERM';

  // Si no se encontraron en start_date / end_date, intentar parsear dates_raw
  if ((!startDate || (!endDate && !isPerm)) && notam.dates_raw) {
    const raw = String(notam.dates_raw).trim();
    if (raw.toUpperCase().includes('PERM')) {
      isPerm = true;
    }
    const delimiter = raw.includes('/') ? '/' : raw.includes('-') ? '-' : null;
    if (delimiter) {
      const parts = raw.split(delimiter);
      if (parts[0] && !startDate) {
        startDate = parseNotamDate(parts[0].trim());
      }
      if (parts[1] && !endDate && !isPerm) {
        const endPart = parts[1].trim().split(/\s+/)[0];
        endDate = parseNotamDate(endPart);
        if (parts[1].toUpperCase().includes('PERM')) {
          isPerm = true;
        }
      }
    }
  }

  // Si aún falta, intentar buscar en description con patrones ICAO B) y C)
  if ((!startDate || (!endDate && !isPerm)) && notam.description) {
    const text = String(notam.description);
    const bMatch = text.match(/\bB\)\s*(\d{10}|\d{6}|\d{2}\/\d{2}\/\d{4}\s*\d{4})/i);
    if (bMatch && !startDate) {
      startDate = parseNotamDate(bMatch[1]);
    }
    const cMatch = text.match(/\bC\)\s*(\d{10}|\d{6}|PERM|EST|\d{2}\/\d{2}\/\d{4}\s*\d{4})/i);
    if (cMatch) {
      if (cMatch[1].toUpperCase().includes('PERM')) {
        isPerm = true;
      } else if (!endDate) {
        endDate = parseNotamDate(cMatch[1]);
      }
    }
  }

  const schedule = notam.schedule || '';

  return {
    startDate: startDate === 'PERM' ? null : startDate,
    endDate: isPerm ? 'PERM' : endDate,
    isPerm,
    schedule
  };
};

/**
 * Valida si un NOTAM está activo/vigente en una fecha de consulta dada.
 * @param {Object} notam - Objeto NOTAM.
 * @param {Date|string} queryDate - Fecha a consultar (objeto Date o string 'YYYY-MM-DD'). Por defecto es la fecha actual.
 * @returns {boolean} true si el NOTAM está vigente en esa fecha.
 */
export const isNotamActiveOnDate = (notam, queryDate = new Date()) => {
  if (!notam) return false;

  let targetDate;
  if (typeof queryDate === 'string') {
    const parts = queryDate.split('-');
    if (parts.length === 3) {
      targetDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    } else {
      targetDate = new Date(queryDate);
    }
  } else {
    targetDate = new Date(queryDate);
  }

  if (isNaN(targetDate.getTime())) {
    targetDate = new Date();
  }

  // Límites del día de consulta en UTC: de 00:00:00 a 23:59:59.999
  const queryDayStart = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const queryDayEnd = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    23, 59, 59, 999
  ));

  const { startDate, endDate, isPerm } = extractNotamDates(notam);

  // 1. Si no tiene ninguna fecha identificable, asumimos que no está expirado para no ocultar información crítica
  if (!startDate && !endDate && !isPerm) {
    return true;
  }

  // 2. Verificar que el NOTAM haya iniciado antes o durante el día de consulta
  // (es decir: startDate <= queryDayEnd)
  if (startDate && startDate > queryDayEnd) {
    return false; // Aún no entra en vigencia para la fecha de consulta
  }

  // 3. Verificar que el NOTAM no haya expirado antes del inicio del día de consulta
  // (es decir: endDate >= queryDayStart o es PERM)
  if (isPerm) {
    return true;
  }

  if (endDate && endDate < queryDayStart) {
    return false; // Ya expiró antes de la fecha de consulta
  }

  return true;
};

/**
 * Filtra una lista de NOTAMs para devolver únicamente los vigentes en la fecha de consulta.
 */
export const filterNotamsByDate = (notamsList, queryDate = new Date()) => {
  if (!Array.isArray(notamsList)) return [];
  return notamsList.filter(notam => isNotamActiveOnDate(notam, queryDate));
};

/**
 * Categoriza un NOTAM para SKBO u otros aeropuertos de manera consistente.
 */
export const categorizeNotam = (n) => {
  if (!n) return 'MISC';
  if (n.category && ['RWY', 'TXY', 'TWY', 'SID_STAR_APP', 'SID/STAR/APP', 'NAV_AIDS', 'LVP', 'FLOW', 'AD_CLSD', 'ASHTAM', 'MISC'].includes(n.category)) {
    if (n.category === 'TWY') return 'TXY';
    if (n.category === 'SID/STAR/APP') return 'SID_STAR_APP';
    return n.category;
  }
  const desc = (n.description || n.text || n.raw_text || n.summary || '').toUpperCase();
  if (desc.includes('ASHTAM') || desc.includes('VOLCAN') || desc.includes('CENIZA')) return 'ASHTAM';
  if (desc.includes('RWY') || desc.includes('RUNWAY') || desc.includes('PISTA')) return 'RWY';
  if (desc.includes('TWY') || desc.includes('TXY') || desc.includes('TAXIWAY') || desc.includes('RODAJE')) return 'TXY';
  if (desc.includes('SID') || desc.includes('STAR') || desc.includes('APP') || desc.includes('PROC') || desc.includes('APPROACH') || desc.includes('SALIDA') || desc.includes('LLEGADA')) return 'SID_STAR_APP';
  if (desc.includes('ILS') || desc.includes('ALS') || desc.includes('VOR') || desc.includes('DME') || desc.includes('GP') || desc.includes('LLZ') || desc.includes('ATIS') || desc.includes('NDB') || desc.includes('FREQ') || desc.includes('FRECUENCIA')) return 'NAV_AIDS';
  if (desc.includes('LVP') || desc.includes('LOW VISIBILITY') || desc.includes('VISIBILIDAD')) return 'LVP';
  if (desc.includes('FLOW') || desc.includes('FLUJO') || desc.includes('ATFM') || desc.includes('EDCT')) return 'FLOW';
  if (desc.includes('CLSD') || desc.includes('CLOSED') || desc.includes('CERRADO')) return 'AD_CLSD';
  return 'MISC';
};

/**
 * Formatea una fecha UTC corta para visualización.
 */
const formatShortUtcDate = (dateObj) => {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  const mon = months[dateObj.getUTCMonth()];
  const yyyy = dateObj.getUTCFullYear();
  const hh = String(dateObj.getUTCHours()).padStart(2, '0');
  const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mon}/${yyyy} ${hh}:${mm} UTC`;
};

/**
 * Formatea el rango de vigencia de un NOTAM de forma legible.
 */
export const formatNotamDateRange = (notam) => {
  const { startDate, endDate, isPerm } = extractNotamDates(notam);
  
  const startStr = startDate ? formatShortUtcDate(startDate) : (notam.start_date || 'N/D');
  if (isPerm) {
    return `${startStr} → PERMANENTE (PERM)`;
  }
  const endStr = endDate ? formatShortUtcDate(endDate) : (notam.end_date || 'PERM');
  return `${startStr} → ${endStr}`;
};

/**
 * Devuelve la cadena 'YYYY-MM-DD' para una fecha dada (en UTC o local).
 */
export const getUtcDateString = (dateObj = new Date()) => {
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
