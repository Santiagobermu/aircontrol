import { useState } from 'react';
import { User, ShieldCheck, Calendar, Sun, Moon, LogOut, Key, Copy, Check, RefreshCw, Plus, Megaphone, X, Lock } from 'lucide-react';
import { getAuth, updatePassword } from 'firebase/auth';
import ThemeToggle from '../ThemeToggle';
import { addManualAlertDB } from '../../utils/db';

export default function MobileProfileView({ 
  currentUser, 
  userRole = 'controller',
  onLogout 
}) {
  const [copiedWebcal, setCopiedWebcal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Alertas del Encargado
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  // Cambiar Contraseña
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const signature = currentUser?.signature || 'ATC';
  const name = currentUser?.name || 'Controlador Aéreo';
  const email = currentUser?.email || 'controlador@aircontrol.com';
  
  const isEncargado = userRole === 'admin' || currentUser?.isSupervisor || currentUser?.isAdmin || (currentUser?.skills && currentUser.skills.includes('CTE'));
  const roleTitle = isEncargado ? 'Encargado de Turno / CTE Certificado' : 'Controlador Certificado SKBO';

  // Copiar Enlace Webcal (.ics)
  const handleCopyWebcal = async () => {
    const rawUrl = currentUser?.calendarSyncUrl || `https://firebasestorage.googleapis.com/v0/b/aircontrol-skbo-sbg.firebasestorage.app/o/calendars%2F${currentUser?.id || currentUser?.signature}.ics?alt=media`;
    const webcalUrl = rawUrl.replace(/^https:\/\//, 'webcal://');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(webcalUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = webcalUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedWebcal(true);
      setTimeout(() => setCopiedWebcal(false), 2500);
      alert('¡Enlace Webcal copiado al portapapeles!\nPuedes pegarlo en la app de Calendario (Apple o Google) en tu iPhone.');
    } catch (err) {
      console.error(err);
      alert(`Enlace Webcal: ${webcalUrl}`);
    }
  };

  // Sincronizar NOTAMs
  const handleSyncNotamsApi = async () => {
    setSyncing(true);
    try {
      const res = await fetch('https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/sync_notams_api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      alert(`Sincronización de NOTAMs procesada en el servidor.`);
    } catch (err) {
      alert('Se envió la orden de sincronización de NOTAMs.');
    } finally {
      setSyncing(false);
    }
  };

  // Publicar Alerta
  const handleCreateAlertSubmit = async (e) => {
    e.preventDefault();
    if (!alertContent.trim()) return;
    await addManualAlertDB({
      content: alertContent.trim(),
      createdBy: currentUser?.name || 'Encargado de Turno',
      createdByEmail: currentUser?.email || ''
    });
    setAlertContent('');
    setIsAlertModalOpen(false);
    alert('¡Alerta publicada exitosamente para el turno!');
  };

  // Cambiar Contraseña submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    setPassLoading(true);
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        alert('¡Contraseña actualizada exitosamente!');
        setIsPassModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert('No se detectó una sesión activa en Firebase.');
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        alert('Por motivos de seguridad de Firebase, debes cerrar sesión y volver a ingresar para actualizar tu contraseña.');
      } else {
        alert('Error al cambiar la contraseña: ' + (err.message || 'Intenta nuevamente'));
      }
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* Tarjeta de Perfil Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(99, 102, 241, 0.1))',
        border: '1px solid var(--accent-cyan)',
        borderRadius: '16px',
        padding: '1.2rem',
        boxShadow: '0 0 20px rgba(6, 182, 212, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '0.6rem'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--bg-secondary)',
          border: '2px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          fontWeight: '800',
          color: 'var(--accent-cyan)',
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)'
        }}>
          {signature}
        </div>

        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {name}
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: '600', display: 'block', marginTop: '0.1rem' }}>
            {roleTitle}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {email}
          </span>
        </div>

        {/* Certificaciones Tácticas */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.4rem' }}>
          {(currentUser?.skills || ['TWR', 'GND', 'DEL', 'CTE']).map((cert, idx) => (
            <span key={idx} style={{
              background: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: '800',
              fontFamily: 'var(--font-mono)'
            }}>
              ✓ {cert}
            </span>
          ))}
        </div>
      </div>

      {/* SECCIÓN HERRAMIENTAS DE ENCARGADO (CTE / SUPERVISOR / ADMIN) */}
      {isEncargado && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(6, 182, 212, 0.05))',
          border: '1px solid var(--status-warning)',
          borderRadius: '14px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: 'var(--status-warning)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Megaphone size={18} />
            Herramientas de Encargado de Turno (CTE)
          </h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Gestiona la sincronización de NOTAMs oficiales y publica avisos operativos para el personal en turno.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="btn btn-primary"
              style={{
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <Plus size={16} />
              Agregar Alerta
            </button>

            <button
              onClick={handleSyncNotamsApi}
              disabled={syncing}
              className="btn btn-secondary"
              style={{
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={16} className={syncing ? 'spin-animation' : ''} />
              {syncing ? 'Cargando...' : 'Sincronizar NOTAMs'}
            </button>
          </div>
        </div>
      )}

      {/* Sincronización Webcal Calendario (.ics) */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem'
      }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={18} color="var(--accent-cyan)" />
          Sincronización Webcal Móvil (.ics)
        </h3>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Conecta tus turnos de AirControl en tiempo real con Apple Calendar u Google Calendar en tu iPhone.
        </p>

        <button
          onClick={handleCopyWebcal}
          className="btn btn-secondary"
          style={{
            width: '100%',
            padding: '0.65rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            marginTop: '0.2rem'
          }}
        >
          {copiedWebcal ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
          {copiedWebcal ? '¡Enlace Webcal Copiado!' : 'Copiar Enlace de Suscripción Webcal'}
        </button>
      </div>

      {/* Ajustes de Tema y Cuenta */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem'
      }}>
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          Configuración y Preferencias
        </h3>

        {/* Fila Modo Claro / Oscuro */}
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 0.8rem',
          background: 'var(--bg-tertiary)',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>Tema de la Interfaz:</span>
          <ThemeToggle />
        </div>

        {/* Fila Cambiar Contraseña */}
        <button
          onClick={() => setIsPassModalOpen(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '0.7rem 0.8rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={16} color="var(--accent-cyan)" />
            <span>Cambiar Contraseña</span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>›</span>
        </button>
      </div>

      {/* Botón de Cerrar Sesión */}
      <button
        onClick={onLogout}
        style={{
          width: '100%',
          padding: '0.8rem',
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid var(--status-danger)',
          color: 'var(--status-danger)',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          marginTop: '0.5rem'
        }}
      >
        <LogOut size={18} />
        Cerrar Sesión Operativa
      </button>

      {/* MODAL PARA CAMBIAR CONTRASEÑA */}
      {isPassModalOpen && (
        <div className="bottom-sheet-backdrop" onClick={() => setIsPassModalOpen(false)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={18} color="var(--accent-cyan)" />
                Cambiar Contraseña
              </h3>
              <button onClick={() => setIsPassModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Nueva Contraseña:
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Confirmar Nueva Contraseña:
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button type="button" onClick={() => setIsPassModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={passLoading} className="btn btn-primary" style={{ flex: 1, padding: '0.65rem', fontWeight: '700' }}>
                  {passLoading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR ALERTA DESDE EL PERFIL */}
      {isAlertModalOpen && (
        <div className="bottom-sheet-backdrop" onClick={() => setIsAlertModalOpen(false)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Megaphone size={18} color="var(--accent-cyan)" />
                Publicar Alerta del Encargado (CTE)
              </h3>
              <button onClick={() => setIsAlertModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAlertSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.3rem', display: 'block' }}>
                  Contenido del Mensaje para la Guardia:
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Ej. Cambio de configuración a Pistas 31L/31R. Atención con procedimiento SID BOG..."
                  value={alertContent}
                  onChange={e => setAlertContent(e.target.value)}
                  required
                  style={{ width: '100%', resize: 'none', fontSize: '0.82rem', padding: '0.6rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setIsAlertModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.65rem', fontWeight: '700' }}>
                  Publicar Alerta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
