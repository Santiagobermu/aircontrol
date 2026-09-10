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
  ShieldCheck
} from 'lucide-react';
import { generateBoletaPdf } from '../utils/boletaGenerator';
import { isSameCtrl } from '../utils/schedulerEngine';

export default function BoletaPreviewModal({
  isOpen,
  onClose,
  trade = null,
  controllers = [],
  supervisor = null
}) {
  const [loading, setLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [fileName, setFileName] = useState('Boleta_ATC.pdf');
  const [error, setError] = useState(null);

  const renderPdf = async () => {
    if (!trade) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await generateBoletaPdf({
        trade,
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
  }, [isOpen, trade]);

  if (!isOpen) return null;

  const ctrlA = controllers.find(c => isSameCtrl(c, trade?.fromControllerId, controllers)) || { 
    name: trade?.fromControllerId || 'Solicitante',
    id: trade?.fromControllerId 
  };
  const ctrlB = controllers.find(c => isSameCtrl(c, trade?.toControllerId, controllers)) || { 
    name: trade?.toControllerId || 'Receptor',
    id: trade?.toControllerId 
  };
  const isApproved = trade?.status === 'APROBADO' || trade?.status === 'approved';

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
                {trade ? (
                  <>
                    Plantilla oficial Aerocivil • {trade.type === 'SWAP' ? 'Cambio de Secuencia (C.SEC)' : 'Hechura de Turno (H.TURNO)'} • {ctrlA.name} ↔ {ctrlB.name}
                  </>
                ) : (
                  'Plantilla oficial Aerocivil • No hay solicitud seleccionada'
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {trade && (
              <button
                type="button"
                onClick={renderPdf}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Recargar documento"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
              </button>
            )}

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
          {!trade ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              borderRadius: '12px',
              maxWidth: '450px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-secondary)'
            }}>
              <FileText size={28} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Ningún cambio seleccionado
              </span>
              <span style={{ fontSize: '0.78rem' }}>
                Selecciona una propuesta de cambio de turno en la lista para visualizar su boleta oficial.
              </span>
            </div>
          ) : loading ? (
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
        {trade && (
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
                color: isApproved ? 'var(--status-success)' : 'var(--status-warning)',
                fontWeight: '600'
              }}>
                {isApproved ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                Supervisor {isApproved ? '(Aprobado)' : '(Pendiente)'}
              </span>
            </div>

            <div style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={14} />
              <span>Diligenciamiento exclusivo en mitad superior • Formato oficial Aerocivil</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
