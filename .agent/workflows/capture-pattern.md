---
description: Capture a bug fix as a coding pattern in the Coding Pattern Guide
---

## When to Run

Run this workflow **after every bug fix**, before closing the task. This is mandated by AGENTS.md § 12.

## Steps

1. **Identify the root cause category.** Determine which category the bug falls into:
   - **UI** — User-facing behavior (dialogs, rendering, responsiveness)
   - **Data Integrity** — Cross-collection references, orphan records, state consistency
   - **Code Quality** — Duplicate code, naming, imports, dead code
   - **Firestore** — Queries, timestamps, batch operations
   - **Performance** — Unnecessary re-renders, large payloads, N+1 queries

2. **Check if a matching pattern already exists.** Open `docs/coding-patterns/CODING_PATTERNS.md` and search for similar patterns. If one exists, update it with the new example instead of creating a duplicate.

3. **Determine the next pattern ID.** Find the highest existing `CP-NNN` number and increment by 1.

4. **Add the new pattern entry.** Copy the template from `docs/coding-patterns/TEMPLATE.md` and fill in:
   - **ID and Title**: `CP-NNN: [Short descriptive title]`
   - **Source Bug**: One-line description of what went wrong
   - **Anti-Pattern**: The exact bad code that caused the bug (simplified)
   - **Correct Pattern**: The fix you applied (simplified as a reusable example)
   - **Detection**: A `grep` or script command that can find similar violations in the codebase

5. **Add the pattern to the correct category section** in `CODING_PATTERNS.md`. If no matching category exists, create a new section.

6. **Run the detection command** you wrote. Report any additional violations found (don't fix them unless instructed).

7. **Report** in your task output:
   - Pattern ID added (e.g., CP-007)
   - Detection results (number of additional violations found)
