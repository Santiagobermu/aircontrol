# Graph Report - Proyecto  (2026-08-31)

## Corpus Check
- 50 files · ~86,100 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 258 nodes · 563 edges · 20 communities (12 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8c216af1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- schedulerEngine.js
- solve_schedule
- package.json
- firebase-messaging-sw.js
- devDependencies
- storage.js
- manifest.json
- notamUtils.js
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
1. `App()` - 26 edges
2. `ControllerPortal()` - 24 edges
3. `getSlotAcronym()` - 17 edges
4. `isColombianHoliday()` - 16 edges
5. `MobileProfileView()` - 13 edges
6. `solve_schedule()` - 12 edges
7. `validateAssignment()` - 12 edges
8. `getSlotDescription()` - 11 edges
9. `runAutoSchedulerForMonth()` - 11 edges
10. `getAllShiftsForController()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AirControl HTML Entrypoint` --references--> `AirControl Favicon SVG`  [EXTRACTED]
  index.html → public/favicon.svg
- `AirControl Architecture Summary` --references--> `AirControl Stitch Specification`  [EXTRACTED]
  PROJECT_SUMMARY.md → AIRCONTROL_STITCH_SPEC.md
- `AirControl Architecture Summary` --references--> `AirControl Design System`  [EXTRACTED]
  PROJECT_SUMMARY.md → DESIGN.md
- `run_test()` --calls--> `solve_schedule()`  [EXTRACTED]
  functions/test_solver.py → functions/solver_engine.py
- `App()` --calls--> `isSameCtrl()`  [EXTRACTED]
  src/App.jsx → src/utils/calendarExport.js

## Import Cycles
- None detected.

## Communities (20 total, 8 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.11
Nodes (36): App(), ControllerList(), ControllerPortal(), LoginScreen(), MobileHeader(), MonthlyGrid(), RequestPanel(), SchedulerSummary() (+28 more)

### Community 1 - "schedulerEngine.js"
Cohesion: 0.13
Nodes (23): MobileBottomNav(), MobileGeneralRosterView(), MobileGuardiaView(), MobileLayout(), MobileRosterView(), MobileTradesView(), getPositionPriority(), SchedulerGrid() (+15 more)

### Community 2 - "solve_schedule"
Cohesion: 0.08
Nodes (39): health(), solve(), sync_notams(), scheduled_sync_notams(), send_push_notification_api(), solve_schedule_api(), sync_notams_api(), categorize_notam() (+31 more)

### Community 3 - "package.json"
Cohesion: 0.10
Nodes (20): firebase, lucide-react, dependencies, firebase, lucide-react, react, react-dom, xlsx (+12 more)

### Community 6 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, eslint, @eslint/js (+11 more)

### Community 7 - "storage.js"
Cohesion: 0.22
Nodes (5): ControllerForm(), DEFAULT_SEQUENCE, INITIAL_CONTROLLERS, STORAGE_KEYS, validateController()

### Community 8 - "manifest.json"
Cohesion: 0.15
Nodes (12): background_color, description, display, gcm_sender_id, icons, id, name, orientation (+4 more)

### Community 9 - "notamUtils.js"
Cohesion: 0.38
Nodes (10): MobileNotamsView(), addManualAlertDB(), categorizeNotam(), extractNotamDates(), filterNotamsByDate(), formatNotamDateRange(), formatShortUtcDate(), getUtcDateString() (+2 more)

### Community 10 - "AirControl Architecture Summary"
Cohesion: 0.67
Nodes (3): AirControl Stitch Specification, AirControl Design System, AirControl Architecture Summary

### Community 20 - "MobileProfileView.jsx"
Cohesion: 0.13
Nodes (30): AICopilotPanel(), MobileProfileView(), controllers, exceptions, schedule, syncControllers, detectUserDevice(), downloadICSFile() (+22 more)

## Knowledge Gaps
- **61 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `ControllerPortal()` connect `App.jsx` to `notamUtils.js`, `MobileProfileView.jsx`, `schedulerEngine.js`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11346938775510204 - nodes in this community are weakly interconnected._
- **Should `schedulerEngine.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13068181818181818 - nodes in this community are weakly interconnected._
- **Should `solve_schedule` be split into smaller, more focused modules?**
  _Cohesion score 0.07822410147991543 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._