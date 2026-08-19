# Graph Report - .  (2026-08-10)

## Corpus Check
- 50 files · ~73,179 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 212 nodes · 444 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 1,200 input · 450 output

## Community Hubs (Navigation)
- Core Web App & Main Components
- Monthly Scheduler & AI Copilot Panel
- Firebase Cloud Functions & NOTAM Backend
- External Package Dependencies
- Local Python Server & Solvers
- Mobile Interface & Touch Layouts
- ESLint Tooling & Code Quality Rules
- Controller Form & Local Storage
- PWA Manifest & Browser Meta
- Authentication & Header Navigation
- Architecture Documentation & Design System
- HTML Entrypoint & Main Assets
- Python Function Requirements
- UI Icon Assets
- Project README Documentation
- Hero Image Assets

## God Nodes (most connected - your core abstractions)
1. `App()` - 22 edges
2. `ControllerPortal()` - 18 edges
3. `getSlotAcronym()` - 17 edges
4. `isColombianHoliday()` - 16 edges
5. `solve_schedule()` - 12 edges
6. `validateAssignment()` - 12 edges
7. `getSlotDescription()` - 11 edges
8. `runAutoSchedulerForMonth()` - 11 edges
9. `sync_skbo_notams()` - 10 edges
10. `MonthlyGrid()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AirControl HTML Entrypoint` --references--> `AirControl Favicon SVG`  [EXTRACTED]
  index.html → public/favicon.svg
- `AirControl Architecture Summary` --references--> `AirControl Stitch Specification`  [EXTRACTED]
  PROJECT_SUMMARY.md → AIRCONTROL_STITCH_SPEC.md
- `AirControl Architecture Summary` --references--> `AirControl Design System`  [EXTRACTED]
  PROJECT_SUMMARY.md → DESIGN.md
- `sync_notams()` --calls--> `sync_skbo_notams()`  [EXTRACTED]
  functions/local_server.py → functions/notams_parser.py
- `solve_schedule_api()` --calls--> `solve_schedule()`  [EXTRACTED]
  functions/main.py → functions/solver_engine.py

## Import Cycles
- None detected.

## Communities (18 total, 5 thin omitted)

### Community 0 - "Core Web App & Main Components"
Cohesion: 0.12
Nodes (32): App(), ControllerList(), ControllerPortal(), generateICS(), getMonthlyShiftsForController(), triggerCalendarSyncIfEnabled(), uploadCalendarToStorage(), addControllerDB() (+24 more)

### Community 1 - "Monthly Scheduler & AI Copilot Panel"
Cohesion: 0.18
Nodes (22): AICopilotPanel(), MonthlyGrid(), RequestPanel(), getPositionPriority(), SchedulerGrid(), SchedulerSummary(), activeRequests, adjustDynamicSlots() (+14 more)

### Community 2 - "Firebase Cloud Functions & NOTAM Backend"
Cohesion: 0.14
Nodes (21): scheduled_sync_notams(), solve_schedule_api(), sync_notams_api(), categorize_notam(), determine_severity(), fetch_aerocivil_charlie1_notams(), fetch_faa_notams_by_designator(), normalize_faa_notam() (+13 more)

### Community 3 - "External Package Dependencies"
Cohesion: 0.10
Nodes (20): firebase, lucide-react, dependencies, firebase, lucide-react, react, react-dom, xlsx (+12 more)

### Community 4 - "Local Python Server & Solvers"
Cohesion: 0.16
Nodes (17): health(), solve(), sync_notams(), get_days_elapsed(), get_sequence_day_index(), get_week_days_of_date(), has_certification(), is_colombian_holiday() (+9 more)

### Community 5 - "Mobile Interface & Touch Layouts"
Cohesion: 0.21
Nodes (12): MobileBottomNav(), MobileGuardiaView(), MobileLayout(), MobileNotamsView(), MobileProfileView(), MobileRosterView(), MobileTradesView(), generateSettleTrade() (+4 more)

### Community 6 - "ESLint Tooling & Code Quality Rules"
Cohesion: 0.11
Nodes (19): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, eslint, @eslint/js (+11 more)

### Community 7 - "Controller Form & Local Storage"
Cohesion: 0.22
Nodes (5): ControllerForm(), DEFAULT_SEQUENCE, INITIAL_CONTROLLERS, STORAGE_KEYS, validateController()

### Community 8 - "PWA Manifest & Browser Meta"
Cohesion: 0.22
Nodes (8): background_color, display, icons, name, orientation, short_name, start_url, theme_color

### Community 9 - "Authentication & Header Navigation"
Cohesion: 0.43
Nodes (4): LoginScreen(), MobileHeader(), ThemeToggle(), deleteManualAlertDB()

### Community 10 - "Architecture Documentation & Design System"
Cohesion: 0.67
Nodes (3): AirControl Stitch Specification, AirControl Design System, AirControl Architecture Summary

## Knowledge Gaps
- **49 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `ESLint Tooling & Code Quality Rules` to `External Package Dependencies`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `sync_skbo_notams()` connect `Firebase Cloud Functions & NOTAM Backend` to `Local Python Server & Solvers`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Web App & Main Components` be split into smaller, more focused modules?**
  _Cohesion score 0.1226215644820296 - nodes in this community are weakly interconnected._
- **Should `Firebase Cloud Functions & NOTAM Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._
- **Should `External Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `ESLint Tooling & Code Quality Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._