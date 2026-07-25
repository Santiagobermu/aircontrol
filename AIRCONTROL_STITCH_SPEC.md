# 🛸 AirControl SKBO - Especificación de UI/UX para App Móvil y Web (Guía Stitch)

> **Propósito del Documento:** Especificación técnica, visual y funcional completa de la plataforma **AirControl (Controladores de Tránsito Aéreo - Aeropuerto El Dorado SKBO)**. Diseñado específicamente para ser procesado por herramientas de generación UI/UX (como **Google Stitch**, Figma AI o v0) para construir la experiencia móvil y optimizar la aplicación web.

---

## 📌 1. Visión General del Producto

**AirControl** es la plataforma de gestión operativa y rotación inteligente de turnos para los **Controladores de Tránsito Aéreo (ATC)** del **Aeropuerto Internacional El Dorado (SKBO)** en Bogotá, Colombia.

La aplicación resuelve la complejidad de los cuadrantes operativos 24/7, garantizando descansos reglamentarios, gestión de licencias, sincronización en vivo con calendarios personales (`.ics`/Webcal), alertas de operaciones SKBO/NOTAMs y un sistema automatizado de intercambio de turnos con validación de certificaciones en tiempo real.

---

## 🎨 2. Sistema de Diseño y Estética Visual (Design Tokens)

La interfaz adopta una estética **Cockpit Dark Radar / Glassmorphism Premium**, inspirada en las pantallas de control de radar de aviación y tableros tácticos de alto rendimiento.

### 🎨 Paleta de Colores (HSL / Hex)
- **Fondo Principal (Space Dark):** `#090d16` (`hsl(222, 40%, 6%)`)
- **Superficies Glass (Paneles):** `rgba(15, 23, 42, 0.75)` con `backdrop-filter: blur(16px)` y borde `rgba(255, 255, 255, 0.08)`
- **Acento Primario (Cyan Radar):** `#06b6d4` (`hsl(188, 86%, 53%)`) - Usado para estados activos, navegación y métricas principales.
- **Acento Secundario (Indigo Tactical):** `#6366f1` (`hsl(239, 84%, 67%)`) - Usado para turnos A, insignias y acciones secundarias.
- **Alertas / Advertencias (Amber Tactical):** `#f59e0b` (`hsl(38, 92%, 50%)`) - Para NOTAMs y peticiones pendientes.
- **Éxito / Confirmación (Emerald Radar):** `#10b981` (`hsl(160, 84%, 39%)`) - Para turnos aprobados y estados operativos.
- **Peligro / Bloqueo (Rose Radar):** `#f43f5e` (`hsl(343, 89%, 60%)`) - Para excepciones, bloqueos AVOID e inactividad.

### ⏱️ Código de Colores por Jornada/Turno
1. **Madrugada (`A` - 00:00 a 06:00):** Indigo Profundo (`rgba(99, 102, 241, 0.15)`) | Texto `#a5b4fc`
2. **Mañana (`M` - 06:00 a 12:00):** Cyan Vibrante (`rgba(6, 182, 212, 0.15)`) | Texto `#67e8f9`
3. **Tarde (`T` - 12:00 a 18:00):** Amber Neón (`rgba(245, 158, 11, 0.15)`) | Texto `#fcd34d`
4. **Noche (`N` - 18:00 a 24:00):** Emerald Neón (`rgba(16, 185, 129, 0.15)`) | Texto `#6ee7b7`

### 🔤 Tipografía e Iconografía
- **Fuentes:** Inter / SF Pro Display para interfaz; JetBrains Mono para IDs de licencia, NOTAMs y códigos horarios UTC.
- **Iconografía:** Lucide Icons (`Radio`, `Activity`, `Calendar`, `ShieldCheck`, `PlaneTakeoff`, `Clock`, `RefreshCw`, `Bell`, `UserCheck`, `LogOut`).

---

## 👥 3. Roles de Usuario y Experiencia Objetivo

1. **Controlador de Tránsito Aéreo (ATC):**
   - Consulta su Roster mensual de turnos.
   - Sincroniza su calendario móvil en 1 clic (`webcal://`).
   - Solicita permutas (`SWAP`) y coberturas (`COVER`) con compañeros validando habilitaciones.
   - Registra peticiones especiales (`AVOID`, `DESCANSO`, `LICN`, `LICR`).
   - Revisa noticias operativas de la torre y boletines NOTAM de SKBO.

2. **Supervisor / Encargado de Turno (CTE):**
   - Revisa y aprueba/rechaza solicitudes de permuta y coberturas de turnos.
   - Publica alertas manuales operativas para la guardia del día.
   - Revisa el radar del turno con la lista del personal en servicio.

3. **Administrador del Sistema:**
   - Gestión integral del cuadrante mensual, motor de optimización OR-Tools, carga de Excel `.xlsx` y registro de controladores.

---

## 📱 4. Especificación Pantalla por Pantalla para App Móvil (Stitch Spec)

### 🔴 Pantalla 1: Login & Autenticación (`LoginScreen`)
- **UI Elementos:**
  - Logo brillante AirControl con radar giratorio sutil.
  - Subtítulo: *Sistema Operativo Roster ATC - SKBO Eldorado*.
  - Selector de Rol / Acceso: *Controlador / Supervisor / Admin*.
  - Inputs: Correo electrónico (`@aircontrol.com`) y Contraseña con toggle de visibilidad (ojo).
  - Botón Acción Primaria: `Ingresar a la Plataforma` con brillo cyan.
  - Indicador de conexión segura Firebase SSL.

---

### 🟢 Pantalla 2: Dashboard Principal / "Mi Roster" (`ControllerPortal - Tab Roster`)
- **Header Superior Móvil:**
  - Avatar con iniciales del controlador y firma/licencia (ej. `JZA`).
  - Chip de rol: `Controlador Certificado (TWR, GND, DEL)`.
  - Icono de Campana con contador de Alertas Operativas / NOTAMs activos.
  - Botón `Sincronizar Calendario` (Abre modal Webcal `.ics`).
- **Sección Hero: "Próximo Turno Asignado":**
  - Tarjeta Glass destacada con gradiente cyan/indigo.
  - Día y Fecha (ej. *Hoy, Jueves 12 de Junio*).
  - Turno: Badge grande `MAÑANA (M)` [06:00 - 12:00].
  - Posición Asignada: `TWR-1 (Torre Titular)`.
  - Chip de estado: `Confirmado & Publicado`.
- **Calendario Mensual Interactivo:**
  - Selector de mes (*Mayo 2026 / Junio 2026*) con flechas táctiles.
  - Grilla de días del mes estilo calendario móvil (7 columnas: Lun - Dom).
  - Cada celda muestra:
    - Número de día (los domingos y festivos colombianos marcados en color rojo suave/amber).
    - Badge abreviado del turno asignado (`M-TWR`, `N-GND`, `DESCANSO`, `VAC`).
  - Al tocar un día: Modal desplegable desde abajo (Bottom Sheet) con:
    - Horario exacto del turno en UTC y hora local Bogotá.
    - Compañeros asignados en la misma jornada.
    - Botón rápido: `Solicitar Permuta para este Día`.

---

### 🟡 Pantalla 3: Radar del Turno & NOTAMs SKBO (`ControllerPortal - Tab Radar`)
- **Sub-Tabs:** `Guardia de Hoy` | `Guardia de Mañana` | `Boletines NOTAMs SKBO` | `Alertas Operativas`.
- **Vista Guardia de Hoy:**
  - Selector de Jornada (`A`, `M`, `T`, `N`).
  - Tarjetas de Posición Operativa mostrando qué controlador está en cada consola:
    - `CTE-1 (Centro/Supervisor)` → Jorge Zubiría (`JZA`).
    - `TWR-1 (Torre Titular)` → Germán Moreno (`GMB`).
    - `GND-1 (Superficie Titular)` → Carlos Soto (`CSO`).
    - `DEL-1 (Autorizaciones)` → Luis Gomez (`LSG`).
    - `ENT-1 (Alumno Trainee)` → Efraín Rodríguez (`ERC`).
- **Vista Boletines NOTAMs SKBO:**
  - Barra de búsqueda de NOTAMs y filtros rápidos: `Todos`, `Pistas (RWY)`, `Calles de Rodaje (TWY)`, `Navegación (NAV)`, `Procedimientos (PROC)`.
  - Tarjetas estilo consola de aviación con código raw NOTAM y traducción legible en español:
    - Ej: `A0412/26` - *Pista 14L/32R fuera de servicio por mantenimiento de balizamiento de 02:00 a 08:00 UTC.*
    - Estado: `Activo Hoy` con tag de vigencia.

---

### 🔵 Pantalla 4: Gestor de Intercambios & Coberturas (`TradePanel`)
- **Segmented Control (Tabs):** `Crear Permuta / Cobertura` | `Mis Solicitudes` | `Permutas Pendientes de Aprobación`.
- **Formulario Inteligente de Solicitud:**
  1. **Tipo:** Permuta Mutua (`SWAP`) o Cesión/Cobertura (`COVER`).
  2. **Fecha de mi turno:** Selector que autocarga únicamente los turnos que el usuario tiene asignados en el mes.
  3. **Controlador Destino:** Dropdown filtrado automáticamente mostrando **únicamente controladores calificados** (que posean la certificación requerida para la posición).
  4. **Turno de intercambio:** Selección de la jornada del compañero.
- **Validación en Tiempo Real:**
  - El sistema muestra un mensaje verde ` Habilitación validada: El compañero cuenta con licencia TWR` o una advertencia roja si rompería el descanso reglamentario de 12 horas.
- **Lista de Solicitudes en Curso:**
  - Tarjeta de permuta indicando: *JZA le cede Noche el 15-Jun a GMB a cambio de Mañana el 18-Jun*.
  - Badge de Estado: `Pendiente Aceptación del Compañero` | `Pendiente Aprobación Supervisor` | `Aprobado & Aplicado al Roster`.

---

### 🟣 Pantalla 5: Registro de Peticiones y Bloqueos (`RequestPanel`)
- **Propósito:** Permitir al controlador comunicar sus necesidades de agenda antes de que el motor de IA/OR-Tools genere el roster.
- **Formulario de Registro:**
  - **Tipo de Petición:**
    - `EVITAR TURNO (AVOID)`: Especifica un turno y día que el controlador no puede trabajar (ej: *Evitar Turno Noche el 20 de Junio por evento familiar*).
    - `DESCANSO SOLICITADO`: Preferencia de día libre.
    - `LICENCIA REMUNERADA (LICR)` / `LICENCIA NO REMUNERADA (LICN)` / `CITA MÉDICA (CMED)`.
  - **Justificación / Comentario:** Campo opcional para aclaraciones.
- **Lista de Peticiones Registradas:**
  - Filtro por mes.
  - Estado de procesamiento en el motor de optimización (Icono de IA Sparkles cuando la restricción es respetada por el solver).

---

### 🧡 Pantalla 6: Perfil & Sincronización Webcal (`ControllerPortal - Perfil`)
- **Sección Identidad:**
  - Nombre completo, Firma ATC (ej. `JZA`), Correo electrónico corporativo.
  - Grilla de Habilitaciones Certificadas: Chips de colores brillantes para `CTE`, `TWR`, `GND`, `DEL`, `FIC`.
  - Indicador de Trainee/Alumno si `trainingPreferred` es verdadero.
- **Sección Sincronización de Calendario (Webcal / iCalendar):**
  - Switch de activación: `Sincronización en la Nube Activa`.
  - Botón: `Copiar Enlace Webcal (Google / Apple / Outlook)`.
  - Opciones de exportación: *[x] Incluir Turnos Operativos  [x] Incluir Excepciones y Vacaciones*.
  - Enlace dinámico `webcal://aircontrol-skbo-sbg.firebasestorage.app/calendars/JZA.ics`.
  - Botón: `Forzar Sincronización Inmediata`.

---

## 🛠️ 5. Guía de Interacción y UX Móvil (Para Generación de UI)

1. **Navegación Móvil (Bottom Navigation Bar):**
   - 5 Tabs principales con iconos táctiles y etiquetas micro:
     - 🗓️ **Mi Roster** (`Roster`)
     - 📡 **Radar SKBO** (`Radar`)
     - 🔄 **Intercambios** (`Trades`)
     - 📝 **Peticiones** (`Requests`)
     - 👤 **Mi Perfil** (`Profile`)
2. **Gestos e Interacciones:**
   - **Pull-to-Refresh:** Para refrescar datos desde Firestore en tiempo real.
   - **Haptic Feedback:** Vibración suave al confirmar un intercambio o copiar el enlace de Webcal.
   - **Tarjetas Táctiles:** Elevación sutil (`transform: translateY(-2px)`) e iluminación de borde cyan al presionar.
3. **Adaptabilidad Responsive:**
   - En pantallas pequeñas (smartphones <= 480px), las tablas extensas se transforman automáticamente en tarjetas verticalizadas.
   - En pantallas de escritorio / tablets, la vista se expande a un panel multicolumna con sidebar fijo.
