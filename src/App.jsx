import { useState, useEffect } from 'react';
import { 
  Radio, 
  Users, 
  User,
  Calendar, 
  Shield, 
  ShieldCheck, 
  Briefcase, 
  Activity, 
  PlaneTakeoff,
  Award,
  HelpCircle,
  Sparkles,
  Grid,
  Send,
  Info,
  ClipboardList,
  RefreshCw,
  Menu,
  X,
  Lock
} from 'lucide-react';
import { 
  createEmptyDaySchedule,
  getWeekDaysOfDate,
  validateAssignment,
  adjustDynamicSlots
} from './utils/schedulerEngine';
import { runOrToolsScheduler } from './utils/ortoolsScheduler';
import ControllerForm from './components/ControllerForm';
import ControllerList from './components/ControllerList';
import SchedulerGrid from './components/SchedulerGrid';
import SchedulerSummary from './components/SchedulerSummary';
import MonthlyGrid from './components/MonthlyGrid';
import RequestPanel from './components/RequestPanel';
import TradePanel from './components/TradePanel';
import LoginScreen from './components/LoginScreen';
import ControllerPortal from './components/ControllerPortal';
import AICopilotPanel from './components/AICopilotPanel';

// Firebase & Firestore Sync
import { db, auth } from './utils/firebase';
import { onSnapshot, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { triggerCalendarSyncIfEnabled } from './utils/calendarExport';
import {
  seedDatabaseIfEmpty,
  addControllerDB,
  updateControllerDB,
  deleteControllerDB,
  saveSequencePatternDB,
  saveScheduleDayDB,
  saveScheduleMonthDB,
  updateExceptionsBatchDB,
  addRequestDB,
  deleteRequestDB,
  addTradeDB,
  updateTradeDB,
  deleteTradeDB,
  registerUserInAuth,
  addManualAlertDB,
  deleteManualAlertDB
} from './utils/db';

export default function App() {
  const [controllers, setControllers] = useState([]);
  const [editingController, setEditingController] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'controllers' | 'scheduler' | 'monthly'
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  
  // Adaptabilidad Móvil
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };
  
  // Calcular fecha actual de Eldorado
  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return {
      year: yyyy,
      month: today.getMonth(),
      dayStr: `${yyyy}-${mm}-${dd}`
    };
  };

  const todayData = getTodayStr();

  // Estado para el Planificador Mensual por Calendario Real
  const [currentYear, setCurrentYear] = useState(todayData.year);
  const [currentMonth, setCurrentMonth] = useState(todayData.month);
  const [selectedDayStr, setSelectedDayStr] = useState(todayData.dayStr);
  const [schedule, setSchedule] = useState({});
  const [exceptions, setExceptions] = useState({});
  const [sequencePattern, setSequencePattern] = useState([]);
  const [notification, setNotification] = useState(null);
  const [requests, setRequests] = useState([]);
  const [trades, setTrades] = useState([]);
  const [publishState, setPublishState] = useState({});
  const [notamsData, setNotamsData] = useState({ notams: [], lastUpdated: null, pdfUrl: null });
  const [manualAlerts, setManualAlerts] = useState([]);
  const [viewAsController, setViewAsController] = useState(false);

  // Calcular dinámicamente los 7 días de la semana de la fecha seleccionada en el planificador
  const weekDays = getWeekDaysOfDate(selectedDayStr);

  // Cargar datos en tiempo real al montar la aplicación desde Firestore
  useEffect(() => {
    let unsubControllers = () => {};
    let unsubSeq = () => {};
    let unsubSchedule = () => {};
    let unsubExceptions = () => {};
    let unsubRequests = () => {};
    let unsubTrades = () => {};
    let unsubPublishState = () => {};
    let unsubNotams = () => {};
    let unsubManualAlerts = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    const init = async () => {
      // 1. Seed database if empty in background (controllers, default sequence)
      seedDatabaseIfEmpty().catch(console.error);
      
      // 2. Set up real-time listener for Controllers
      unsubControllers = onSnapshot(collection(db, 'controllers'), (snapshot) => {
        const list = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data());
        });
        // Sort alphabetically by name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setControllers(list);
      });

      // 3. Set up real-time listener for Sequence Pattern
      unsubSeq = onSnapshot(doc(db, 'settings', 'sequence'), (docSnap) => {
        if (docSnap.exists()) {
          setSequencePattern(docSnap.data().pattern || []);
        }
      });

      unsubSchedule = onSnapshot(collection(db, 'schedule'), (snapshot) => {
        const schedMap = {};
        snapshot.forEach(docSnap => {
          const dayData = docSnap.data() || {};
          const SHIFTS = ['A', 'M', 'T', 'N'];
          SHIFTS.forEach(shift => {
            if (dayData[shift]) {
              dayData[shift] = adjustDynamicSlots(dayData[shift], 'ENT', shift);
              dayData[shift] = adjustDynamicSlots(dayData[shift], 'INS', shift);
              dayData[shift] = adjustDynamicSlots(dayData[shift], 'CAE', shift);
              dayData[shift] = adjustDynamicSlots(dayData[shift], 'CHEC', shift);
            }
          });
          schedMap[docSnap.id] = dayData;
        });
        setSchedule(schedMap);
      });

      // 5. Set up real-time listener for Exceptions
      unsubExceptions = onSnapshot(collection(db, 'exceptions'), (snapshot) => {
        const excMap = {};
        snapshot.forEach(docSnap => {
          excMap[docSnap.id] = docSnap.data();
        });
        setExceptions(excMap);
      });

      // 6. Set up real-time listener for Requests
      unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
        const reqList = [];
        snapshot.forEach(docSnap => {
          reqList.push(docSnap.data());
        });
        setRequests(reqList);
      });

      // 7. Set up real-time listener for Trades
      unsubTrades = onSnapshot(collection(db, 'trades'), (snapshot) => {
        const tradeList = [];
        snapshot.forEach(docSnap => {
          tradeList.push(docSnap.data());
        });
        setTrades(tradeList);
      });

      // 8. Set up real-time listener for Publish State
      unsubPublishState = onSnapshot(doc(db, 'settings', 'publishState'), (docSnap) => {
        if (docSnap.exists()) {
          setPublishState(docSnap.data() || {});
        } else {
          setPublishState({});
        }
      });

      // 9. Set up real-time listener for NOTAMs
      unsubNotams = onSnapshot(doc(db, 'settings', 'notams_skbo'), (docSnap) => {
        if (docSnap.exists()) {
          setNotamsData(docSnap.data() || { notams: [], lastUpdated: null, pdfUrl: null });
        } else {
          setNotamsData({ notams: [], lastUpdated: null, pdfUrl: null });
        }
      });

      // 10. Set up real-time listener for Manual Alerts
      unsubManualAlerts = onSnapshot(collection(db, 'manual_alerts'), (snapshot) => {
        const alertList = [];
        snapshot.forEach(docSnap => {
          alertList.push(docSnap.data());
        });
        // Sort alerts by creation date descending
        alertList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setManualAlerts(alertList);
      });

      setLoading(false);
    };

    init();

    return () => {
      unsubAuth();
      unsubControllers();
      unsubSeq();
      unsubSchedule();
      unsubExceptions();
      unsubRequests();
      unsubTrades();
      unsubPublishState();
      unsubNotams();
      unsubManualAlerts();
    };
  }, []);

  // Mostrar notificaciones flotantes
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // Registro al vuelo (JIT) en Firebase Auth para controladores existentes con la contraseña por defecto
      if ((err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') && password === 'Skbo12345!') {
        const matchingCtrl = controllers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (matchingCtrl) {
          await registerUserInAuth(email, password);
          await signInWithEmailAndPassword(auth, email, password);
          return;
        }
      }
      throw err;
    }
  };

  const handleAdminPasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showNotification('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        showNotification('Contraseña actualizada correctamente.');
        setIsChangePasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showNotification('No hay una sesión activa.');
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        showNotification('Por seguridad, debes cerrar sesión y volver a ingresar para cambiar la contraseña.');
      } else {
        showNotification('Error al cambiar la contraseña: ' + err.message);
      }
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Navegar de Mes en el planificador
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

  // CRUD de Controladores
  const handleAddController = async (newController) => {
    try {
      if (newController.email && newController.password) {
        await registerUserInAuth(newController.email, newController.password);
      }
      // Stripear el password antes de persistir en base de datos por seguridad
      const firestoreData = { ...newController };
      delete firestoreData.password;
      await addControllerDB(firestoreData);
      showNotification(`Controlador ${newController.name} registrado con éxito.`);
    } catch (err) {
      console.error(err);
      alert(`Error al registrar el controlador en Firebase: ${err.message}`);
    }
  };

  const handleUpdateController = async (updatedController) => {
    try {
      if (updatedController.email && updatedController.password) {
        await registerUserInAuth(updatedController.email, updatedController.password);
      }
      // Stripear el password antes de persistir en base de datos por seguridad
      const firestoreData = { ...updatedController };
      delete firestoreData.password;
      await updateControllerDB(firestoreData);
      setEditingController(null);
      showNotification(`Datos del controlador ${updatedController.name} actualizados.`);
    } catch (err) {
      console.error(err);
      alert(`Error al actualizar el controlador en Firebase: ${err.message}`);
    }
  };

  const handleDeleteController = async (id) => {
    const name = controllers.find(c => c.id === id)?.name || 'este controlador';
    if (window.confirm(`¿Está seguro de que desea eliminar a ${name}? Esto borrará sus asignaciones históricas del cuadrante mensual.`)) {
      await deleteControllerDB(id);

      // Limpiar asignaciones históricas
      const cleanedSchedule = { ...schedule };
      const changedDates = [];

      Object.keys(cleanedSchedule).forEach(date => {
        let changed = false;
        Object.keys(cleanedSchedule[date] || {}).forEach(shift => {
          Object.keys(cleanedSchedule[date][shift] || {}).forEach(slot => {
            if (cleanedSchedule[date][shift][slot] === id) {
              cleanedSchedule[date][shift][slot] = null;
              changed = true;
            }
          });
        });
        if (changed) {
          changedDates.push(date);
        }
      });

      for (const date of changedDates) {
        await saveScheduleDayDB(date, cleanedSchedule[date]);
      }

      if (editingController && editingController.id === id) {
        setEditingController(null);
      }
      showNotification(`Controlador ${name} de baja en el sistema.`);
    }
  };

  const handleEditController = (controller) => {
    setEditingController(controller);
    setActiveTab('controllers');
  };

  const handleCancelEdit = () => {
    setEditingController(null);
  };

  // Actualizar secuencia de 6 días patrón
  const handleUpdateSequence = async (idx, value) => {
    const newSeq = [...sequencePattern];
    newSeq[idx] = value;
    await saveSequencePatternDB(newSeq);
    showNotification(`Secuencia rotatoria del Día ${idx + 1} actualizada a ${value}.`);
  };

  // Asignar controlador a un slot por fecha
  const handleAssignController = async (dateStr, shift, slotKey, controllerId) => {
    const updatedSchedule = { ...schedule };
    if (!updatedSchedule[dateStr]) {
      updatedSchedule[dateStr] = createEmptyDaySchedule(dateStr);
    }
    
    const oldControllerId = schedule[dateStr]?.[shift]?.[slotKey];
    updatedSchedule[dateStr][shift][slotKey] = controllerId;
    
    // Ajustar los slots dinámicamente tras la asignación
    updatedSchedule[dateStr][shift] = adjustDynamicSlots(updatedSchedule[dateStr][shift], 'ENT', shift);
    updatedSchedule[dateStr][shift] = adjustDynamicSlots(updatedSchedule[dateStr][shift], 'INS', shift);
    updatedSchedule[dateStr][shift] = adjustDynamicSlots(updatedSchedule[dateStr][shift], 'CAE', shift);
    updatedSchedule[dateStr][shift] = adjustDynamicSlots(updatedSchedule[dateStr][shift], 'CHEC', shift);
    
    await saveScheduleDayDB(dateStr, updatedSchedule[dateStr]);

    const parts = dateStr.split('-');
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    if (oldControllerId) {
      await triggerCalendarSyncIfEnabled(oldControllerId, controllers, yr, mo, updatedSchedule, exceptions);
    }
    if (controllerId && controllerId !== oldControllerId) {
      await triggerCalendarSyncIfEnabled(controllerId, controllers, yr, mo, updatedSchedule, exceptions);
    }
    
    if (controllerId) {
      const name = controllers.find(c => c.id === controllerId)?.name || 'Controlador';
      showNotification(`${name} programado en slot ${slotKey.split('-')[0]} para el día ${dateStr}.`);
    } else {
      showNotification(`Slot de fecha ${dateStr} vaciado.`);
    }

    setSelectedDayStr(dateStr);
  };

  // Guardar importación de Excel en lote (Roster y Excepciones)
  const handleBulkImport = async (scheduleUpdates, exceptionUpdates) => {
    // 1. Guardar todos los días del cuadrante modificados
    const dayPromises = Object.keys(scheduleUpdates).map(dateStr => {
      return saveScheduleDayDB(dateStr, scheduleUpdates[dateStr]);
    });
    
    // 2. Guardar todas las excepciones modificadas
    const exceptionPromises = Object.keys(exceptionUpdates).map(async (ctrlId) => {
      const ref = doc(db, 'exceptions', ctrlId);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      Object.keys(exceptionUpdates[ctrlId]).forEach(dateStr => {
        data[dateStr] = exceptionUpdates[ctrlId][dateStr];
      });
      return setDoc(ref, data);
    });
    
    await Promise.all([...dayPromises, ...exceptionPromises]);
    showNotification("Importación de Excel completada exitosamente.");

    controllers.forEach(c => {
      if (c.calendarSyncEnabled) {
        const combinedSchedule = { ...schedule, ...scheduleUpdates };
        const combinedExceptions = { ...exceptions };
        Object.keys(exceptionUpdates).forEach(ctrlId => {
          if (!combinedExceptions[ctrlId]) combinedExceptions[ctrlId] = {};
          Object.keys(exceptionUpdates[ctrlId]).forEach(dateStr => {
            combinedExceptions[ctrlId][dateStr] = exceptionUpdates[ctrlId][dateStr];
          });
        });
        triggerCalendarSyncIfEnabled(c.id, controllers, currentYear, currentMonth, combinedSchedule, combinedExceptions);
      }
    });
  };

  // Cambiar el estado de publicación oficial de un mes
  const handleTogglePublishMonth = async (year, month) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const newStatus = !publishState[monthKey];
    
    try {
      const ref = doc(db, 'settings', 'publishState');
      await setDoc(ref, {
        ...publishState,
        [monthKey]: newStatus
      });
      showNotification(
        newStatus 
          ? `Turnos de ${monthNames[month]} ${year} publicados oficialmente.` 
          : `Turnos de ${monthNames[month]} ${year} revertidos a borrador.`,
        newStatus ? 'success' : 'warning'
      );
    } catch (error) {
      console.error("Error setting publish state:", error);
      showNotification('Error al cambiar el estado de publicación.', 'danger');
    }
  };

  // Abrir posición adicional (custom slot)
  const handleAddCustomSlot = async (dateStr, shift, position) => {
    try {
      const updatedSchedule = { ...schedule };
      if (!updatedSchedule[dateStr]) {
        updatedSchedule[dateStr] = createEmptyDaySchedule(dateStr);
      }
      
      const shiftSlots = updatedSchedule[dateStr][shift] || {};
      const existingIndexes = Object.keys(shiftSlots)
        .filter(k => k.startsWith(`${position}-`))
        .map(k => parseInt(k.split('-')[1], 10))
        .filter(n => !isNaN(n));
      
      const nextIndex = existingIndexes.length > 0 ? Math.max(...existingIndexes) + 1 : 1;
      const newSlotKey = `${position}-${nextIndex}`;
      
      updatedSchedule[dateStr][shift][newSlotKey] = null;
      
      await saveScheduleDayDB(dateStr, updatedSchedule[dateStr]);
      showNotification(`Posición ${newSlotKey} abierta con éxito en el turno ${shift}.`);
      setSelectedDayStr(dateStr);
    } catch (err) {
      console.error(err);
      alert('Error al abrir posición: ' + err.message);
    }
  };

  // Cerrar posición adicional (custom slot)
  const handleRemoveCustomSlot = async (dateStr, shift, slotKey) => {
    try {
      const updatedSchedule = { ...schedule };
      if (updatedSchedule[dateStr] && updatedSchedule[dateStr][shift]) {
        delete updatedSchedule[dateStr][shift][slotKey];
        await saveScheduleDayDB(dateStr, updatedSchedule[dateStr]);
        showNotification(`Posición ${slotKey} del turno ${shift} cerrada con éxito.`);
        setSelectedDayStr(dateStr);
      }
    } catch (err) {
      console.error(err);
      alert('Error al cerrar posición: ' + err.message);
    }
  };

  // Modificar excepciones (Vacaciones, Cursos, Descanso, Inoperativo) por fecha o rango (lote)
  const handleUpdateException = async (ctrlId, dateStrOrArr, newStatus) => {
    const dates = Array.isArray(dateStrOrArr) ? dateStrOrArr : [dateStrOrArr];
    const updatedSchedule = { ...schedule };
    let scheduleChanged = false;
    const changedDates = [];

    await updateExceptionsBatchDB(ctrlId, dates, newStatus);

    dates.forEach(dateStr => {
      // Si es no operativo, remover del cuadrante para esta fecha
      if (newStatus !== 'OPERATIVO' && updatedSchedule[dateStr]) {
        let changed = false;
        Object.keys(updatedSchedule[dateStr] || {}).forEach(shift => {
          Object.keys(updatedSchedule[dateStr][shift] || {}).forEach(slotKey => {
            if (updatedSchedule[dateStr][shift][slotKey] === ctrlId) {
              updatedSchedule[dateStr][shift][slotKey] = null;
              changed = true;
              scheduleChanged = true;
            }
          });
        });
        if (changed) {
          changedDates.push(dateStr);
        }
      }
    });

    if (scheduleChanged) {
      for (const dateStr of changedDates) {
        await saveScheduleDayDB(dateStr, updatedSchedule[dateStr]);
      }
    }
    
    if (dates.length > 0) {
      setSelectedDayStr(dates[0]);

      const parts = dates[0].split('-');
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;

      const updatedExceptions = { ...exceptions };
      if (!updatedExceptions[ctrlId]) updatedExceptions[ctrlId] = {};
      dates.forEach(d => {
        updatedExceptions[ctrlId][d] = newStatus;
      });

      await triggerCalendarSyncIfEnabled(ctrlId, controllers, yr, mo, updatedSchedule, updatedExceptions);
    }
  };

  // CRUD de Peticiones Especiales (Fase 9)
  const handleAddRequest = async (newRequest) => {
    await addRequestDB(newRequest);
    showNotification('Petición especial registrada con éxito.');
  };

  const handleDeleteRequest = async (id) => {
    await deleteRequestDB(id);
    showNotification('Petición especial cancelada.');
  };

  // CRUD de Cambios y Coberturas (Fase 10)
  const handleAddTrade = async (newTrade) => {
    await addTradeDB(newTrade);
    showNotification('Solicitud de cambio registrada como Pendiente.');
  };

  const handleDeleteTrade = async (id) => {
    await deleteTradeDB(id);
    showNotification('Solicitud de cambio cancelada / rechazada.');
  };

  const handleApproveTrade = async (id) => {
    const trade = trades.find(t => t.id === id);
    if (!trade || trade.status !== 'PENDIENTE_APROBACION') return;

    const updatedSchedule = { ...schedule };
    const dateStr = trade.date;

    // Inicializar fecha si no existe en schedule
    if (!updatedSchedule[dateStr]) {
      updatedSchedule[dateStr] = createEmptyDaySchedule(dateStr);
    }

    // --- VALIDACIÓN DE LICENCIAS Y REGLAS DE TRANSCIÓN ---
    const testSchedule = JSON.parse(JSON.stringify(updatedSchedule));
    let warnings = [];

    const ctrlA = controllers.find(c => c.id === trade.fromControllerId);
    const ctrlB = controllers.find(c => c.id === trade.toControllerId);

    if (trade.type === 'SWAP') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;
      const toShift = trade.toSlot.shift;
      const toSlotKey = trade.toSlot.slotKey;

      // Realizar la simulación
      testSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;
      testSchedule[dateStr][toShift][toSlotKey] = trade.fromControllerId;

      // Validar para A (que va a toShift / toSlotKey)
      const valA = validateAssignment(trade.fromControllerId, dateStr, toShift, toSlotKey, testSchedule, controllers, exceptions);
      if (!valA.isValid) {
        warnings.push(`[${ctrlA?.name || trade.fromControllerId}]: ${valA.error}`);
      }

      // Validar para B (que va a fromShift / fromSlotKey)
      const valB = validateAssignment(trade.toControllerId, dateStr, fromShift, fromSlotKey, testSchedule, controllers, exceptions);
      if (!valB.isValid) {
        warnings.push(`[${ctrlB?.name || trade.toControllerId}]: ${valB.error}`);
      }
    } else if (trade.type === 'COVER') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;

      // Realizar la simulación
      testSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;

      // Validar para B (que va a fromShift / fromSlotKey)
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

      // Realizar el intercambio físico en el cuadrante
      updatedSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;
      updatedSchedule[dateStr][toShift][toSlotKey] = trade.fromControllerId;

      showNotification('Intercambio de turnos (SWAP) ejecutado con éxito.');
    } else if (trade.type === 'COVER') {
      const fromShift = trade.fromSlot.shift;
      const fromSlotKey = trade.fromSlot.slotKey;

      // Reemplazo físico en el cuadrante (B toma el slot de A, A queda liberado de ese slot)
      updatedSchedule[dateStr][fromShift][fromSlotKey] = trade.toControllerId;

      showNotification('Reemplazo de turno (COVER) ejecutado con éxito. Deuda registrada.');
    }

    // Guardar cuadrante actualizado en Firestore
    await saveScheduleDayDB(dateStr, updatedSchedule[dateStr]);

    // Actualizar estado de la solicitud de cambio a APROBADO en Firestore
    const updatedTrade = { ...trade, status: 'APROBADO' };
    await updateTradeDB(updatedTrade);

    // Auto-sincronizar calendarios de los controladores
    const parts = dateStr.split('-');
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    await triggerCalendarSyncIfEnabled(trade.fromControllerId, controllers, yr, mo, updatedSchedule, exceptions);
    await triggerCalendarSyncIfEnabled(trade.toControllerId, controllers, yr, mo, updatedSchedule, exceptions);

    // Forzar actualización de vista
    setSelectedDayStr(dateStr);
  };

  // Ejecutar el auto-completador para el MES COMPLETO
  const handleAutoScheduleMonth = async () => {
    // Calcular días del mes seleccionado
    const lastDayDate = new Date(currentYear, currentMonth + 1, 0);
    const count = lastDayDate.getDate();
    const daysInMonth = [];
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    for (let i = 1; i <= count; i++) {
      const dayStr = String(i).padStart(2, '0');
      daysInMonth.push(`${currentYear}-${monthStr}-${dayStr}`);
    }

    // Asegurar inicialización de slots vacíos en schedule
    const currentScheduleState = { ...schedule };
    daysInMonth.forEach(day => {
      if (!currentScheduleState[day]) {
        currentScheduleState[day] = createEmptyDaySchedule(day);
      }
    });

    // Pre-procesar peticiones de descanso y licencia (excepciones) para el solver
    const tempExceptions = JSON.parse(JSON.stringify(exceptions || {}));
    requests.forEach(req => {
      if (req.position === 'DESCANSO' || req.position === 'LICN' || req.position === 'LICR') {
        if (!tempExceptions[req.controllerId]) tempExceptions[req.controllerId] = {};
        tempExceptions[req.controllerId][req.date] = req.position;
      }
    });

    const result = await runOrToolsScheduler(daysInMonth, controllers, tempExceptions, sequencePattern, requests, schedule);
    
    if (result) {
      await saveScheduleMonthDB(result);
      
      // Persistir las excepciones derivadas de las peticiones en la base de datos
      const exceptionPromises = [];
      requests.forEach(req => {
        if (req.position === 'DESCANSO' || req.position === 'LICN' || req.position === 'LICR') {
          const ref = doc(db, 'exceptions', req.controllerId);
          exceptionPromises.push((async () => {
            const snap = await getDoc(ref);
            const data = snap.exists() ? snap.data() : {};
            data[req.date] = req.position;
            await setDoc(ref, data);
          })());
        }
      });
      if (exceptionPromises.length > 0) {
        await Promise.all(exceptionPromises);
      }

      showNotification(`¡Todo el mes de ${monthNames[currentMonth]} programado con éxito de forma balanceada!`, 'success');
      controllers.forEach(c => {
        if (c.calendarSyncEnabled) {
          triggerCalendarSyncIfEnabled(c.id, controllers, currentYear, currentMonth, result, tempExceptions);
        }
      });
    } else {
      showNotification('No se pudo generar una malla perfecta para el mes. Revisa que no haya demasiadas excepciones o personal de baja.', 'error');
    }
  };

  // Limpiar el mes seleccionado
  const handleClearScheduleMonth = async () => {
    if (window.confirm(`¿Está seguro de que desea vaciar todas las asignaciones del cuadrante para el mes de ${monthNames[currentMonth]}?`)) {
      const lastDayDate = new Date(currentYear, currentMonth + 1, 0);
      const count = lastDayDate.getDate();
      const updatedSchedule = {};
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      
      for (let i = 1; i <= count; i++) {
        const dayStr = String(i).padStart(2, '0');
        const dayStrFull = `${currentYear}-${monthStr}-${dayStr}`;
        updatedSchedule[dayStrFull] = createEmptyDaySchedule(dayStrFull);
      }
      
      await saveScheduleMonthDB(updatedSchedule);
      showNotification(`Se han vaciado todos los turnos de ${monthNames[currentMonth]}.`, 'warning');
      controllers.forEach(c => {
        if (c.calendarSyncEnabled) {
          triggerCalendarSyncIfEnabled(c.id, controllers, currentYear, currentMonth, updatedSchedule, exceptions);
        }
      });
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // KPIs rápidos
  const totalControllers = controllers.length;
  const countCTE = controllers.filter(c => c.skills && c.skills.includes('CTE')).length;
  const countTWR = controllers.filter(c => c.skills && c.skills.includes('TWR')).length;
  const countGND = controllers.filter(c => c.skills && c.skills.includes('GND')).length;
  const countDEL = controllers.filter(c => c.skills && c.skills.includes('DEL')).length;
  const countFIC = controllers.filter(c => c.skills && c.skills.includes('FIC')).length;

  if (loading || authLoading) {
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
        gap: '1.5rem'
      }}>
        <div className="pulse-animation" style={{
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <PlaneTakeoff size={52} className="spin-animation" style={{ animation: 'spin 3s linear infinite' }} />
        </div>
        <h2 style={{ fontWeight: '700', letterSpacing: '1px' }}>Sincronizando AirControl...</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estableciendo conexión en tiempo real con Eldorado SKBO</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isUserAdmin = currentUser.email && (
    currentUser.email.toLowerCase() === 'admin@aircontrol.com' ||
    currentUser.email.toLowerCase() === 'santiagobermugonza@gmail.com' ||
    controllers.some(c => c.email && c.email.toLowerCase() === currentUser.email.toLowerCase() && c.isAdmin)
  );

  const isUserSupervisor = currentUser.email && !isUserAdmin && (
    controllers.some(c => c.email && c.email.toLowerCase() === currentUser.email.toLowerCase() && c.isSupervisor)
  );

  const userRole = isUserAdmin ? 'admin' : (isUserSupervisor ? 'supervisor' : 'controller');

  const showControllerPortal = userRole === 'controller' || (viewAsController && (userRole === 'admin' || userRole === 'supervisor'));

  if (showControllerPortal) {
    return (
      <ControllerPortal
        userEmail={currentUser.email}
        controllers={controllers}
        schedule={schedule}
        exceptions={exceptions}
        requests={requests}
        trades={trades}
        publishState={publishState}
        userRole={userRole}
        notamsData={notamsData}
        manualAlerts={manualAlerts}
        onLogout={handleLogout}
        onUpdateController={handleUpdateController}
        onToggleViewMode={() => setViewAsController(false)}
      />
    );
  }

  return (
    <div className="app-container">
      
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

      {/* Banner de Notificación */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: notification.type === 'success' ? 'var(--status-success)' : 
                           notification.type === 'warning' ? 'var(--status-warning)' : 'var(--status-danger)',
          color: 'white',
          padding: '0.85rem 1.5rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          fontWeight: '600',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          {notification.type === 'success' && <Sparkles size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Overlay del menú móvil */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Lateral */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div>
          <div className="brand">
            <div className="brand-logo">
              <PlaneTakeoff size={22} />
            </div>
            <h2>AirControl</h2>
          </div>

          <nav>
            <ul className="nav-links">
              <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('dashboard')}>
                  <Activity size={18} />
                  Resumen de Torre
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'controllers' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('controllers')}>
                  <Users size={18} />
                  Controladores
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'scheduler' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('scheduler')}>
                  <Calendar size={18} />
                  Programación Mensual
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'monthly' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('monthly')}>
                  <Grid size={18} />
                  Malla Mensual
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('requests')}>
                  <ClipboardList size={18} />
                  Peticiones Especiales
                </button>
              </li>
              <li className={`nav-item ${activeTab === 'trades' ? 'active' : ''}`}>
                <button onClick={() => handleTabClick('trades')}>
                  <RefreshCw size={18} />
                  Cambios y Deudas
                </button>
              </li>
              {userRole === 'admin' && (
                <li className={`nav-item ${activeTab === 'copilot' ? 'active' : ''}`}>
                  <button onClick={() => handleTabClick('copilot')}>
                    <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
                    Copiloto IA
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>

        {(userRole === 'admin' || userRole === 'supervisor') && (
          <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
            <button 
              onClick={() => setViewAsController(true)} 
              className="btn" 
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                justifyContent: 'center',
                fontSize: '0.8rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                fontWeight: '700',
                transition: 'all 0.2s'
              }}
            >
              <User size={14} />
              <span>Vista de Controlador</span>
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
            <Radio size={14} className="pulse-animation" />
            <span style={{ fontWeight: '600' }}>Torre Activa 24h</span>
          </div>
          <span>v1.4.0 · Eldorado SKBO</span>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="main-content">
        
        {/* Encabezado */}
        <header className="page-header">
          <div className="header-title">
            {activeTab === 'dashboard' && (
              <>
                <h1>Panel de Control ATC</h1>
                <p>Estadísticas clave y estado operativo de la torre de control de aeródromo.</p>
              </>
            )}
            {activeTab === 'controllers' && (
              <>
                <h1>Gestión de Controladores</h1>
                <p>Registra y administra al personal de controladores aéreos y sus respectivas certificaciones.</p>
              </>
            )}
            {activeTab === 'scheduler' && (
              <>
                <h1>Planificador de Turnos Mensual</h1>
                <p>Navega y programa los turnos detallados día a día de todo el mes de calendario.</p>
              </>
            )}
            {activeTab === 'monthly' && (
              <>
                <h1>Malla Mensual Global</h1>
                <p>Visualización general de la grilla de turnos y estados de todo el mes de calendario.</p>
              </>
            )}
            {activeTab === 'requests' && (
              <>
                <h1>Peticiones Especiales de Turnos</h1>
                <p>Registra, visualiza y gestiona las solicitudes particulares de programación del personal.</p>
              </>
            )}
            {activeTab === 'trades' && (
              <>
                <h1>Cambios de Turno y Libro de Deudas</h1>
                <p>Gestiona intercambios (SWAPs) y coberturas (COVERs) con balance de saldos adeudados.</p>
              </>
            )}
            {activeTab === 'copilot' && (
              <>
                <h1>Copiloto ATC de IA</h1>
                <p>Generación inteligente de rosters mensuales, optimización de cuadrantes y administración de directivas operativas.</p>
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
              <Briefcase size={16} style={{ color: 'var(--accent-cyan)' }} />
              <span>ElDorado SKBO</span>
            </div>
            
            <button 
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: '700'
              }}
            >
              <Lock size={14} />
              Contraseña
            </button>

            <button 
              onClick={handleLogout}
              className="btn btn-danger-outline"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: '700'
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <Users size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{totalControllers}</span>
              <span className="stat-label">Total Personal</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">
              <Award size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{countCTE}</span>
              <span className="stat-label">Habilitación CTE (Encargado)</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon indigo">
              <ShieldCheck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{countTWR}</span>
              <span className="stat-label">Licencia TWR</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon emerald">
              <Shield size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{countGND}</span>
              <span className="stat-label">Licencia GND</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <Send size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{countDEL}</span>
              <span className="stat-label">Licencia DEL</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <Info size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{countFIC}</span>
              <span className="stat-label">Licencia FIC</span>
            </div>
          </div>
        </section>

        {/* Vistas Dinámicas */}
        {activeTab === 'dashboard' && (
          <div className="glass-panel" style={{ gap: '1.5rem', padding: '2.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: '700' }}>
              Estado de la Torre y Normativa de Turnos - ElDorado SKBO
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Este sistema automatiza la programación de controladores aéreos asegurando el cumplimiento estricto de las normativas de la OACI y las regulaciones locales de la Aeronáutica Civil:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginTop: '1rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '1.5rem',
                borderRadius: '12px'
              }}>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={16} /> Regla del Turno Nocturno (A)
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Cualquier controlador que labore en el turno **A (00:00 - 06:00)** queda inhabilitado para trabajar en cualquier otro turno del mismo día calendario. Solo puede reprogramarse a partir del día siguiente.
                </p>
              </div>

              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '1.5rem',
                borderRadius: '12px'
              }}>
                <h4 style={{ color: 'var(--accent-indigo)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={16} /> Límites Diarios y Descansos
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Los turnos son de **6 horas**. Se permite trabajar turnos dobles (**máximo 12 horas diarias**). Cada controlador goza de **2 días libres** dinámicos a la semana.
                </p>
              </div>

              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '1.5rem',
                borderRadius: '12px'
              }}>
                <h4 style={{ color: 'var(--accent-purple)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={16} /> Secuencia Staggered de 6 Días
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Los controladores rotan en ciclos desfasados de 6 días: **N - A - DESC - MT - T - DESC**. El algoritmo balancea los 6 grupos desfasados para cubrir el Roster operativo en torre las 24 horas.
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              backgroundColor: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginTop: '1.5rem'
            }}>
              <HelpCircle size={24} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <strong>¿Cómo empezar?</strong> Ve a la pestaña de <strong>Programación Mensual</strong> para planificar los turnos del mes calendario de forma detallada, o consulta la <strong>Malla Mensual</strong> para revisar el consolidado.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'controllers' && (
          <div className="dashboard-grid">
            <ControllerForm 
              key={editingController ? editingController.id : 'new'}
              onAddController={handleAddController}
              editingController={editingController}
              onUpdateController={handleUpdateController}
              onCancelEdit={handleCancelEdit}
              controllers={controllers}
              userRole={userRole}
            />

            <ControllerList 
              controllers={controllers}
              onEditController={handleEditController}
              onDeleteController={handleDeleteController}
              userRole={userRole}
            />
          </div>
        )}

        {activeTab === 'scheduler' && schedule && exceptions && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SchedulerGrid 
              schedule={schedule}
              controllers={controllers}
              exceptions={exceptions}
              currentYear={currentYear}
              currentMonth={currentMonth}
              onNavigateMonth={handleNavigateMonth}
              onAssignController={handleAssignController}
              onAutoScheduleMonth={handleAutoScheduleMonth}
              onClearScheduleMonth={handleClearScheduleMonth}
              sequencePattern={sequencePattern}
              onUpdateSequence={handleUpdateSequence}
              onAddCustomSlot={handleAddCustomSlot}
              onRemoveCustomSlot={handleRemoveCustomSlot}
              userRole={userRole}
            />

            <SchedulerSummary 
              schedule={schedule}
              controllers={controllers}
              exceptions={exceptions}
              weekDays={weekDays}
              currentYear={currentYear}
              currentMonth={currentMonth}
              onUpdateException={handleUpdateException}
            />
          </div>
        )}

        {activeTab === 'monthly' && (
          <MonthlyGrid 
            schedule={schedule}
            controllers={controllers}
            exceptions={exceptions}
            publishState={publishState}
            onTogglePublishMonth={handleTogglePublishMonth}
            onUpdateController={handleUpdateController}
            onAssignController={handleAssignController}
            onUpdateException={handleUpdateException}
            onBulkImport={handleBulkImport}
            userRole={userRole}
          />
        )}

        {activeTab === 'requests' && (
          <RequestPanel 
            controllers={controllers}
            requests={requests}
            onAddRequest={handleAddRequest}
            onDeleteRequest={handleDeleteRequest}
          />
        )}

        {activeTab === 'trades' && (
          <TradePanel 
            controllers={controllers}
            schedule={schedule}
            trades={trades}
            onAddTrade={handleAddTrade}
            onDeleteTrade={handleDeleteTrade}
            onApproveTrade={handleApproveTrade}
            userRole={userRole}
          />
        )}

        {activeTab === 'copilot' && userRole === 'admin' && (
          <AICopilotPanel 
            controllers={controllers}
            schedule={schedule}
            exceptions={exceptions}
            requests={requests}
            sequencePattern={sequencePattern}
            onSaveScheduleMonth={saveScheduleMonthDB}
          />
        )}
      </main>

      {/* Modal de Cambio de Contraseña de Admin */}
      {isChangePasswordModalOpen && (
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
            maxWidth: '450px',
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
              onClick={() => {
                setIsChangePasswordModalOpen(false);
                setNewPassword('');
                setConfirmPassword('');
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
              <Lock size={22} style={{ color: 'var(--accent-cyan)' }} />
              <span>Cambiar Contraseña</span>
            </h3>

            <form onSubmit={handleAdminPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="new-password">Nueva Contraseña</label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  placeholder="Min. 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirmar Contraseña</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsChangePasswordModalOpen(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingPassword}
                >
                  {isSubmittingPassword ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
