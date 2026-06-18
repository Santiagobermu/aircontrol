/* ==========================================================================
   AirControl - Utilidades de Almacenamiento y Mock Data (ElDorado SKBO)
   ========================================================================== */

const STORAGE_KEYS = {
  CONTROLLERS: 'aircontrol_controllers_v3', // Versión 3 para incluir la propiedad trainingPreferred
  SHIFTS: 'aircontrol_shifts_v3',          // Versión 3 para almacenamiento por fechas YYYY-MM-DD
  SEQUENCE: 'aircontrol_sequence_v3',      // Secuencia de 6 días ajustable
  EXCEPTIONS: 'aircontrol_exceptions_v3'   // Excepciones por fecha
};

// Secuencia de 6 días ajustable por defecto
const DEFAULT_SEQUENCE = ['N', 'A', 'DESCANSO', 'M+T', 'T', 'DESCANSO'];

// 61 Controladores reales de la torre ElDorado SKBO con trainingPreferred habilitado en algunos de ellos
const INITIAL_CONTROLLERS = [
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
  { id: 'ATC-023', name: 'SMG', skills: ['CTE', 'TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
  { id: 'ATC-024', name: 'SBG', skills: ['TWR', 'GND', 'DEL'], active: true, trainingPreferred: false },
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

/**
 * Obtiene los controladores en localStorage.
 */
export const getControllers = () => {
  const data = localStorage.getItem(STORAGE_KEYS.CONTROLLERS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.CONTROLLERS, JSON.stringify(INITIAL_CONTROLLERS));
    return INITIAL_CONTROLLERS;
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al parsear controladores:', error);
    return INITIAL_CONTROLLERS;
  }
};

/**
 * Guarda la lista de controladores.
 */
export const saveControllers = (controllers) => {
  localStorage.setItem(STORAGE_KEYS.CONTROLLERS, JSON.stringify(controllers));
};

/**
 * Valida un controlador.
 */
export const validateController = (controller, existingControllers, isEditing = false) => {
  if (!controller.name || controller.name.trim() === '') {
    return { isValid: false, error: 'El nombre / firma del controlador es obligatorio.' };
  }
  if (!controller.id || controller.id.trim() === '') {
    return { isValid: false, error: 'La licencia / ID único es obligatorio.' };
  }
  // Habilidades vacías permitidas para que personal en entrenamiento (sin habilitaciones) pueda ser registrado

  // Verificar IDs duplicados al crear
  if (!isEditing) {
    const duplicate = existingControllers.find(c => c.id.toLowerCase() === controller.id.trim().toLowerCase());
    if (duplicate) {
      return { isValid: false, error: `Ya existe un controlador registrado con la licencia: ${controller.id}` };
    }
  }

  return { isValid: true, error: null };
};

/**
 * Obtiene la secuencia de 6 días del panel de control o la carga por defecto.
 */
export const getSequencePattern = () => {
  const data = localStorage.getItem(STORAGE_KEYS.SEQUENCE);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SEQUENCE, JSON.stringify(DEFAULT_SEQUENCE));
    return DEFAULT_SEQUENCE;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_SEQUENCE;
  }
};

/**
 * Guarda la secuencia de 6 días del panel.
 */
export const saveSequencePattern = (seq) => {
  localStorage.setItem(STORAGE_KEYS.SEQUENCE, JSON.stringify(seq));
};
