# Graph Report - Proyecto  (2026-08-19)

## Corpus Check
- 47 files · ~81,390 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 227 nodes · 485 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f5d4c37b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- schedulerEngine.js
- sync_skbo_notams
- package.json
- solve_schedule
- MobileLayout.jsx
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
- ControllerPortal.jsx

## God Nodes (most connected - your core abstractions)
1. `App()` - 22 edges
2. `ControllerPortal()` - 22 edges
3. `getSlotAcronym()` - 19 edges
4. `isColombianHoliday()` - 16 edges
5. `getSlotDescription()` - 13 edges
6. `solve_schedule()` - 12 edges
7. `validateAssignment()` - 12 edges
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

## Communities (21 total, 7 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.15
Nodes (24): App(), ControllerList(), ControllerPortal(), addControllerDB(), addRequestDB(), addTradeDB(), DEFAULT_SEQUENCE, deleteControllerDB() (+16 more)

### Community 1 - "schedulerEngine.js"
Cohesion: 0.15
Nodes (26): AICopilotPanel(), MobileGeneralRosterView(), MonthlyGrid(), RequestPanel(), getPositionPriority(), SchedulerGrid(), SchedulerSummary(), generateSettleTrade() (+18 more)

### Community 2 - "sync_skbo_notams"
Cohesion: 0.14
Nodes (21): scheduled_sync_notams(), solve_schedule_api(), sync_notams_api(), categorize_notam(), determine_severity(), fetch_aerocivil_charlie1_notams(), fetch_faa_notams_by_designator(), normalize_faa_notam() (+13 more)

### Community 3 - "package.json"
Cohesion: 0.10
Nodes (20): firebase, lucide-react, dependencies, firebase, lucide-react, react, react-dom, xlsx (+12 more)

### Community 4 - "solve_schedule"
Cohesion: 0.16
Nodes (17): health(), solve(), sync_notams(), get_days_elapsed(), get_sequence_day_index(), get_week_days_of_date(), has_certification(), is_colombian_holiday() (+9 more)

### Community 5 - "MobileLayout.jsx"
Cohesion: 0.23
Nodes (7): MobileBottomNav(), MobileGuardiaView(), MobileHeader(), MobileLayout(), MobileRosterView(), MobileTradesView(), deleteManualAlertDB()

### Community 6 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, eslint, @eslint/js (+11 more)

### Community 7 - "storage.js"
Cohesion: 0.22
Nodes (5): ControllerForm(), DEFAULT_SEQUENCE, INITIAL_CONTROLLERS, STORAGE_KEYS, validateController()

### Community 8 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, display, icons, name, orientation, short_name, start_url, theme_color

### Community 9 - "notamUtils.js"
Cohesion: 0.42
Nodes (9): MobileNotamsView(), categorizeNotam(), extractNotamDates(), filterNotamsByDate(), formatNotamDateRange(), formatShortUtcDate(), getUtcDateString(), isNotamActiveOnDate() (+1 more)

### Community 10 - "AirControl Architecture Summary"
Cohesion: 0.67
Nodes (3): AirControl Stitch Specification, AirControl Design System, AirControl Architecture Summary

### Community 20 - "ControllerPortal.jsx"
Cohesion: 0.22
Nodes (13): LoginScreen(), MobileProfileView(), ThemeToggle(), generateICS(), getMonthlyShiftsForController(), triggerCalendarSyncIfEnabled(), uploadCalendarToStorage(), addManualAlertDB() (+5 more)

## Knowledge Gaps
- **51 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `sync_skbo_notams()` connect `sync_skbo_notams` to `solve_schedule`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14717741935483872 - nodes in this community are weakly interconnected._
- **Should `sync_skbo_notams` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._