import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Terminal, 
  Brain, 
  Bot, 
  Plus, 
  Trash2, 
  Settings,
  AlertCircle
} from 'lucide-react';
import { 
  getAI, 
  getGenerativeModel, 
  GoogleAIBackend 
} from "firebase/ai";
import app, { db } from "../utils/firebase";
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { isColombianHoliday, runAutoSchedulerForMonth } from '../utils/schedulerEngine';

export default function AICopilotPanel({ 
  controllers, 
  schedule, 
  exceptions, 
  requests, 
  sequencePattern = [],
  onSaveScheduleMonth 
}) {
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState('');
  const [rulesLoading, setRulesLoading] = useState(true);

  // Selector de período
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(4); // Mayo (0-indexed = 4)
  const [selectedRange, setSelectedRange] = useState('1-7'); // '1-7' | '8-14' | '15-21' | '22-28' | '29-end' | 'full'

  // Estados de IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiThinkingLogs, setAiThinkingLogs] = useState([]);
  const [aiError, setAiError] = useState(null);
  
  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: '¡Hola! Soy tu Copiloto ATC para Eldorado SKBO. Puedo ayudarte a generar un roster inteligente para el mes seleccionado, optimizar las asignaciones actuales o explicarte las directivas de seguridad aplicadas.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  
  const consoleEndRef = useRef(null);
  const chatEndRef = useRef(null);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'rules'), (docSnap) => {
      if (docSnap.exists()) {
        setRules(docSnap.data().rules || []);
      } else {
        setRules([]);
      }
      setRulesLoading(false);
    }, (err) => {
      console.error('Error al sincronizar reglas con Firestore:', err);
      setRulesLoading(false);
    });

    return () => unsub();
  }, []);

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    const updated = [...rules, newRule.trim()];
    setRules(updated);
    setNewRule('');
    try {
      await setDoc(doc(db, 'settings', 'rules'), { rules: updated });
    } catch (err) {
      console.error(err);
      alert('Error al guardar la regla en la nube.');
    }
  };

  const handleDeleteRule = async (idx) => {
    const updated = rules.filter((_, i) => i !== idx);
    setRules(updated);
    try {
      await setDoc(doc(db, 'settings', 'rules'), { rules: updated });
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la regla de la nube.');
    }
  };

  // Desplazar consolas al final
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiThinkingLogs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Instanciar Modelo de IA de manera segura
  const getAiModelSafe = (useJson = false) => {
    try {
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      const config = useJson ? { responseMimeType: "application/json" } : {};
      return getGenerativeModel(ai, { 
        model: "gemini-flash-latest", 
        generationConfig: config 
      });
    } catch (err) {
      console.error("Error initializing Firebase AI:", err);
      return null;
    }
  };

  // 🤖 GENERADOR DE ROSTER MENSUAL CON GEMINI
  const handleGenerateRosterAI = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiThinkingLogs([
      '⚡ [SISTEMA] Iniciando Copiloto ATC Eldorado SKBO...',
      `⚡ [SISTEMA] Cargando controladores activos... (Encontrados: ${controllers.filter(c => c.active).length})`,
      '⚡ [SISTEMA] Cargando reglas dinámicas desde settings/rules...',
      '⚡ [SISTEMA] Recopilando excepciones del cuadrante (vacaciones, inoperativos)...',
      '⚡ [SISTEMA] Compilando peticiones especiales de los controladores...',
      '🤖 [IA] Analizando Roster óptimo. Computando ciclos staggered (N - A - DESC - M+T - T - DESC)...'
    ]);

    const model = getAiModelSafe(true);
    if (!model) {
      setAiLoading(false);
      setAiError(
        'El SDK de Firebase AI Logic no se ha podido inicializar. ' +
        'Por favor, asegúrate de haber aceptado los Términos de Servicio de Generative Language en tu Consola de Google Cloud:\n' +
        'https://console.cloud.google.com/terms/generative-language-api?project=aircontrol-skbo-sbg'
      );
      return;
    }

    // Preparar el listado de días a programar en base al rango seleccionado
    const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const dates = [];

    let startDay = 1;
    let endDay = daysCount;

    if (selectedRange === '1-7') {
      startDay = 1;
      endDay = 7;
    } else if (selectedRange === '8-14') {
      startDay = 8;
      endDay = 14;
    } else if (selectedRange === '15-21') {
      startDay = 15;
      endDay = 21;
    } else if (selectedRange === '22-28') {
      startDay = 22;
      endDay = 28;
    } else if (selectedRange === '29-end') {
      startDay = 29;
      endDay = daysCount;
    }

    if (startDay > endDay) {
      setAiLoading(false);
      setAiError('Este mes no tiene suficientes días para el rango seleccionado.');
      return;
    }

    for (let i = startDay; i <= endDay; i++) {
      const dayStr = String(i).padStart(2, '0');
      dates.push(`${selectedYear}-${monthStr}-${dayStr}`);
    }

    // Filtrar controladores activos y sus skills
    const activeCtrls = controllers.filter(c => c.active).map(c => ({
      id: c.id,
      name: c.name,
      skills: c.skills,
      trainingPreferred: !!c.trainingPreferred
    }));

    // Compilar Excepciones
    const activeExceptions = {};
    dates.forEach(d => {
      controllers.forEach(c => {
        const exc = exceptions[c.id]?.[d];
        if (exc && exc !== 'OPERATIVO') {
          if (!activeExceptions[c.id]) activeExceptions[c.id] = {};
          activeExceptions[c.id][d] = exc;
        }
      });
    });

    // Compilar Peticiones
    const activeRequests = requests.filter(r => dates.includes(r.date)).map(r => ({
      controllerId: r.controllerId,
      date: r.date,
      shift: r.shift,
      position: r.position
    }));

    // --- LÓGICA DE CONTINUIDAD HISTÓRICA (Fase 13.6) ---
    // Función auxiliar para mapear las asignaciones de una fecha específica
    const getAssignmentsForDate = (dateStr) => {
      const dayData = schedule[dateStr];
      const assignments = {};
      if (dayData) {
        controllers.forEach(ctrl => {
          const shiftsWorked = [];
          ['M', 'T', 'N', 'A'].forEach(shift => {
            const slots = dayData[shift] || {};
            if (Object.values(slots).includes(ctrl.id)) {
              shiftsWorked.push(shift);
            }
          });
          assignments[ctrl.id] = shiftsWorked.length > 0 ? shiftsWorked.join('+') : 'DESCANSO';
        });
      }
      return assignments;
    };

    // Calcular las 2 fechas anteriores al inicio del rango actual
    const firstDate = new Date(dates[0] + 'T00:00:00');
    
    const dateMinus1 = new Date(firstDate);
    dateMinus1.setDate(dateMinus1.getDate() - 1);
    const prevDateStr1 = dateMinus1.toISOString().split('T')[0];

    const dateMinus2 = new Date(firstDate);
    dateMinus2.setDate(dateMinus2.getDate() - 2);
    const prevDateStr2 = dateMinus2.toISOString().split('T')[0];

    const prevDay1Context = getAssignmentsForDate(prevDateStr1);
    const prevDay2Context = getAssignmentsForDate(prevDateStr2);

    // --- CÁLCULO DE DOMINGOS Y FESTIVOS EN COLOMBIA (Fase 13.7) ---
    const sundaysAndHolidays = [];
    dates.forEach(d => {
      const dayOfWeek = new Date(d + 'T00:00:00').getDay();
      const holidayCheck = isColombianHoliday(d);
      if (dayOfWeek === 0 || holidayCheck.isHoliday) {
        sundaysAndHolidays.push({
          date: d,
          reason: dayOfWeek === 0 ? 'Domingo' : `Festivo: ${holidayCheck.name}`
        });
      }
    });

    // --- GENERACIÓN DEL BORRADOR BASE PROCEDIMENTAL MATEMÁTICO (Fase 13.9.5) ---
    setAiThinkingLogs(prev => [...prev, '🤖 [IA] Calculando propuesta base procedimental balanceada en JavaScript...']);
    let baseDraftSchedule = {};
    try {
      baseDraftSchedule = runAutoSchedulerForMonth(dates, controllers, exceptions, sequencePattern, requests);
      setAiThinkingLogs(prev => [...prev, '🤖 [IA] ¡Borrador base algorítmico generado con éxito! Garantizando descansos y rotaciones.']);
    } catch (err) {
      console.error("Error generating algorithmic base schedule:", err);
      setAiThinkingLogs(prev => [...prev, '⚠️ [SISTEMA] Error generando borrador. Procediendo a generación directa...']);
    }

    const prompt = `
      Eres el Ingeniero ATC Eldorado SKBO más experto del mundo.
      Tu rol es actuar como SUPERVISOR Y OPTIMIZADOR del cuadrante de turnos (roster) para el mes seleccionado:
      Mes: ${monthNames[selectedMonth]} ${selectedYear}
      Días a programar: ${dates.join(', ')}

      --- PROPUESTA BASE MATEMÁTICAMENTE COMPLETA (BORRADOR GENERADO ALGORÍTMICAMENTE) ---
      Hemos calculado algorítmicamente en JavaScript una propuesta base que cumple estrictamente con el 100% de los descansos obligatorios, licencias, límites de 12 horas, fatigas y balance de turnos de tarde:
      ${JSON.stringify(baseDraftSchedule, null, 2)}

      Tu objetivo principal es tomar este BORRADOR algorítmico base y realizar una OPTIMIZACIÓN SEMÁNTICA inteligente.
      
      Instrucciones de Optimización Mandatorias:
      1. Mantener los Descansos de Seguridad: BAJO NINGUNA CIRCUNSTANCIA debes eliminar, reducir o acortar la cantidad de descansos completos (DESCANSO o LIBRE) que ya tenga asignados un controlador en la propuesta base.
      2. Resolver Peticiones Preferentes: Analiza las peticiones de los controladores ('activeRequests') y, en caso de que la propuesta base no las haya acomodado, realiza sutiles reajustes y permutas de turnos entre controladores con las mismas licencias para satisfacer sus solicitudes preferentes de turnos de mañana o tarde.
      3. Balancear Turnos de Tarde (T) y Mañana (M): Evita rigurosamente que un controlador quede saturado trabajando turnos de tarde consecutivamente o sin descansos. Distribuye uniformemente la carga de trabajo de tarde y mañana entre el personal activo disponible de Eldorado.
      4. Respetar Costuras Semanales: Asegúrate de dar continuidad al historial inmediato (Días -1 y -2) inyectado abajo para evitar rupturas de secuencia.

      --- SECUENCIA ROTATORIA DINÁMICA DEL SISTEMA ---
      Debes respetar estrictamente la siguiente secuencia de rotación de turnos configurada en la plataforma:
      ${sequencePattern && sequencePattern.length > 0 ? sequencePattern.join(' -> ') : 'N -> A -> DESCANSO -> M+T -> T -> DESCANSO'}
      Asegúrate de programar las transiciones de turnos de los controladores de acuerdo a esta secuencia ideal basándote en la disponibilidad y balance.

      --- DOMINGOS Y FESTIVOS (RESTRICCIONES ESPECIALES DE OPERACIÓN) ---
      Las siguientes fechas de este rango son Domingos o Festivos nacionales en Colombia:
      ${sundaysAndHolidays.length > 0 ? JSON.stringify(sundaysAndHolidays, null, 2) : 'No hay domingos ni festivos en este periodo.'}

      Instrucciones Mandatorias para Domingos y Festivos:
      1. Prohibición de Turnos Suplementarios (Dobles): Ningún controlador puede ser programado en turnos dobles (M+T o T+N) en estas fechas. Solo se acepta máximo 1 turno de 6 horas por persona ese día.
      2. Asignación de Posiciones: Se debe buscar asignar TODAS las posiciones físicas activas de Eldorado ese día.
      3. Prohibición de DESCANSO: No se permite programar el estado de "DESCANSO" ordinario a controladores activos en estas fechas específicas (los dos descansos garantizados a la semana se deben programar en días hábiles de lunes a sábado).
      4. Estado LIBRE Especial: Si un controlador activo no recibe ninguna asignación operativa en un Domingo o Festivo (porque todas las posiciones operativas ya fueron cubiertas por otros compañeros), su estado ese día debe ser "LIBRE" (este estado no consume ni cuenta dentro de su cuota de 2 descansos semanales obligatorios).

      --- CONTEXTO HISTÓRICO Y PREVENCIÓN DE FATIGA (DÍAS PREVIOS) ---
      Para mantener la secuencia rotatoria y evitar la fatiga operativa en la costura de cambio de rango semanal, ten en cuenta los turnos que los controladores realizaron en los días inmediatamente anteriores a esta programación:

      Asignaciones del Día Anterior (${prevDateStr1}):
      ${Object.keys(prevDay1Context).length > 0 ? JSON.stringify(prevDay1Context, null, 2) : 'No hay datos registrados (asume que el personal inicia descansado).'}

      Asignaciones de 2 Días Atrás (${prevDateStr2}):
      ${Object.keys(prevDay2Context).length > 0 ? JSON.stringify(prevDay2Context, null, 2) : 'No hay datos registrados.'}

      Instrucciones Imperativas de Continuidad de Costura:
      1. Descanso Post-Nocturnidad en Costura: Si un controlador trabajó en el turno N (Noche) o A (Madrugada) el día anterior (${prevDateStr1}), es OBLIGATORIO asignarle DESCANSO en el primer día de este rango de programación (${dates[0]}). No se le puede programar turno de Mañana (M) o Tarde (T) en esa fecha inicial.
      2. Continuidad del Roster: Calcula en qué día del ciclo de secuencia dinámica se encuentra cada controlador en base a sus asignaciones previas del día anterior y 2 días atrás, y prosigue su patrón de rotación de forma consistente.

      --- REGLAS DINÁMICAS ESTRICTAS A SEGUIR ---
      ${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

      --- REGLAS DE ENTRENAMIENTO Y ALUMNOS (ENT) ---
      * Los slots marcados como ENT (entrenamiento) están reservados únicamente para controladores que tengan 'trainingPreferred: true'.
      * Los controladores con 'trainingPreferred: true' SÍ pueden realizar turnos operativos normales en cualquier posición que su licencia les permita.
      * Se permite programar a un alumno un turno de entrenamiento (ENT) combinado con un turno operativo el mismo día (ej: Mañana y Tarde), siempre que no supere las 12 horas diarias y se respeten las combinaciones dobles válidas (M+T o T+N).
      * No existe ninguna prohibición de turnos de madrugada (A) para los alumnos.

      --- REGLAS DE DESCANSO Y FATIGA ---
      * Prioridad Absoluta de Descanso Semanal: Se debe dar máxima prioridad a asegurar que cada controlador activo tenga mínimo 2 descansos completos (DESCANSO o LIBRE) a la semana (rango de 7 días).
      * Cualquier controlador programado en el turno de Madrugada (A) queda inhabilitado para realizar cualquier otro turno el mismo día calendario.
      * Tras un turno de Noche (N) o Madrugada (A), el controlador debe programarse en DESCANSO antes de volver a ingresar a un turno operativo de Mañana o Tarde.
      * Únicamente se permiten combinaciones de turnos dobles en las configuraciones M+T (Mañana y Tarde) o T+N (Tarde y Noche). Cualquier otra combinación doble está estrictamente prohibida por fatiga y seguridad.

      --- PERSONAL DE CONTROLADORES ---
      ${JSON.stringify(activeCtrls, null, 2)}

      --- EXCEPCIONES DE DISPONIBILIDAD (No programar en estas fechas a los respectivos IDs) ---
      ${JSON.stringify(activeExceptions, null, 2)}

      --- PETICIONES PREFERENTES DE TURNOS ---
      ${JSON.stringify(activeRequests, null, 2)}

      --- INSTRUCCIONES DE SALIDA ---
      Devuelve un JSON estrictamente estructurado donde cada día sea una llave y contenga los turnos M, T, N, A.
      Dentro de cada turno, asigna los IDs de los controladores a las posiciones exactas de Eldorado.
      Las posiciones físicas reales activas de Eldorado que debes asignar estrictamente por cada turno son:

      1. Turno de Madrugada (A):
         * Torre (3 slots): TWR-1, TWR-2, TWR-3 (Habilitación TWR requerida)
         * Superficie (3 slots): GND-1, GND-2, GND-3 (Habilitación GND requerida)
         * Autorizaciones (1 slot): DEL-1 (Habilitación DEL requerida)
         * Entrenamiento (1 slot): ENT-1 (Reservado únicamente para personal con 'trainingPreferred: true')
         * Centro (0 slots): No se programa Centro en Madrugada. Asignar null.
         * FIC (0 slots): No se programa FIC en Madrugada. Asignar null.
         *(Total slots en A: 8)

      2. Turno de Mañana (M) y Tarde (T):
         * Centro (1 slot): CTE-1 (Habilitación CTE requerida)
         * Torre (3 slots): TWR-1, TWR-2, TWR-3 (Habilitación TWR requerida)
         * Superficie (3 slots): GND-1, GND-2, GND-3 (Habilitación GND requerida)
         * Autorizaciones (2 slots): DEL-1, DEL-2 (Habilitación DEL requerida)
         * FIC (3 slots): FIC-1, FIC-2, FIC-3 (Habilitación FIC requerida)
         * Entrenamiento (1 slot): ENT-1 (Reservado únicamente para personal con 'trainingPreferred: true')
         *(Total slots en M y T: 13)

      3. Turno de Noche (N):
         * Centro (1 slot): CTE-1 (Habilitación CTE requerida)
         * Torre (3 slots): TWR-1, TWR-2, TWR-3 (Habilitación TWR requerida)
         * Superficie (3 slots): GND-1, GND-2, GND-3 (Habilitación GND requerida)
         * Autorizaciones (2 slots): DEL-1, DEL-2 (Habilitación DEL requerida)
         * Entrenamiento (1 slot): ENT-1 (Reservado únicamente para personal con 'trainingPreferred: true')
         * FIC (0 slots): No se programa FIC en Noche. Asignar null.
         *(Total slots en N: 10)

      Si una posición queda vacía porque no se requiere o no se programa en ese turno, asígnale valor null.
      Asegúrate de balancear perfectamente los turnos, respetando descansos y habilitaciones de licencias.
      DEVUELVE ÚNICAMENTE EL JSON.
    `;

    try {
      setAiThinkingLogs(prev => [...prev, '🤖 [IA] Enviando prompt contextualizado a Gemini...']);
      
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      
      setAiThinkingLogs(prev => [...prev, '🤖 [IA] Respuesta JSON recibida. Validando consistencia estructural...']);
      
      const generatedRoster = JSON.parse(rawText);
      
      // Aplicar al schedule de Firestore
      await onSaveScheduleMonth(generatedRoster);
      
      setAiThinkingLogs(prev => [
        ...prev, 
        '🎉 [SISTEMA] ¡Malla mensual generada e inyectada con éxito a Firestore!',
        `👉 Visita la pestaña "Malla Mensual" para verificar el resultado del mes de ${monthNames[selectedMonth]}.`
      ]);
      
      alert(`¡Malla mensual de ${monthNames[selectedMonth]} generada con éxito por la IA!`);
    } catch (err) {
      console.error(err);
      let errMsg = err.message;
      if (errMsg.includes('terms of service') || errMsg.includes('PERMISSION_DENIED')) {
        setAiError(
          'La generación falló debido a que no se han aceptado los Términos de Servicio de IA de Google Cloud para este proyecto.\n\n' +
          'Accede a este enlace para habilitarlo en 1 clic:\n' +
          'https://console.cloud.google.com/terms/generative-language-api?project=aircontrol-skbo-sbg'
        );
      } else {
        setAiError(`Error de ejecución en Gemini: ${errMsg}`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  // 💬 CHAT CONVERSACIONAL CO-PILOTO CON GEMINI
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    const model = getAiModelSafe(false);
    if (!model) {
      setChatLoading(false);
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        text: '⚠️ No puedo procesar tu solicitud ya que los términos de servicio de la API de IA en Google Cloud no han sido aceptados para este proyecto de Firebase. Por favor, acéptalos en: https://console.cloud.google.com/terms/generative-language-api?project=aircontrol-skbo-sbg y vuelve a intentar.' 
      }]);
      return;
    }

    const contextRulesPrompt = `
      Eres el Asistente Copiloto ATC Oficial para Eldorado SKBO.
      Tu rol es guiar al administrador, responder dudas sobre las regulaciones operativas del sistema o ayudar con consultas.
      Las reglas de negocio activas en el sistema son:
      ${rules.map((r) => `- ${r}`).join('\n')}

      Responde la siguiente pregunta del administrador de forma concisa, profesional y directa en español:
      "${userText}"
    `;

    try {
      const result = await model.generateContent(contextRulesPrompt);
      const reply = result.response.text();
      setChatMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        text: '⚠️ Ocurrió un error al contactar a Gemini. Verifica que los términos de servicio de Generative Language estén aceptados en Google Cloud Console.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="dashboard-grid">
      
      {/* Columna Izquierda: Generación de Roster & Reglas Dinámicas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Panel Selector de IA */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <Brain size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.2rem' }}>
              Roster Inteligente ATC (IA)
            </h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Genera de forma balanceada todos los turnos del mes calendario seleccionado respetando licencias, peticiones, excepciones y reglas dinámicas.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Año</label>
              <select 
                className="form-input" 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                disabled={aiLoading}
              >
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>Mes</label>
              <select 
                className="form-input" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                disabled={aiLoading}
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 2.2 }}>
              <label>Rango de Días</label>
              <select 
                className="form-input" 
                value={selectedRange} 
                onChange={(e) => setSelectedRange(e.target.value)}
                disabled={aiLoading}
                style={{ borderColor: 'var(--accent-indigo)' }}
              >
                <option value="1-7">Semana 1 (Días 1-7)</option>
                <option value="8-14">Semana 2 (Días 8-14)</option>
                <option value="15-21">Semana 3 (Días 15-21)</option>
                <option value="22-28">Semana 4 (Días 22-28)</option>
                <option value="29-end">Semana 5 (Días 29-Fin)</option>
                <option value="full">Mes Completo (Lento)</option>
              </select>
            </div>
          </div>

          {aiError && (
            <div style={{
              backgroundColor: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: 'var(--status-danger)',
              fontSize: '0.8rem',
              fontWeight: '500',
              lineHeight: '1.4',
              marginBottom: '1rem',
              wordBreak: 'break-word'
            }}>
              <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
              <span>{aiError}</span>
            </div>
          )}

          <button
            onClick={handleGenerateRosterAI}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.8rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            disabled={aiLoading}
          >
            <Sparkles size={16} />
            {aiLoading ? 'Generando con Gemini...' : `Generar Malla de ${monthNames[selectedMonth]}`}
          </button>
        </div>

        {/* Panel Consola de Streaming */}
        {aiThinkingLogs.length > 0 && (
          <div className="glass-panel" style={{ height: 'fit-content', backgroundColor: '#090d16' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Terminal size={16} style={{ color: 'var(--status-success)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--status-success)' }}>
                Consola ATC de Razonamiento IA
              </span>
            </div>

            <div style={{
              height: '140px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              color: '#10b981',
              lineHeight: '1.4',
              paddingRight: '0.5rem'
            }}>
              {aiThinkingLogs.map((log, idx) => (
                <div key={idx} style={{
                  borderLeft: log.includes('SISTEMA') ? '2px solid #3b82f6' : '2px solid #10b981',
                  paddingLeft: '0.5rem'
                }}>
                  {log}
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        )}

        {/* Módulo de Administración de Reglas Dinámicas */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <Settings size={20} style={{ color: 'var(--accent-indigo)' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.15rem' }}>
              Reglas Dinámicas del Sistema
            </h3>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
            Añade, elimina o modifica las directivas de seguridad operativa de Eldorado. Gemini las respetará de inmediato al generar el roster.
          </p>

          {rulesLoading ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Cargando directivas de la nube...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem', maxHeight: '220px', overflowY: 'auto' }}>
              {rules.map((rule, idx) => (
                <div 
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {rule}
                  </span>
                  <button
                    onClick={() => handleDeleteRule(idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--status-danger)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title="Eliminar directiva"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddRule} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Restringir a ATC-001 de turnos de noche..."
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              required
              disabled={rulesLoading}
              style={{ fontSize: '0.8rem' }}
            />
            <button 
              type="submit" 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '700' }}
              disabled={rulesLoading}
            >
              <Plus size={16} /> Añadir
            </button>
          </form>
        </div>

      </div>

      {/* Columna Derecha: Chat Conversacional con Copiloto ATC */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          height: '520px',
          justifyContent: 'space-between'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <Bot size={22} style={{ color: 'var(--accent-indigo)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '1.15rem', margin: 0 }}>
                Copiloto Conversacional ATC
              </h3>
              <span style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem', fontWeight: '700' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }} /> En línea
              </span>
            </div>
          </div>

          {/* Historial del Chat */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            paddingRight: '0.5rem',
            marginBottom: '1rem'
          }}>
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: msg.role === 'user' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                  border: msg.role === 'user' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--color-border)',
                  borderRadius: '16px',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderTopLeftRadius: msg.role === 'model' ? '4px' : '16px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  lineHeight: '1.5'
                }}
              >
                {msg.text}
              </div>
            ))}

            {chatLoading && (
              <div style={{
                alignSelf: 'flex-start',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: '16px',
                borderTopLeftRadius: '4px',
                padding: '0.75rem 1rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic'
              }}>
                Copiloto pensando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input del Chat */}
          <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Pregúntame sobre la malla de Eldorado..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
              required
              style={{ fontSize: '0.8rem' }}
            />
            <button 
              type="submit" 
              className="btn btn-primary btn-icon-only" 
              style={{ padding: '0.6rem 0.8rem' }}
              disabled={chatLoading}
            >
              <Send size={15} />
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
