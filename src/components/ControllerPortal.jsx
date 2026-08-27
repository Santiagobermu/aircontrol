import { useState, useMemo, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
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
  EyeOff,
  Plus,
  Trash2,
  Radio,
  Bell,
  Shield,
  ShieldCheck,
  Edit2,
  MessageSquare
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
  deleteTradeDB,
  addManualAlertDB,
  deleteManualAlertDB,
  saveScheduleDayDB
} from '../utils/db';
import { auth } from '../utils/firebase';
import { updatePassword } from 'firebase/auth';
import MonthlyGrid from './MonthlyGrid';
import { generateICS, uploadCalendarToStorage, triggerCalendarSyncIfEnabled, getAllShiftsForController } from '../utils/calendarExport';
import { isNotamActiveOnDate, formatNotamDateRange, categorizeNotam, getUtcDateString } from '../utils/notamUtils';

export default function ControllerPortal({ 
  userEmail, 
  controllers, 
  schedule, 
  exceptions, 
  requests, 
  trades, 
  publishState = {},
  userRole = 'controller',
  notamsData = { notams: [], lastUpdated: null, pdfUrl: null },
  manualAlerts = [],
  onLogout,
  onUpdateController,
  onToggleViewMode = null
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

  // Estados y Funcionalidades para NOTAMs y Alertas
  const [syncingNotams, setSyncingNotams] = useState(false);
  const [activeNotamScopeTab, setActiveNotamScopeTab] = useState('skbo'); // 'skbo' | 'ad_clsd' | 'flow' | 'ashtam'
  const todayNotamStr = getUtcDateString(new Date());
  const [notamQueryDateStr, setNotamQueryDateStr] = useState(todayNotamStr);
  const [notamSearchQuery, setNotamSearchQuery] = useState('');
  const [selectedNotamCategory, setSelectedNotamCategory] = useState('ALL');
  
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [newAlertContent, setNewAlertContent] = useState('');
  const [newAlertExpiresAt, setNewAlertExpiresAt] = useState('');

  // Filtrar alertas vigentes en tiempo real y eliminar de Firestore si ya expiraron
  const validManualAlerts = useMemo(() => {
    const now = new Date();
    return (manualAlerts || []).filter(alertItem => {
      if (!alertItem.expiresAt) return true;
      const expDate = new Date(alertItem.expiresAt);
      if (expDate <= now) {
        deleteManualAlertDB(alertItem.id).catch(console.error);
        return false;
      }
      return true;
    });
  }, [manualAlerts]);

  // Verificar periódicamente cada 10s para borrar notas que hayan cumplido su deadline
  useEffect(() => {
    if (!manualAlerts || manualAlerts.length === 0) return;
    const checkExpired = () => {
      const now = new Date();
      manualAlerts.forEach(alertItem => {
        if (alertItem.expiresAt && new Date(alertItem.expiresAt) <= now) {
          deleteManualAlertDB(alertItem.id).catch(console.error);
        }
      });
    };
    checkExpired();
    const interval = setInterval(checkExpired, 10000);
    return () => clearInterval(interval);
  }, [manualAlerts]);

  const handleSyncNotams = async () => {
    setSyncingNotams(true);
    try {
      const res = await fetch('https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/sync_notams_api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Sincronización completa. Se importaron ${data.count} NOTAMs.`);
      } else {
        alert(`Error al sincronizar: ${data.error || 'Respuesta no válida'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error al conectar con el servidor de sincronización.`);
    } finally {
      setSyncingNotams(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!newAlertContent.trim()) return;
    try {
      await addManualAlertDB({
        content: newAlertContent.trim(),
        expiresAt: newAlertExpiresAt ? new Date(newAlertExpiresAt).toISOString() : null,
        createdBy: currentController?.name || 'Supervisor',
        createdByEmail: userEmail
      });
      setNewAlertContent('');
      setNewAlertExpiresAt('');
      setIsAddingAlert(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la alerta local: ' + err.message);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta alerta del turno?')) return;
    try {
      await deleteManualAlertDB(alertId);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la alerta: ' + err.message);
    }
  };

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
    if (tab === 'monthlyGrid') {
      setCurrentMonth(new Date().getMonth());
      setCurrentYear(new Date().getFullYear());
    }
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
        // Activar con todos los meses disponibles
        const allShifts = getAllShiftsForController(currentController, schedule, exceptions);
        const icsContent = generateICS(currentController, allShifts, { includeOps, includeExceptions });
        const downloadUrl = await uploadCalendarToStorage(currentController.id || currentController.signature, icsContent);
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

  // Identificar si el usuario actual es Encargado de turno (CTE / supervisor / admin)
  const isEncargadoDeTurno = useMemo(() => {
    if (userRole === 'admin') return true;
    if (!currentController) return false;
    if (currentController.isSupervisor || currentController.isAdmin) return true;
    if (currentController.skills && currentController.skills.includes('CTE')) return true;

    if (todaySchedule) {
      for (const shift of SHIFTS) {
        const slots = todaySchedule[shift] || {};
        for (const key of Object.keys(slots)) {
          if (key.startsWith('CTE-') && slots[key] === currentController.id) {
            return true;
          }
        }
      }
    }
    return false;
  }, [userRole, currentController, todaySchedule]);

  // Estado del modal de cambio diario de posición (Radar)
  const [radarChangeModal, setRadarChangeModal] = useState({
    isOpen: false,
    shift: null,
    slotKey: null,
    currentCtrlId: null,
    newCtrlId: '',
    comment: ''
  });

  // Orden de jerarquía de posiciones para el Radar: Encargado -> Torres -> Superficie -> Autorizaciones -> FIC -> Otros
  const getPositionOrder = (slotKey) => {
    const prefix = (slotKey || '').split('-')[0].toUpperCase();
    switch (prefix) {
      case 'CTE': return 1; // Encargado
      case 'TWR': return 2; // Torres
      case 'GND': return 3; // Superficie
      case 'DEL': return 4; // Autorizaciones
      case 'FIC': return 5; // FIC
      case 'ACC': return 6;
      case 'SIM': return 7;
      case 'OFI': return 8;
      case 'CAE': return 9;
      case 'CHC':
      case 'CHEC': return 10;
      case 'ENT': return 11;
      case 'INS': return 12;
      default: return 99;
    }
  };

  // Guardar cambio diario de posición y comentario (control de último momento por Encargado de turno)
  const handleSaveRadarChange = async () => {
    const { shift, slotKey, newCtrlId, comment } = radarChangeModal;
    if (!shift || !slotKey) return;
    
    const dateStr = todayStr;
    const updatedDaySched = schedule[dateStr] 
      ? JSON.parse(JSON.stringify(schedule[dateStr])) 
      : createEmptyDaySchedule(dateStr);

    if (!updatedDaySched[shift]) {
      updatedDaySched[shift] = {};
    }
    
    const oldCtrlId = updatedDaySched[shift][slotKey];
    updatedDaySched[shift][slotKey] = newCtrlId || null;

    // Guardar / actualizar comentario del cambio diario
    if (!updatedDaySched._dailyComments) {
      updatedDaySched._dailyComments = {};
    }
    const commentKey = `${shift}|${slotKey}`;
    if (comment && comment.trim()) {
      updatedDaySched._dailyComments[commentKey] = {
        text: comment.trim(),
        by: currentController?.name || 'Encargado',
        at: new Date().toISOString()
      };
    } else {
      delete updatedDaySched._dailyComments[commentKey];
    }

    try {
      await saveScheduleDayDB(dateStr, updatedDaySched);
      
      const parts = dateStr.split('-');
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      if (oldCtrlId) {
        await triggerCalendarSyncIfEnabled(oldCtrlId, controllers, yr, mo, { ...schedule, [dateStr]: updatedDaySched }, exceptions);
      }
      if (newCtrlId && newCtrlId !== oldCtrlId) {
        await triggerCalendarSyncIfEnabled(newCtrlId, controllers, yr, mo, { ...schedule, [dateStr]: updatedDaySched }, exceptions);
      }

      const newCtrlName = controllers.find(c => c.id === newCtrlId)?.name || 'Vacante';
      const acronym = getSlotAcronym(slotKey);
      alert(`Cambio diario registrado: ${newCtrlName} asignado a ${acronym} en el turno ${shift}.`);
      setRadarChangeModal({ isOpen: false, shift: null, slotKey: null, currentCtrlId: null, newCtrlId: '', comment: '' });
    } catch (err) {
      console.error(err);
      alert('Error al guardar el cambio diario de posición: ' + err.message);
    }
  };

  // ==================== TRADES / CAMBIOS DE TURNO ====================
  const [tradeType, setTradeType] = useState('COVER'); // 'COVER' | 'SWAP'
  const [tradeDate, setTradeDate] = useState('');
  const [selectedMyShift, setSelectedMyShift] = useState(''); // "shift|slotKey"
  const [targetControllerId, setTargetControllerId] = useState('OPEN');
  const [selectedColleagueShift, setSelectedColleagueShift] = useState(''); // "shift|slotKey" (para SWAP)
  const [tradeComment, setTradeComment] = useState('');

  // Helper para determinar la habilidad / certificación requerida por una posición
  const getRequiredSkillForSlot = (slotKey, shift) => {
    if (!slotKey) return null;
    const code = slotKey.toUpperCase();
    const acronym = getSlotAcronym(slotKey, shift);

    if (code.startsWith('TWR') || ['LNT', 'LST', 'LPT'].includes(acronym) || code.includes('TWR')) return 'TWR';
    if (code.startsWith('GND') || ['GNT', 'GST', 'GPT'].includes(acronym) || code.includes('GND')) return 'GND';
    if (code.startsWith('DEL') || ['DPT', 'DPR'].includes(acronym) || code.includes('DEL')) return 'DEL';
    if (code.startsWith('FIC') || ['FPT', 'FPR', 'FPA'].includes(acronym) || code.includes('FIC')) return 'FIC';
    if (code.startsWith('CTE') || acronym === 'CTE' || code.includes('CTE')) return 'CTE';
    if (code.startsWith('ACC') || acronym.includes('ACC') || code.includes('ACC')) return 'ACC';
    if (code.startsWith('SIM') || acronym.includes('SIM') || code.includes('SIM')) return 'SIM';
    if (code.startsWith('ENT') || acronym === 'ENT') return 'ENT';
    return null;
  };

  // Helper para verificar si un controlador tiene la certificación requerida
  const isControllerQualified = (ctrl, requiredSkill) => {
    if (!ctrl) return false;
    if (!requiredSkill) return true;
    
    if (requiredSkill === 'ENT') {
      return Boolean(ctrl.trainingPreferred);
    }

    const skills = ctrl.skills || [];
    if (requiredSkill === 'CTE') {
      return Boolean(ctrl.isSupervisor || ctrl.isAdmin || skills.includes('CTE'));
    }
    return skills.includes(requiredSkill) || skills.includes(requiredSkill.toUpperCase());
  };

  // Obtener mis turnos reales del día seleccionado en el trade form
  const myShiftsOnSelectedTradeDate = useMemo(() => {
    if (!tradeDate || !currentController || !schedule[tradeDate]) return [];
    
    const list = [];
    SHIFTS.forEach(shift => {
      const slots = schedule[tradeDate][shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === currentController.id) {
          const reqSkill = getRequiredSkillForSlot(slotKey, shift);
          list.push({ 
            shift, 
            slotKey,
            fullKey: `${shift}|${slotKey}`,
            requiredSkill: reqSkill
          });
        }
      });
    });
    return list;
  }, [tradeDate, currentController, schedule]);

  const selectedMyShiftObj = useMemo(() => {
    if (!selectedMyShift) return null;
    return myShiftsOnSelectedTradeDate.find(s => s.fullKey === selectedMyShift) || null;
  }, [selectedMyShift, myShiftsOnSelectedTradeDate]);

  const requiredSkillForMyShift = selectedMyShiftObj?.requiredSkill || null;

  // Filtrar controladores activos para el dropdown excluyendo a mí mismo y verificando habilitación para mi turno
  const availableColleagues = useMemo(() => {
    if (!currentController) return [];
    let list = controllers.filter(c => c.active !== false && c.id !== currentController.id);

    if (requiredSkillForMyShift) {
      list = list.filter(c => isControllerQualified(c, requiredSkillForMyShift));
    }
    return list;
  }, [controllers, currentController, requiredSkillForMyShift]);

  // Obtener turnos reales del colega en el día seleccionado para los que YO esté habilitado
  const colleagueShiftsOnSelectedTradeDate = useMemo(() => {
    if (!tradeDate || !targetControllerId || targetControllerId === 'OPEN' || tradeType !== 'SWAP' || !schedule[tradeDate] || !currentController) return [];
    
    const list = [];
    SHIFTS.forEach(shift => {
      const slots = schedule[tradeDate][shift] || {};
      Object.keys(slots).forEach(slotKey => {
        if (slots[slotKey] === targetControllerId) {
          const reqSkill = getRequiredSkillForSlot(slotKey, shift);
          list.push({ 
            shift, 
            slotKey,
            fullKey: `${shift}|${slotKey}`,
            requiredSkill: reqSkill
          });
        }
      });
    });

    return list.filter(s => isControllerQualified(currentController, s.requiredSkill));
  }, [tradeDate, targetControllerId, tradeType, schedule, currentController]);

  // Enviar propuesta de SWAP o COVER a un colega o Solicitud Abierta
  const handleProposeTrade = async (e) => {
    e.preventDefault();
    if (!tradeDate || !currentController || !selectedMyShift) {
      alert(tradeType === 'COVER' ? 'Por favor selecciona la fecha y el turno a cubrir.' : 'Por favor selecciona la fecha y tu turno a ceder.');
      return;
    }
    if (tradeType === 'SWAP' && targetControllerId !== 'OPEN' && !selectedColleagueShift) {
      alert('Por favor selecciona el turno del compañero a intercambiar.');
      return;
    }

    const [myShift, myKey] = selectedMyShift.split('|');
    const colleague = targetControllerId !== 'OPEN' ? controllers.find(c => c.id === targetControllerId) : null;
    const targetName = targetControllerId === 'OPEN' ? 'Abierta a cualquier compañero habilitado' : (colleague?.name || targetControllerId);
    const targetSig = targetControllerId === 'OPEN' ? 'OPEN' : (colleague?.signature || colleague?.id || targetControllerId);

    let collShift = '';
    let collKey = '';
    
    if (tradeType === 'SWAP' && targetControllerId !== 'OPEN' && selectedColleagueShift) {
      const parts = selectedColleagueShift.split('|');
      collShift = parts[0];
      collKey = parts[1];
    }

    const newTrade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: tradeDate,
      dateStr: tradeDate,
      type: tradeType, // 'SWAP' | 'COVER'
      fromControllerId: currentController.id,
      fromControllerSignature: currentController.signature || currentController.id,
      requesterSignature: currentController.signature || currentController.id,
      requesterName: currentController.name,
      requesterShift: `${myShift}${getSlotAcronym(myKey, myShift)}`,
      fromSlot: { shift: myShift, slotKey: myKey },
      toControllerId: targetControllerId === 'OPEN' ? 'OPEN' : targetControllerId,
      toControllerSignature: targetSig,
      targetSignature: targetSig,
      targetName: targetName,
      targetShift: tradeType === 'COVER' ? 'Reemplazo' : (targetControllerId === 'OPEN' ? 'Abierta' : (collShift ? `${collShift}${getSlotAcronym(collKey, collShift)}` : 'Por acordar')),
      toSlot: tradeType === 'SWAP' && collShift && collKey ? { shift: collShift, slotKey: collKey } : null,
      isPublic: targetControllerId === 'OPEN',
      comment: tradeComment.trim(),
      status: 'PENDIENTE_ACEPTACION',
      createdAt: new Date().toISOString()
    };

    await addTradeDB(newTrade);
    const typeLabel = tradeType === 'COVER' ? 'COVER' : 'SWAP';
    alert(targetControllerId === 'OPEN' 
      ? `¡Solicitud de ${typeLabel} Abierta publicada exitosamente!` 
      : `¡Propuesta de ${typeLabel} enviada exitosamente a tu compañero!`);

    // Resetear form
    setTradeDate('');
    setSelectedMyShift('');
    setTargetControllerId('OPEN');
    setSelectedColleagueShift('');
    setTradeComment('');
  };

  // Filtrar solicitudes enviadas por mí
  const mySentTrades = useMemo(() => {
    if (!currentController) return [];
    return trades.filter(t => t.fromControllerId === currentController.id && t.type !== 'COVER_SETTLE');
  }, [trades, currentController]);

  // Filtrar solicitudes recibidas de colegas (esperando que yo las acepte o rechace, directas o abiertas)
  const myReceivedTrades = useMemo(() => {
    if (!currentController) return [];
    return trades.filter(t => {
      if (t.status !== 'PENDIENTE_ACEPTACION' && t.status !== 'pending') return false;
      const isDirect = t.toControllerId === currentController.id || (t.targetSignature && t.targetSignature === (currentController.signature || currentController.id));
      const isOpen = Boolean(t.isPublic || t.toControllerId === 'OPEN' || t.targetSignature === 'OPEN') && t.fromControllerId !== currentController.id;
      return isDirect || isOpen;
    });
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
      const isPublic = Boolean(trade.isPublic || trade.toControllerId === 'OPEN' || trade.targetSignature === 'OPEN');
      const ctrlB = isPublic 
        ? currentController 
        : (controllers.find(c => c.id === trade.toControllerId) || currentController);

      let fromSlot = trade.fromSlot;
      let toSlot = trade.toSlot;

      if (trade.type === 'SWAP' && !toSlot) {
        // Encontrar turnos de ctrlB en esta fecha para intercambiar
        const myShiftsOnDate = [];
        SHIFTS.forEach(s => {
          const slots = daySched[s] || {};
          Object.keys(slots).forEach(k => {
            if (slots[k] === ctrlB.id) {
              myShiftsOnDate.push({ shift: s, slotKey: k });
            }
          });
        });

        if (myShiftsOnDate.length === 0) {
          alert('No tienes ningún turno programado en esta fecha para completar el intercambio.');
          return;
        }

        // Buscar un turno para el cual ctrlA esté habilitado
        const compatibleShift = myShiftsOnDate.find(s => {
          const skill = getRequiredSkillForSlot(s.slotKey, s.shift);
          return isControllerQualified(ctrlA, skill);
        }) || myShiftsOnDate[0];

        toSlot = compatibleShift;
      }

      if (trade.type === 'SWAP' && toSlot) {
        const fromShift = fromSlot.shift;
        const fromSlotKey = fromSlot.slotKey;
        const toShift = toSlot.shift;
        const toSlotKey = toSlot.slotKey;

        // Validar que sigan perteneciendo a los controladores
        if (daySched[fromShift]?.[fromSlotKey] !== trade.fromControllerId) {
          alert('El turno original propuesto ya no pertenece a tu compañero.');
          return;
        }
        if (daySched[toShift]?.[toSlotKey] !== ctrlB.id) {
          alert('Tu turno de destino ya no pertenece a tu ficha en la programación actual.');
          return;
        }

        // Simular intercambio
        daySched[fromShift][fromSlotKey] = ctrlB.id;
        daySched[toShift][toSlotKey] = trade.fromControllerId;

        // Validar para A
        const valA = validateAssignment(trade.fromControllerId, dateStr, toShift, toSlotKey, testSchedule, controllers, exceptions);
        if (!valA.isValid) {
          warnings.push(`[${ctrlA?.name || trade.fromControllerId}]: ${valA.error}`);
        }

        // Validar para B
        const valB = validateAssignment(ctrlB.id, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
        if (!valB.isValid) {
          warnings.push(`[${ctrlB?.name || ctrlB.id}]: ${valB.error}`);
        }
      } else if (trade.type === 'COVER') {
        const fromShift = fromSlot.shift;
        const fromSlotKey = fromSlot.slotKey;

        // Validar que siga perteneciendo a A
        if (daySched[fromShift]?.[fromSlotKey] !== trade.fromControllerId) {
          alert('El turno original propuesto ya no pertenece a tu compañero.');
          return;
        }

        // Simular reemplazo
        daySched[fromShift][fromSlotKey] = ctrlB.id;

        // Validar para B
        const valB = validateAssignment(ctrlB.id, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
        if (!valB.isValid) {
          warnings.push(`[${ctrlB?.name || ctrlB.id}]: ${valB.error}`);
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
      if (trade.type === 'SWAP' && toSlot) {
        const posB = toSlot.slotKey.split('-')[0];
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
        toControllerId: ctrlB.id,
        toControllerSignature: ctrlB.signature || ctrlB.id,
        targetSignature: ctrlB.signature || ctrlB.id,
        targetName: ctrlB.name,
        targetShift: toSlot ? `${toSlot.shift}${getSlotAcronym(toSlot.slotKey, toSlot.shift)}` : trade.targetShift,
        toSlot: toSlot || trade.toSlot,
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

  const handleApproveTrade = async (id) => {
    const trade = trades.find(t => t.id === id);
    if (!trade || trade.status !== 'PENDIENTE_APROBACION') return;

    const updatedSchedule = { ...schedule };
    const dateStr = trade.date;

    if (!updatedSchedule[dateStr]) {
      updatedSchedule[dateStr] = createEmptyDaySchedule(dateStr);
    }

    const testSchedule = JSON.parse(JSON.stringify(updatedSchedule));
    let warnings = [];

    const ctrlA = controllers.find(c => c.id === trade.fromControllerId);
    const ctrlB = controllers.find(c => c.id === trade.toControllerId);

    if (trade.type === 'SWAP') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;
      const toShift = trade.toSlot.shift;
      const toSlotKey = trade.toSlot.slotKey;

      testSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;
      testSchedule[dateStr][toShift][toSlotKey] = trade.fromControllerId;

      const valA = validateAssignment(trade.fromControllerId, dateStr, toShift, toSlotKey, testSchedule, controllers, exceptions);
      if (!valA.isValid) {
        warnings.push(`[${ctrlA?.name || trade.fromControllerId}]: ${valA.error}`);
      }

      const valB = validateAssignment(trade.toControllerId, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
      if (!valB.isValid) {
        warnings.push(`[${ctrlB?.name || trade.toControllerId}]: ${valB.error}`);
      }
    } else if (trade.type === 'COVER') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;

      testSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;

      const valB = validateAssignment(trade.toControllerId, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
      if (!valB.isValid) {
        warnings.push(`[${ctrlB?.name || trade.toControllerId}]: ${valB.error}`);
      }
    }

    if (warnings.length > 0) {
      const proceed = window.confirm(
        `Se han detectado los siguientes conflictos / advertencias en las habilitaciones o Roster para esta solicitud:\n\n` +
        warnings.map(w => `• ${w}`).join('\n') +
        `\n\n¿Desea forzar la aprobación y ejecución de todas formas?`
      );
      if (!proceed) return;
    }

    if (trade.type === 'SWAP') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;
      const toShift = trade.toSlot.shift;
      const toSlotKey = trade.toSlot.slotKey;

      updatedSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;
      updatedSchedule[dateStr][toShift][toSlotKey] = trade.fromControllerId;
    } else if (trade.type === 'COVER') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;

      updatedSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;
    }

    try {
      await saveScheduleDayDB(dateStr, updatedSchedule[dateStr]);

      const updatedTrade = { ...trade, status: 'APROBADO' };
      await updateTradeDB(updatedTrade);

      const parts = dateStr.split('-');
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      await triggerCalendarSyncIfEnabled(trade.fromControllerId, controllers, yr, mo, updatedSchedule, exceptions);
      await triggerCalendarSyncIfEnabled(trade.toControllerId, controllers, yr, mo, updatedSchedule, exceptions);
      
      alert('Solicitud de cambio aprobada y ejecutada con éxito.');
    } catch (err) {
      console.error(err);
      alert('Error al ejecutar la aprobación: ' + err.message);
    }
  };

  const handleRejectTradeByAdmin = async (id) => {
    if (!window.confirm('¿Estás seguro de rechazar y eliminar esta propuesta de cambio de turno?')) return;
    try {
      await deleteTradeDB(id);
      alert('Solicitud de cambio rechazada.');
    } catch (err) {
      console.error(err);
      alert('Error al rechazar la solicitud: ' + err.message);
    }
  };

  // ==================== PETICIONES ESPECIALES ====================
  const [requestDate, setRequestDate] = useState('');
  const [requestShift, setRequestShift] = useState('Cualquiera');
  const [requestPosition, setRequestPosition] = useState('Cualquiera');
  const [requestComment, setRequestComment] = useState('');

  // Enviar petición especial
  const handleAddRequest = async (e) => {
    e.preventDefault();
    if (!requestDate || !currentController) return;

    const isOpPosition = ['TWR', 'GND', 'DEL', 'FIC', 'CTE', 'SIM'].includes(requestPosition);
    if (isOpPosition && (!currentController.skills || !currentController.skills.includes(requestPosition))) {
      alert(`No estás habilitado/certificado en la posición ${requestPosition}. Solo puedes solicitar posiciones en las que estés certificado.`);
      return;
    }

    const isExceptionRequest = ['DESCANSO', 'LICN', 'LICR'].includes(requestPosition);

    const newReq = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      controllerId: currentController.id,
      date: requestDate,
      shift: isExceptionRequest ? 'Cualquiera' : requestShift,
      position: requestPosition,
      comment: requestComment.trim()
    };

    await addRequestDB(newReq);
    alert('Petición especial enviada con éxito al administrador.');
    
    // Resetear form
    setRequestDate('');
    setRequestShift('Cualquiera');
    setRequestPosition('Cualquiera');
    setRequestComment('');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ThemeToggle style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} />
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menú"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
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
          {onToggleViewMode && (
            <button 
              onClick={onToggleViewMode} 
              className="btn" 
              style={{ 
                width: '100%', 
                padding: '0.6rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.5rem', 
                fontWeight: '700',
                marginBottom: '0.75rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              <Lock size={16} /> Volver a Gestión
            </button>
          )}
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
            <ThemeToggle />
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
                initialYear={currentYear}
                initialMonth={currentMonth}
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
          <div style={{ width: '100%' }}>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .spin-animation {
                animation: spin 1s linear infinite;
              }
              .radar-positions-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 0.75rem;
              }
              @media (max-width: 990px) {
                .radar-grid-container {
                  display: flex !important;
                  flex-direction: column-reverse !important;
                }
                .radar-positions-grid {
                  grid-template-columns: repeat(2, 1fr) !important;
                }
              }
            `}</style>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '1.5rem',
              alignItems: 'start',
              width: '100%'
            }} className="radar-grid-container">
              
              {/* Columna Izquierda: Radar de Turnos */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={22} style={{ color: 'var(--accent-cyan)' }} />
                    <span>Radar SKBO Eldorado · Hoy: {todayStr}</span>
                  </h2>
                </div>

                {isEncargadoDeTurno && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--accent-cyan)',
                    backgroundColor: 'rgba(6, 182, 212, 0.08)',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontWeight: '600'
                  }}>
                    <Edit2 size={14} style={{ flexShrink: 0 }} />
                    <span>Control Diario Encargado: Haz clic en cualquier casilla para cambiar el controlador en tiempo real si hubo un cambio de último momento.</span>
                  </div>
                )}

                {todaySchedule ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {SHIFTS.map(shift => {
                      const slots = todaySchedule[shift] || {};
                      const activeAssignments = Object.keys(slots).filter(k => slots[k] !== null);
                      
                      const sortedAssignments = [...activeAssignments].sort((a, b) => {
                        const orderA = getPositionOrder(a);
                        const orderB = getPositionOrder(b);
                        if (orderA !== orderB) return orderA - orderB;
                        return a.localeCompare(b, undefined, { numeric: true });
                      });
                      
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

                          {sortedAssignments.length > 0 ? (
                            <div className="radar-positions-grid">
                              {sortedAssignments.map(slotKey => {
                                const ctrlId = slots[slotKey];
                                const ctrl = controllers.find(c => c.id === ctrlId);
                                const acronym = getSlotAcronym(slotKey);
                                const desc = getSlotDescription(slotKey);
                                const isMe = ctrl && currentController && ctrlId === currentController.id;
                                
                                const rawComment = todaySchedule?._dailyComments?.[`${shift}|${slotKey}`];
                                const commentText = typeof rawComment === 'string' ? rawComment : rawComment?.text;
                                const commentAuthor = typeof rawComment === 'object' ? rawComment?.by : null;

                                return (
                                  <div 
                                    key={slotKey}
                                    onClick={() => {
                                      if (isEncargadoDeTurno) {
                                        setRadarChangeModal({
                                          isOpen: true,
                                          shift,
                                          slotKey,
                                          currentCtrlId: ctrlId,
                                          newCtrlId: ctrlId || '',
                                          comment: commentText || ''
                                        });
                                      }
                                    }}
                                    title={isEncargadoDeTurno ? "Haz clic para cambiar controlador o agregar comentario (Control Diario)" : undefined}
                                    style={{
                                      backgroundColor: isMe ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-secondary)',
                                      border: isMe ? '1px solid var(--accent-cyan)' : '1px solid var(--color-border)',
                                      borderRadius: '10px',
                                      padding: '0.75rem',
                                      cursor: isEncargadoDeTurno ? 'pointer' : 'default',
                                      transition: 'all 0.2s',
                                      position: 'relative'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                      {isEncargadoDeTurno && (
                                        <Edit2 size={12} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '700', marginTop: '0.4rem', color: 'var(--text-primary)' }}>
                                      {ctrl?.name || 'Controlador'} {isMe && '(Tú)'}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                      {desc}
                                    </div>
                                    {commentText && (
                                      <div style={{
                                        fontSize: '0.68rem',
                                        color: 'var(--accent-cyan)',
                                        backgroundColor: 'rgba(6, 182, 212, 0.08)',
                                        border: '1px solid rgba(6, 182, 212, 0.2)',
                                        padding: '0.2rem 0.4rem',
                                        borderRadius: '4px',
                                        marginTop: '0.35rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        fontStyle: 'italic',
                                        lineHeight: '1.2'
                                      }} title={commentAuthor ? `Comentario de ${commentAuthor}` : 'Comentario del cambio'}>
                                        <MessageSquare size={11} style={{ flexShrink: 0 }} />
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          "{commentText}"
                                        </span>
                                      </div>
                                    )}
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

              {/* Columna Derecha: Alertas Manuales y NOTAMs oficiales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Bloque 1: Alertas Locales del Turno */}
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--status-warning)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
                      <Bell size={18} style={{ color: 'var(--status-warning)' }} />
                      <span>Alertas de la Torre (Locales)</span>
                    </h3>
                    {(userRole === 'admin' || isEncargadoDeTurno) && (
                      <button 
                        onClick={() => setIsAddingAlert(!isAddingAlert)} 
                        className="btn"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          color: 'var(--status-warning)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '700'
                        }}
                      >
                        {isAddingAlert ? 'Cancelar' : '+ Nueva'}
                      </button>
                    )}
                  </div>

                  {isAddingAlert && (
                    <div style={{ marginBottom: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                      <textarea
                        className="form-input"
                        style={{ width: '100%', minHeight: '60px', fontSize: '0.8rem', padding: '0.4rem', resize: 'none', color: 'white', backgroundColor: 'var(--bg-tertiary)' }}
                        placeholder="Escribe la alerta del turno (ej. Falla de radio en frecuencia secundaria, obras en rodaje K)..."
                        value={newAlertContent}
                        onChange={(e) => setNewAlertContent(e.target.value)}
                      />
                      
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={12} style={{ color: 'var(--accent-cyan)' }} />
                          <span>Válida hasta (Fecha y hora límite - opcional):</span>
                        </label>
                        <input
                          type="datetime-local"
                          className="form-input"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', color: 'white', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--color-border)', width: '100%' }}
                          value={newAlertExpiresAt}
                          onChange={(e) => setNewAlertExpiresAt(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button 
                          onClick={handleCreateAlert} 
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Guardar Alerta
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {validManualAlerts.length > 0 ? (
                      validManualAlerts.map(alertItem => (
                        <div 
                          key={alertItem.id} 
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.04)',
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            position: 'relative'
                          }}
                        >
                          {(userRole === 'admin' || isEncargadoDeTurno) && (
                            <button
                              onClick={() => handleDeleteAlert(alertItem.id)}
                              style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--status-danger)',
                                cursor: 'pointer',
                                padding: '0.1rem'
                              }}
                              title="Eliminar alerta"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-primary)', paddingRight: '1.5rem', lineHeight: '1.4' }}>
                            {alertItem.content}
                          </p>
                          
                          {alertItem.expiresAt && (
                            <div style={{
                              fontSize: '0.68rem',
                              color: 'var(--status-warning)',
                              backgroundColor: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              marginTop: '0.4rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontWeight: '600'
                            }}>
                              <Clock size={11} />
                              <span>Vence: {new Date(alertItem.expiresAt).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            <span>Por: {alertItem.createdBy}</span>
                            <span>{new Date(alertItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '1rem 0' }}>
                        No hay alertas locales registradas para este turno.
                      </p>
                    )}
                  </div>
                </div>

                {/* Bloque 2: NOTAMs Oficiales (FAA Search API) */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
                      <Radio size={18} style={{ color: 'var(--accent-cyan)' }} />
                      <span>NOTAMs Oficiales (Aerocivil + FAA)</span>
                    </h3>
                    
                    {(userRole === 'admin' || currentController?.isSupervisor) && (
                      <button 
                        onClick={handleSyncNotams} 
                        disabled={syncingNotams}
                        className="btn"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(6, 182, 212, 0.1)',
                          color: 'var(--accent-cyan)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <RefreshCw size={12} className={syncingNotams ? 'spin-animation' : ''} />
                        <span>{syncingNotams ? 'Sincronizando...' : 'Sincronizar'}</span>
                      </button>
                    )}
                  </div>

                  {/* Pestañas de Ámbito Principal (SKBO / Otros Aeropuertos / Control de Flujos / ASHTAMs) */}
                  {(() => {
                    const skboCount = (notamsData.notams || []).filter(n => isNotamActiveOnDate(n, notamQueryDateStr)).length;
                    const adCount = (notamsData.adClosedNotams || []).filter(n => isNotamActiveOnDate(n, notamQueryDateStr)).length;
                    const flowCount = (notamsData.flowNotams || []).filter(n => isNotamActiveOnDate(n, notamQueryDateStr)).length;
                    const ashtamCount = (notamsData.ashtamNotams || []).filter(n => isNotamActiveOnDate(n, notamQueryDateStr)).length;

                    return (
                      <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { setActiveNotamScopeTab('skbo'); setSelectedNotamCategory('ALL'); }}
                          style={{
                            flex: 1,
                            minWidth: '70px',
                            padding: '0.35rem 0.2rem',
                            fontSize: '0.7rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            backgroundColor: activeNotamScopeTab === 'skbo' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                            color: activeNotamScopeTab === 'skbo' ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                          }}
                        >
                          📌 SKBO ({skboCount})
                        </button>
                        <button
                          onClick={() => { setActiveNotamScopeTab('ad_clsd'); setSelectedNotamCategory('ALL'); }}
                          style={{
                            flex: 1,
                            minWidth: '80px',
                            padding: '0.35rem 0.2rem',
                            fontSize: '0.7rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            backgroundColor: activeNotamScopeTab === 'ad_clsd' ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                            color: activeNotamScopeTab === 'ad_clsd' ? 'var(--status-danger)' : 'var(--text-secondary)'
                          }}
                        >
                          🛫 Otros AD ({adCount})
                        </button>
                        <button
                          onClick={() => { setActiveNotamScopeTab('flow'); setSelectedNotamCategory('ALL'); }}
                          style={{
                            flex: 1,
                            minWidth: '80px',
                            padding: '0.35rem 0.2rem',
                            fontSize: '0.7rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            backgroundColor: activeNotamScopeTab === 'flow' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                            color: activeNotamScopeTab === 'flow' ? 'var(--status-warning)' : 'var(--text-secondary)'
                          }}
                        >
                          ✈️ Flujo ({flowCount})
                        </button>
                        <button
                          onClick={() => { setActiveNotamScopeTab('ashtam'); setSelectedNotamCategory('ALL'); }}
                          style={{
                            flex: 1,
                            minWidth: '85px',
                            padding: '0.35rem 0.2rem',
                            fontSize: '0.7rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            backgroundColor: activeNotamScopeTab === 'ashtam' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                            color: activeNotamScopeTab === 'ashtam' ? '#ec4899' : 'var(--text-secondary)'
                          }}
                        >
                          🌋 ASHTAM ({ashtamCount})
                        </button>
                      </div>
                    );
                  })()}

                  {/* Selector de Fecha de Consulta de Vigencia y Buscador */}
                  {(() => {
                    const getTomorrowUtc = () => {
                      const d = new Date();
                      d.setUTCDate(d.getUTCDate() + 1);
                      return getUtcDateString(d);
                    };
                    const isToday = notamQueryDateStr === todayNotamStr;
                    const isTomorrow = notamQueryDateStr === getTomorrowUtc();

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem 0.4rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: '800', whiteSpace: 'nowrap' }}>
                            Vigencia:
                          </span>

                          <button
                            onClick={() => setNotamQueryDateStr(todayNotamStr)}
                            style={{
                              flex: 1,
                              padding: '0.25rem 0.4rem',
                              fontSize: '0.72rem',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontWeight: '700',
                              backgroundColor: isToday ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                              color: isToday ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                            }}
                          >
                            Hoy
                          </button>

                          <button
                            onClick={() => setNotamQueryDateStr(getTomorrowUtc())}
                            style={{
                              flex: 1,
                              padding: '0.25rem 0.4rem',
                              fontSize: '0.72rem',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontWeight: '700',
                              backgroundColor: isTomorrow ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                              color: isTomorrow ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                            }}
                          >
                            Mañana
                          </button>

                          <input
                            type="date"
                            value={notamQueryDateStr}
                            onChange={(e) => {
                              if (e.target.value) setNotamQueryDateStr(e.target.value);
                            }}
                            style={{
                              padding: '0.2rem 0.35rem',
                              fontSize: '0.72rem',
                              color: 'var(--text-primary)',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '5px',
                              fontFamily: 'var(--font-mono)',
                              outline: 'none'
                            }}
                          />
                        </div>

                        <input
                          type="text"
                          className="form-input"
                          placeholder="Filtrar por texto (ej. SKCL, ASHTAM, VOLCAN, CLSD)..."
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', color: 'white', backgroundColor: 'var(--bg-tertiary)' }}
                          value={notamSearchQuery}
                          onChange={(e) => setNotamSearchQuery(e.target.value)}
                        />
                      </div>
                    );
                  })()}

                  {/* Panel de Categorías (Solo se muestra cuando la pestaña activa es SKBO) */}
                  {activeNotamScopeTab === 'skbo' && (
                    <div style={{
                      display: 'flex',
                      gap: '0.25rem',
                      flexWrap: 'wrap',
                      marginBottom: '0.75rem'
                    }}>
                      {[
                        { key: 'ALL', label: 'Todos' },
                        { key: 'RWY', label: 'RWY' },
                        { key: 'TWY', label: 'TWY' },
                        { key: 'SID/STAR/APP', label: 'SID/STAR/APP' },
                        { key: 'MISC', label: 'Otros' }
                      ].map(cat => {
                        const isSelected = selectedNotamCategory === cat.key;
                        return (
                          <button
                            key={cat.key}
                            onClick={() => setSelectedNotamCategory(cat.key)}
                            className="btn"
                            style={{
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: 'none',
                              backgroundColor: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.03)',
                              color: isSelected ? 'black' : 'var(--text-secondary)',
                              transition: 'all 0.2s'
                            }}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Lista de NOTAMs Vigentes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {(() => {
                      const rawDataset = activeNotamScopeTab === 'ad_clsd' 
                        ? (notamsData.adClosedNotams || [])
                        : activeNotamScopeTab === 'flow'
                        ? (notamsData.flowNotams || [])
                        : activeNotamScopeTab === 'ashtam'
                        ? (notamsData.ashtamNotams || [])
                        : (notamsData.notams || []);

                      const filteredList = rawDataset
                        .filter(n => isNotamActiveOnDate(n, notamQueryDateStr))
                        .filter(n => {
                          if (activeNotamScopeTab !== 'skbo') return true;
                          if (selectedNotamCategory === 'ALL') return true;
                          const rawCat = n.category || categorizeNotam(n);
                          if (selectedNotamCategory === 'RWY') {
                            return rawCat === 'RWY';
                          }
                          if (selectedNotamCategory === 'TWY') {
                            return rawCat === 'TXY' || rawCat === 'TWY';
                          }
                          if (selectedNotamCategory === 'SID/STAR/APP') {
                            return rawCat === 'SID_STAR_APP' || rawCat === 'SID/STAR/APP';
                          }
                          if (selectedNotamCategory === 'MISC') {
                            return rawCat !== 'RWY' && rawCat !== 'TXY' && rawCat !== 'TWY' && rawCat !== 'SID_STAR_APP' && rawCat !== 'SID/STAR/APP';
                          }
                          return true;
                        })
                        .filter(n => {
                          if (!notamSearchQuery.trim()) return true;
                          const query = notamSearchQuery.toLowerCase();
                          return (n.id || '').toLowerCase().includes(query) || 
                                 (n.airport || '').toLowerCase().includes(query) ||
                                 (n.description || '').toLowerCase().includes(query);
                        });

                      if (filteredList.length > 0) {
                        return filteredList.map(n => {
                          const isCritical = n.severity === 'CRITICAL' || n.description?.includes('CLSD') || n.description?.includes('CLOSED') || n.description?.includes('CIERRE');
                          const isWarning = n.severity === 'WARNING' || n.description?.includes('U/S') || n.description?.includes('WIP') || n.description?.includes('LIMIT') || n.description?.includes('FLOW');
                          
                          let badgeBg = 'rgba(255,255,255,0.05)';
                          let badgeCol = 'var(--text-secondary)';
                          if (isCritical) {
                            badgeBg = 'rgba(244, 63, 94, 0.15)';
                            badgeCol = 'var(--status-danger)';
                          } else if (isWarning) {
                            badgeBg = 'rgba(245, 158, 11, 0.15)';
                            badgeCol = 'var(--status-warning)';
                          }

                          const formattedDates = formatNotamDateRange(n);

                          return (
                            <div 
                              key={n.id} 
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isCritical ? 'rgba(244, 63, 94, 0.25)' : isWarning ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-border)'}`,
                                borderRadius: '8px',
                                padding: '0.75rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                                    color: 'var(--accent-cyan)',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    fontWeight: '800'
                                  }}>
                                    {n.airport || 'SKBO'}
                                  </span>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    backgroundColor: badgeBg,
                                    color: badgeCol,
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '4px',
                                    fontWeight: '800'
                                  }}>
                                    {n.id}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span style={{
                                    fontSize: '0.62rem',
                                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                    color: 'var(--status-success)',
                                    padding: '0.1rem 0.3rem',
                                    borderRadius: '4px',
                                    fontWeight: '700'
                                  }}>
                                    Vigente
                                  </span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    {n.schedule ? `Horario: ${n.schedule}` : 'Todo el día'}
                                  </span>
                                </div>
                              </div>
                              <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-primary)', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                                {n.description}
                              </p>
                              <div style={{ marginTop: '0.35rem', fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>Vigencia: {formattedDates}</span>
                                {n.source && <span>Fuente: {n.source.includes('AEROCIVIL') ? 'Aerocivil' : 'FAA'}</span>}
                              </div>
                            </div>
                          );
                        });
                      }

                      return (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '1.5rem 0' }}>
                          No hay NOTAMs vigentes en este ámbito para la fecha {notamQueryDateStr}.
                        </p>
                      );
                    })()}
                  </div>

                  {notamsData.lastUpdated && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      Última sinc (Aerocivil + FAA): {new Date(notamsData.lastUpdated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}
                </div>
              </div>

            </div>

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
                  
                  {/* Tipo de Operación */}
                  <div className="form-group">
                    <label style={{ fontWeight: '700' }}>Tipo de Operación</label>
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTradeType('COVER');
                          setSelectedColleagueShift('');
                        }}
                        className={`filter-btn ${tradeType === 'COVER' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: '700' }}
                      >
                        Hacer el Turno (COVER)
                      </button>
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
                    </div>
                  </div>

                  {/* 1. Fecha del Cambio */}
                  <div className="form-group">
                    <label htmlFor="trade-date" style={{ fontWeight: '700' }}>1. Fecha del Cambio</label>
                    <input
                      id="trade-date"
                      type="date"
                      className="form-input"
                      value={tradeDate}
                      onChange={(e) => {
                        setTradeDate(e.target.value);
                        setSelectedMyShift('');
                        setTargetControllerId('OPEN');
                        setSelectedColleagueShift('');
                      }}
                      required
                    />
                  </div>

                  {/* 2. Turno a Ceder / Cubrir */}
                  {tradeDate && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                      <label htmlFor="my-trade-slot" style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>
                        {tradeType === 'COVER' ? '2. Turno a Solicitar que sea Cubierto:' : '2. Turno a Ceder:'}
                      </label>
                      {myShiftsOnSelectedTradeDate.length > 0 ? (
                        <select
                          id="my-trade-slot"
                          className="form-input"
                          value={selectedMyShift}
                          onChange={(e) => {
                            setSelectedMyShift(e.target.value);
                            setTargetControllerId('OPEN');
                            setSelectedColleagueShift('');
                          }}
                          required
                          style={{ borderColor: 'var(--accent-cyan)' }}
                        >
                          <option value="">-- Selecciona el turno --</option>
                          {myShiftsOnSelectedTradeDate.map(s => (
                            <option key={s.fullKey} value={s.fullKey}>
                              {s.shift === 'A' ? 'Madrugada (A)' : s.shift === 'M' ? 'Mañana (M)' : s.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} - {getSlotAcronym(s.slotKey, s.shift)} ({getSlotDescription(s.slotKey, s.shift)}) {s.requiredSkill ? `· Req: ${s.requiredSkill}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', margin: 0, fontStyle: 'italic' }}>
                          * No tienes turnos programados en esta fecha.
                        </p>
                      )}
                    </div>
                  )}

                  {/* 3. Controlador que Recibirá el Turno (Filtrado por Habilitación) */}
                  {tradeDate && selectedMyShift && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                      <label htmlFor="target-colleague" style={{ color: 'var(--accent-indigo)', fontWeight: '700' }}>
                        {tradeType === 'COVER' ? '3. Controlador que Recibirá el Turno:' : '3. Controlador Receptor:'}
                      </label>
                      <select
                        id="target-colleague"
                        className="form-input"
                        value={targetControllerId}
                        onChange={(e) => {
                          setTargetControllerId(e.target.value);
                          setSelectedColleagueShift('');
                        }}
                        required
                        style={{ borderColor: 'var(--accent-indigo)' }}
                      >
                        <option value="OPEN">📢 Solicitud Abierta a cualquier compañero habilitado</option>
                        {availableColleagues.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.id}) {requiredSkillForMyShift ? `· Habilitado ${requiredSkillForMyShift}` : ''}
                          </option>
                        ))}
                      </select>
                      {requiredSkillForMyShift && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'block', marginTop: '0.25rem' }}>
                          * Se muestran únicamente controladores con habilitación en <strong>{requiredSkillForMyShift}</strong>.
                        </span>
                      )}
                    </div>
                  )}

                  {/* 4. Turno a Intercambiar con Receptor (SOLO PARA SWAP) */}
                  {tradeType === 'SWAP' && tradeDate && selectedMyShift && (
                    <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                      <label htmlFor="colleague-trade-slot" style={{ color: 'var(--status-warning)', fontWeight: '700' }}>4. Turno a Intercambiar con Receptor:</label>
                      {targetControllerId === 'OPEN' ? (
                        <div style={{
                          padding: '0.75rem',
                          background: 'rgba(6, 182, 212, 0.08)',
                          border: '1px dashed var(--accent-cyan)',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)'
                        }}>
                          📢 <strong>Solicitud Abierta:</strong> Cualquier compañero habilitado para <strong>{requiredSkillForMyShift || 'el turno'}</strong> que tenga turno en esta fecha podrá postular su turno para completar el intercambio.
                        </div>
                      ) : (
                        colleagueShiftsOnSelectedTradeDate.length > 0 ? (
                          <select
                            id="colleague-trade-slot"
                            className="form-input"
                            value={selectedColleagueShift}
                            onChange={(e) => setSelectedColleagueShift(e.target.value)}
                            required
                            style={{ borderColor: 'var(--status-warning)' }}
                          >
                            <option value="">-- Selecciona el turno del receptor para intercambiar --</option>
                            {colleagueShiftsOnSelectedTradeDate.map(s => (
                              <option key={s.fullKey} value={s.fullKey}>
                                {s.shift === 'A' ? 'Madrugada (A)' : s.shift === 'M' ? 'Mañana (M)' : s.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} - {getSlotAcronym(s.slotKey, s.shift)} ({getSlotDescription(s.slotKey, s.shift)}) {s.requiredSkill ? `· Pos: ${s.requiredSkill}` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{
                            padding: '0.65rem',
                            background: 'rgba(244, 63, 94, 0.08)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            color: 'var(--status-danger)'
                          }}>
                            ⚠️ El receptor seleccionado no tiene turnos programados hoy para los cuales cuentes con habilitación.
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* 5. Comentarios */}
                  <div className="form-group">
                    <label htmlFor="trade-comment" style={{ fontSize: '0.8rem', fontWeight: '700' }}>5. Comentarios / Justificación (Opcional):</label>
                    <textarea
                      id="trade-comment"
                      className="form-input"
                      rows={2}
                      placeholder="Motivo o detalle de la solicitud..."
                      value={tradeComment}
                      onChange={(e) => setTradeComment(e.target.value)}
                      style={{ resize: 'none', padding: '0.55rem' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '0.7rem', marginTop: '0.5rem', fontWeight: '700' }}
                    disabled={!tradeDate || !selectedMyShift || (tradeType === 'SWAP' && targetControllerId !== 'OPEN' && (!selectedColleagueShift || colleagueShiftsOnSelectedTradeDate.length === 0))}
                  >
                    {tradeType === 'COVER' ? 'Enviar Propuesta de COVER' : 'Enviar Propuesta de SWAP'}
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
                                <strong>{sender?.name || t.fromControllerId}</strong> {t.isPublic || t.toControllerId === 'OPEN' ? 'publicó una solicitud abierta de SWAP para ceder su turno de' : 'te propone intercambiar su turno de'} <em>{t.fromSlot?.shift} ({getSlotAcronym(t.fromSlot?.slotKey, t.fromSlot?.shift)})</em> {t.toSlot ? <>por tu turno de <em>{t.toSlot.shift} ({getSlotAcronym(t.toSlot.slotKey, t.toSlot.shift)})</em></> : <>por un turno compatible</>}.
                              </>
                            ) : (
                              <>
                                <strong>{sender?.name || t.fromControllerId}</strong> te solicita que le cubras su turno de <em>{t.fromSlot?.shift} ({getSlotAcronym(t.fromSlot?.slotKey, t.fromSlot?.shift)})</em>.
                              </>
                            )}
                          </p>

                          {t.comment && (
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              "{t.comment}"
                            </p>
                          )}

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
                      const isPublic = Boolean(t.isPublic || t.toControllerId === 'OPEN' || t.targetSignature === 'OPEN');
                      const receiver = isPublic ? null : controllers.find(c => c.id === t.toControllerId);
                      
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
                              {isPublic ? '📢 Solicitud Abierta' : `Destinatario: ${receiver?.name || t.toControllerId}`} ({t.fromSlot?.shift} {getSlotAcronym(t.fromSlot?.slotKey, t.fromSlot?.shift)})
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

              {/* Solicitudes Pendientes de Aprobación CTE/Admin */}
              {(currentController?.isSupervisor || userRole === 'admin') && (
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                  <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={20} style={{ color: 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Solicitudes por Aprobar (Panel CTE)
                      <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                        {trades.filter(t => t.status === 'PENDIENTE_APROBACION').length}
                      </span>
                    </h3>
                  </div>

                  {trades.filter(t => t.status === 'PENDIENTE_APROBACION').length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {trades.filter(t => t.status === 'PENDIENTE_APROBACION').map(t => {
                        const sender = controllers.find(c => c.id === t.fromControllerId);
                        const receiver = controllers.find(c => c.id === t.toControllerId);
                        
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
                                {t.type === 'SWAP' ? 'SWAP' : 'COVER'}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>
                                Fecha: {t.date}
                              </span>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0.2rem 0', lineHeight: '1.4' }}>
                              {t.type === 'SWAP' ? (
                                <>
                                  <strong>{sender?.name || t.fromControllerId}</strong> cede <em>{t.fromSlot.shift} ({getSlotAcronym(t.fromSlot.slotKey)})</em> <br/>
                                  <strong>{receiver?.name || t.toControllerId}</strong> cede <em>{t.toSlot.shift} ({getSlotAcronym(t.toSlot.slotKey)})</em>
                                </>
                              ) : (
                                <>
                                  <strong>{receiver?.name || t.toControllerId}</strong> cubre a <strong>{sender?.name || t.fromControllerId}</strong> en <em>{t.fromSlot.shift} ({getSlotAcronym(t.fromSlot.slotKey)})</em>
                                </>
                              )}
                            </p>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <button
                                onClick={() => handleApproveTrade(t.id)}
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                              >
                                <Check size={14} /> Aprobar y Ejecutar
                              </button>
                              <button
                                onClick={() => handleRejectTradeByAdmin(t.id)}
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
                      No hay solicitudes pendientes de aprobación de jefatura.
                    </p>
                  )}
                </div>
              )}

            </div>

          </div>
        )}

        {/* Tab 4: MIS PETICIONES ESPECIALES */}
        {activeTab === 'requests' && (() => {
          const isExceptionRequest = ['DESCANSO', 'LICN', 'LICR'].includes(requestPosition);

          return (
            <div className="dashboard-grid">
              
              {/* Formulario */}
              <div className="glass-panel" style={{ height: 'fit-content' }}>
                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardList size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontSize: '1.15rem' }}>Enviar Petición Especial</h3>
                </div>

                <form onSubmit={handleAddRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Fecha */}
                  <div className="form-group">
                    <label htmlFor="req-date" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CalendarIcon size={14} /> Fecha Requerida
                    </label>
                    <input
                      id="req-date"
                      type="date"
                      className="form-input"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Posición / Requerimiento */}
                  <div className="form-group">
                    <label htmlFor="req-pos" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Shield size={14} /> Posición / Requerimiento
                    </label>
                    <select
                      id="req-pos"
                      className="form-input"
                      value={requestPosition}
                      onChange={(e) => setRequestPosition(e.target.value)}
                    >
                      <option value="Cualquiera">Cualquier Posición (Flexible)</option>
                      
                      {/* Opciones operativas basadas EXCLUSIVAMENTE en las habilitaciones reales del controlador */}
                      <optgroup label="Posiciones Operativas Habilitadas">
                        {(currentController.skills || []).map(skill => (
                          <option key={skill} value={skill}>
                            {skill === 'CTE' ? 'Encargado de Turno (CTE)' :
                             skill === 'TWR' ? 'Torre de Control (TWR)' :
                             skill === 'GND' ? 'Control de Superficie (GND)' :
                             skill === 'DEL' ? 'Autorizaciones de Plan (DEL)' :
                             skill === 'FIC' ? 'Información de Vuelo (FIC)' :
                             skill === 'SIM' ? 'Pseudopiloto (SIM)' : skill}
                          </option>
                        ))}
                        {currentController.trainingPreferred && (
                          <option value="ENT">Entrenamiento Alumno (ENT)</option>
                        )}
                      </optgroup>

                      {/* Opciones de Ausencia / Bloqueo (Base de Administración) */}
                      <optgroup label="Descansos, Licencias y Evitados">
                        <option value="DESCANSO">Día de Descanso (DESCANSO)</option>
                        <option value="LICR">Licencia Remunerada (LICR)</option>
                        <option value="LICN">Licencia No Remunerada (LICN)</option>
                        <option value="AVOID">Evitar Turno Específico (Bloqueo)</option>
                      </optgroup>
                    </select>
                    {['TWR', 'GND', 'DEL', 'FIC', 'CTE', 'SIM'].includes(requestPosition) && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--status-success)', marginTop: '0.2rem' }}>
                        ✓ Habilitación verificada en tu perfil.
                      </span>
                    )}
                  </div>

                  {/* Turno Preferente */}
                  <div className="form-group">
                    <label htmlFor="req-shift" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} /> Turno Preferente
                    </label>
                    <select
                      id="req-shift"
                      className="form-input"
                      value={isExceptionRequest ? 'Cualquiera' : requestShift}
                      onChange={(e) => setRequestShift(e.target.value)}
                      disabled={isExceptionRequest}
                      style={isExceptionRequest ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                    >
                      <option value="Cualquiera">Cualquier Turno (Flexible)</option>
                      <option value="M">Mañana (M: 06:00 - 12:00)</option>
                      <option value="T">Tarde (T: 12:00 - 18:00)</option>
                      <option value="N">Noche (N: 18:00 - 24:00)</option>
                      <option value="A">Madrugada (A: 00:00 - 06:00)</option>
                    </select>
                    {requestPosition === 'AVOID' && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', marginTop: '0.2rem' }}>
                        Selecciona el turno específico que deseas evitar ese día.
                      </span>
                    )}
                  </div>

                  {/* Comentarios / Justificación */}
                  <div className="form-group">
                    <label htmlFor="req-comment" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ClipboardList size={14} /> Comentarios / Justificación
                    </label>
                    <textarea
                      id="req-comment"
                      className="form-input"
                      rows={2}
                      placeholder="Escribe una breve razón o comentario (opcional)..."
                      style={{ resize: 'vertical', minHeight: '60px', padding: '0.5rem 0.75rem', fontFamily: 'inherit' }}
                      value={requestComment}
                      onChange={(e) => setRequestComment(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontWeight: '700', gap: '0.25rem' }}
                    disabled={!requestDate}
                  >
                    <Plus size={16} /> Registrar Solicitud
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto' }}>
                    {myRequests.map(r => {
                      const isAvoid = r.position === 'AVOID';
                      const isDescanso = r.position === 'DESCANSO';
                      const isLicn = r.position === 'LICN';
                      const isLicr = r.position === 'LICR';

                      return (
                        <div 
                          key={r.id}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {r.date}
                              </span>

                              {/* Shift badge */}
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: r.shift === 'M' ? 'rgba(6,182,212,0.1)' : r.shift === 'T' ? 'rgba(245,158,11,0.1)' : r.shift === 'N' ? 'rgba(168,85,247,0.1)' : r.shift === 'A' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)',
                                color: r.shift === 'M' ? 'var(--accent-cyan)' : r.shift === 'T' ? 'var(--accent-fic)' : r.shift === 'N' ? 'var(--accent-purple)' : r.shift === 'A' ? 'var(--accent-indigo)' : 'var(--text-muted)'
                              }}>
                                {r.shift === 'Cualquiera' ? 'CUALQUIER TURNO' : `TURNO ${r.shift}`}
                              </span>

                              {/* Position / Exception badge */}
                              {isDescanso && (
                                <span style={{ color: 'var(--status-success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' }}>DESCANSO</span>
                              )}
                              {isLicr && (
                                <span style={{ color: 'var(--accent-purple)', backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(168, 85, 247, 0.2)' }}>LIC. REMUNERADA (LICR)</span>
                              )}
                              {isLicn && (
                                <span style={{ color: 'var(--accent-indigo)', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(99, 102, 241, 0.2)' }}>LIC. NO REMUN. (LICN)</span>
                              )}
                              {isAvoid && (
                                <span style={{ color: 'var(--status-danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', border: '1px solid rgba(239, 68, 68, 0.2)' }}>EVITAR TURNO</span>
                              )}
                              {!isDescanso && !isLicr && !isLicn && !isAvoid && r.position !== 'Cualquiera' && (
                                <span className={`skill-chip ${r.position.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>{r.position}</span>
                              )}
                            </div>

                            {r.comment && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                "{r.comment}"
                              </span>
                            )}
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
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', margin: '2rem 0' }}>
                    No tienes peticiones registradas.
                  </p>
                )}
              </div>

            </div>
          );
        })()}
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
                          setSyncLoading(true);
                          try {
                            const allShifts = getAllShiftsForController(currentController, schedule, exceptions);
                            const totalEvents = Object.values(allShifts).reduce((acc, items) => acc + (items?.length || 0), 0);
                            const icsContent = generateICS(currentController, allShifts, { includeOps, includeExceptions });
                            const newUrl = await uploadCalendarToStorage(currentController.id || currentController.signature, icsContent);
                            await onUpdateController({
                              ...currentController,
                              calendarSyncUrl: newUrl
                            });
                            alert(`¡Sincronización multi-mes completada con éxito!\nSe actualizaron ${totalEvents} turnos y novedades (incluyendo Agosto, Septiembre y meses futuros) en la nube.`);
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

      {/* Modal de Control Diario de Posición (Radar de Turno para Encargados) */}
      {radarChangeModal.isOpen && (
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
            maxWidth: '480px',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            position: 'relative'
          }}>
            <button
              onClick={() => setRadarChangeModal({ isOpen: false, shift: null, slotKey: null, currentCtrlId: null, newCtrlId: '' })}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
              <UserCheck size={20} style={{ color: 'var(--accent-cyan)' }} />
              <span>Control Diario de Posición (Encargado)</span>
            </h3>

            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              fontSize: '0.85rem'
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Turno y Posición:</div>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                Turno {radarChangeModal.shift === 'A' ? 'Madrugada (A)' : radarChangeModal.shift === 'M' ? 'Mañana (M)' : radarChangeModal.shift === 'T' ? 'Tarde (T)' : 'Noche (N)'} · {getSlotAcronym(radarChangeModal.slotKey)} ({getSlotDescription(radarChangeModal.slotKey)})
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="radar-ctrl-select" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>
                Selecciona el controlador real para esta posición hoy:
              </label>
              <select
                id="radar-ctrl-select"
                className="form-input"
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', backgroundColor: 'var(--bg-secondary)', color: 'white', borderRadius: '8px' }}
                value={radarChangeModal.newCtrlId}
                onChange={(e) => setRadarChangeModal(prev => ({ ...prev, newCtrlId: e.target.value }))}
              >
                <option value="">-- Vacante / Sin Asignar --</option>
                {controllers.filter(c => c.active).map(c => {
                  const requiredSkill = radarChangeModal.slotKey ? radarChangeModal.slotKey.split('-')[0] : '';
                  let hasSkill = true;
                  if (requiredSkill === 'ENT') {
                    hasSkill = !!c.trainingPreferred;
                  } else if (requiredSkill && requiredSkill !== 'INS' && requiredSkill !== 'CAE' && requiredSkill !== 'CHC' && requiredSkill !== 'OFI') {
                    hasSkill = c.skills && c.skills.includes(requiredSkill);
                  }
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id}) {hasSkill ? '✓ Habilitado' : '⚠️ Sin Habilitación'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="radar-comment" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <MessageSquare size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>Comentario / Motivo del cambio (opcional):</span>
              </label>
              <textarea
                id="radar-comment"
                className="form-input"
                style={{ width: '100%', minHeight: '65px', padding: '0.5rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-secondary)', color: 'white', borderRadius: '8px', resize: 'none' }}
                placeholder="Ej. Cambio de último momento por cita médica, permuta aprobada por encargado..."
                value={radarChangeModal.comment}
                onChange={(e) => setRadarChangeModal(prev => ({ ...prev, comment: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRadarChangeModal({ isOpen: false, shift: null, slotKey: null, currentCtrlId: null, newCtrlId: '' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveRadarChange}
              >
                Guardar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
