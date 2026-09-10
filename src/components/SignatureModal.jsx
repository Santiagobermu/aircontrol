import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Upload, 
  KeyRound, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Hash, 
  FileText, 
  User, 
  Award,
  Sparkles
} from 'lucide-react';
import { uploadSignatureImage, generateOfficialSeal } from '../utils/signatureUtils';

export default function SignatureModal({ 
  isOpen, 
  onClose, 
  controller, 
  onSaveSignature, 
  isAdmin = false 
}) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('draw'); // 'draw' | 'seal'

  // Previsualización de firma existente
  const existingSig = controller?.signatureDataUrl || controller?.signatureUrl;
  const hasExistingPin = !!controller?.signaturePin;

  // Inicializar y redimensionar canvas con alta resolución
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.parentElement.clientWidth || 420;
    const height = 180;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#06b6d4'; // Cyan elegante característico de AirControl

    // Si ya tiene firma registrada, precargarla en el canvas
    if (existingSig) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        // Ajustar imagen proporcionalmente
        const hRatio = width / img.width;
        const vRatio = height / img.height;
        const sRatio = Math.min(hRatio, vRatio, 1);
        const centerShiftX = (width - img.width * sRatio) / 2;
        const centerShiftY = (height - img.height * sRatio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * sRatio, img.height * sRatio);
        setHasDrawn(true);
      };
      img.src = existingSig;
    } else {
      ctx.clearRect(0, 0, width, height);
      setHasDrawn(false);
    }
  }, [isOpen, existingSig]);

  if (!isOpen || !controller) return null;

  // Helpers de dibujo para Mouse y Touch
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.closePath();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setHasDrawn(false);
    setError(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor sube una imagen válida (PNG, JPG o WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const ratio = window.devicePixelRatio || 1;
        const width = canvas.width / ratio;
        const height = canvas.height / ratio;

        ctx.clearRect(0, 0, width, height);

        const hRatio = width / img.width;
        const vRatio = height / img.height;
        const sRatio = Math.min(hRatio, vRatio, 1);
        const centerShiftX = (width - img.width * sRatio) / 2;
        const centerShiftY = (height - img.height * sRatio) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * sRatio, img.height * sRatio);
        setHasDrawn(true);
        setError(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError(null);

    // Validar trazo de firma
    if (!hasDrawn && !existingSig) {
      setError('Debes dibujar tu firma o subir una imagen para continuar.');
      return;
    }

    // Validar PIN si se ingresó o si es un nuevo registro
    const isNewPinEntered = pin.trim().length > 0;
    if (isNewPinEntered) {
      if (!/^\d{4}$/.test(pin.trim())) {
        setError('El PIN de firma debe ser exactamente de 4 dígitos numéricos.');
        return;
      }
      if (pin.trim() !== confirmPin.trim()) {
        setError('Los PINs ingresados no coinciden.');
        return;
      }
    } else if (!hasExistingPin) {
      setError('Debes definir un PIN de firma de 4 dígitos para autorizar oficializaciones.');
      return;
    }

    setLoading(true);
    try {
      const canvas = canvasRef.current;
      let finalDataUrl = existingSig;

      if (hasDrawn && canvas) {
        finalDataUrl = canvas.toDataURL('image/png');
      }

      // Subir a Firebase Storage
      const storageUrl = await uploadSignatureImage(controller.id, finalDataUrl);

      const payload = {
        signatureUrl: storageUrl || finalDataUrl,
        signatureDataUrl: finalDataUrl,
        signatureUpdatedAt: new Date().toISOString()
      };

      if (isNewPinEntered) {
        payload.signaturePin = pin.trim();
      }

      await onSaveSignature(payload);
      onClose();
    } catch (err) {
      console.error('Error al guardar firma:', err);
      setError('Ocurrió un error al guardar la firma: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sealData = generateOfficialSeal(controller, 'MUESTRA');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '540px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '20px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(6, 182, 212, 0.3)'
      }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.85rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <ShieldCheck size={22} color="var(--accent-cyan)" />
              Firma Híbrida y PIN Operativo
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {controller.fullName || controller.name} ({controller.name})
            </span>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-icon-only" 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            color: 'var(--status-danger)',
            fontSize: '0.82rem',
            fontWeight: '600'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Selector de Pestañas (Dibujar vs Vista Previa Sello) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'var(--bg-tertiary)',
          padding: '0.25rem',
          borderRadius: '10px',
          gap: '0.25rem',
          border: '1px solid var(--glass-border)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'draw' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'draw' ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            ✍️ Dibujar / Subir Firma
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('seal')}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeTab === 'seal' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'seal' ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            🛡️ Simulador de Sello
          </button>
        </div>

        {activeTab === 'draw' ? (
          <>
            {/* Contenedor del Canvas de Firma */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  Traza tu firma en el recuadro con el dedo o mouse:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="filter-btn"
                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Limpiar trazo"
                  >
                    <RotateCcw size={12} />
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="filter-btn"
                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Subir archivo de imagen"
                  >
                    <Upload size={12} />
                    Subir Imagen
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/png, image/jpeg, image/webp" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>

              <div style={{
                width: '100%',
                height: '180px',
                borderRadius: '12px',
                border: '2px dashed rgba(6, 182, 212, 0.4)',
                backgroundColor: 'rgba(6, 182, 212, 0.03)',
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none'
              }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  onTouchCancel={stopDrawing}
                  style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
                />
                {!hasDrawn && !existingSig && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255, 255, 255, 0.25)',
                    fontSize: '0.85rem',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }}>
                    Firma aquí con tu dedo o mouse
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN PIN DE FIRMA OPERATIVA */}
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <KeyRound size={15} color="var(--accent-cyan)" />
                  PIN de Firma Operativa (4 dígitos)
                </span>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}
                >
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPin ? 'Ocultar' : 'Ver dígitos'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="sig-pin" style={{ fontSize: '0.75rem', marginBottom: '0.3rem', display: 'block' }}>
                    {hasExistingPin ? 'Nuevo PIN (Opcional)' : 'PIN de Firma (4 Números) *'}
                  </label>
                  <input
                    id="sig-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    className="form-input"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', letterSpacing: '0.3em', fontWeight: '800', fontSize: '1.1rem', width: '100%' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="sig-confirm-pin" style={{ fontSize: '0.75rem', marginBottom: '0.3rem', display: 'block' }}>
                    Confirmar PIN de Firma
                  </label>
                  <input
                    id="sig-confirm-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    className="form-input"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', letterSpacing: '0.3em', fontWeight: '800', fontSize: '1.1rem', width: '100%' }}
                  />
                </div>
              </div>

              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                ℹ️ Este PIN será solicitado en consola o móvil para estampar tu firma digital y oficializar coberturas o permutas.
                {hasExistingPin && ' Ya tienes un PIN guardado. Déjalo en blanco si deseas conservarlo.'}
              </span>
            </div>
          </>
        ) : (
          /* PESTAÑA SIMULADOR DE SELLO OFICIAL (SIN LICENCIA) */
          <div style={{
            background: 'rgba(6, 182, 212, 0.04)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
              <Sparkles size={18} />
              <span style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sello Aeronáutico Oficial (Simulación)
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Así se verá la certificación oficial estampada en las permutas, cubrimientos y correos institucionales despachados:
            </p>

            <div style={{
              background: '#090d16',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              {/* Miniatura de firma */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rúbrica Digital:</span>
                <div style={{
                  height: '45px',
                  width: '120px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {hasDrawn && canvasRef.current ? (
                    <img 
                      src={canvasRef.current.toDataURL('image/png')} 
                      alt="Firma" 
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                    />
                  ) : existingSig ? (
                    <img 
                      src={existingSig} 
                      alt="Firma" 
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                    />
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Sin trazo</span>
                  )}
                </div>
              </div>

              {/* Datos del sello (NOTA: EXCLUYE LICENCIA SEGÚN REQUERIMIENTO) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Controlador:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{sealData.signatory.fullName}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>SIGLAS:</span>
                  <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{sealData.signatory.siglas}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Documento de Identidad:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{sealData.signatory.documentId}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>No. Ref. Interno:</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{sealData.signatory.referenceNumber}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Validación: <strong style={{ color: 'var(--status-success)' }}>{sealData.sealCode}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>UTC: {sealData.formattedUTC.slice(0, 22)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flex: 1, padding: '0.75rem' }}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            style={{ flex: 2, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: '800' }}
            disabled={loading}
          >
            {loading ? (
              <span>Guardando en Firebase...</span>
            ) : (
              <>
                <Check size={16} />
                <span>Guardar Firma y PIN</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
