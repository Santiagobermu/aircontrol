import { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { generateBoletaPdf } from '../utils/boletaGenerator';

export default function BoletaPreviewModal({
  isOpen,
  onClose,
  trade = null,
  controllers = [],
  supervisor = null
}) {
  const [testMode, setTestMode] = useState(trade ? 'current' : 'sample_swap');
  const [loading, setLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [fileName, setFileName] = useState('Boleta_ATC.pdf');
  const [error, setError] = useState(null);

  // Muestras de prueba predefinidas para calibración y revisión inmediata
  const getEffectiveTrade = () => {
    if (testMode === 'current' && trade) {
      return trade;
    }

    // Buscar controladores reales con firmas si existen, o usar los primeros disponibles
    const ctrlWithSig = controllers.filter(c => c.signatureUrl || c.signatureDataUrl);
    const ctrlA = ctrlWithSig[0] || controllers[0] || { id: 'JZA', name: 'JZA', fullName: 'Juan Zapata A.', referenceNumber: '42' };
    const ctrlB = ctrlWithSig[1] || controllers[1] || { id: 'GMB', name: 'GMB', fullName: 'Gabriel Mejía B.', referenceNumber: '18' };

    if (testMode === 'sample_cover') {
      return {
        id: 'trade-demo-cover',
        type: 'COVER',
        date: '2026-09-15',
        fromControllerId: ctrlA.id,
        toControllerId: ctrlB.id,
        fromSlot: { shift: 'T', slotKey: 'DEL-1' },
        toSlot: null,
        status: 'APROBADO',
        createdAt: '2026-09-10T14:30:00Z'
      };
    }

    if (testMode === 'sample_pending') {
      return {
        id: 'trade-demo-pending',
        type: 'SWAP',
        date: '2026-09-20',
        returnDate: '2026-09-22',
        fromControllerId: ctrlA.id,
        toControllerId: ctrlB.id,
        fromSlot: { shift: 'T', slotKey: 'GND-1' },
        toSlot: { shift: 'M', slotKey: 'DEL-1' },
        status: 'PENDIENTE_APROBACION',
        createdAt: '2026-09-10T14:30:00Z'
      };
    }

    // Default: sample_swap
    return {
      id: 'trade-demo-swap',
      type: 'SWAP',
      date: '2026-09-15',
      returnDate: '2026-09-18',
      fromControllerId: ctrlA.id,
      toControllerId: ctrlB.id,
      fromSlot: { shift: 'M', slotKey: 'TWR-1' },
      toSlot: { shift: 'T', slotKey: 'GND-1' },
      status: 'APROBADO',
      createdAt: '2026-09-10T14:30:00Z'
    };
  };

  const renderPdf = async () => {
    setLoading(true);
    setError(null);
    try {
      const effTrade = getEffectiveTrade();
      const result = await generateBoletaPdf({
        trade: effTrade,
        controllers,
        supervisor
      });
      setPdfBlobUrl(result.blobUrl);
      setFileName(result.fileName);
    } catch (err) {
      console.error('Error generando boleta:', err);
      setError('Error generando el documento PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      renderPdf();
    }
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [isOpen, testMode, trade]);

  if (!isOpen) return null;

  const effTrade = getEffectiveTrade();
  const ctrlA = controllers.find(c => c.id === effTrade.fromControllerId) || { name: effTrade.fromControllerId };
  const ctrlB = controllers.find(c => c.id === effTrade.toControllerId) || { name: effTrade.toControllerId };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '900px',
        width: '100%',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        background: '#090d16'
      }}>
        {/* Cabecera del Modal */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Boleta Oficial de Cambio de Turno ATC
                </h3>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  color: 'var(--accent-cyan)',
                  background: 'rgba(6, 182, 212, 0.12)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '20px',
                  letterSpacing: '0.04em'
                }}>
                  GSAN-1.3-12-018
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Plantilla oficial Aerocivil • {effTrade.type === 'SWAP' ? 'Cambio de Secuencia (C.SEC)' : 'Hechura de Turno (H.TURNO)'} • {ctrlA.name} ↔ {ctrlB.name}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {pdfBlobUrl && (
              <>
                <a
                  href={pdfBlobUrl}
                  download={fileName}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Descargar Boleta PDF"
                >
                  <Download size={14} /> Descargar PDF
                </a>
                <a
                  href={pdfBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Abrir en pestaña nueva"
                >
                  <ExternalLink size={14} />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-icon-only"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Simulación y Filtros de Calibración */}
        <div style={{
          padding: '0.6rem 1.5rem',
          background: '#0d1322',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Sparkles size={13} color="var(--accent-cyan)" /> Modo de Prueba / Calibración:
            </span>
            <div style={{ display: 'flex', gap: '0.3rem', background: '#090d16', padding: '0.2rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
              {trade && (
                <button
                  type="button"
                  onClick={() => setTestMode('current')}
                  style={{
                    background: testMode === 'current' ? 'var(--accent-cyan)' : 'transparent',
                    color: testMode === 'current' ? '#000' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cambio Actual
                </button>
              )}
              <button
                type="button"
                onClick={() => setTestMode('sample_swap')}
                style={{
                  background: testMode === 'sample_swap' ? 'var(--accent-cyan)' : 'transparent',
                  color: testMode === 'sample_swap' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Simular SWAP (2 Filas)
              </button>
              <button
                type="button"
                onClick={() => setTestMode('sample_cover')}
                style={{
                  background: testMode === 'sample_cover' ? 'var(--accent-cyan)' : 'transparent',
                  color: testMode === 'sample_cover' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Simular COVER (1 Fila)
              </button>
              <button
                type="button"
                onClick={() => setTestMode('sample_pending')}
                style={{
                  background: testMode === 'sample_pending' ? 'var(--accent-cyan)' : 'transparent',
                  color: testMode === 'sample_pending' ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Pendiente Supervisor
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={renderPdf}
            className="btn btn-secondary"
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="Recargar y regenerar boleta"
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} /> Recalibrar
          </button>
        </div>

        {/* Visor Interactivo de la Boleta Oficial */}
        <div style={{
          flex: 1,
          width: '100%',
          position: 'relative',
          background: '#1a1f2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
              <div className="spinner" style={{ width: '36px', height: '36px', borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
              <span style={{ fontSize: '0.85rem' }}>Diligenciando formato oficial GSAN-1.3-12-018...</span>
            </div>
          ) : error ? (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '1.5rem',
              borderRadius: '12px',
              maxWidth: '450px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={28} color="var(--status-danger)" />
              <span style={{ color: 'var(--status-danger)', fontSize: '0.85rem', fontWeight: '600' }}>{error}</span>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title="Boleta Oficial de Cambio de Turno"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#262c3d'
              }}
            />
          ) : null}
        </div>

        {/* Pie Informativo de Auditoría */}
        <div style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.75rem',
          background: 'rgba(15, 23, 42, 0.8)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>Firmas en Boleta:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--status-success)', fontWeight: '600' }}>
              <CheckCircle2 size={13} /> Solicitante ({ctrlA.name})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--status-success)', fontWeight: '600' }}>
              <CheckCircle2 size={13} /> Receptor ({ctrlB.name})
            </span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: effTrade.status === 'APROBADO' ? 'var(--status-success)' : 'var(--status-warning)',
              fontWeight: '600'
            }}>
              {effTrade.status === 'APROBADO' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
              Supervisor {effTrade.status === 'APROBADO' ? '(Aprobado)' : '(Pendiente)'}
            </span>
          </div>

          <div style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} />
            <span>Diligenciamiento exclusivo en mitad superior • Formato oficial Aerocivil</span>
          </div>
        </div>
      </div>
    </div>
  );
}
