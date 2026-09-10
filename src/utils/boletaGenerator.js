import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getSlotAcronym, isSameCtrl } from './schedulerEngine';

/**
 * Escala y factores de calibración geométrica sobre la plantilla 'Boleta de cambio de turno.pdf'
 * Página: Letter (612 x 792 pt).
 * Mitad superior: Y in [407.5, 756] pt.
 */
const CALIBRATION = {
  scaleX: 0.42481,
  scaleY: 0.425,
  offsetX: 80,
  offsetY: 407.5,
  imgHeight: 820
};

const toPdfX = (px) => CALIBRATION.offsetX + px * CALIBRATION.scaleX;
const toPdfY = (py) => CALIBRATION.offsetY + (CALIBRATION.imgHeight - py) * CALIBRATION.scaleY;

/**
 * Convierte un DataURL o URL remota de firma a objeto de imagen incrustada en pdf-lib.
 */
async function embedSignatureImage(pdfDoc, sigUrlOrDataUrl) {
  if (!sigUrlOrDataUrl || typeof sigUrlOrDataUrl !== 'string') return null;
  try {
    if (sigUrlOrDataUrl.startsWith('data:image/png;base64,')) {
      const b64 = sigUrlOrDataUrl.replace('data:image/png;base64,', '');
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return await pdfDoc.embedPng(bytes);
    } else if (sigUrlOrDataUrl.startsWith('data:image/jpeg;base64,') || sigUrlOrDataUrl.startsWith('data:image/jpg;base64,')) {
      const b64 = sigUrlOrDataUrl.replace(/^data:image\/jpe?g;base64,/, '');
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return await pdfDoc.embedJpg(bytes);
    } else if (sigUrlOrDataUrl.startsWith('http://') || sigUrlOrDataUrl.startsWith('https://')) {
      const res = await fetch(sigUrlOrDataUrl);
      const arrayBuf = await res.arrayBuffer();
      try {
        return await pdfDoc.embedPng(arrayBuf);
      } catch {
        return await pdfDoc.embedJpg(arrayBuf);
      }
    }
  } catch (err) {
    console.warn('Error incrustando firma en PDF:', err);
  }
  return null;
}

/**
 * Dibuja una imagen ajustada proporcionalmente dentro de una caja rectangular.
 */
function drawImageContained(page, image, boxX, boxY, boxWidth, boxHeight) {
  if (!image) return;
  const imgDims = image.scale(1);
  const scale = Math.min(boxWidth / imgDims.width, boxHeight / imgDims.height);
  const w = imgDims.width * scale;
  const h = imgDims.height * scale;
  const x = boxX + (boxWidth - w) / 2;
  const y = boxY + (boxHeight - h) / 2;
  page.drawImage(image, { x, y, width: w, height: h });
}

/**
 * Centra un texto horizontalmente en una coordenada X central.
 */
function drawTextCentered(page, text, centerX, y, size, font, color = rgb(0, 0, 0)) {
  if (!text) return;
  const textStr = String(text).trim();
  if (!textStr) return;
  const width = font.widthOfTextAtSize(textStr, size);
  page.drawText(textStr, {
    x: centerX - width / 2,
    y: y,
    size,
    font,
    color
  });
}

/**
 * Formatea un turno usando la nomenclatura oficial del importador de Excel (ej. MLNT, TGNT, TDPT, MLPT, etc.)
 */
function formatShiftLabel(slotObj) {
  if (!slotObj) return '';
  if (typeof slotObj === 'string') {
    const trimmed = slotObj.trim().toUpperCase();
    if (trimmed.length === 4) return trimmed;
    const parts = trimmed.split(/[-|]/);
    if (parts.length >= 2) {
      const shiftCandidate = parts.find(p => ['M', 'T', 'N', 'A'].includes(p)) || 'M';
      const slotCandidate = parts.find(p => p !== shiftCandidate) || '';
      const acr = getSlotAcronym(slotCandidate, shiftCandidate);
      return acr ? (acr.startsWith(shiftCandidate) ? acr : `${shiftCandidate}${acr}`) : trimmed;
    }
    return trimmed;
  }
  
  const shift = (slotObj.shift || '').toUpperCase();
  const slotKey = slotObj.slotKey || '';
  if (!slotKey && shift) return shift;
  
  const acronym = getSlotAcronym(slotKey, shift);
  if (!acronym) return shift;
  
  if (acronym.startsWith(shift) && acronym.length >= 3) {
    return acronym;
  }
  
  return `${shift}${acronym}`;
}

/**
 * Descompone una fecha YYYY-MM-DD en { day, month, year2d }
 */
function parseDateParts(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return {
      day: String(now.getDate()).padStart(2, '0'),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year2d: String(now.getFullYear()).slice(-2)
    };
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return {
      day: parts[2],
      month: parts[1],
      year2d: parts[0].slice(-2)
    };
  }
  return { day: '', month: '', year2d: '' };
}

/**
 * Genera el documento PDF de la Boleta Oficial de Cambio de Turno ATC (GSAN-1.3-12-018)
 * llenando únicamente la mitad superior de la hoja.
 *
 * @param {Object} params
 * @param {Object} params.trade - Objeto de permuta/cubrimiento
 * @param {Array} params.controllers - Lista de controladores registrados
 * @param {Object} [params.supervisor] - Datos del supervisor que aprueba
 * @param {string} [params.customRegional] - Texto regional (por defecto "Centro Sur")
 * @param {string} [params.customAeropuerto] - Texto aeropuerto (por defecto "Aeropuerto ElDorado")
 * @returns {Promise<{ pdfBytes: Uint8Array, blobUrl: string, fileName: string }>}
 */
export async function generateBoletaPdf({
  trade,
  controllers = [],
  supervisor = null,
  customRegional = 'Centro Sur',
  customAeropuerto = 'Aeropuerto ElDorado'
}) {
  // 1. Obtener la plantilla oficial
  let templateBytes;
  try {
    const res = await fetch('/templates/boleta_cambio_turno.pdf');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    templateBytes = await res.arrayBuffer();
  } catch (fetchErr) {
    console.error('Error cargando /templates/boleta_cambio_turno.pdf:', fetchErr);
    throw new Error('No se pudo cargar la plantilla oficial de boleta.');
  }

  // 2. Cargar documento en pdf-lib
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 3. Obtener información de controladores
  const ctrlA = controllers.find(c => isSameCtrl(c, trade.fromControllerId, controllers)) || {
    id: trade.fromControllerId,
    name: trade.fromControllerId,
    referenceNumber: ''
  };

  const ctrlB = controllers.find(c => isSameCtrl(c, trade.toControllerId, controllers)) || {
    id: trade.toControllerId,
    name: trade.toControllerId,
    referenceNumber: ''
  };

  const isSwap = trade.type === 'SWAP';
  const isApproved = trade.status === 'APROBADO' || trade.status === 'approved';

  // Resolver supervisor que dio la última aprobación
  let supervisorCtrl = null;
  const supIdentifier = trade.supervisorId || trade.approvedById || trade.approvedBy;
  if (supIdentifier) {
    supervisorCtrl = controllers.find(c => isSameCtrl(c, supIdentifier, controllers));
  }
  if (!supervisorCtrl && supervisor) {
    supervisorCtrl = controllers.find(c => isSameCtrl(c, supervisor, controllers)) || supervisor;
  }
  // Si está aprobado y aún no encontramos controller con firma, buscar en controllers a un supervisor/admin con firma
  if (!supervisorCtrl && isApproved) {
    supervisorCtrl = controllers.find(c => 
      (c.isSupervisor || c.isAdmin || c.role === 'admin' || c.role === 'supervisor' || (c.skills && c.skills.includes('CTE'))) &&
      (c.signatureDataUrl || c.signatureUrl)
    );
  }

  const sigA = trade.solicitanteSignature || ctrlA.signatureDataUrl || ctrlA.signatureUrl;
  const sigB = trade.receptorSignature || ctrlB.signatureDataUrl || ctrlB.signatureUrl;
  const sigSupervisor = trade.supervisorSignature || 
                        supervisorCtrl?.signatureDataUrl || 
                        supervisorCtrl?.signatureUrl || 
                        supervisor?.signatureDataUrl || 
                        supervisor?.signatureUrl;

  const supervisorName = trade.supervisorName || 
                         trade.approvedBy || 
                         supervisorCtrl?.fullName || 
                         supervisorCtrl?.name || 
                         supervisor?.fullName || 
                         supervisor?.name || 
                         'Encargado de Turno';

  const imgSigA = await embedSignatureImage(pdfDoc, sigA);
  const imgSigB = await embedSignatureImage(pdfDoc, sigB);
  const imgSigSupervisor = await embedSignatureImage(pdfDoc, sigSupervisor);

  // 4. Encabezados Institucionales
  page.drawText(customRegional, {
    x: toPdfX(535),
    y: toPdfY(204),
    size: 8.5,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.4)
  });

  page.drawText(customAeropuerto, {
    x: toPdfX(572),
    y: toPdfY(246),
    size: 8.5,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.4)
  });

  // Fechas y turnos
  const dateObj1 = parseDateParts(trade.date);
  const shiftText1 = formatShiftLabel(trade.fromSlot);

  // Formato Asig / Ref
  const asig1 = `${ctrlA.name || ctrlA.id}${ctrlA.referenceNumber ? ` / ${ctrlA.referenceNumber}` : ''}`;
  const hace1 = `${ctrlB.name || ctrlB.id}${ctrlB.referenceNumber ? ` / ${ctrlB.referenceNumber}` : ''}`;

  // Coordenadas X de columnas de la tabla:
  const colX = {
    dia: toPdfX(48.5),
    mes: toPdfX(110.5),
    turno: toPdfX(177),
    asig: toPdfX(288),
    hace: toPdfX(443.5),
    csec: toPdfX(576),
    hturno: toPdfX(682),
    firmaBox: {
      x: toPdfX(738),
      y: toPdfY(372),
      w: (995 - 738) * CALIBRATION.scaleX, // ~109 pt
      h: (372 - 325) * CALIBRATION.scaleY  // ~20 pt
    }
  };

  // --- FILA 1 ---
  const row1Y = toPdfY(353);
  drawTextCentered(page, dateObj1.day, colX.dia, row1Y, 8.5, fontBold);
  drawTextCentered(page, dateObj1.month, colX.mes, row1Y, 8.5, fontBold);
  drawTextCentered(page, shiftText1, colX.turno, row1Y, 7.8, fontBold);
  drawTextCentered(page, asig1, colX.asig, row1Y, 8, fontBold);
  drawTextCentered(page, hace1, colX.hace, row1Y, 8, fontBold);

  if (isSwap) {
    drawTextCentered(page, 'X', colX.csec, row1Y - 1, 10.5, fontBold, rgb(0.85, 0.1, 0.1));
  } else {
    drawTextCentered(page, 'X', colX.hturno, row1Y - 1, 10.5, fontBold, rgb(0.85, 0.1, 0.1));
  }

  // Firma del que asume en la Fila 1 (Casilla 10: Controlador B)
  if (imgSigB) {
    drawImageContained(page, imgSigB, colX.firmaBox.x, colX.firmaBox.y, colX.firmaBox.w, colX.firmaBox.h);
  } else {
    drawTextCentered(page, `(Pendiente ${ctrlB.name || 'ATC'})`, toPdfX(865), row1Y, 6.5, fontRegular, rgb(0.5, 0.5, 0.5));
  }

  // --- FILA 2 (Solo si es SWAP: turno recíproco devuelto) ---
  if (isSwap && trade.toSlot) {
    const returnDateStr = trade.returnDate || trade.date;
    const dateObj2 = parseDateParts(returnDateStr);
    const shiftText2 = formatShiftLabel(trade.toSlot);
    const asig2 = `${ctrlB.name || ctrlB.id}${ctrlB.referenceNumber ? ` / ${ctrlB.referenceNumber}` : ''}`;
    const hace2 = `${ctrlA.name || ctrlA.id}${ctrlA.referenceNumber ? ` / ${ctrlA.referenceNumber}` : ''}`;

    const row2Y = toPdfY(405);
    drawTextCentered(page, dateObj2.day, colX.dia, row2Y, 8.5, fontBold);
    drawTextCentered(page, dateObj2.month, colX.mes, row2Y, 8.5, fontBold);
    drawTextCentered(page, shiftText2, colX.turno, row2Y, 7.8, fontBold);
    drawTextCentered(page, asig2, colX.asig, row2Y, 8, fontBold);
    drawTextCentered(page, hace2, colX.hace, row2Y, 8, fontBold);
    drawTextCentered(page, 'X', colX.csec, row2Y - 1, 10.5, fontBold, rgb(0.85, 0.1, 0.1));

    // Firma del que asume en la Fila 2 (Controlador A)
    const firmaBox2 = {
      x: toPdfX(738),
      y: toPdfY(424),
      w: colX.firmaBox.w,
      h: colX.firmaBox.h
    };

    if (imgSigA) {
      drawImageContained(page, imgSigA, firmaBox2.x, firmaBox2.y, firmaBox2.w, firmaBox2.h);
    } else {
      drawTextCentered(page, `(Pendiente ${ctrlA.name || 'ATC'})`, toPdfX(865), row2Y, 6.5, fontRegular, rgb(0.5, 0.5, 0.5));
    }
  }

  // --- PIE DE BOLETA (Solicitante y Fecha) ---
  const footerY = toPdfY(668);

  // Solicitado por ( Casilla 16 )
  drawTextCentered(page, ctrlA.name || ctrlA.id, toPdfX(160), footerY, 8.5, fontBold);

  // No. Referencia interno ( Casilla 17 )
  if (ctrlA.referenceNumber) {
    drawTextCentered(page, ctrlA.referenceNumber, toPdfX(258), footerY, 8.5, fontBold);
  }

  // Fecha del trámite ( Casillas 18, 19, 20 )
  const todayParts = parseDateParts(trade.createdAt ? trade.createdAt.slice(0, 10) : trade.date);
  drawTextCentered(page, todayParts.day, toPdfX(678), footerY, 8.5, fontBold);
  drawTextCentered(page, todayParts.month, toPdfX(784), footerY, 8.5, fontBold);
  drawTextCentered(page, todayParts.year2d, toPdfX(892), footerY, 8.5, fontBold);

  // --- FIRMAS INFERIORES ---
  // Casilla 21: Firma Solicitante (Controlador A)
  const firmaSolBox = {
    x: toPdfX(145),
    y: toPdfY(732),
    w: (445 - 145) * CALIBRATION.scaleX, // ~127 pt
    h: 24
  };

  if (imgSigA) {
    drawImageContained(page, imgSigA, firmaSolBox.x, firmaSolBox.y, firmaSolBox.w, firmaSolBox.h);
  } else {
    page.drawText(`Pendiente firma ${ctrlA.name || ''}`, {
      x: firmaSolBox.x + 20,
      y: firmaSolBox.y + 8,
      size: 7,
      font: fontRegular,
      color: rgb(0.6, 0.6, 0.6)
    });
  }

  // Casilla 22: Supervisor / Encargado de Turno
  const firmaSupBox = {
    x: toPdfX(597),
    y: toPdfY(732),
    w: (885 - 597) * CALIBRATION.scaleX, // ~122 pt
    h: 26
  };

  if (isApproved && imgSigSupervisor) {
    drawImageContained(page, imgSigSupervisor, firmaSupBox.x, firmaSupBox.y, firmaSupBox.w, firmaSupBox.h);
  } else if (isApproved) {
    page.drawText(`APROBADO - ${supervisorName.toUpperCase()}`, {
      x: firmaSupBox.x + 5,
      y: firmaSupBox.y + 8,
      size: 7,
      font: fontBold,
      color: rgb(0.1, 0.55, 0.2)
    });
  } else {
    page.drawText('(Pendiente Aprobación Supervisor)', {
      x: firmaSupBox.x + 5,
      y: firmaSupBox.y + 8,
      size: 6.8,
      font: fontRegular,
      color: rgb(0.6, 0.6, 0.6)
    });
  }

  // --- SELLO DIGITAL AERONÁUTICO AL PIE ---
  // Estampa el código de validación único y marca de tiempo UTC sin tocar la mitad inferior
  const cleanRef = (trade.id || 'REF').slice(-6).toUpperCase();
  const sealCode = `AIRCONTROL-${trade.type}-${cleanRef}`;
  const dateUtc = new Date().toUTCString().slice(0, 22);

  page.drawText(`Certificación Electrónica AirControl SKBO • Validación: ${sealCode} • Registro UTC: ${dateUtc}`, {
    x: toPdfX(22),
    y: toPdfY(780),
    size: 5.5,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55)
  });

  // Guardar documento
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const cleanDate = trade.date || 'fecha';
  const cleanType = trade.type || 'CAMBIO';
  const fileName = `Boleta_${cleanType}_${ctrlA.name || 'A'}_${ctrlB.name || 'B'}_${cleanDate}.pdf`;

  return {
    pdfBytes,
    blobUrl,
    fileName
  };
}
