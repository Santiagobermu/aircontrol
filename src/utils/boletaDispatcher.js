import { generateBoletaPdf } from './boletaGenerator.js';
import { isSameCtrl } from './schedulerEngine.js';

export const POWER_AUTOMATE_WEBHOOK_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_POWER_AUTOMATE_WEBHOOK_URL) ||
  'https://default292755c0f07b4b91bb6e87338209cc.96.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/17/workflows/bfdcdc2db61048c5b2fba96e1716f22a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=VukOWdXIbERgCE-nmK5tpVQzc0bco6OR2GVoE96NU8o';

const OFFICIAL_TOWER_EMAIL = 'torreeldorado@aerocivil.gov.co';

/**
 * Convierte un Uint8Array (bytes de PDF) a Base64 eficientemente en navegador
 */
export function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Recopila y deduplica correos electrónicos institucionales de los interesados
 */
export function resolveRecipients(ctrlA, ctrlB, supervisor) {
  const emailSet = new Set();

  const addEmail = (email) => {
    if (!email) return;
    const clean = String(email).trim().toLowerCase();
    if (clean.includes('@')) {
      emailSet.add(clean);
    }
  };

  // 1. Solicitante
  addEmail(ctrlA?.institutionalEmail || ctrlA?.email);

  // 2. Receptor
  addEmail(ctrlB?.institutionalEmail || ctrlB?.email);

  // 3. Supervisor / Encargado de turno
  addEmail(supervisor?.institutionalEmail || supervisor?.email);

  // 4. Correo oficial de Torre de Control El Dorado
  addEmail(OFFICIAL_TOWER_EMAIL);

  return Array.from(emailSet);
}

/**
 * Construye una descripción sintética y clara del cambio para el cuerpo del correo
 */
export function buildShiftDetails(trade, ctrlA, ctrlB) {
  if (!trade) return '';
  const isSwap = trade.type === 'SWAP';
  const nameA = ctrlA?.fullName || ctrlA?.name || trade.fromControllerId || 'Controlador A';
  const nameB = ctrlB?.fullName || ctrlB?.name || trade.toControllerId || 'Controlador B';
  const dateStr = trade.date || 'Fecha por definir';

  const slotStrA = trade.fromSlot ? `${trade.fromSlot.shift || ''} (${trade.fromSlot.slotKey || ''})` : 'Turno asignado';

  if (isSwap) {
    const returnDate = trade.returnDate || trade.date;
    const slotStrB = trade.toSlot ? `${trade.toSlot.shift || ''} (${trade.toSlot.slotKey || ''})` : 'Turno acordado';
    return `Cambio de Secuencia (SWAP): ${nameA} cede ${slotStrA} el día ${dateStr} a ${nameB}, y a su vez ${nameB} devuelve ${slotStrB} el día ${returnDate} a ${nameA}.`;
  }

  return `Hechura de Turno (COVER): ${nameB} asume el turno ${slotStrA} programado el día ${dateStr} para ${nameA}.`;
}

/**
 * Despacha la boleta PDF diligenciada y firmada hacia el Webhook de Microsoft Power Automate
 * para su archivo automático en SharePoint y distribución por correo electrónico.
 *
 * @param {Object} params
 * @param {Object} params.trade - Objeto de solicitud de cambio
 * @param {Array} params.controllers - Lista de controladores
 * @param {Object} [params.supervisor] - Supervisor que dio la aprobación
 * @param {Uint8Array} [params.pdfBytes] - Bytes del PDF ya generado (opcional, si no está se genera)
 * @param {string} [params.fileName] - Nombre del archivo PDF
 * @returns {Promise<{ success: boolean, message: string, recipients: string[], dispatchedAt: string }>}
 */
export async function dispatchBoletaToPowerAutomate({
  trade,
  controllers = [],
  supervisor = null,
  pdfBytes = null,
  fileName = null
}) {
  if (!trade) {
    throw new Error('No se especificó la solicitud de cambio a despachar.');
  }

  // 1. Resolver información de participantes
  const ctrlA = controllers.find(c => isSameCtrl(c, trade.fromControllerId, controllers)) || {
    id: trade.fromControllerId,
    name: trade.fromControllerId
  };

  const ctrlB = controllers.find(c => isSameCtrl(c, trade.toControllerId, controllers)) || {
    id: trade.toControllerId,
    name: trade.toControllerId
  };

  // Resolver supervisor
  let supervisorCtrl = null;
  const supIdentifier = trade.supervisorId || trade.approvedById || trade.approvedBy;
  if (supIdentifier) {
    supervisorCtrl = controllers.find(c => isSameCtrl(c, supIdentifier, controllers));
  }
  if (!supervisorCtrl && supervisor) {
    supervisorCtrl = controllers.find(c => isSameCtrl(c, supervisor, controllers)) || supervisor;
  }

  // 2. Asegurar que tengamos el documento PDF compilado
  let finalPdfBytes = pdfBytes;
  let finalFileName = fileName;

  if (!finalPdfBytes) {
    const pdfResult = await generateBoletaPdf({
      trade,
      controllers,
      supervisor: supervisorCtrl
    });
    finalPdfBytes = pdfResult.pdfBytes;
    finalFileName = pdfResult.fileName;
  }

  if (!finalPdfBytes || finalPdfBytes.length === 0) {
    throw new Error('No fue posible compilar los bytes de la boleta PDF.');
  }

  // 3. Convertir archivo a Base64
  const pdfBase64 = uint8ArrayToBase64(finalPdfBytes);

  // 4. Preparar lista de destinatarios
  const recipientsList = resolveRecipients(ctrlA, ctrlB, supervisorCtrl);
  const recipientsString = recipientsList.join(';');

  const requesterName = ctrlA.fullName || ctrlA.name || trade.fromControllerId;
  const receptorName = ctrlB.fullName || ctrlB.name || trade.toControllerId;
  const supervisorName = trade.supervisorName || trade.approvedBy || supervisorCtrl?.fullName || supervisorCtrl?.name || 'Encargado de Turno';
  const shiftDetails = buildShiftDetails(trade, ctrlA, ctrlB);

  // 5. Estructurar carga útil JSON (Payload para Power Automate)
  const payload = {
    tradeId: trade.id || `trade-${Date.now()}`,
    fileName: finalFileName || `Boleta_${trade.type || 'CAMBIO'}_${ctrlA.name || 'A'}_${ctrlB.name || 'B'}_${trade.date || 'fecha'}.pdf`,
    pdfBase64,
    tradeType: trade.type === 'SWAP' ? 'SWAP (C.SEC)' : 'COVER (H.TURNO)',
    date: trade.date || new Date().toISOString().slice(0, 10),
    recipients: recipientsString,
    requesterName,
    receptorName,
    supervisorName,
    shiftDetails
  };

  // 6. Enviar petición HTTP POST al Webhook
  const response = await fetch(POWER_AUTOMATE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Error del Webhook de Power Automate (HTTP ${response.status}): ${errorText || response.statusText}`);
  }

  const dispatchedAt = new Date().toISOString();

  return {
    success: true,
    message: `Boleta despachada exitosamente a ${recipientsList.length} destinatarios y archivada en SharePoint.`,
    recipients: recipientsList,
    dispatchedAt
  };
}
