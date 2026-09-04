import { useState, useEffect } from 'react';
import { User, ShieldCheck, Calendar, Sun, Moon, LogOut, Key, Copy, Check, RefreshCw, Plus, Megaphone, X, Lock, Download, HelpCircle, Smartphone, ExternalLink, Info, Bell, BellRing, BellOff } from 'lucide-react';
import { getAuth, updatePassword } from 'firebase/auth';
import ThemeToggle from '../ThemeToggle';
import { addManualAlertDB } from '../../utils/db';
import { generateICS, uploadCalendarToStorage, getAllShiftsForController, getGoogleCalendarSubscribeUrl, downloadICSFile, detectUserDevice } from '../../utils/calendarExport';
import { requestPushPermission, disablePushNotifications, getPermissionStatus, triggerLocalTestNotification, checkPushSupport } from '../../utils/notifications';

export default function MobileProfileView({ 
  currentUser, 
  userRole = 'controller',
  scheduleMonth = {},
  exceptions = {},
  onLogout,
  onChangePassword,
  onUpdateController
}) {
  const [copiedWebcal, setCopiedWebcal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  
  // Plataforma seleccionada para sincronización de calendario ('android' | 'apple')
  const [calendarPlatform, setCalendarPlatform] = useState(() => {
    const dev = detectUserDevice();
    return dev === 'android' ? 'android' : 'apple';
  });
  const [isAndroidGuideOpen, setIsAndroidGuideOpen] = useState(false);

  // Estado de Notificaciones Push
  const [pushStatus, setPushStatus] = useState('default');
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    const status = getPermissionStatus();
    setPushStatus(status);
  }, []);

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

  const rawUrl = currentUser?.calendarSyncUrl || `https://firebasestorage.googleapis.com/v0/b/aircontrol-skbo-sbg.firebasestorage.app/o/calendars%2F${currentUser?.id || currentUser?.signature}.ics?alt=media`;
  const webcalUrl = rawUrl.replace(/^https:\/\//, 'webcal://');
  const googleCalendarUrl = getGoogleCalendarSubscribeUrl(rawUrl);

  // Copiar Enlace
  const handleCopyCalendarLink = async () => {
    try {
      const linkToCopy = calendarPlatform === 'apple' ? webcalUrl : rawUrl;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(linkToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = linkToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedWebcal(true);
      setTimeout(() => setCopiedWebcal(false), 2500);
      alert('¡Enlace de suscripción copiado al portapapeles!');
    } catch (err) {
      console.error(err);
      alert(`Enlace: ${rawUrl}`);
    }
  };

  // Descarga directa de archivo .ics (Para Samsung Calendar, Xiaomi, Outlook, etc.)
  const handleDirectDownloadICS = () => {
    if (!currentUser) return;
    try {
      const allShifts = getAllShiftsForController(currentUser, scheduleMonth, exceptions);
      const totalCount = Object.values(allShifts).reduce((acc, l) => acc + (l?.length || 0), 0);
      const icsContent = generateICS(currentUser, allShifts);
      const fileName = `horario_${currentUser.signature || currentUser.name || 'aircontrol'}`;
      downloadICSFile(fileName, icsContent);
      alert(`¡Archivo de horario descargado con éxito (${totalCount} eventos)!\n\nToca "Abrir" en la barra de descargas de tu celular para guardarlos directamente en tu calendario (Samsung, Google, Outlook, etc.).`);
    } catch (err) {
      console.error(err);
      alert('Error al generar la descarga del archivo ICS: ' + err.message);
    }
  };

  const handleToggleCloudSync = async () => {
    if (!currentUser) return;
    setSyncLoading(true);
    try {
      if (currentUser.calendarSyncEnabled) {
        if (onUpdateController) {
          await onUpdateController({
            ...currentUser,
            calendarSyncEnabled: false,
            calendarSyncUrl: null
          });
        }
      } else {
        const allShifts = getAllShiftsForController(currentUser, scheduleMonth, exceptions);
        const icsContent = generateICS(currentUser, allShifts);
        const targetId = currentUser.id || currentUser.signature;
        const downloadUrl = await uploadCalendarToStorage(targetId, icsContent);
        if (onUpdateController) {
          await onUpdateController({
            ...currentUser,
            calendarSyncEnabled: true,
            calendarSyncUrl: downloadUrl
          });
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error al gestionar la sincronización de calendario: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleForceSync = async () => {
    if (!currentUser) return;
    setSyncLoading(true);
    try {
      const allShifts = getAllShiftsForController(currentUser, scheduleMonth, exceptions);
      const totalEvents = Object.values(allShifts).reduce((acc, items) => acc + (items?.length || 0), 0);
      const icsContent = generateICS(currentUser, allShifts);
      const targetId = currentUser.id || currentUser.signature;
      const newUrl = await uploadCalendarToStorage(targetId, icsContent);
      if (onUpdateController) {
        await onUpdateController({
          ...currentUser,
          calendarSyncUrl: newUrl
        });
      }
      alert(`¡Sincronización multi-mes completada con éxito!\nSe actualizaron ${totalEvents} turnos y novedades (incluyendo Agosto, Septiembre y meses futuros) en tu calendario de la nube.`);
    } catch (err) {
      console.error(err);
      alert('Error al forzar actualización: ' + err.message);
    } finally {
      setSyncLoading(false);
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

      {/* Sincronización de Calendario (.ics / Google Calendar & Apple) */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '1.2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Calendar size={20} color="var(--accent-cyan)" />
            Sincronización de Calendario (.ics)
          </h3>
          {currentUser?.calendarSyncEnabled && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: '700',
              color: 'var(--status-success)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '0.2rem 0.55rem',
              borderRadius: '20px'
            }}>
              ✓ Activa
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Sincroniza tus turnos y descansos en tiempo real con <strong>Google Calendar en Android</strong> o <strong>Apple Calendar en iPhone</strong>.
        </p>

        {/* Selector de Plataforma (Android vs Apple) */}
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
            onClick={() => setCalendarPlatform('android')}
            style={{
              padding: '0.45rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              background: calendarPlatform === 'android' ? 'var(--accent-cyan)' : 'transparent',
              color: calendarPlatform === 'android' ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <Smartphone size={15} />
            Android / Google
          </button>
          <button
            type="button"
            onClick={() => setCalendarPlatform('apple')}
            style={{
              padding: '0.45rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              background: calendarPlatform === 'apple' ? 'var(--accent-cyan)' : 'transparent',
              color: calendarPlatform === 'apple' ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🍏</span>
            iPhone / Mac
          </button>
        </div>

        {/* ACCIONES ESPECÍFICAS SEGÚN LA PLATAFORMA SELECCIONADA */}
        {calendarPlatform === 'android' ? (
          /* VISTA ANDROID / GOOGLE CALENDAR &amp; SAMSUNG */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            
            {/* Botón Principal 1: Descarga Directa 1-Toque */}
            <button
              type="button"
              onClick={handleDirectDownloadICS}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <Download size={18} />
              📥 Descargar &amp; Abrir en Calendario (.ICS)
            </button>

            {/* Botón Principal 2: Asistente Google Calendar Nube */}
            <button
              type="button"
              onClick={() => setIsAndroidGuideOpen(true)}
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: '1px solid rgba(26, 115, 232, 0.4)',
                background: 'rgba(26, 115, 232, 0.12)',
                color: '#60a5fa',
                cursor: 'pointer'
              }}
            >
              <ExternalLink size={16} />
              ☁️ Sincronizar con Google Calendar (Nube)
            </button>

            {/* Fila de Acciones de Nube */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleCopyCalendarLink}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                {copiedWebcal ? <Check size={15} color="var(--status-success)" /> : <Copy size={15} />}
                {copiedWebcal ? '¡Copiado!' : 'Copiar Enlace'}
              </button>

              {currentUser?.calendarSyncEnabled ? (
                <>
                  <button
                    onClick={handleForceSync}
                    disabled={syncLoading}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <RefreshCw size={14} className={syncLoading ? 'spin-animation' : ''} />
                    {syncLoading ? '...' : 'Forzar Sync'}
                  </button>

                  <button
                    onClick={handleToggleCloudSync}
                    disabled={syncLoading}
                    className="btn btn-danger-outline"
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}
                  >
                    Desactivar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleToggleCloudSync}
                  disabled={syncLoading}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                >
                  ☁️ {syncLoading ? 'Activando...' : 'Activar Nube'}
                </button>
              )}
            </div>

            {/* Indicaciones breves para Android */}
            <div style={{
              borderTop: '1px dashed var(--color-border)',
              paddingTop: '0.55rem',
              marginTop: '0.1rem',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              lineHeight: '1.4'
            }}>
              💡 <strong>Recomendación en Android:</strong> Pulsa <em>&quot;Descargar &amp; Abrir&quot;</em> para guardar tus turnos en 1 segundo en tu app de calendario (Samsung, Google, Xiaomi). Para suscripción dinámica que se actualice sola, usa el botón azul de Google Calendar.
            </div>

          </div>
        ) : (
          /* VISTA APPLE / IPHONE & MAC */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Botón Principal Destacado: 1-Clic Suscribirse en iPhone / Mac */}
            <a
              href={webcalUrl}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.8rem',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)',
                color: '#ffffff',
                boxSizing: 'border-box'
              }}
              onClick={async (e) => {
                if (!currentUser?.calendarSyncEnabled) {
                  e.preventDefault();
                  await handleToggleCloudSync();
                  window.location.href = webcalUrl;
                }
              }}
            >
              <Calendar size={18} />
              📅 Suscribirse en iPhone / Mac (Un Clic)
            </a>

            {/* Acciones Secundarias */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleCopyCalendarLink}
                className="btn btn-secondary"
                style={{
                  flex: 1,
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
                {copiedWebcal ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
                {copiedWebcal ? '¡Copiado!' : 'Copiar Enlace'}
              </button>

              {currentUser?.calendarSyncEnabled ? (
                <>
                  <button
                    onClick={handleForceSync}
                    disabled={syncLoading}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <RefreshCw size={15} className={syncLoading ? 'spin-animation' : ''} />
                    {syncLoading ? 'Actualizando...' : 'Forzar Sync'}
                  </button>

                  <button
                    onClick={handleToggleCloudSync}
                    disabled={syncLoading}
                    className="btn btn-danger-outline"
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      fontWeight: '700'
                    }}
                  >
                    Desactivar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleToggleCloudSync}
                  disabled={syncLoading}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
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
                  ☁️ {syncLoading ? 'Activando...' : 'Activar Nube'}
                </button>
              )}
            </div>

            {/* Indicaciones breves */}
            <div style={{
              borderTop: '1px dashed var(--color-border)',
              paddingTop: '0.6rem',
              marginTop: '0.2rem',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              lineHeight: '1.4'
            }}>
              💡 <strong>iPhone / Mac:</strong> Presiona el botón azul para añadir la suscripción directa en tu app de Calendario. Los cambios de turnos (swaps) se actualizarán solos.
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN NOTIFICACIONES PUSH */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        padding: '1.2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <BellRing size={20} color="var(--accent-cyan)" />
            Notificaciones Push Web
          </h3>
          {pushStatus === 'granted' ? (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: '700',
              color: 'var(--status-success)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '0.2rem 0.55rem',
              borderRadius: '20px'
            }}>
              ✓ Activadas
            </span>
          ) : pushStatus === 'denied' ? (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: '700',
              color: 'var(--status-danger)',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '0.2rem 0.55rem',
              borderRadius: '20px'
            }}>
              Bloqueadas
            </span>
          ) : (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: '700',
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              padding: '0.2rem 0.55rem',
              borderRadius: '20px'
            }}>
              Inactivas
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Recibe alertas instantáneas en tu dispositivo sobre <strong>solicitudes de cambio de turno</strong>, <strong>aprobaciones de guardia</strong> y <strong>avisos operacionales</strong>.
        </p>

        {/* Botón de activación o desactivación */}
        {pushStatus === 'granted' ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                triggerLocalTestNotification('AirControl SKBO', '¡Notificaciones push operativas en este dispositivo!');
                alert('Se envió una notificación de prueba. Revisa tu barra de notificaciones.');
              }}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              <Bell size={15} color="var(--accent-cyan)" />
              Probar Notificación
            </button>

            <button
              type="button"
              onClick={async () => {
                setPushLoading(true);
                try {
                  const targetId = currentUser?.id || currentUser?.signature;
                  await disablePushNotifications(targetId);
                  setPushStatus('default');
                  alert('Notificaciones push desactivadas.');
                } catch (e) {
                  alert('Error al desactivar notificaciones: ' + e.message);
                } finally {
                  setPushLoading(false);
                }
              }}
              disabled={pushLoading}
              className="btn btn-danger-outline"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: '700'
              }}
            >
              {pushLoading ? '...' : 'Desactivar'}
            </button>
          </div>
        ) : pushStatus === 'denied' ? (
          <div style={{
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '10px',
            padding: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.4'
          }}>
            ⚠️ Las notificaciones están bloqueadas en tu navegador. Para activarlas, toca el icono de candado o ajustes del sitio junto a la barra de direcciones y cambia el permiso a <strong>"Permitir"</strong>.
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              setPushLoading(true);
              try {
                const targetId = currentUser?.id || currentUser?.signature;
                const res = await requestPushPermission(targetId);
                if (res.success) {
                  setPushStatus('granted');
                  triggerLocalTestNotification('AirControl SKBO', '¡Notificaciones activadas exitosamente!');
                  alert('¡Notificaciones Push activadas con éxito! Ahora recibirás avisos de cambios de turnos y alertas.');
                } else {
                  setPushStatus(getPermissionStatus());
                  alert('Aviso: ' + (res.error || 'No se pudieron activar las notificaciones.'));
                }
              } catch (e) {
                alert('Error al solicitar notificaciones: ' + e.message);
              } finally {
                setPushLoading(false);
              }
            }}
            disabled={pushLoading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.8rem',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <BellRing size={17} />
            {pushLoading ? 'Solicitando permiso...' : '🔔 Activar Notificaciones Push'}
          </button>
        )}

        <div style={{
          borderTop: '1px dashed var(--color-border)',
          paddingTop: '0.55rem',
          marginTop: '0.1rem',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          lineHeight: '1.4'
        }}>
          ℹ️ <strong>En iPhone / iPad:</strong> Requiere que la aplicación esté añadida a la pantalla de inicio (PWA) con iOS 16.4 o superior.
        </div>
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
            justifyContent: 'space-between',
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

      {/* MODAL GUÍA DE SINCRONIZACIÓN ANDROID & GOOGLE CALENDAR */}
      {isAndroidGuideOpen && (
        <div className="bottom-sheet-backdrop" onClick={() => setIsAndroidGuideOpen(false)}>
          <div className="bottom-sheet-modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                <Smartphone size={20} color="var(--accent-cyan)" />
                Sincronización en Android
              </h3>
              <button onClick={() => setIsAndroidGuideOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              
              {/* Opción 1: Descarga Directa (Recomendada para celular) */}
              <div style={{
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '12px',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', color: 'var(--accent-cyan)', fontSize: '0.88rem' }}>
                  <span>⚡</span> Opción 1: Descarga Instantánea (1 Toque)
                </div>

                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Es el método más rápido en Android. Descarga tu horario e impórtalo directamente en tu app de calendario favorita (Samsung Calendar, Google Calendar, Xiaomi, Huawei, Outlook).
                </p>

                <button
                  type="button"
                  onClick={handleDirectDownloadICS}
                  className="btn btn-primary"
                  style={{
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
                  <Download size={16} />
                  Descargar Horario (.ICS)
                </button>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Al descargarse, toca <strong>"Abrir"</strong> en la notificación de tu celular y pulsa <em>"Guardar / Importar todo"</em>.
                </span>
              </div>

              {/* Opción 2: Google Calendar (Automático en la nube) */}
              <div style={{
                background: 'rgba(26, 115, 232, 0.08)',
                border: '1px solid rgba(26, 115, 232, 0.3)',
                borderRadius: '12px',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', color: '#60a5fa', fontSize: '0.88rem' }}>
                  <span>☁️</span> Opción 2: Suscripción Dinámica en Google Calendar
                </div>

                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Google no permite suscribir calendarios por enlace dentro de su app móvil. Debe agregarse a tu cuenta desde la web (una sola vez):
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <strong>Paso 1:</strong>
                    <button
                      type="button"
                      onClick={handleCopyCalendarLink}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Copy size={13} />
                      {copiedWebcal ? '¡Enlace Copiado!' : 'Copiar Enlace'}
                    </button>
                  </div>

                  <div>
                    <strong>Paso 2:</strong> Ve a <a href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontWeight: '700', textDecoration: 'underline' }}>Google Calendar (Desde URL)</a> o ábrelo en tu computador/navegador.
                  </div>

                  <div>
                    <strong>Paso 3:</strong> Pega el enlace en la casilla <em>"URL del calendario"</em> y presiona <strong>"Agregar calendario"</strong>.
                  </div>

                  <div>
                    <strong>Paso 4:</strong> En la app Google Calendar de tu celular: Ve a ⚙️ <em>Ajustes</em> → <em>Tu cuenta</em> → Toca <em>Horario AirControl</em> → Activa <strong>Sincronizar</strong>.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAndroidGuideOpen(false)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.7rem', fontWeight: '700', borderRadius: '10px' }}
              >
                Entendido, cerrar guía
              </button>
            </div>
          </div>
        </div>
      )}

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
