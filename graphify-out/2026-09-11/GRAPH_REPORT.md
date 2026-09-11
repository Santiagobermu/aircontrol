# Graph Report - Proyecto  (2026-09-11)

## Corpus Check
- 57 files · ~102,695 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 296 nodes · 680 edges · 21 communities (13 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `43b3aafe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- ControllerPortal.jsx
- solve_schedule
- package.json
- firebase-messaging-sw.js
- schedulerEngine.js
- devDependencies
- storage.js
- manifest.json
- getSlotAcronym
- AirControl Architecture Summary
- AirControl HTML Entrypoint
- Firebase Functions Dependencies
- AirControl Icon Assets SVG
- AirControl README
- AirControl Hero Image
- rules/graphify.md
- workflows/graphify.md
- MobileProfileView.jsx

## God Nodes (most connected - your core abstractions)
1. `App()` - 29 edges
2. `ControllerPortal()` - 26 edges
3. `getSlotAcronym()` - 19 edges
4. `isColombianHoliday()` - 16 edges
5. `MobileProfileView()` - 13 edges
6. `generateBoletaPdf()` - 13 edges
7. `isSameCtrl()` - 13 edges
8. `solve_schedule()` - 12 edges
9. `dispatchBoletaToPowerAutomate()` - 12 edges
10. `validateAssignment()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `AirControl HTML Entrypoint` --references--> `AirControl Favicon SVG`  [EXTRACTED]
  index.html → public/favicon.svg
- `AirControl Architecture Summary` --references--> `AirControl Stitch Specification`  [EXTRACTED]
  PROJECT_SUMMARY.md → AIRCONTROL_STITCH_SPEC.md
- `AirControl Architecture Summary` --references--> `AirControl Design System`  [EXTRACTED]
  PROJECT_SUMMARY.md → DESIGN.md
- `run_test()` --calls--> `solve_schedule()`  [EXTRACTED]
  functions/test_solver.py → functions/solver_engine.py
- `App()` --calls--> `dispatchBoletaToPowerAutomate()`  [EXTRACTED]
  src/App.jsx → src/utils/boletaDispatcher.js

## Import Cycles
- None detected.

## Communities (21 total, 8 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.14
Nodes (27): App(), ControllerList(), ControllerPortal(), addControllerDB(), addRequestDB(), addTradeDB(), DEFAULT_SEQUENCE, deleteControllerDB() (+19 more)

### Community 1 - "ControllerPortal.jsx"
Cohesion: 0.16
Nodes (20): LoginScreen(), MobileHeader(), MobileNotamsView(), NotificationCenterModal(), ThemeToggle(), addManualAlertDB(), getUserReadNotificationsDB(), markAllNotificationsAsReadDB() (+12 more)

### Community 2 - "solve_schedule"
Cohesion: 0.08
Nodes (39): health(), solve(), sync_notams(), scheduled_sync_notams(), send_push_notification_api(), solve_schedule_api(), sync_notams_api(), categorize_notam() (+31 more)

### Community 3 - "package.json"
Cohesion: 0.09
Nodes (22): firebase, lucide-react, dependencies, firebase, lucide-react, pdf-lib, react, react-dom (+14 more)

### Community 5 - "schedulerEngine.js"
Cohesion: 0.17
Nodes (23): AICopilotPanel(), MonthlyGrid(), RequestPanel(), getPositionPriority(), SchedulerGrid(), SchedulerSummary(), activeRequests, adjustDynamicSlots() (+15 more)

### Community 6 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, eslint, @eslint/js (+11 more)

### Community 7 - "storage.js"
Cohesion: 0.18
Nodes (8): ControllerForm(), SignatureModal(), generateOfficialSeal(), uploadSignatureImage(), DEFAULT_SEQUENCE, INITIAL_CONTROLLERS, STORAGE_KEYS, validateController()

### Community 8 - "manifest.json"
Cohesion: 0.15
Nodes (12): background_color, description, display, gcm_sender_id, icons, id, name, orientation (+4 more)

### Community 9 - "getSlotAcronym"
Cohesion: 0.13
Nodes (26): BoletaPreviewModal(), MobileBottomNav(), MobileGeneralRosterView(), MobileGuardiaView(), MobileLayout(), MobileRosterView(), MobileTradesView(), generateSettleTrade() (+18 more)

### Community 10 - "AirControl Architecture Summary"
Cohesion: 0.67
Nodes (3): AirControl Stitch Specification, AirControl Design System, AirControl Architecture Summary

### Community 20 - "MobileProfileView.jsx"
Cohesion: 0.13
Nodes (29): MobileProfileView(), controllers, exceptions, schedule, syncControllers, detectUserDevice(), downloadICSFile(), generateICS() (+21 more)

## Knowledge Gaps
- **64 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSlotAcronym()` connect `getSlotAcronym` to `App.jsx`, `ControllerPortal.jsx`, `schedulerEngine.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `dispatchBoletaToPowerAutomate()` connect `getSlotAcronym` to `App.jsx`, `ControllerPortal.jsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `ControllerPortal()` connect `App.jsx` to `ControllerPortal.jsx`, `MobileProfileView.jsx`, `schedulerEngine.js`, `getSlotAcronym`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14260249554367202 - nodes in this community are weakly interconnected._
- **Should `solve_schedule` be split into smaller, more focused modules?**
  _Cohesion score 0.07928118393234672 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._