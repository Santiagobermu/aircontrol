import { storage } from './firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * Sube la imagen de la firma (Data URL) a Firebase Storage.
 * @param {string} controllerId - Identificador único del controlador.
 * @param {string} dataUrl - Imagen de la firma en formato Base64 Data URL.
 * @returns {Promise<string>} - URL de descarga pública de la firma.
 */
export const uploadSignatureImage = async (controllerId, dataUrl) => {
  if (!controllerId || !dataUrl) return null;
  try {
    const cleanId = controllerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageRef = ref(storage, `signatures/${cleanId}.png`);
    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/png',
      customMetadata: {
        'Cache-Control': 'public, max-age=86400, must-revalidate',
        'Uploaded-At': new Date().toISOString()
      }
    });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error al subir imagen de firma a Firebase Storage:', error);
    // Retornar el dataUrl como fallback si Storage tiene alguna restricción temporal
    return dataUrl;
  }
};

/**
 * Genera el sello digital oficial de formalización aeronáutica.
 * NOTA: Por requerimiento explícito, EXCLUYE el número de licencia / ID.
 * @param {Object} controller - Datos del controlador.
 * @param {string} actionType - 'SWAP' | 'COVER' | 'OFICIALIZACION'
 * @param {string} referenceId - ID de la permuta o cubrimiento si aplica.
 * @returns {Object} - Objeto con datos formateados del sello.
 */
export const generateOfficialSeal = (controller, actionType = 'OFICIALIZACION', referenceId = null) => {
  const date = new Date();
  const utcString = date.toUTCString();
  const isoString = date.toISOString();
  
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const cleanRef = referenceId ? String(referenceId).slice(-6).toUpperCase() : randomSuffix;
  const sealCode = `SKBO-${actionType.toUpperCase()}-${cleanRef}`;

  const fullName = controller?.fullName || controller?.name || 'Controlador Aéreo';
  const siglas = controller?.name || controller?.signature || 'ATC';
  const refNumber = controller?.referenceNumber || 'Sin Asignar';
  const docId = controller?.documentId || 'Sin Registrar';
  const email = controller?.institutionalEmail || controller?.email || 'N/A';

  const asciiSeal = [
    `╔══════════════════════════════════════════════════════════════════╗`,
    `║           OFICIALIZACIÓN OPERATIVA - AIRCONTROL SKBO            ║`,
    `║ Firmante: ${fullName.padEnd(52, ' ')} ║`,
    `║ Siglas: ${siglas.padEnd(10, ' ')} | Doc: ${docId.padEnd(18, ' ')} | Ref: ${refNumber.padEnd(10, ' ')} ║`,
    `║ Correo: ${email.padEnd(54, ' ')} ║`,
    `║ Fecha/Hora: ${utcString.padEnd(50, ' ')} ║`,
    `║ Código de Validación: ${sealCode.padEnd(40, ' ')} ║`,
    `╚══════════════════════════════════════════════════════════════════╝`
  ].join('\n');

  return {
    sealCode,
    timestampUTC: isoString,
    formattedUTC: utcString,
    signatory: {
      fullName,
      siglas,
      referenceNumber: refNumber,
      documentId: docId,
      email
    },
    asciiSeal
  };
};
