# AirControl - Sistema de Gestión y Optimización de Turnos ATC

Este documento sirve como mapa técnico completo del proyecto **AirControl** para que cualquier desarrollador o IA pueda entender instantáneamente la arquitectura, las dependencias, la lógica de negocio y las intenciones futuras del sistema.

---

## 📌 Resumen General del Proyecto
**AirControl** es una aplicación web SPA diseñada para gestionar y optimizar de forma automática el roster mensual de Controladores de Tránsito Aéreo (ATC) en el aeropuerto El Dorado (SKBO). 

El sistema cuenta con un motor híbrido de programación:
1. **Solucionador de Restricciones (CP-SAT)** de **Google OR-Tools** ejecutado en Python (backend) para una optimización perfecta.
2. **Motor Heurístico Local en JavaScript** (frontend) como plan de respaldo (*fallback*) en caso de indisponibilidad del servidor backend.

---

## 🗂️ Arquitectura del Directorio y Componentes

El proyecto está dividido en dos capas principales: **Frontend (React/Vite)** y **Backend (Python/Flask/Firebase Functions)**.

```
├── PROJECT_SUMMARY.md         # Este archivo (Guía de contexto para IAs)
├── package.json               # Dependencias de npm (Vite, React, Lucide, XLSX, Firebase)
├── firebase.json              # Configuración de despliegue de Firebase Hosting y Functions
├── firestore.rules            # Reglas de seguridad de la base de datos Firestore
├── storage.rules              # Reglas de seguridad del almacenamiento de archivos (.ics)
├── functions/                 # Backend de Optimización (Python 3.11)
│   ├── local_server.py        # Servidor Flask local de desarrollo (Puerto 8080)
│   ├── main.py                # Entrada para Firebase Cloud Functions
│   ├── solver_engine.py       # Modelo matemático CP-SAT de Google OR-Tools
│   └── requirements.txt       # Dependencias de Python (ortools, flask, flask-cors)
└── src/                       # Frontend SPA (React + Vanilla CSS)
    ├── main.jsx               # Inicialización de la App React
    ├── App.jsx                # Panel de Control principal, estado global y sincronización con Firestore
    ├── index.css              # Sistema de diseño, paleta de colores oscuros y estilos visuales
    ├── components/            # Componentes React de UI y Negocio
    │   ├── MonthlyGrid.jsx       # Grilla interactiva del mes (edición manual, importación Excel)
    │   ├── ControllerPortal.jsx  # Vista de controlador (intercambio de turnos y sincronización webcal)
    │   ├── RequestPanel.jsx      # Registro de peticiones especiales, descansos y justificaciones
    │   ├── AICopilotPanel.jsx    # Panel del copiloto de IA y triggers del solver
    │   ├── TradePanel.jsx        # Gestión y aprobación de intercambios de turnos
    │   ├── SchedulerSummary.jsx  # Gráficas, balances y analíticas del roster
    │   └── LoginScreen.jsx       # Autenticación de roles (Admin/Supervisor/Controlador)
    └── utils/                 # Utilidades y Lógica de Negocio
        ├── firebase.js           # Configuración del SDK de Firebase
        ├── db.js                 # Helpers CRUD de lectura/escritura de Firestore
        ├── calendarExport.js     # Motor de generación de suscripciones webcal (.ics)
        ├── ortoolsScheduler.js   # Cliente API para conectar con el solver de OR-Tools
        └── schedulerEngine.js    # Motor heurístico local JS y gestor de días festivos colombianos
```

---

## 🛠️ Detalle del Código y Funciones Clave

### 1. El Motor de Optimización CP-SAT (`functions/solver_engine.py`)
Es el núcleo de optimización. Utiliza **Google OR-Tools CP-SAT** para resolver el cuadrante como un problema de satisfacción de restricciones (CSP).

* **Entrada**: Controladores activos, excepciones vigentes (vacaciones, licencias, etc.), patrón secuencial seleccionado, días del mes, festivos nacionales y pre-asignaciones existentes (presets).
* **Restricciones Duras (Hard Constraints)**:
  * **Certificaciones**: Solo asigna a un controlador si sus `skills` contienen la posición operativa (ej. `TWR`, `GND`, `DEL`, `FIC`, `CTE`).
  * **Excepciones**: Si el controlador tiene un estado especial en un día (`VACACIONES`, `DESCANSO`, `LICR`, `LICN`, `CMED`, `SIND`), no se le puede asignar jornada.
  * **Carga Máxima**: Límite de 12 horas diarias (máximo 2 turnos de 6 horas) por controlador.
  * **Consecutividad**: Si trabaja doble turno en un día, deben ser seguidos (`M+T` o `T+N`). No se permiten turnos alternados como `M+N` o jornada de madrugada `A` con otra jornada.
  * **Días Festivos/Domingos**: No se permiten turnos dobles en domingos o festivos colombianos.
  * **Descanso de Transición**: No se puede trabajar Mañana (`M`) si el día anterior se trabajó Noche (`N`). Tampoco Madrugada (`A`) si el día anterior se trabajó Tarde (`T`).
  * **Ventana de Descanso Semanal**: En cualquier ventana de lunes a sábado (o martes a sábado si el lunes es festivo), el controlador debe tener al menos un descanso asignado.
  * **Límite Mensual de Suplementarios**: Máximo 8 turnos dobles por controlador al mes.
  * **Evitar Jornada (`AVOID`)**: Si hay una petición de evitar un turno específico (ej. "Evitar Noche" el 10 de junio), el solver fuerza esa variable de decisión a `0`.
* **Función de Optimización (Jerárquica)**:
  1. *Prioridad 1 (Peso 1,000,000)*: Minimizar posiciones sin asignar (unassigned slots).
  2. *Prioridad 2 (Peso 10,000)*: Maximizar la equidad distribuyendo la carga de turnos lo más uniforme posible.
  3. *Prioridad 3 (Peso 100)*: Minimizar el uso de turnos dobles (suplementarios).
  4. *Prioridad 4 (Peso 1)*: Maximizar la alineación con el patrón secuencial rotativo seleccionado.

---

### 2. Integración de Calendarios (`src/utils/calendarExport.js`)
Permite a los controladores suscribirse a sus turnos en tiempo real mediante Google Calendar, Apple Calendar o Outlook.
* Genera dinámicamente un archivo estándar iCalendar (`.ics`) a partir de las asignaciones de Firestore.
* Sube el archivo `.ics` a Firebase Storage con acceso de lectura pública.
* Genera un enlace con esquema `webcal://` para sincronización unidireccional automática en los dispositivos móviles de los controladores.

---

### 3. Carga e Importación desde Excel (`src/components/MonthlyGrid.jsx`)
Permite al administrador cargar archivos `.xlsx` oficiales para poblar el cuadrante.
* **Mapeo Flex**: Capaz de ubicar la columna de firmas de los controladores en las primeras 3 columnas (columna 0, 1 o 2).
* **Mapeo Dinámico de Códigos**: Traduce códigos típicos (ej. `TCTE`, `NLNT`, `DESC`, `TROP`) a turnos y posiciones del sistema.
* Si el sistema detecta códigos no reconocidos (por ejemplo, `MUAR`), abre una interfaz modal para que el usuario defina en tiempo real a qué turno/excepción equivale dicho código.

---

## 💾 Modelos de Datos en Firestore

### 1. `controllers` (Colección de Controladores)
```json
{
  "id": "JZA",                  // Firma / ID único del controlador
  "name": "Jorge Zubiría",
  "active": true,
  "skills": ["TWR", "GND", "DEL"], // Certificaciones operativas vigentes
  "trainingPreferred": false,   // True si está en etapa de entrenamiento
  "calendarSyncEnabled": true,  // True si tiene sincronización de calendario activa
  "sequenceOffset": 2           // Desfase para el cálculo del patrón secuencial
}
```

### 2. `schedule` (Colección del Roster)
Documentos identificados por fecha en formato `YYYY-MM-DD`.
```json
{
  "A": { "TWR-1": "JZA", "GND-1": "GMB" }, // Asignaciones del turno de Madrugada
  "M": { "CTE-1": "ORG", "TWR-1": "JFW", "TWR-2": "GGO" }, // Asignaciones de Mañana
  "T": { "CTE-1": "LSG" },
  "N": { "TWR-1": "ZAO" }
}
```

### 3. `exceptions` (Excepciones de Asistencia)
Documento único por controlador que almacena su disponibilidad especial día por día.
```json
{
  "JZA": {
    "2026-06-12": "VACACIONES",
    "2026-06-15": "DESCANSO",
    "2026-06-20": "LICN"
  }
}
```

### 4. `requests` (Peticiones Especiales)
Almacena preferencias de asignación o bloqueos.
```json
{
  "id": "req-178309...",
  "controllerId": "JZA",
  "date": "2026-06-15",
  "position": "AVOID",          // Opciones: TWR, GND, DEL, FIC, CTE, DESCANSO, LICN, LICR, AVOID
  "shift": "N",                 // Turno preferido o turno a evitar (M, T, N, A, Cualquiera)
  "comment": "Cita médica familiar" // Justificación o notas opcionales
}
```

---

## 🔮 Estado Actual e Intenciones Futuras

### ¿Qué se ha completado recientemente?
1. **Solucionador OR-Tools**: Se migró con éxito el motor de auto-programación a Google OR-Tools en Python.
2. **Sincronización Webcal**: Integración de suscripción de calendarios en tiempo real via Firebase Storage.
3. **Módulo de Excepciones en Peticiones**: Implementación de peticiones de **Descanso (DESCANSO)**, **Licencia No Remunerada (LICN)** y **Licencia Remunerada (LICR)** que se guardan como excepciones directas en Firestore.
4. **Petición de Bloqueo (`AVOID`)**: Se agregó la funcionalidad para solicitar evitar turnos específicos, impidiendo que el solver asigne jornadas a esos turnos y días específicos.

### Siguientes Pasos e Intenciones del Proyecto:
* **Programación Manual de Festivos**: Habilitar a los administradores la programación manual de capacitaciones o entrenamientos durante domingos y festivos cuando no hay posiciones operativas asignadas por defecto.
* **Optimización Avanzada de Secuencias**: Refinar la penalización y comportamiento del solver para garantizar la secuencia rotativa estricta establecida por el administrador en la pestaña de configuración mensual.
