import { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Activity, 
  RefreshCw, 
  ClipboardList, 
  LogOut, 
  User, 
  Check, 
  X, 
  Clock, 
  ArrowRight,
  UserCheck,
  PlaneTakeoff,
  AlertCircle,
  Menu,
  Lock,
  Grid,
  EyeOff
} from 'lucide-react';
import { 
  getSlotAcronym, 
  getSlotDescription, 
  isColombianHoliday, 
  SHIFTS, 
  createEmptyDaySchedule,
  validateAssignment
} from '../utils/schedulerEngine';
import { 
  addRequestDB, 
  deleteRequestDB, 
  addTradeDB, 
  updateTradeDB, 
  deleteTradeDB
} from '../utils/db';
import { auth } from '../utils/firebase';
import { updatePassword } from 'firebase/auth';
import MonthlyGrid from './MonthlyGrid';
import { generateICS, uploadCalendarToStorage } from '../utils/calendarExport';

export default function ControllerPortal({ 
  userEmail, 
  controllers, 
  schedule, 
  exceptions, 
  requests, 
  trades, 
  publishState = {},
  onLogout,
  onUpdateController
}) {
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'radar' | 'trades' | 'requests'

  // Adaptabilidad Móvil
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Estados para Cambio de Contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState(null);
  const [passSuccess, setPassSuccess] = useState(null);

  const [selectedDayActionDate, setSelectedDayActionDate] = useState(null);

  // Estados para Exportación / Sincronización de Calendario
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [includeOps, setIncludeOps] = useState(true);
  const [includeExceptions, setIncludeExceptions] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword.length < 6) {
      setPassError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('Las contraseñas no coinciden.');
      return;
    }

    setPassLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        setPassSuccess('¡Contraseña actualizada con éxito!');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError('No se encontró un usuario autenticado. Por favor, inicia sesión de nuevo.');
      }
    } catch (err) {
      console.error(err);
      let msg = 'Error al actualizar la contraseña.';
      if (err.code === 'auth/requires-recent-login') {
        msg = 'Por seguridad, esta acción requiere que hayas iniciado sesión recientemente. Por favor, cierra sesión e ingresa de nuevo para poder cambiar tu contraseña.';
      } else if (err.message) {
        msg = err.message;
      }
      setPassError(msg);
    } finally {
      setPassLoading(false);
    }
  };
  
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // 1. Identificar a qué controlador corresponde este correo
  const currentController = useMemo(() => {
    return controllers.find(c => c.email && c.email.toLowerCase() === userEmail.toLowerCase());
  }, [controllers, userEmail]);

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const isMonthPublished = publishState && publishState[monthKey];

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Descargar archivo ICS
  const handleDownloadICS = () => {
    if (!currentController) return;
    try {
      const icsContent = generateICS(currentController, currentYear, currentMonth, myMonthlyShifts, { includeOps, includeExceptions });
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `horario_${currentController.name.toLowerCase()}_${currentYear}_${currentMonth + 1}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error al generar el archivo de calendario.');
    }
  };

  // Activar o actualizar la sincronización en la nube
  const handleToggleCloudSync = async () => {
    if (!currentController) return;
    setSyncLoading(true);
    try {
      if (currentController.calendarSyncEnabled) {
        // Desactivar
        await onUpdateController({
          ...currentController,
          calendarSyncEnabled: false,
          calendarSyncUrl: null
        });
      } else {
        // Activar
        const icsContent = generateICS(currentController, currentYear, currentMonth, myMonthlyShifts, { includeOps, includeExceptions });
        const downloadUrl = await uploadCalendarToStorage(currentController.id, icsContent);
        await onUpdateController({
          ...currentController,
          calendarSyncEnabled: true,
          calendarSyncUrl: downloadUrl
        });
      }
    } catch (err) {
      console.error(err);
      alert('Error al gestionar la sincronización de calendario: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // 2. Obtener los turnos asignados a este controlador en el mes activo
  const myMonthlyShifts = useMemo(() => {
    if (!currentController) return {};
    
    const monthlyMap = {};
    const count = getDaysInMonth(currentYear, currentMonth);
    const monthStr = String(currentMonth + 1).padStart(2, '0');

    for (let i = 1; i <= count; i++) {
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
      
      monthlyMap[dateStr] = [];

      // Check exceptions first
      const exc = exceptions[currentController.id]?.[dateStr];
      if (exc && exc !== 'OPERATIVO') {
        monthlyMap[dateStr].push({ type: 'EXCEPTION', status: exc });
      }

      // Check active schedules
      const daySched = schedule[dateStr];
      if (daySched) {
        SHIFTS.forEach(shift => {
          const slots = daySched[shift] || {};
          Object.keys(slots).forEach(slotKey => {
            if (slots[slotKey] === currentController.id) {
              monthlyMap[dateStr].push({ 
                type: 'SHIFT', 
                shift, 
                slotKey,
                acronym: getSlotAcronym(slotKey),
                description: getSlotDescription(slotKey)
              });
            }
          });
        });
      }
    }
    return monthlyMap;
  }, [currentController, currentYear, currentMonth, schedule, exceptions]);

  // Formatear días del mes para grilla de calendario
  const calendarDays = useMemo(() => {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    
    const days = [];
    for (let i = 1; i <= totalDays; i++) {
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
      const dateObj = new Date(dateStr + 'T00:00:00');
      
      days.push({
        dateStr,
        dayNum: i,
        dayOfWeek: dateObj.getDay(), // 0 = Domingo, 1 = Lunes...
        isHoliday: isColombianHoliday(dateStr).isHoliday
      });
    }
    return days;
  }, [currentYear, currentMonth]);

  // Navegación de mes
  const handleNavigateMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const getShortExceptionLabel = (status) => {
    if (status === 'VACACIONES') return 'VAC';
    if (status === 'CAPACITACION') return 'CAPA';
    if (status === 'DESCANSO') return 'DESC';
    if (status === 'NO_OPERATIVO') return 'N/O';
    return status;
  };

  // ==================== RADAR DE TURNO ====================
  const todayStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const todaySchedule = useMemo(() => {
    const daySched = schedule[todayStr];
    if (!daySched) return null;
    return daySched;
  }, [schedule, todayStr]);

  // ==================== TRADES / CAMBIOS DE TURNO ====================
  const [tradeDate, setTradeDate] = useState('');
  const [selectedMyShift, setSelectedMyShift] = useState(''); // "shift|slotKey"
  const [targetControllerId, setTargetControllerId] = useState('');
  const [tradeType, setTradeType] = useState('SWAP'); // 'SWAP' | 'COVER'
  const [selectedColleagueShift, setSelectedColleagueShift] = useState(''); // "shift|slotKey" (para SWAP)

  // Obtener mis turnos reales del día seleccionado en el trade form
  const myShiftsOnSelectedTradeDate = useMemo(() => {
    if (!tradeDate || !currentController || !schedule[tradeDate]) return [];
    
    const list = [];
    SHIFTS.forEach(shift => {
      const slots = schedule[tradeDate][shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === currentController.id) {
          list.push({ shift, slotKey });
        }
      });
    });
    return list;
  }, [tradeDate, currentController, schedule]);

  // Obtener turnos reales del colega en el día seleccionado (para SWAP)
  const colleagueShiftsOnSelectedTradeDate = useMemo(() => {
    if (!tradeDate || !targetControllerId || !schedule[tradeDate] || tradeType !== 'SWAP' || !currentController) return [];
    
    const list = [];
    SHIFTS.forEach(shift => {
      const slots = schedule[tradeDate][shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === targetControllerId) {
          list.push({ shift, slotKey });
        }
      });
    });

    return list.filter(s => {
      const posB = s.slotKey.split('-')[0];
      if (posB === 'ENT') {
        return !!currentController.trainingPreferred;
      }
      return currentController.skills && currentController.skills.includes(posB);
    });
  }, [tradeDate, targetControllerId, schedule, tradeType, currentController]);

  // Filtrar controladores activos para el dropdown excluyendo a mí mismo
  const availableColleagues = useMemo(() => {
    if (!currentController) return [];
    let list = controllers.filter(c => c.active && c.id !== currentController.id);

    if (selectedMyShift) {
      const parts = selectedMyShift.split('|');
      const keyA = parts[1] || parts[0];
      const posA = keyA.split('-')[0];
      
      list = list.filter(c => {
        if (posA === 'ENT') {
          return !!c.trainingPreferred;
        }
        return c.skills && c.skills.includes(posA);
      });
    }
    return list;
  }, [controllers, currentController, selectedMyShift]);

  // Enviar propuesta de cambio a un colega (Fase 1 de Aprobación)
  const handleProposeTrade = async (e) => {
    e.preventDefault();
    if (!tradeDate || !currentController || !targetControllerId || !selectedMyShift) return;
    if (tradeType === 'SWAP' && !selectedColleagueShift) return;

    const [myShift, myKey] = selectedMyShift.split('|');
    let collShift = '';
    let collKey = '';
    
    if (tradeType === 'SWAP') {
      const parts = selectedColleagueShift.split('|');
      collShift = parts[0];
      collKey = parts[1];
    }

    // Validar habilidades de B para el slot de A
    const posA = myKey.split('-')[0];
    const colleague = controllers.find(c => c.id === targetControllerId);
    if (!colleague) return;

    if (posA === 'ENT') {
      if (!colleague.trainingPreferred) {
        alert('El compañero no está habilitado para entrenamiento.');
        return;
      }
    } else if (!colleague.skills || !colleague.skills.includes(posA)) {
      alert(`El compañero no tiene la habilitación requerida (${posA}) para cubrir tu turno.`);
      return;
    }

    // Validar habilidades de A para el slot de B (SWAP)
    if (tradeType === 'SWAP') {
      const posB = collKey.split('-')[0];
      if (posB === 'ENT') {
        if (!currentController.trainingPreferred) {
          alert('No estás habilitado para entrenamiento.');
          return;
        }
      } else if (!currentController.skills || !currentController.skills.includes(posB)) {
        alert(`No tienes la habilitación requerida (${posB}) para cubrir el turno de tu compañero.`);
        return;
      }
    }

    const newTrade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: tradeDate,
      type: tradeType,
      fromControllerId: currentController.id,
      toControllerId: targetControllerId,
      fromSlot: { shift: myShift, slotKey: myKey },
      toSlot: tradeType === 'SWAP' ? { shift: collShift, slotKey: collKey } : null,
      status: 'PENDIENTE_ACEPTACION' // Creada, esperando que el colega (B) acepte
    };

    await addTradeDB(newTrade);
    alert('Propuesta enviada exitosamente a tu compañero. Aparecerá en su portal para aceptación.');

    // Resetear form
    setTradeDate('');
    setSelectedMyShift('');
    setTargetControllerId('');
    setSelectedColleagueShift('');
  };

  // Filtrar solicitudes enviadas por mí
  const mySentTrades = useMemo(() => {
    if (!currentController) return [];
    return trades.filter(t => t.fromControllerId === currentController.id && t.type !== 'COVER_SETTLE');
  }, [trades, currentController]);

  // Filtrar solicitudes recibidas de colegas (esperando que yo las acepte o rechace)
  const myReceivedTrades = useMemo(() => {
    if (!currentController) return [];
    return trades.filter(t => t.toControllerId === currentController.id && t.status === 'PENDIENTE_ACEPTACION');
  }, [trades, currentController]);

  // Aceptar propuesta de colega (Ejecuta el cambio DIRECTAMENTE sin intervención del admin)
  const handleAcceptColleagueTrade = async (trade) => {
    try {
      const dateStr = trade.date;
      
      // Obtener el schedule del día desde el prop 'schedule' (o crear vacío)
      const daySched = schedule[dateStr] ? JSON.parse(JSON.stringify(schedule[dateStr])) : createEmptyDaySchedule(dateStr);

      // --- VALIDACIÓN DE LICENCIAS Y REGLAS DE TRANSCIÓN ---
      const testSchedule = { [dateStr]: daySched };
      let warnings = [];

      const ctrlA = controllers.find(c => c.id === trade.fromControllerId);
      const ctrlB = controllers.find(c => c.id === trade.toControllerId);

      if (trade.type === 'SWAP') {
        const fromShift = trade.fromSlot.shift;
        const fromSlotKey = trade.fromSlot.slotKey;
        const toShift = trade.toSlot.shift;
        const toSlotKey = trade.toSlot.slotKey;

        // Validar que sigan perteneciendo a los controladores
        if (daySched[fromShift]?.[fromSlotKey] !== trade.fromControllerId) {
          alert('El turno original propuesto ya no pertenece a tu compañero.');
          return;
        }
        if (daySched[toShift]?.[toSlotKey] !== trade.toControllerId) {
          alert('Tu turno de destino ya no pertenece a tu ficha en la programación actual.');
          return;
        }

        // Simular intercambio
        daySched[fromShift][fromSlotKey] = trade.toControllerId;
        daySched[toShift][toSlotKey] = trade.fromControllerId;

        // Validar para A
        const valA = validateAssignment(trade.fromControllerId, dateStr, toShift, toSlotKey, testSchedule, controllers, exceptions);
        if (!valA.isValid) {
          warnings.push(`[${ctrlA?.name || trade.fromControllerId}]: ${valA.error}`);
        }

        // Validar para B
        const valB = validateAssignment(trade.toControllerId, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
        if (!valB.isValid) {
          warnings.push(`[${ctrlB?.name || trade.toControllerId}]: ${valB.error}`);
        }
      } else if (trade.type === 'COVER') {
        const fromShift = trade.fromSlot.shift;
        const fromSlotKey = trade.fromSlot.slotKey;

        // Validar que siga perteneciendo a A
        if (daySched[fromShift]?.[fromSlotKey] !== trade.fromControllerId) {
          alert('El turno original propuesto ya no pertenece a tu compañero.');
          return;
        }

        // Simular reemplazo
        daySched[fromShift][fromSlotKey] = trade.toControllerId;

        // Validar para B
        const valB = validateAssignment(trade.toControllerId, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
        if (!valB.isValid) {
          warnings.push(`[${ctrlB?.name || trade.toControllerId}]: ${valB.error}`);
        }
      }

      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Se han detectado advertencias / conflictos de fatiga en la programación para esta solicitud:\n\n` +
          warnings.map(w => `• ${w}`).join('\n') +
          `\n\n¿Desean forzar la aplicación del cambio de todas formas?`
        );
        if (!proceed) return;
      }

      // Validar habilitaciones de B para el slot de A
      const posA = trade.fromSlot.slotKey.split('-')[0];
      if (posA === 'ENT') {
        if (!ctrlB.trainingPreferred) {
          alert('No estás habilitado para entrenamiento.');
          return;
        }
      } else if (!ctrlB.skills || !ctrlB.skills.includes(posA)) {
        alert(`No tienes la habilitación requerida (${posA}) para cubrir este turno.`);
        return;
      }

      // Validar habilitaciones de A para el slot de B (SWAP)
      if (trade.type === 'SWAP') {
        const posB = trade.toSlot.slotKey.split('-')[0];
        if (posB === 'ENT') {
          if (!ctrlA.trainingPreferred) {
            alert('Tu compañero no está habilitado para entrenamiento.');
            return;
          }
        } else if (!ctrlA.skills || !ctrlA.skills.includes(posB)) {
          alert(`Tu compañero no tiene la habilitación requerida (${posB}) para cubrir tu turno.`);
          return;
        }
      }

      // Actualizar estado del trade a PENDIENTE_APROBACION en Firestore (para revisión de admin/supervisor)
      const updated = {
        ...trade,
        status: 'PENDIENTE_APROBACION'
      };
      await updateTradeDB(updated);
      alert('¡El cambio ha sido acordado por ambos controladores y enviado al administrador/supervisor para su aprobación final!');
    } catch (err) {
      console.error(err);
      alert('Error al aplicar el cambio: ' + err.message);
    }
  };

  // Rechazar propuesta de colega (se borra o cancela)
  const handleRejectColleagueTrade = async (tradeId) => {
    if (window.confirm('¿Está seguro de que desea rechazar esta propuesta de cambio de tu compañero?')) {
      await deleteTradeDB(tradeId);
      alert('Propuesta rechazada y eliminada.');
    }
  };

  // Cancelar una propuesta que yo envié
  const handleCancelSentTrade = async (tradeId) => {
    if (window.confirm('¿Desea cancelar esta propuesta de cambio enviada?')) {
      await deleteTradeDB(tradeId);
      alert('Propuesta cancelada.');
    }
  };

  // ==================== PETICIONES ESPECIALES ====================
  const [requestDate, setRequestDate] = useState('');
  const [requestShift, setRequestShift] = useState('Cualquiera');
  const [requestPosition, setRequestPosition] = useState('Cualquiera');

  // Enviar petición especial
  const handleAddRequest = async (e) => {
    e.preventDefault();
    if (!requestDate || !currentController) return;

    const newReq = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      controllerId: currentController.id,
      date: requestDate,
      shift: requestShift,
      position: requestPosition
    };

    await addRequestDB(newReq);
    alert('Petición especial enviada con éxito al administrador.');
    
    // Resetear form
    setRequestDate('');
    setRequestShift('Cualquiera');
    setRequestPosition('Cualquiera');
  };

  // Filtrar mis peticiones especiales
  const myRequests = useMemo(() => {
    if (!currentController) return [];
    return requests.filter(r => r.controllerId === currentController.id);
  }, [requests, currentController]);

  const handleDeleteRequest = async (id) => {
    if (window.confirm('¿Deseas cancelar esta petición especial?')) {
      await deleteRequestDB(id);
    }
  };

  if (!currentController) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-primary)',
        color: 'white',
        fontFamily: 'var(--font-heading)',
        gap: '1rem',
        padding: '1.5rem',
        textAlign: 'center'
      }}>
        <AlertCircle size={48} style={{ color: 'var(--status-danger)' }} />
        <h2>Error de Ficha ATC</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px' }}>
          Tu correo electrónico **{userEmail}** no está asociado a ningún controlador autorizado en la base de datos de Eldorado. 
          Contacta con el Administrador para que registre tu correo en tu ficha.
        </p>
        <button onClick={onLogout} className="btn btn-danger-outline" style={{ marginTop: '1rem' }}>
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', width: '100vw' }}>
      
      {/* Cabecera Móvil Fija */}
      <header className="mobile-header">
        <div className="mobile-header-brand">
          <div className="brand-logo">
            <PlaneTakeoff size={18} />
          </div>
          <h2>AirControl</h2>
        </div>
        <button 
          className="mobile-menu-toggle" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Abrir menú"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Overlay del menú móvil */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Responsive para Controlador */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div>
          <div className="brand">
            <div className="brand-logo">
              <PlaneTakeoff size={22} />
            </div>
            <h2>AirControl</h2>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--color-border)',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <User size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {currentController.name}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Licencia: {currentController.id}
              </span>
            </div>
          </div>

          <nav>
            <ul className="nav-links">
              <li className={`nav-item ${activeTab === 'roster' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('roster')}>
                  <CalendarIcon size={18} />
                  Mi Cronograma
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'radar' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('radar')}>
                  <Activity size={18} />
                  Radar de Turno
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'trades' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('trades')}>
                  <RefreshCw size={18} />
                  Cambios de Turno
                  {myReceivedTrades.length > 0 && (
                    <span style={{
                      fontSize: '0.65rem',
                      backgroundColor: 'var(--status-warning)',
                      color: 'black',
                      fontWeight: '800',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      marginLeft: '0.35rem'
                    }}>
                      {myReceivedTrades.length}
                    </span>
                  )}
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'monthlyGrid' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('monthlyGrid')}>
                  <Grid size={18} />
                  Malla del Mes
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('requests')}>
                  <ClipboardList size={18} />
                  Mis Peticiones
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('security')}>
                  <Lock size={18} />
                  Cambiar Contraseña
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="sidebar-footer">
          <button 
            onClick={onLogout} 
            className="btn btn-danger-outline" 
            style={{ width: '100%', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700' }}
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Encabezado */}
        <header className="page-header">
          <div className="header-title">
            {activeTab === 'roster' && (
              <>
                <h1>Mi Cronograma de Turnos</h1>
                <p>Visualiza tus asignaciones, descansos y excepciones del mes calendario en tiempo real.</p>
              </>
            )}
            {activeTab === 'radar' && (
              <>
                <h1>Radar Operativo de Eldorado</h1>
                <p>Consulta qué controladores y posiciones están activos en Eldorado SKBO el día de hoy.</p>
              </>
            )}
            {activeTab === 'trades' && (
              <>
                <h1>Cambios y Coberturas de Turnos</h1>
                <p>Propón intercambios a tus colegas o gestiona las solicitudes que has recibido.</p>
              </>
            )}
            {activeTab === 'monthlyGrid' && (
              <>
                <h1>Malla Completa del Mes</h1>
                <p>Visualiza el cuadrante mensual completo de Eldorado SKBO para coordinar turnos o cambios de secuencia con tus compañeros.</p>
              </>
            )}
            {activeTab === 'requests' && (
              <>
                <h1>Mis Peticiones Especiales</h1>
                <p>Gestiona tus solicitudes de turnos preferentes o descansos para las programaciones futuras.</p>
              </>
            )}
            {activeTab === 'security' && (
              <>
                <h1>Seguridad y Credenciales</h1>
                <p>Actualiza la contraseña de acceso a tu portal personal de AirControl.</p>
              </>
            )}
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--color-border)',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            fontFamily: 'var(--font-heading)',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            <UserCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Portal del Controlador</span>
          </div>
        </header>

        {/* Tab 1: MI ROSTER / CALENDARIO */}
        {activeTab === 'roster' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={20} style={{ color: 'var(--accent-cyan)' }} />
                <span>Mes de {monthNames[currentMonth]} {currentYear}</span>
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsExportModalOpen(true)} 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '0.4rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <CalendarIcon size={14} />
                  Sincronizar Calendario
                </button>
                <button onClick={() => handleNavigateMonth('prev')} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem' }}>
                  Atrás
                </button>
                <button onClick={() => handleNavigateMonth('next')} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem' }}>
                  Siguiente
                </button>
              </div>
            </div>

            {isMonthPublished ? (
              <>
                {/* Calendario Grid */}
                <div 
                  className="portal-calendar-headers"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '0.5rem',
                    textAlign: 'center',
                    marginBottom: '0.5rem'
                  }}
                >
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                    <div key={d} style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.5rem 0' }}>
                      {d}
                    </div>
                  ))}
                </div>

                <div 
                  className="portal-calendar-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '0.5rem',
                    minHeight: '380px'
                  }}
                >
                  {/* Espacios vacíos antes del primer día del mes */}
                  {Array.from({ length: calendarDays[0]?.dayOfWeek || 0 }).map((_, idx) => (
                    <div key={`empty-${idx}`} style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.02)', borderRadius: '12px' }} />
                  ))}

                  {/* Días del mes */}
                  {calendarDays.map((day) => {
                    const shifts = myMonthlyShifts[day.dateStr] || [];
                    const hasShift = shifts.some(s => s.type === 'SHIFT');
                    const hasException = shifts.some(s => s.type === 'EXCEPTION');
                    
                    let cardBg = 'rgba(255,255,255,0.02)';
                    let borderCol = 'var(--color-border)';
                    let glowShadow = 'none';

                    if (hasException) {
                      const excStatus = shifts.find(s => s.type === 'EXCEPTION').status;
                      cardBg = excStatus === 'VACACIONES' ? 'rgba(6, 182, 212, 0.05)' : 'rgba(244, 63, 94, 0.05)';
                      borderCol = excStatus === 'VACACIONES' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(244, 63, 94, 0.25)';
                    } else if (hasShift) {
                      cardBg = 'rgba(99, 102, 241, 0.04)';
                      borderCol = 'rgba(99, 102, 241, 0.3)';
                      glowShadow = '0 0 10px rgba(99, 102, 241, 0.05)';
                    }

                    return (
                      <div 
                        key={day.dateStr}
                        className="portal-calendar-day-card"
                        onClick={() => setSelectedDayActionDate(day.dateStr)}
                        style={{
                          backgroundColor: cardBg,
                          border: `1px solid ${borderCol}`,
                          boxShadow: glowShadow,
                          borderRadius: '12px',
                          padding: '0.65rem 0.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '80px',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                        title="Presiona para proponer cambios o registrar peticiones para este día"
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: '700', 
                            color: day.isHoliday || day.dayOfWeek === 0 ? 'var(--status-danger)' : 'var(--text-primary)' 
                          }}>
                            {day.dayNum}
                          </span>
                          {day.isHoliday && (
                            <span style={{ fontSize: '0.55rem', color: 'var(--status-danger)', fontWeight: '800', lineHeight: 1 }}>FEST</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.4rem' }}>
                          {shifts.map((s, idx) => {
                            if (s.type === 'EXCEPTION') {
                              return (
                                <span key={idx} style={{
                                  fontSize: '0.65rem',
                                  backgroundColor: s.status === 'VACACIONES' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                  color: s.status === 'VACACIONES' ? 'var(--accent-cyan)' : 'var(--status-danger)',
                                  padding: '0.15rem 0.25rem',
                                  borderRadius: '4px',
                                  fontWeight: '700'
                                }}>
                                  {getShortExceptionLabel(s.status)}
                                </span>
                              );
                            } else {
                              return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                    color: 'var(--accent-indigo)',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '6px',
                                    fontWeight: '800',
                                    width: '100%'
                                  }}>
                                    Turno {s.shift}
                                  </span>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontWeight: '600' }}>
                                    {s.acronym} · {s.description}
                                  </span>
                                </div>
                              );
                            }
                          })}

                          {shifts.length === 0 && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                              fontWeight: '500'
                            }}>
                              {day.dayOfWeek === 0 || day.isHoliday ? 'LIBRE' : 'DESCANSO'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                backgroundColor: 'rgba(244, 63, 94, 0.02)',
                border: '1px dashed rgba(244, 63, 94, 0.15)',
                borderRadius: '16px',
                textAlign: 'center',
                marginTop: '1rem',
                gap: '1.25rem'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--status-danger)'
                }}>
                  <EyeOff size={32} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    Roster en Planificación
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                    El cuadrante de turnos para {monthNames[currentMonth]} {currentYear} se encuentra actualmente en borrador y no ha sido publicado oficialmente por la administración.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: MALLA COMPLETA DEL MES */}
        {activeTab === 'monthlyGrid' && (
          <div className="glass-panel" style={{ padding: '1.5rem', overflow: 'hidden', width: '100%' }}>
            {isMonthPublished ? (
              <MonthlyGrid 
                schedule={schedule}
                controllers={controllers}
                exceptions={exceptions}
                publishState={publishState}
                readOnly={true}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                backgroundColor: 'rgba(244, 63, 94, 0.02)',
                border: '1px dashed rgba(244, 63, 94, 0.15)',
                borderRadius: '16px',
                textAlign: 'center',
                gap: '1.25rem'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--status-danger)'
                }}>
                  <EyeOff size={32} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    Malla en Planificación
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                    La malla global para {monthNames[currentMonth]} {currentYear} se encuentra en borrador y no está publicada oficialmente.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: RADAR OPERATIVO HOY */}
        {activeTab === 'radar' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={22} style={{ color: 'var(--accent-cyan)' }} />
                <span>Radar SKBO Eldorado · Hoy: {todayStr}</span>
              </h2>
            </div>

            {todaySchedule ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {SHIFTS.map(shift => {
                  const slots = todaySchedule[shift] || {};
                  const activeAssignments = Object.keys(slots).filter(k => slots[k] !== null);
                  
                  return (
                    <div 
                      key={shift}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '16px',
                        padding: '1.25rem'
                      }}
                    >
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: 'var(--accent-indigo)' }}>
                        <Clock size={16} /> Turno {shift === 'A' ? 'Madrugada (A)' : shift === 'M' ? 'Mañana (M)' : shift === 'T' ? 'Tarde (T)' : 'Noche (N)'}
                      </h4>

                      {activeAssignments.length > 0 ? (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.75rem'
                        }}>
                          {activeAssignments.map(slotKey => {
                            const ctrlId = slots[slotKey];
                            const ctrl = controllers.find(c => c.id === ctrlId);
                            const acronym = getSlotAcronym(slotKey);
                            const desc = getSlotDescription(slotKey);
                            const isMe = ctrlId === currentController.id;
                            
                            return (
                              <div 
                                key={slotKey}
                                style={{
                                  backgroundColor: isMe ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-secondary)',
                                  border: isMe ? '1px solid var(--accent-cyan)' : '1px solid var(--color-border)',
                                  borderRadius: '10px',
                                  padding: '0.75rem'
                                }}
                              >
                                <span style={{
                                  fontSize: '0.65rem',
                                  backgroundColor: isMe ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                                  color: isMe ? 'black' : 'var(--text-secondary)',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  fontWeight: '800'
                                }}>
                                  {acronym}
                                </span>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700', marginTop: '0.4rem', color: 'var(--text-primary)' }}>
                                  {ctrl?.name || 'Controlador'} {isMe && '(Tú)'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  {desc}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                          No hay personal programado en este turno hoy.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '3rem' }}>
                <Activity size={32} />
                <p style={{ fontWeight: '500', fontSize: '1.05rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                  Sin programación para el día de hoy
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  El administrador no ha programado el radar operativo para el día de hoy en Eldorado.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: GESTIÓN DE CAMBIOS DE TURNO */}
        {activeTab === 'trades' && (
          <div className="dashboard-grid">
            
            {/* Columna Izquierda: Formulario de Solicitud */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div className="glass-panel">
                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontSize: '1.15rem' }}>Proponer Cambio a un Compañero</h3>
                </div>

                <form onSubmit={handleProposeTrade} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  <div className="form-group">
                    <label>Tipo de Cambio</label>
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTradeType('SWAP');
                          setSelectedColleagueShift('');
                        }}
                        className={`filter-btn ${tradeType === 'SWAP' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: '700' }}
                      >
                        Intercambio (SWAP)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTradeType('COVER');
                          setSelectedColleagueShift('');
                        }}
                        className={`filter-btn ${tradeType === 'COVER' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: '700' }}
                      >
                        Reemplazo (COVER)
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="trade-date">Fecha del Cambio</label>
                    <input
                      id="trade-date"
                      type="date"
                      className="form-input"
                      value={tradeDate}
                      onChange={(e) => {
                        setTradeDate(e.target.value);
                        setSelectedMyShift('');
                        setSelectedColleagueShift('');
                      }}
                      required
                    />
                  </div>

                  {tradeDate && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                      <label htmlFor="my-trade-slot" style={{ color: 'var(--accent-cyan)' }}>Mi Turno Programado:</label>
                      {myShiftsOnSelectedTradeDate.length > 0 ? (
                        <select
                          id="my-trade-slot"
                          className="form-input"
                          value={selectedMyShift}
                          onChange={(e) => setSelectedMyShift(e.target.value)}
                          required
                          style={{ borderColor: 'var(--accent-cyan)' }}
                        >
                          <option value="">-- Selecciona tu turno a ceder --</option>
                          {myShiftsOnSelectedTradeDate.map(s => (
                            <option key={`${s.shift}|${s.slotKey}`} value={`${s.shift}|${s.slotKey}`}>
                              {s.shift === 'A' ? 'Madrugada (A)' : s.shift === 'M' ? 'Mañana (M)' : s.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} - {getSlotAcronym(s.slotKey)} ({getSlotDescription(s.slotKey)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', margin: 0, fontStyle: 'italic' }}>
                          * No tienes turnos programados en Eldorado en esta fecha.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="target-colleague">Compañero Destinatario</label>
                    <select
                      id="target-colleague"
                      className="form-input"
                      value={targetControllerId}
                      onChange={(e) => {
                        setTargetControllerId(e.target.value);
                        setSelectedColleagueShift('');
                      }}
                      required
                      disabled={!tradeDate || myShiftsOnSelectedTradeDate.length === 0}
                    >
                      <option value="">-- Selecciona al Compañero --</option>
                      {availableColleagues.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {tradeType === 'SWAP' && tradeDate && targetControllerId && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                      <label htmlFor="colleague-trade-slot" style={{ color: 'var(--accent-indigo)' }}>Turno de mi Compañero a recibir:</label>
                      {colleagueShiftsOnSelectedTradeDate.length > 0 ? (
                        <select
                          id="colleague-trade-slot"
                          className="form-input"
                          value={selectedColleagueShift}
                          onChange={(e) => setSelectedColleagueShift(e.target.value)}
                          required
                          style={{ borderColor: 'var(--accent-indigo)' }}
                        >
                          <option value="">-- Selecciona el turno que recibirás --</option>
                          {colleagueShiftsOnSelectedTradeDate.map(s => (
                            <option key={`${s.shift}|${s.slotKey}`} value={`${s.shift}|${s.slotKey}`}>
                              {s.shift === 'A' ? 'Madrugada (A)' : s.shift === 'M' ? 'Mañana (M)' : s.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} - {getSlotAcronym(s.slotKey)} ({getSlotDescription(s.slotKey)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', margin: 0, fontStyle: 'italic' }}>
                          * Tu compañero no tiene turnos programados hoy para realizar un SWAP.
                        </p>
                      )}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '0.7rem', marginTop: '0.5rem', fontWeight: '700' }}
                    disabled={!tradeDate || !targetControllerId || !selectedMyShift || (tradeType === 'SWAP' && !selectedColleagueShift)}
                  >
                    Enviar Propuesta
                  </button>
                </form>
              </div>

            </div>

            {/* Columna Derecha: Recibidas y Enviadas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Solicitudes Recibidas (Etapa 1: Aprobación del Colega) */}
              <div className="glass-panel">
                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserCheck size={20} style={{ color: 'var(--status-warning)' }} />
                  <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Propuestas Recibidas de Colegas
                    <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                      {myReceivedTrades.length}
                    </span>
                  </h3>
                </div>

                {myReceivedTrades.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {myReceivedTrades.map(t => {
                      const sender = controllers.find(c => c.id === t.fromControllerId);
                      
                      return (
                        <div 
                          key={t.id}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            animation: 'fadeIn 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={{
                              fontWeight: '800',
                              backgroundColor: t.type === 'SWAP' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: t.type === 'SWAP' ? 'var(--accent-cyan)' : 'var(--accent-fic)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px'
                            }}>
                              {t.type === 'SWAP' ? 'INTERCAMBIO (SWAP)' : 'REEMPLAZO (COVER)'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>
                              Fecha: {t.date}
                            </span>
                          </div>

                          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0.2rem 0', lineHeight: '1.4' }}>
                            {t.type === 'SWAP' ? (
                              <>
                                <strong>{sender?.name || t.fromControllerId}</strong> te propone intercambiar su turno de <em>{t.fromSlot.shift} ({getSlotAcronym(t.fromSlot.slotKey)})</em> por tu turno de <em>{t.toSlot.shift} ({getSlotAcronym(t.toSlot.slotKey)})</em>.
                              </>
                            ) : (
                              <>
                                <strong>{sender?.name || t.fromControllerId}</strong> te solicita que le cubras su turno de <em>{t.fromSlot.shift} ({getSlotAcronym(t.fromSlot.slotKey)})</em>.
                              </>
                            )}
                          </p>

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button
                              onClick={() => handleAcceptColleagueTrade(t)}
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                            >
                              <Check size={14} /> Aceptar y Enviar a Admin
                            </button>
                            <button
                              onClick={() => handleRejectColleagueTrade(t.id)}
                              className="btn btn-danger-outline"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <X size={14} /> Rechazar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', margin: '1rem 0' }}>
                    No tienes solicitudes de compañeros pendientes.
                  </p>
                )}
              </div>

              {/* Solicitudes Enviadas por Mí */}
              <div className="glass-panel">
                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={20} style={{ color: 'var(--accent-indigo)' }} />
                  <h3 style={{ fontSize: '1.15rem' }}>Mis Propuestas Enviadas</h3>
                </div>

                {mySentTrades.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
                    {mySentTrades.map(t => {
                      const receiver = controllers.find(c => c.id === t.toControllerId);
                      
                      let statusText = 'Esperando Compañero';
                      let statusColor = 'var(--status-warning)';
                      
                      if (t.status === 'PENDIENTE_APROBACION') {
                        statusText = 'Aceptada por Compañero (Esperando Admin)';
                        statusColor = 'var(--accent-cyan)';
                      } else if (t.status === 'APROBADO') {
                        statusText = 'Aprobado';
                        statusColor = 'var(--status-success)';
                      }

                      return (
                        <div 
                          key={t.id}
                          style={{
                            borderLeft: `3px solid ${statusColor}`,
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid var(--color-border)',
                            borderLeftWidth: '3px',
                            borderRadius: '8px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: '700' }}>{t.type} · {t.date}</span>
                            <span style={{ color: statusColor, fontWeight: '800' }}>{statusText}</span>
                          </div>

                          <div style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              Propuesta a: <strong>{receiver?.name || t.toControllerId}</strong> ({t.fromSlot.shift} {getSlotAcronym(t.fromSlot.slotKey)})
                            </span>
                            {t.status === 'PENDIENTE_ACEPTACION' && (
                              <button
                                onClick={() => handleCancelSentTrade(t.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--status-danger)',
                                  cursor: 'pointer',
                                  padding: '0.2rem'
                                }}
                                title="Cancelar Propuesta"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', margin: '1rem 0' }}>
                    No has propuesto ningún cambio este mes.
                  </p>
                )}
              </div>

            </div>

          </div>
        )}

        {/* Tab 4: MIS PETICIONES ESPECIALES */}
        {activeTab === 'requests' && (
          <div className="dashboard-grid">
            
            {/* Formulario */}
            <div className="glass-panel" style={{ height: 'fit-content' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={20} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.15rem' }}>Enviar Petición Especial</h3>
              </div>

              <form onSubmit={handleAddRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label htmlFor="req-date">Fecha Solicitada</label>
                  <input
                    id="req-date"
                    type="date"
                    className="form-input"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="req-shift">Turno Preferente</label>
                  <select
                    id="req-shift"
                    className="form-input"
                    value={requestShift}
                    onChange={(e) => setRequestShift(e.target.value)}
                  >
                    <option value="Cualquiera">Cualquiera</option>
                    <option value="M">Mañana (M)</option>
                    <option value="T">Tarde (T)</option>
                    <option value="N">Noche (N)</option>
                    <option value="A">Madrugada (A)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="req-pos">Posición Solicitada</label>
                  <select
                    id="req-pos"
                    className="form-input"
                    value={requestPosition}
                    onChange={(e) => setRequestPosition(e.target.value)}
                  >
                    <option value="Cualquiera">Cualquiera</option>
                    {(currentController.skills || []).map(skill => (
                      <option key={skill} value={skill}>{getSlotDescription(`${skill}-1`).split(' ')[0]} ({skill})</option>
                    ))}
                    {currentController.trainingPreferred && (
                      <option value="ENT">Entrenamiento (ENT)</option>
                    )}
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontWeight: '700' }}
                  disabled={!requestDate}
                >
                  Registrar Petición
                </button>
              </form>
            </div>

            {/* Listado */}
            <div className="glass-panel" style={{ height: 'fit-content' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={20} style={{ color: 'var(--accent-indigo)' }} />
                <h3 style={{ fontSize: '1.15rem' }}>Mis Peticiones Registradas</h3>
              </div>

              {myRequests.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {myRequests.map(r => (
                    <div 
                      key={r.id}
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {r.date}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Turno: <strong style={{ color: 'var(--accent-cyan)' }}>{r.shift}</strong> · Posición: <strong style={{ color: 'var(--accent-indigo)' }}>{r.position}</strong>
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteRequest(r.id)}
                        className="btn btn-danger-outline btn-icon-only"
                        style={{ padding: '0.35rem' }}
                        title="Cancelar Petición"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', margin: '2rem 0' }}>
                  No tienes peticiones especiales registradas en Eldorado para este periodo.
                </p>
              )}
            </div>

          </div>
        )}
        {/* Tab 5: SEGURIDAD Y CREDENCIALES */}
        {activeTab === 'security' && (
          <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={20} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.15rem' }}>Actualizar Contraseña</h3>
              </div>

              {passSuccess && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  color: 'var(--status-success)',
                  fontSize: '0.82rem',
                  fontWeight: '500',
                  marginBottom: '1rem'
                }}>
                  <Check size={16} style={{ flexShrink: 0 }} />
                  <span>{passSuccess}</span>
                </div>
              )}

              {passError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  color: 'var(--status-danger)',
                  fontSize: '0.82rem',
                  fontWeight: '500',
                  marginBottom: '1rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{passError}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label htmlFor="new-pass">Nueva Contraseña</label>
                  <input
                    id="new-pass"
                    type="password"
                    className="form-input"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={passLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-pass">Confirmar Nueva Contraseña</label>
                  <input
                    id="confirm-pass"
                    type="password"
                    className="form-input"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={passLoading}
                  />
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ⚠️ Por seguridad, si ha pasado mucho tiempo desde que iniciaste sesión, Firebase podría solicitar que vuelvas a ingresar tus credenciales para completar esta acción.
                </p>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontWeight: '700' }}
                  disabled={passLoading}
                >
                  {passLoading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* MODAL DE ACCIONES PARA DÍA ESPECÍFICO */}
      {selectedDayActionDate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '380px',
            width: '90%',
            padding: '2rem',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: '1px solid var(--color-border)',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
                <CalendarIcon size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Fecha: {selectedDayActionDate}</span>
              </h3>
              <button 
                onClick={() => setSelectedDayActionDate(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              ¿Qué tipo de solicitud de cambio o petición operativa deseas realizar para este día?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                onClick={() => {
                  setTradeDate(selectedDayActionDate);
                  setTradeType('SWAP');
                  setSelectedMyShift('');
                  setSelectedColleagueShift('');
                  setActiveTab('trades');
                  setSelectedDayActionDate(null);
                }}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: '700', border: '1px solid rgba(6, 182, 212, 0.15)' }}
              >
                <span>🔄 Proponer Intercambio (SWAP)</span>
                <ArrowRight size={14} style={{ color: 'var(--accent-cyan)' }} />
              </button>

              <button
                onClick={() => {
                  setTradeDate(selectedDayActionDate);
                  setTradeType('COVER');
                  setSelectedMyShift('');
                  setSelectedColleagueShift('');
                  setActiveTab('trades');
                  setSelectedDayActionDate(null);
                }}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: '700', border: '1px solid rgba(99, 102, 241, 0.15)' }}
              >
                <span>🙋 Solicitar Reemplazo (COVER)</span>
                <ArrowRight size={14} style={{ color: 'var(--accent-indigo)' }} />
              </button>

              <button
                onClick={() => {
                  setRequestDate(selectedDayActionDate);
                  setActiveTab('requests');
                  setSelectedDayActionDate(null);
                }}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: '700', border: '1px solid rgba(168, 85, 247, 0.15)' }}
              >
                <span>📋 Enviar Petición Especial / Libre</span>
                <ArrowRight size={14} style={{ color: 'var(--accent-purple)' }} />
              </button>
            </div>

            <button
              onClick={() => setSelectedDayActionDate(null)}
              className="btn btn-danger-outline"
              style={{ width: '100%', padding: '0.65rem', fontWeight: '700', marginTop: '0.5rem' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Exportación y Sincronización de Calendario */}
      {isExportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '520px',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              onClick={() => {
                setIsExportModalOpen(false);
                setCopiedLink(false);
              }}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarIcon size={22} style={{ color: 'var(--accent-cyan)' }} />
              <span>Sincronizar Calendario Personal</span>
            </h3>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Lleva tus turnos y estados especiales directamente a tu calendario personal (Google Calendar, iPhone/iCloud, Mac, Outlook).
            </p>

            {/* Opciones de Filtro */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Opciones de Exportación:</strong>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={includeOps}
                  onChange={(e) => setIncludeOps(e.target.checked)}
                />
                <span>Incluir turnos operativos (Madrugada, Mañana, Tarde, Noche)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={includeExceptions}
                  onChange={(e) => setIncludeExceptions(e.target.checked)}
                />
                <span>Incluir estados especiales y descansos (Vacaciones, CMED, TROP, etc.)</span>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Opción A: Descarga Manual */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Opción 1: Exportar archivo local</strong>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDownloadICS}
                  style={{ width: '100%', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                >
                  📥 Descargar Archivo .ICS
                </button>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Descarga el archivo e impórtalo manualmente en tu iPhone, Mac o Google Calendar.
                </span>
              </div>

              {/* Opción B: Suscripción en Tiempo Real */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Opción 2: Sincronización automática en la nube (Suscripción)</strong>
                
                {currentController?.calendarSyncEnabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--status-success)', fontWeight: '600' }}>✓ Sincronización Activa</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                        Cualquier cambio de turno (como swaps o covers) se actualizará en este enlace automáticamente.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                          const icsContent = generateICS(currentController, currentYear, currentMonth, myMonthlyShifts, { includeOps, includeExceptions });
                          setSyncLoading(true);
                          try {
                            const newUrl = await uploadCalendarToStorage(currentController.id, icsContent);
                            await onUpdateController({
                              ...currentController,
                              calendarSyncUrl: newUrl
                            });
                            alert('Sincronización forzada con éxito.');
                          } catch (e) {
                            alert('Error al forzar actualización: ' + e.message);
                          } finally {
                            setSyncLoading(false);
                          }
                        }}
                        disabled={syncLoading}
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                      >
                        {syncLoading ? 'Actualizando...' : '🔄 Forzar Actualización'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-outline"
                        onClick={handleToggleCloudSync}
                        disabled={syncLoading}
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                      >
                        Desactivar
                      </button>
                    </div>

                    {/* Copiar enlace */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Enlace de suscripción para añadir en calendarios:</span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                          type="text"
                          readOnly
                          value={currentController.calendarSyncUrl || ''}
                          className="form-input"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem', flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--color-border)' }}
                          onClick={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            navigator.clipboard.writeText(currentController.calendarSyncUrl || '');
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem' }}
                        >
                          {copiedLink ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <a
                          href={currentController.calendarSyncUrl ? currentController.calendarSyncUrl.replace(/^https:\/\//, 'webcal://') : '#'}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '0.35rem 0.5rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', width: '100%' }}
                        >
                          📅 Suscribirse en iPhone / Mac (Un Clic)
                        </a>
                      </div>
                    </div>

                    {/* Instrucciones */}
                    <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <strong style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>¿Cómo agregarlo a Google Calendar?</strong>
                      <ol style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1rem', padding: 0, lineHeight: 1.4 }}>
                        <li>Copia el enlace de arriba.</li>
                        <li>En Google Calendar web, ve a "Otros calendarios" (+) &gt; "Desde URL".</li>
                        <li>Pega el enlace y haz clic en "Agregar calendario".</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleToggleCloudSync}
                      disabled={syncLoading}
                      style={{ width: '100%', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                    >
                      ☁️ Activar Sincronización en la Nube
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Crea un feed dinámico seguro. Podrás suscribirte desde tu iPhone o Google Calendar y tus turnos se actualizarán solos.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setIsExportModalOpen(false);
                setCopiedLink(false);
              }}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.65rem', fontWeight: '700', marginTop: '0.5rem' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
