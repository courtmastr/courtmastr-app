# Claude AI Instructions — CourtMaster v2

> **This file is a pointer.** The authoritative project rules are in `AGENTS.md`.

---

## Quick Start for Claude

**Before ANY task:**
1. Load and follow `AGENTS.md` in the project root
2. Check `docs/coding-patterns/CODING_PATTERNS.md` BEFORE planning
3. Run detection commands if applicable

---

## Critical Reminders

### Must Check Before Planning
- **Coding Patterns**: `docs/coding-patterns/CODING_PATTERNS.md`
- **Data Model Rules**: `docs/migration/DATA_MODEL_MIGRATION_RULES.md`
- **Debug KB**: `docs/debug-kb/` for known issues

### Must Follow During Coding
- No native dialogs (use `v-dialog`)
- Use `serverTimestamp()`, never `new Date()`
- Always update both sides of relationships atomically
- Use `notificationStore.showToast` for user feedback

### Must Do After Fixing Bugs
1. Add/update pattern in `CODING_PATTERNS.md`
2. Include detection command
3. Run detection and report violations

---

## Full Authority

See **`AGENTS.md`** for:
- Complete command reference
- Code style guidelines
- Non-negotiable rules
- Debug KB protocol
- Data model rules
- Directory structure
- Testing procedures
- Coding pattern guide

**Enforcement**: Any violation of `AGENTS.md` constitutes task failure.

---

## Pattern Detection

Quick checks before submitting:
```bash
# Check for inline dialogs (should use BaseDialog)
grep -rn "<v-dialog" src/ --include="*.vue" | grep -v "BaseDialog"

# Check for manual async (should use useAsyncOperation)
grep -rn "loading.value = true" src/ --include="*.vue" --include="*.ts" | grep -v "useAsyncOperation"

# Check for native confirm/alert/prompt
grep -rn "confirm(" src/ --include="*.vue" --include="*.ts"
```

See `CODING_PATTERNS.md` for full detection commands.
