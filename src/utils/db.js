import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const INITIAL_CONTROLLERS_RAW = [
  { id: 'ATC-001', name: 'JZA', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-002', name: 'GMB', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-003', name: 'GGO', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-004', name: 'CSO', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-005', name: 'LSG', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-006', name: 'ZAO', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-007', name: 'JMA', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-008', name: 'OVM', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-009', name: 'AFA', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-010', name: 'DSE', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-011', name: 'CLG', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-012', name: 'AKS', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-013', name: 'LNB', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-014', name: 'MFB', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-015', name: 'GAM', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-016', name: 'NLO', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-017', name: 'LDD', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-018', name: 'DZC', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-019', name: 'DAS', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-020', name: 'KIV', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-021', name: 'JGP', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-022', name: 'JJM', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-023', name: 'SMG', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false, email: 'smg@aircontrol.com' },
  { id: 'ATC-024', name: 'SBG', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false, email: 'sbg@aircontrol.com' },
  { id: 'ATC-025', name: 'ALQ', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-026', name: 'DPV', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-027', name: 'FDP', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-028', name: 'LSR', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-029', name: 'DSC', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-030', name: 'JNM', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-031', name: 'JDW', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-032', name: 'LAG', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-033', name: 'CMH', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-034', name: 'AFW', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-035', name: 'ERC', skills: ['GND', 'DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-036', name: 'SON', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-037', name: 'SRC', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-038', name: 'MJM', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-039', name: 'JBP', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-040', name: 'SAP', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-041', name: 'AGC', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-042', name: 'JSD', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-043', name: 'JRZ', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-044', name: 'ABR', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-045', name: 'MPW', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-046', name: 'RRM', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-047', name: 'AHG', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-048', name: 'JNC', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-049', name: 'SMS', skills: ['GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-050', name: 'VGR', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-051', name: 'CFD', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-052', name: 'JOP', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-053', name: 'DMM', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-054', name: 'ZBC', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-055', name: 'JZB', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-056', name: 'FGP', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-057', name: 'CEC', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-058', name: 'EGR', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-059', name: 'JPB', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-060', name: 'AGO', skills: ['DEL'], active: true, trainingPreferred: true },
  { id: 'ATC-061', name: 'JSW', skills: ['DEL'], active: true, trainingPreferred: true }
];

const INITIAL_CONTROLLERS = INITIAL_CONTROLLERS_RAW.map(c => ({
  ...c,
  email: c.email || `${c.name.toLowerCase()}@aircontrol.com`
}));

const DEFAULT_SEQUENCE = ['N', 'A', 'DESCANSO', 'M+T', 'T', 'DESCANSO'];

let isSeededChecked = false;

/**
 * Seeds initial controllers and sequence to Firestore if collections are empty.
 */
export const seedDatabaseIfEmpty = async () => {
  if (isSeededChecked) return;
  isSeededChecked = true;
  
  try {
    const controllersColl = collection(db, 'controllers');
    const snapshot = await getDocs(controllersColl);
    
    if (snapshot.empty) {
      console.log('Seeding initial controllers...');
      // Use batches (limit 500)
      const batch = writeBatch(db);
      INITIAL_CONTROLLERS.forEach(c => {
        const ref = doc(db, 'controllers', c.id);
        batch.set(ref, c);
      });
      await batch.commit();
      console.log('Controllers seeded successfully.');
      
      // Asegurar que se registren los usuarios demo en Firebase Auth
      try {
        console.log('Registering/verifying admin account in Firebase Auth...');
        await registerUserInAuth('admin@aircontrol.com', 'Skbo12345!');
        console.log('Admin account registered/verified.');
      } catch (authErr) {
        console.error('Error registering admin account:', authErr);
      }
    } else {
      // Verificar y autocurar correos en Firestore de los controladores existentes
      const batch = writeBatch(db);
      let updatedCount = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.email && data.name) {
          const email = `${data.name.toLowerCase()}@aircontrol.com`;
          batch.update(docSnap.ref, { email });
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        console.log(`Self-healing: Mapped emails for ${updatedCount} existing controllers in Firestore...`);
        await batch.commit();
      }
    }

    const seqDocRef = doc(db, 'settings', 'sequence');
    const seqSnap = await getDoc(seqDocRef);
    if (!seqSnap.exists()) {
      console.log('Seeding default sequence...');
      await setDoc(seqDocRef, { pattern: DEFAULT_SEQUENCE });
    }

    const rulesDocRef = doc(db, 'settings', 'rules');
    const rulesSnap = await getDoc(rulesDocRef);
    
    const DEFAULT_RULES = [
      "Turno de Madrugada (A) [Crítico]: Si un controlador trabaja en el turno A (00:00 - 06:00), queda inhabilitado para cualquier otro turno el mismo día calendario.",
      "Descanso Post-Madrugada/Noche: Tras un turno N (Noche) o A (Madrugada), el controlador debe ser programado en DESCANSO antes de volver a ingresar a un turno operativo de Mañana o Tarde.",
      "Garantía de Descanso Semanal: Cada controlador activo tiene derecho a mínimo 2 descansos completos (DESCANSO o LIBRE) a la semana (rango de 7 días).",
      "Secuencia Rotatoria Dinámica: Respetar la secuencia de rotación de turnos activa configurada dinámicamente en el planificador.",
      "Habilitaciones Certificadas: Un controlador solo puede ser asignado a un slot si posee la certificación correspondiente (CTE, TWR, GND, DEL, FIC) activa.",
      "Capacidad Máxima y Combinaciones Dobles: Jornada laboral máxima de 12 horas diarias. Se permiten únicamente turnos dobles en las combinaciones M+T (Mañana y Tarde) o T+N (Tarde y Noche).",
      "Sub-Posición FIC Limitada: Todos los slots de FIC (Información de Vuelo) trabajan únicamente en turnos de Mañana (M) y Tarde (T). No se permite FIC en Noche (N) ni Madrugada (A).",
      "Alumnos y Entrenamiento (ENT): Slots marcados como ENT reservados para personal con trainingPreferred: true. Se permite entrenar en múltiples jornadas (turnos) el mismo día, sin limitaciones diarias de cantidad de alumnos entrenando, siempre que no excedan las 12 horas de jornada laboral máxima."
    ];

    if (!rulesSnap.exists()) {
      console.log('Seeding default system rules...');
      await setDoc(rulesDocRef, { rules: DEFAULT_RULES });
    } else {
      const existingRules = rulesSnap.data().rules || [];
      const needsUpdate = 
        existingRules.length <= 5 || 
        !existingRules.some(r => r.includes('FIC') && r.includes('Mañana')) ||
        !existingRules.some(r => r.includes('múltiples jornadas') || r.includes('varias jornadas'));
        
      if (needsUpdate) {
        console.log('Auto-updating system rules to latest version (v13.6)...');
        await setDoc(rulesDocRef, { rules: DEFAULT_RULES });
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

// Controllers CRUD
export const addControllerDB = async (c) => {
  await setDoc(doc(db, 'controllers', c.id), c);
};

export const updateControllerDB = async (c) => {
  await setDoc(doc(db, 'controllers', c.id), c);
};

export const deleteControllerDB = async (id) => {
  await deleteDoc(doc(db, 'controllers', id));
};

// Sequence
export const saveSequencePatternDB = async (pattern) => {
  await setDoc(doc(db, 'settings', 'sequence'), { pattern });
};

// Schedule updates
export const saveScheduleDayDB = async (dateStr, daySchedule) => {
  await setDoc(doc(db, 'schedule', dateStr), daySchedule);
};

// Batch schedule updates (used for auto-scheduling a whole month)
export const saveScheduleMonthDB = async (monthScheduleMap) => {
  const batch = writeBatch(db);
  Object.keys(monthScheduleMap).forEach(dateStr => {
    const ref = doc(db, 'schedule', dateStr);
    batch.set(ref, monthScheduleMap[dateStr]);
  });
  await batch.commit();
};

// Exception updates
export const updateExceptionDB = async (ctrlId, dateStr, newStatus) => {
  const ref = doc(db, 'exceptions', ctrlId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  data[dateStr] = newStatus;
  await setDoc(ref, data);
};

// Batch exception updates (for ranges)
export const updateExceptionsBatchDB = async (ctrlId, dateArray, newStatus) => {
  const ref = doc(db, 'exceptions', ctrlId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  dateArray.forEach(d => {
    data[d] = newStatus;
  });
  await setDoc(ref, data);
};

// Special Requests CRUD
export const addRequestDB = async (req) => {
  await setDoc(doc(db, 'requests', req.id), req);
};

export const deleteRequestDB = async (id) => {
  await deleteDoc(doc(db, 'requests', id));
};

// Trades & Shifts Swapping CRUD
export const addTradeDB = async (trade) => {
  await setDoc(doc(db, 'trades', trade.id), trade);
};

export const updateTradeDB = async (trade) => {
  await setDoc(doc(db, 'trades', trade.id), trade);
};

export const deleteTradeDB = async (id) => {
  await deleteDoc(doc(db, 'trades', id));
};

const firebaseConfig = {
  apiKey: "AIzaSyDYg4_HddIkdsBuMk8td_2A-sOYS8tb8O8",
  authDomain: "aircontrol-skbo-sbg.firebaseapp.com",
  projectId: "aircontrol-skbo-sbg",
  storageBucket: "aircontrol-skbo-sbg.firebasestorage.app",
  messagingSenderId: "588241571134",
  appId: "1:588241571134:web:c830794477a968392a306f",
  measurementId: "G-XXZ19PF4WH"
};

/**
 * Registra un usuario en Firebase Authentication usando una aplicación secundaria,
 * evitando que el administrador actual sea cerrado de sesión.
 */
export const registerUserInAuth = async (email, password) => {
  if (!email || !password) return null;
  try {
    const appName = `secondaryAuthApp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), password);
    await deleteApp(secondaryApp);
    return userCredential.user;
  } catch (error) {
    console.error("Error al registrar usuario en Firebase Auth:", error);
    if (error.code === 'auth/email-already-in-use') {
      return { email };
    }
    throw error;
  }
};

// System Rules CRUD
export const getSystemRulesDB = async () => {
  const ref = doc(db, 'settings', 'rules');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().rules || [];
  }
  return [];
};

export const saveSystemRulesDB = async (rules) => {
  await setDoc(doc(db, 'settings', 'rules'), { rules });
};

// Manual Alerts CRUD
export const addManualAlertDB = async (alertData) => {
  const ref = doc(collection(db, 'manual_alerts'));
  await setDoc(ref, { 
    ...alertData, 
    id: ref.id,
    createdAt: new Date().toISOString()
  });
  return ref.id;
};

export const deleteManualAlertDB = async (id) => {
  await deleteDoc(doc(db, 'manual_alerts', id));
};

