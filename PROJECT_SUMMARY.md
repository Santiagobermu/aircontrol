# AirControl - Sistema de Gestión y Optimización de Turnos ATC (El Dorado - SKBO)

Este documento sirve como mapa técnico completo y exhaustivo del proyecto **AirControl** para que cualquier desarrollador o modelo de IA pueda entender de manera instantánea la arquitectura, la base de datos, los motores de programación, la aplicación móvil PWA, las reglas matemáticas del solucionador, la integración de NOTAMs y la terminología aeronáutica del sistema.

---

## 📌 Resumen General del Proyecto
**AirControl** es una aplicación web progresiva (PWA) de página única (SPA) diseñada para gestionar, visualizar y optimizar de forma automática el roster mensual de Controladores de Tránsito Aéreo (ATC) en el Aeropuerto Internacional El Dorado (SKBO).

El sistema cuenta con una arquitectura híbrida de optimización y doble interfaz responsiva (Escritorio + Móvil PWA):
1. **Solucionador de Restricciones (Google OR-Tools CP-SAT)** ejecutado en Python en el backend (servidor Flask local / Firebase Cloud Functions) para una optimización matemática exacta.
2. **Motor Heurístico Local en JavaScript** ejecutado en el cliente como plan de resguardo (*fallback*) automático en caso de desconexión o falla de red.
3. **Aplicación Móvil PWA Táctil**: Interfaz nativa para teléfonos inteligentes (iOS / Android) basada en un sistema de diseño Glassmorphic, navegación por pestañas inferiores (Bottom Nav), modales *Bottom Sheet*, sincronización de NOTAMs y Webcal `.ics` en un toque.

---

## 🗂️ Arquitectura del Directorio y Componentes

```
├── PROJECT_SUMMARY.md         # Documentación maestra técnica del proyecto (Este archivo)
├── AIRCONTROL_STITCH_SPEC.md  # Especificación de diseño de UI/UX para apps móviles y web
├── DESIGN.md                  # Tokens de diseño, paleta de colores de turnos y estética Radar
├── TURNOS TWR AGOSTO 2026.xlsx# Archivo oficial de referencia del roster de Torre SKBO
├── package.json               # Dependencias de npm (Vite, React 19, Lucide React, XLSX, Firebase)
├── firebase.json              # Configuración de Firebase Hosting y Cloud Functions
├── firestore.rules            # Reglas de seguridad de Firestore Database
├── storage.rules              # Reglas de almacenamiento de suscripciones webcal (.ics)
├── public/                    # Archivos estáticos e infraestructura PWA
│   └── manifest.json          # Manifiesto PWA para instalación standalone en teléfonos
├── functions/                 # Backend de Optimización Matemática y Parser NOTAMs (Python 3.11)
│   ├── local_server.py        # Servidor Flask local para desarrollo (Puerto 8080)
│   ├── main.py                # Punto de entrada para Firebase Cloud Functions
│   ├── solver_engine.py       # Modelo matemático CP-SAT de Google OR-Tools
│   ├── notams_parser.py       # Parser de NOTAMs oficiales y categorización
│   └── requirements.txt       # Dependencias Python (ortools, flask, flask-cors, firebase-admin)
└── src/                       # Frontend SPA (React + Vanilla CSS)
    ├── main.jsx               # Inicialización de la aplicación React
    ├── App.jsx                # Estado global, autenticación JIT, ruteo responsivo (Desktop/Mobile)
    ├── index.css              # Sistema de diseño, tokens CSS, dark/light mode y utilidades Glassmorphism
    ├── components/            # Componentes React de Negocio (Escritorio)
    │   ├── MonthlyGrid.jsx       # Malla mensual interactiva (edición manual, importador Excel)
    │   ├── ControllerPortal.jsx  # Portal del controlador (peticiones, swaps y suscripción webcal)
    │   ├── RequestPanel.jsx      # Panel de administración de peticiones y descansos
    │   ├── AICopilotPanel.jsx    # Asistente Copiloto IA y disparador del solver OR-Tools
    │   ├── TradePanel.jsx        # Gestión y aprobación de intercambios de turnos entre controladores
    │   ├── SchedulerSummary.jsx  # Gráficas, analíticas y balance de horas del roster
    │   ├── ControllerList.jsx     # Gestión de perfiles, firmas y certificaciones de controladores
    │   ├── ControllerForm.jsx     # Formulario de creación/edición de controlador
    │   ├── SchedulerGrid.jsx      # Grilla principal de turnos diarios por jornada
    │   ├── ThemeToggle.jsx        # Interruptor de modo claro / modo oscuro con persistencia
    │   └── LoginScreen.jsx       # Pantalla de autenticación por siglas o correo
    │
    └── components/mobile/     # Módulos y Pantallas para Dispositivos Móviles (PWA)
        ├── MobileLayout.jsx      # Envoltorio principal con ruteador táctil e integración de estado
        ├── MobileHeader.jsx      # Barra superior con reloj UTC en vivo, iniciales y centro de notificaciones
        ├── MobileBottomNav.jsx   # Barra de navegación inferior (Roster, En Turno, Cambios, NOTAMs, Perfil)
        ├── MobileRosterView.jsx  # Hero Card "Próximo Turno", grilla mensual homogénea y modal Bottom Sheet
        ├── MobileGuardiaView.jsx # Vista "En Turno" con jornadas A/M/T/N, posiciones completas y resaltado (tú)
        ├── MobileTradesView.jsx  # Gestión de Cambios (SWAP/COVER), filtro estricto y formulario táctil
        ├── MobileNotamsView.jsx  # Boletines NOTAMs con texto completo JetBrains Mono, pestañas Web y sync CTE
        └── MobileProfileView.jsx # Perfil táctico, copia Webcal 1-tap, herramientas CTE y cambio de clave
    └── utils/                 # Utilidades y Lógica de Negocio
        ├── firebase.js           # Inicialización del SDK de Firebase (Firestore, Storage, Auth)
        ├── db.js                 # Helpers CRUD de lectura/escritura en Firestore (trades, alerts, rules)
        ├── calendarExport.js     # Generador de suscripciones iCalendar (.ics) para webcal
        ├── ortoolsScheduler.js   # Cliente API HTTP para conectar con el backend CP-SAT
        └── schedulerEngine.js    # Motor heurístico local JS, traductor de siglas y festivos colombianos
```

---

## 📱 Aplicación Móvil PWA (`src/components/mobile/`)

AirControl detecta automáticamente si el dispositivo es un teléfono inteligente (`window.innerWidth <= 768px`) o si el usuario activa el modo móvil, renderizando `MobileLayout` con 5 pestañas de navegación táctil:

1. **Mi Roster (`MobileRosterView.jsx`)**:
   - Tarjeta **Hero "Próximo Turno"** destacando la sigla precisa de posición (`LNT`, `GNT`, `DPT`), horas UTC y fecha.
   - Grilla de calendario homogénea (7 columnas) mostrando turnos completos en 4 letras (`MLNT`, `NGNT`) y apilado vertical para turnos dobles.
   - Modal *Bottom Sheet* al tocar cualquier día para ver detalles, compañeros en guardia y botón rápido para solicitar cambio.

2. **En Turno (`MobileGuardiaView.jsx`)**:
   - Selector de jornada (**Madrugada A**, **Mañana M**, **Tarde T**, **Noche N**) y día (**Turno de Hoy** / **Turno de Mañana**).
   - Nombres completos de posición: *Torre Norte (LNT)*, *Torre Sur (LST)*, *Superficie Norte (GNT)*, *Autorizaciones Titular (DPT)*, *Encargado de Turno (CTE)*, etc.
   - Resaltado visual en color cyan brillante con etiqueta **`FIRMA (tú)`** para el controlador autenticado.

3. **Cambios (`MobileTradesView.jsx`)**:
   - Listado de permutas y reemplazos (SWAP / COVER) filtrado estrictamente para el usuario autenticado (solicitudes propias, dirigidas o públicas pendientes).
   - Botón **`➕ Nuevo cambio`** que despliega un formulario *Bottom Sheet* para solicitar permutaciones con detección de turno asignado.

4. **NOTAMs (`MobileNotamsView.jsx`)**:
   - Renderizado del texto explicativo completo del boletín oficial en tipografía `JetBrains Mono`.
   - Pestañas de alcance idénticas a la web: **SKBO**, **Otros AD (AD_CLSD)**, **Flujo (FLOW)**, **ASHTAM**.
   - Sub-filtros para SKBO: `TODOS`, `RWY`, `TWY`, `SID/STAR/APP`, `OTROS`.
   - Botones de **Sincronizar NOTAMs** y **Agregar Alerta Operativa** para usuarios con rol de Encargado (CTE).

5. **Perfil (`MobileProfileView.jsx`)**:
   - Tarjeta de perfil táctico con firmas, correo y certificaciones del controlador.
   - Botón **Copiar Enlace de Suscripción Webcal (.ics)** para vincular el horario con Apple Calendar o Google Calendar.
   - Herramientas para Encargados de Turno (CTE) y modal interactivo para **Cambiar Contraseña** mediante Firebase Auth.

---

## 🔤 Nomenclatura Oficial de Posiciones y Siglas Operativas

Cada celda y turno se compone de la **letra de la jornada** (`M`=Mañana, `T`=Tarde, `N`=Noche, `A`=Amanecida/Madrugada) antecedida a la sigla de la posición:

| Categoría | Posición Interna | Sigla Oficial | Descripción en El Dorado (SKBO) |
| :--- | :--- | :--- | :--- |
| **Encargado** | `CTE-1` | `CTE` | Encargado de Turno (`MCTE`, `TCTE`, `NCTE`, `ACTE`) |
| **Torre (`TWR`)** | `TWR-1` | `LNT` | Torre Norte (`MLNT`, `TLNT`, `NLNT`, `ALNT`) |
| | `TWR-2` | `LST` | Torre Sur (`MLST`, `TLST`, `NLST`, `ALST`) |
| | `TWR-3` | `LPT` | Torre Reserva (`MLPT`, `TLPT`, `NLPT`, `ALPT`) |
| **Superficie (`GND`)** | `GND-1` | `GNT` | Superficie Norte (`MGNT`, `TGNT`, `NGNT`, `AGNT`) |
| | `GND-2` | `GST` | Superficie Sur (`MGST`, `TGST`, `NGST`, `AGST`) |
| | `GND-3` | `GPT` | Superficie Reserva (`MGPT`, `TGPT`, `NGPT`, `AGPT`) |
| **Autorizaciones (`DEL`)** | `DEL-1` | `DPT` | Autorizaciones Titular (`MDPT`, `TDPT`, `NDPT`, `ADPT`) |
| | `DEL-2` | `DPR` | Autorizaciones Reserva (`MDPR`, `TDPR`, `NDPR`, `ADPR`) |
| **FIC** | `FIC-1` | `FPT` | FIC Titular (`MFPT`, `TFPT`) |
| | `FIC-2` | `FPR` | FIC Reserva (`MFPR`, `TFPR`) |
| | `FIC-3` | `FPA` | FIC Apoyo (`MFPA`, `TFPA`) |
| **Centro Control (`ACC`)** | `ACC-1` | `ACC` | Terminales Centro de Control (`MACC`, `TACC`, `NACC`, `AACC`) |
| **Pseudopiloto** | `SIM-1` | `SIM` | Simulador de Vuelo (`MSIM`, `TSIM`, `NSIM`, `ASIM`) |
| **Oficina** | `OFI-1` | `OFI` | Turnos Administrativos (`MOFI`, `TOFI`) |
| **Capacitación** | `CAE-1` | `CAE` | Capacitación Especial (`MCAE`, `TCAE`) |
| **Chequeo** | `CHC-1` | `CHC` | Chequeo / Evaluación (`MCHC`, `TCHC`, `NCHC`, `ACHC`) |
| **Entrenamiento** | `ENT-1` | `ENT` | Entrenamiento Alumno (`MENT`, `TENT`, `NENT`, `AENT`) |
| **Instrucción** | `INS-1` | `INS` | Instrucción Operativa (`MINS`, `TINS`, `NINS`, `AINS`) |

---

## 🛠️ Detalle de los Motores de Programación

### 1. El Solucionador Matemático CP-SAT (`functions/solver_engine.py`)

Resuelve el cuadrante mensual mediante optimización basada en restricciones duras e inflexibles (*Hard Constraints*) y una función objetivo jerárquica con penalizaciones ponderadas.

#### Matriz de Cobertura Diaria Obligatoria (39 Slots Obligatorios Todos los Días):
* **Madrugada (`A`) [6 slots]**: `ALNT` (`TWR-1`), `ALST` (`TWR-2`), `ACTE` (`CTE-1`), `AGNT` (`GND-1`), `AGST` (`GND-2`), `ADPR` (`DEL-2`).
* **Mañana (`M`) [12 slots]**: `MCTE` (`CTE-1`), `MLNT` (`TWR-1`), `MLST` (`TWR-2`), `MLPT` (`TWR-3`), `MGNT` (`GND-1`), `MGST` (`GND-2`), `MGPT` (`GND-3`), `MDPT` (`DEL-1`), `MDPR` (`DEL-2`), `MFPT` (`FIC-1`), `MFPR` (`FIC-2`), `MFPA` (`FIC-3`).
* **Tarde (`T`) [12 slots]**: `TCTE` (`CTE-1`), `TLNT` (`TWR-1`), `TLST` (`TWR-2`), `TLPT` (`TWR-3`), `TGNT` (`GND-1`), `TGST` (`GND-2`), `TGPT` (`GND-3`), `TDPT` (`DEL-1`), `TDPR` (`DEL-2`), `TFPT` (`FIC-1`), `TFPR` (`FIC-2`), `TFPA` (`FIC-3`).
* **Noche (`N`) [9 slots]**: `NCTE` (`CTE-1`), `NLNT` (`TWR-1`), `NLST` (`TWR-2`), `NLPT` (`TWR-3`), `NGNT` (`GND-1`), `NGST` (`GND-2`), `NGPT` (`GND-3`), `NDPT` (`DEL-1`), `NDPR` (`DEL-2`).

#### Exclusión de Programación Automática:
* Las posiciones **`SIM`**, **`INS`**, **`CHC`** y **`OFI`** **NUNCA** son programadas por la IA. Solo se asignan de forma manual o por presets.

#### Reglas de Encadenamiento Inviolables (Hard Constraints):
1. **`NCTE` ➔ `ACTE`**: La asignación de `NCTE` el día $d$ impone matemáticamente `ACTE` al controlador el día $d+1$.
2. **`NDPR` ➔ `ADPR`**: La asignación de `NDPR` el día $d$ impone matemáticamente `ADPR` al controlador el día $d+1$.
3. **Descansos Obligatorios por Transición**:
   - No se permite Mañana (`M`) el día $d+1$ si se trabajó Noche (`N`) el día $d$.
   - No se permite Madrugada (`A`) el día $d+1$ si se trabajó Tarde (`T`) el día $d$.
4. **Límite OACI de Carga Diaria**: Máximo 2 turnos (12 horas) por controlador en el mismo día. Si realiza doble turno, deben ser continuos (`M+T` o `T+N`).
5. **Certificación**: Solo se asignan posiciones operativas si el perfil del controlador contiene la habilidad correspondiente (`skills`). Las posiciones dinámicas/abiertas (`ENT`, `INS`, `CAE`, `CHC`, `OFI`) no requieren certificación previa.
6. **Descansos Explícitos**: Cualquier día en que un controlador no trabaje ningún turno y no tenga licencia/vacaciones se marca automáticamente como **`DESCANSO`**.

#### Función Objetivo Jerárquica:
1. **Prioridad 1 (Peso 1,000,000)**: Minimizar slots requeridos sin asignar (*unassigned slots*).
2. **Prioridad 2 (Peso 10,000)**: Maximizar la equidad en el balance de carga mensual entre controladores.
3. **Prioridad 3 (Peso 100)**: Minimizar la duplicidad o suplementarios excesivos.
4. **Prioridad 4 (Peso 1)**: Maximizar la alineación con la secuencia rotativa teórica de 6 días.

---

### 2. El Importador de Excel Inteligente (`src/components/MonthlyGrid.jsx`)

Permite importar rosters mensuales oficiales (`.xlsx`) con 100% de precisión y cero pérdida de datos.

* **Asignación Dinámica de Slots Sin Sobreescritura (Zero-Loss)**:
  - Al procesar posiciones como `ENT`, `INS`, `SIM`, `OFI`, `CAE`, `CHC`, `ACC`, el importador busca casillas libres secuenciales (`ENT-1`, `ENT-2`, `ENT-3`...). Esto evita que múltiples alumnos o entrenadores en un mismo turno sobreescriban sus casillas.
* **Mapeo de Terminales ACC**:
  - Los códigos de terminales `MTNT`, `MTNR`, `TNTR`, `TTNR`, `TTNA`, `MTNA`, `MTST`, `MTSA`, `TTST`, `TTSR`, `NTST`, `MTSR`, `NTNR`, `NTNT`, `TUWA`, `NUWA` se traducen automáticamente a la categoría **Centro de Control (`ACC-1`)**.

---

## 💾 Esquemas de Datos en Firestore

### 1. Colección `controllers`
```json
{
  "id": "JZA",                  // Firma / Iniciales únicas del controlador
  "name": "Jorge Zubiría",
  "active": true,
  "skills": ["TWR", "GND", "DEL", "FIC", "ACC", "SIM"], // Habilidades vigentes
  "trainingPreferred": false,   // True si es Alumno en entrenamiento
  "calendarSyncEnabled": true,  // True si tiene suscripción webcal activa
  "calendarSyncUrl": "https://firebasestorage.googleapis.com/v0/b/aircontrol-skbo-sbg.firebasestorage.app/o/calendars%2FJZA.ics?alt=media",
  "sequenceOffset": 2           // Desfase para rotación teórica
}
```

### 2. Colección `schedule` (ID en formato `YYYY-MM-DD`)
```json
{
  "A": { "CTE-1": "ACT", "TWR-1": "LNT", "TWR-2": "LST", "GND-1": "GNT", "GND-2": "GST", "DEL-2": "DPR" },
  "M": { "CTE-1": "JZA", "TWR-1": "GMB", "TWR-2": "CSO", "TWR-3": "LSG", "ENT-1": "GAM", "ENT-2": "DSE" },
  "T": { "CTE-1": "ZAO", "TWR-1": "JMA" },
  "N": { "CTE-1": "OVM", "TWR-1": "AFA" }
}
```

### 3. Colección `exceptions` (ID = Firma del Controlador)
```json
{
  "JZA": {
    "2026-08-01": "DESCANSO",
    "2026-08-15": "VACACIONES",
    "2026-08-20": "LICR"
  }
}
```

### 4. Colección `trades` (Intercambios y Coberturas)
```json
{
  "id": "trade_1785960000",
  "type": "SWAP",               // SWAP o COVER
  "dateStr": "2026-08-15",
  "requesterSignature": "SBG",
  "requesterName": "Santiago Bermúdez",
  "requesterShift": "MLNT",
  "targetSignature": "OPEN",    // O sigla del controlador específico
  "targetName": "Abierta a cualquier compañero",
  "targetShift": "Por acordar",
  "isPublic": true,
  "comment": "Motivo o cita médica",
  "status": "pending",           // pending, approved, rejected
  "createdAt": "2026-08-05T20:00:00.000Z"
}
```

### 5. Documento `settings/notams_skbo` (Estructura de NOTAMs Oficiales)
```json
{
  "notams": [ ... ],             // Arreglo de NOTAMs para SKBO
  "adClosedNotams": [ ... ],     // Arreglo de NOTAMs para Otros Aeropuertos (AD_CLSD)
  "flowNotams": [ ... ],         // Arreglo de NOTAMs para Control de Flujo (FLOW)
  "ashtamNotams": [ ... ],       // Arreglo de NOTAMs para Ceniza Volcánica (ASHTAM)
  "lastUpdated": "2026-08-05T21:00:00Z",
  "pdfUrl": "https://..."
}
```

### 6. Colección `manual_alerts` (Avisos del Encargado de Turno)
```json
{
  "id": "alert_9812",
  "content": "Precaución en rodaje K por trabajos de mantenimiento...",
  "createdBy": "Santiago Bermúdez",
  "createdByEmail": "santiago@aircontrol.com",
  "createdAt": "2026-08-05T21:30:00Z",
  "expiresAt": null
}
```

---

## 🔒 Autenticación JIT y Selección de Temas

- **Inicio de Sesión**: Los controladores ingresan digitando sus **siglas/iniciales** (ej: `SBG`, `JZA`, `GMB`, `admin`). El sistema autocompleta el dominio `@aircontrol.com` internamente.
- **Tema Claro / Oscuro (`ThemeToggle.jsx`)**: Persistencia del tema en `localStorage` con adaptación inmediata de colores Glassmorphic en web y móvil PWA.

---

## 🚀 Despliegue y Endpoints Hosting

- **Frontend SPA / PWA**: Hospedado en Firebase Hosting ([https://aircontrol-skbo-sbg.web.app](https://aircontrol-skbo-sbg.web.app)).
- **Backend Solver CP-SAT**: Cloud Function ([`https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/solve_schedule_api`](https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/solve_schedule_api)).
- **Sincronización NOTAMs API**: Cloud Function ([`https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/sync_notams_api`](https://us-central1-aircontrol-skbo-sbg.cloudfunctions.net/sync_notams_api)).
- **Repositorio GitHub**: ([https://github.com/Santiagobermu/aircontrol.git](https://github.com/Santiagobermu/aircontrol.git)).
