# AGENTS.md — Agent Authority Contract

This document is **authoritative**. All agents MUST follow it. Violations constitute task failure.

---

## 1. Project Snapshot

**Stack (Fixed)**
- Frontend: Vue 3 + TypeScript + Vite
- UI: Vuetify 3 (Material Design only)
- State: Pinia (no Vuex, no globals)
- Backend: Firebase (Firestore, Auth, Cloud Functions, Hosting)
- PWA: Vite PWA Plugin
- Package Manager: npm (MUST NOT change)
- Node Version: Read from `.nvmrc` or `package.json` `engines`

**Repository Layout**
- Source: `src/`
- Firebase Config: `firebase.json`
- Cloud Functions: `functions/`
- Debug KB: `docs/debug-kb/`
- Logging Scripts: `scripts/`

---

## 2. Non-Negotiables

**MUST:**
- Make smallest possible change to solve task
- Reuse existing patterns, components, stores
- Search codebase before creating files
- Run `:log` commands after changes
- Follow Debug KB Protocol on failures

**MUST NOT:**
- Add dependencies unless explicitly instructed
- Refactor unrelated code
- Change linting/formatting rules
- Switch package manager
- Change Firestore schema/rules/auth unless instructed
- Touch production deploy config unless instructed
- Weaken security to "make it work"

---

## 3. Working Conventions

- Use Vue Composition API with `<script setup>`
- Use Pinia for shared state only
- Use Vuetify components exclusively
- Keep TypeScript types explicit at module boundaries
- Match existing code style exactly
- No silent breaking changes

---

## 4. Mandatory Agent Workflow

1. **Understand**: Read task and locate relevant files
2. **Search KB**: Check `docs/debug-kb/` for similar issues
3. **Implement**: Minimal diff using existing patterns
4. **Verify**: Run appropriate `:log` command
5. **Handle Failure**: Follow Debug KB Protocol
6. **Document**: Update KB with solution
7. **Summarize**: Report files changed, commands run, KB updates

---

## 5. Debug KB Protocol (STRICT)

**A. Always Use `:log` Scripts**
```bash
npm run dev:log
npm run build:log
npm run test:log
npm run lint:log
npm run firebase:emulators:log
npm run firebase:deploy:log
```
Safe probes only: `node -v`, `npm -v`, `firebase --version`

**B. On Failure**
When command fails, output shows:
```
Fingerprint: <8-char-id>
Log saved: docs/debug-kb/_artifacts/<file>.log
```

Agents MUST:
1. Capture the fingerprint
2. Search KB before fixes:
   - `docs/debug-kb/<fingerprint>.md`
   - `docs/debug-kb/index.yml`
   - `grep error text docs/debug-kb/`
3. If entry exists: try Fix(final) first
4. If not exists: create from TEMPLATE.md
5. Record ONE attempt per change (Change + Result)
6. Link artifact log file path
7. Include: exact command, node version, firebase-tools version

**C. On Success**
Agents MUST:
1. Write Root cause (ONE sentence)
2. Write Fix (final) with exact steps
3. Write Verification with runnable commands
4. Set status to ✅ fixed or 🟡 workaround
5. Update `docs/debug-kb/index.yml`

**D. Never Skip Documentation**
If unresolved:
- Log all attempts
- Mark status ❌ unresolved
- Leave entry for future debugging

---

## 6. Knowledge Base Quality Bar

Every KB entry MUST include:
- Exact command run
- Runtime versions (node, firebase-tools)
- Normalized error signature
- Artifact log file link
- Root cause as ONE sentence
- Verification steps as runnable commands
- No vague language

---

## 7. Firebase Safety Rules

Agents MUST:
- Prefer Firebase emulators for debugging
- Never log secrets or tokens
- Never weaken Firestore rules to pass tests
- Match Cloud Functions runtime to firebase.json
- Avoid side effects on module import
- Verify security rules before changes

---

## 8. Data Model Rules (Post-Feb 2026 Migration)

**Collection Usage:**
- `/match` = Bracket structure (brackets-manager, READ ONLY)
- `/match_scores` = Operational data (scores, courts, status)
- `/matches` = REMOVED (never reference)

**ID & Status:**
- All IDs stored as strings; both adapters normalize to strings
- `/match_scores.status` (string) authoritative for UI
- `/match.status` (numeric 0-4) brackets-manager internal only

**Cloud Functions:** updateMatch, generateSchedule, advanceWinner use `/match` + `/match_scores` only

Full rules: `docs/migration/DATA_MODEL_MIGRATION_RULES.md`

---

## 9. Uncertainty Rule

If unsure about data shape, auth flow, Firestore rules intent, deployment behavior, or existing conventions: **STOP and ask one clarifying question.** Do NOT guess or invent behavior.

---

## 10. Minimal Diff Rule

Agents MUST:
- Touch only files directly related to the task
- Avoid reformatting/reorganizing unrelated code
- Avoid multi-concern changes in single task

---

## 11. Agent Output Requirements

After completing a task, agents MUST report:
- Files changed (full paths)
- Commands executed (exact)
- Fingerprints handled
- KB files created or updated
- Verification evidence

---

## 12. Maintenance Rule

AGENTS.md MUST remain ≤ 180 lines. Prefer tightening language over adding sections. This file is a contract, not documentation.

---

**Enforcement**: Any violation constitutes task failure.
