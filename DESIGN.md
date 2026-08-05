---
name: AirControl SKBO
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
  space-dark: '#090d16'
  surface-glass: rgba(15, 23, 42, 0.75)
  alert-amber: '#f59e0b'
  danger-rose: '#f43f5e'
  shift-madrugada: '#a5b4fc'
  shift-manana: '#67e8f9'
  shift-tarde: '#fcd34d'
  shift-noche: '#6ee7b7'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-data:
    fontFamily: jetbrainsMono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: jetbrainsMono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max-width: 1280px
---

## Brand & Style

The design system for this product is rooted in the **Cockpit Dark Radar / Glassmorphism Premium** aesthetic. It is designed to evoke the high-stakes, precision-oriented environment of Air Traffic Control at El Dorado International Airport. The UI must feel like a specialized tool: mission-critical, technologically advanced, and ultra-reliable.

### Visual Style: Tactical Glassmorphism
The design employs a sophisticated mix of **Minimalism** and **Glassmorphism**. By using deep space backgrounds contrasted with translucent, blurred surfaces and vibrant "neon" accents, the system differentiates between background information and actionable tactical data.

- **Atmosphere:** Immersive, dark, and focused.
- **Tone:** Professional, technical, and urgent.
- **Target Audience:** Air Traffic Controllers (ATC) and Supervisors (CTE) requiring high legibility under varying light conditions and rapid data processing.
- **Key Characteristics:** 
  - Heavy use of backdrop blurs (16px) to create depth.
  - Thin, high-contrast borders (8% white) to define glass containers.
  - Glowing accents in Cyan and Indigo to draw attention to critical operations.
  - Monospaced elements for data integrity (UTC, License IDs).

## Colors

The palette is strictly dark-mode, designed to reduce eye strain during long shifts while maintaining high contrast for readability.

### Core Palette
- **Primary (Cyan Radar):** The main functional color for active states, primary buttons, and system-level metrics.
- **Secondary (Indigo Tactical):** Used for auxiliary features and specific shift branding.
- **Neutral (Space Dark):** The foundation of the UI, providing a void-like depth that makes glass elements pop.

### Functional & Tactical Colors
- **Success (Emerald):** Operational readiness and approved requests.
- **Warning (Amber):** Pending items and NOTAM alerts.
- **Danger (Rose):** Red-line exceptions, blocked dates (AVOID), and system errors.

### Shift-Specific Coding
To allow controllers to identify their schedule at a glance, specific tints are assigned to the four main shifts (Madrugada, Mañana, Tarde, Noche). These should be used as low-opacity background fills with high-saturation text labels.

## Typography

The typography system prioritizes legibility and technical precision.

- **Inter / SF Pro Display:** Used for all standard UI elements, navigation, and body copy. It provides a clean, neutral tone that stays out of the way of the data.
- **JetBrains Mono:** Reserved for "Tactical Data"—this includes License IDs, UTC timestamps, flight codes, and raw NOTAM text. The monospaced nature ensures that alphanumeric strings are easy to compare and visually scan.

### Scaling
Headlines scale down for mobile to maintain hierarchy without overcrowding the narrow viewport. Labels often use uppercase with increased letter spacing to differentiate headers from interactive body text.

## Layout & Spacing

This design system uses a **Fluid Grid** for mobile and a **Fixed Grid** for desktop.

### Spacing Rhythm
A 4px base unit drives all spacing (padding, margins, gaps). 
- **Mobile:** A 4-column layout with 16px margins and 16px gutters.
- **Desktop:** A 12-column layout with 32px margins. The maximum content width is capped at 1280px to prevent excessive line lengths in data tables.

### Layout Philosophy
The layout is "Bottom-Heavy" for mobile, placing key navigation and primary actions (like the "Trade" button) within thumb reach. For the Radar and Roster views, the layout utilizes horizontal scrolling for density while keeping critical identifiers (like names or times) sticky.

## Elevation & Depth

Hierarchy is established through **Backdrop Blurs** and **Tonal Layers** rather than traditional heavy shadows.

- **Level 0 (Background):** Pure `#090d16`. Used for the global app canvas.
- **Level 1 (Glass Surface):** Semi-transparent `rgba(15, 23, 42, 0.75)` with a 16px blur. This is the standard container for cards and panels.
- **Level 2 (Active/Elevated):** Use a sutil `0 0 20px rgba(6, 182, 212, 0.15)` outer glow for primary interactive elements or "Next Shift" hero cards.
- **Outlines:** Every glass surface must have a 1px solid border at `rgba(255, 255, 255, 0.08)`. This "inner glow" effect defines the shape against the dark background.

## Shapes

The shape language is **Rounded**, balancing the technical, "hard" nature of radar screens with a modern, approachable mobile feel.

- **Standard Elements (Cards, Inputs):** 0.5rem (8px) corner radius.
- **Large Elements (Bottom Sheets, Hero Sections):** 1rem (16px) corner radius.
- **Small Elements (Badges, Chips):** 0.25rem (4px) or full pill-shape for status indicators.

## Components

### Tactical Cards
Cards are the primary data container. They use the `surface-glass` style. For "Next Shift" or "Active Alert," the top border should be thickened to 2px and colored with the relevant shift or status color (e.g., Cyan for Mañana).

### Radar Buttons
- **Primary:** High-vibrancy Cyan background with dark text. Apply a subtle outer glow.
- **Secondary:** Transparent background with a 1px Cyan border.
- **Ghost:** No background or border; used for secondary actions in the Bottom Navigation.

### Status Badges
High-contrast badges are essential for quick scanning. 
- **Style:** Small caps, bold typography.
- **Coloring:** Background should be a 15% opacity version of the status color, with the text at 100% saturation (e.g., Emerald background @ 15% / Emerald text @ 100% for "Approved").

### Inputs
Input fields use the `space-dark` background with a `rgba(255,255,255,0.08)` border. On focus, the border transitions to Primary Cyan with a subtle 4px blur glow.

### Specialized Components
- **Shift Indicators:** Circular or square indicators using the shift-specific colors to mark days on the calendar grid.
- **UTC Clock:** A persistent top-level display using JetBrains Mono for synchronized time-keeping.
- **Tactical Toggle:** A segmented control for switching between "Guardia de Hoy" and "NOTAMs," featuring a sliding glass highlight.