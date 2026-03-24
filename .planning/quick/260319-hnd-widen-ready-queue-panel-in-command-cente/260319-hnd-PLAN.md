---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tournaments/views/MatchControlView.vue
autonomous: true
must_haves:
  truths:
    - "Ready Queue sidebar is visibly wider in the Command Center layout"
    - "Courts grid still fills remaining space and remains usable"
    - "Mobile/responsive behavior is not broken"
  artifacts:
    - path: "src/features/tournaments/views/MatchControlView.vue"
      provides: "Wider sidebar grid column"
      contains: "grid-template-columns"
  key_links: []
---

<objective>
Widen the Ready Queue sidebar panel in the Match Control Command Center from 320px to 420px.

Purpose: Give the Ready Queue more horizontal space so match entries are easier to read and interact with.
Output: Updated CSS grid column width in MatchControlView.vue.
</objective>

<execution_context>
@/Users/ramc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/ramc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tournaments/views/MatchControlView.vue

The Command Center uses a CSS grid layout in the `.mc-body` class (line ~2357):
```css
.mc-body {
  display: grid;
  grid-template-columns: 1fr 320px;   /* Courts | Sidebar (Ready Queue + Alerts) */
  gap: 12px;
  padding: 12px;
}
```

The sidebar (`.mc-sidebar`) contains the ReadyQueue panel and AlertsPanel stacked vertically.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Widen sidebar column from 320px to 420px</name>
  <files>src/features/tournaments/views/MatchControlView.vue</files>
  <action>
In `src/features/tournaments/views/MatchControlView.vue`, find the `.mc-body` CSS rule (around line 2357) and change:
```
grid-template-columns: 1fr 320px;
```
to:
```
grid-template-columns: 1fr 420px;
```

This gives the sidebar (Ready Queue + Alerts) 100px more width while the Courts grid (`1fr`) auto-shrinks to fill the remainder.

Also check for any responsive/media-query rules that reference the old 320px width and update them proportionally if they exist.
  </action>
  <verify>
    <automated>cd /Users/ramc/Documents/Code/courtmaster-v2 && grep -n "grid-template-columns.*420px" src/features/tournaments/views/MatchControlView.vue</automated>
  </verify>
  <done>The `.mc-body` grid now allocates 420px to the sidebar column. Courts grid uses remaining space via `1fr`. No other layout references to old 320px remain.</done>
</task>

</tasks>

<verification>
- `grep -n "320px" src/features/tournaments/views/MatchControlView.vue` returns no hits in grid-template-columns
- `grep -n "420px" src/features/tournaments/views/MatchControlView.vue` shows the updated value
- Dev server renders Command Center with wider Ready Queue panel
</verification>

<success_criteria>
Ready Queue sidebar is 420px wide (up from 320px). Courts grid auto-adjusts. No layout regressions.
</success_criteria>

<output>
After completion, create `.planning/quick/260319-hnd-widen-ready-queue-panel-in-command-cente/260319-hnd-SUMMARY.md`
</output>
