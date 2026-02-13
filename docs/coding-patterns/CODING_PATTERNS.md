# Coding Pattern Guide — CourtMaster v2

> **Living Document.** Every bug fix MUST add or update a pattern here.
> See [AGENTS.md § 12](../../AGENTS.md) for the Post-Fix Protocol.

---

## How to Use This File

1. **Before writing code** — scan the relevant category below for anti-patterns to avoid.
2. **After fixing a bug** — add a new pattern entry using `TEMPLATE.md` in this directory.
3. **During code review** — use the "Detection" commands to scan for violations.

---

## Category: UI / User Experience

### CP-001: No Native Browser Dialogs

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Zombie Court — native `confirm()` auto-dismissed |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
async function deleteItem(id: string) {
  if (!confirm('Are you sure?')) return;    // ← BLOCKS thread, auto-dismisses, wrong theme
  await store.delete(id);
}
```

**Correct Pattern (✅):**
```typescript
// 1. Add reactive state
const showDeleteDialog = ref(false);
const itemToDeleteId = ref<string | null>(null);

// 2. Split into request + confirm
function requestDelete(id: string) {
  itemToDeleteId.value = id;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  if (!itemToDeleteId.value) return;
  showDeleteDialog.value = false;
  try {
    await store.delete(itemToDeleteId.value);
    notificationStore.showToast('success', 'Deleted');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete');
  }
}
```
```html
<!-- 3. Add v-dialog in template -->
<v-dialog v-model="showDeleteDialog" max-width="400" persistent>
  <v-card>
    <v-card-title>Delete Item?</v-card-title>
    <v-card-text>This cannot be undone.</v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
      <v-btn color="error" @click="confirmDelete">Delete</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

**Detection:**
```bash
grep -rn "confirm(" src/ --include="*.vue" --include="*.ts" | grep -v "//.*confirm"
grep -rn "prompt(" src/ --include="*.vue" --include="*.ts" | grep -v "//.*prompt"
grep -rn "alert(" src/ --include="*.vue" --include="*.ts" | grep -v "//.*alert"
```

**Fix Guide:** [docs/fix/replace-native-dialogs.md](../fix/replace-native-dialogs.md)

---

## Category: Data Integrity

### CP-002: Reverse Lookups for Cross-Collection References

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Zombie Court — court stuck "In Use" after match lost `courtId` |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Relying on a single forward link
async function completeMatch(matchId: string) {
  const matchDoc = await getDoc(matchRef);
  const courtId = matchDoc.data()?.courtId;
  if (!courtId) {
    console.warn('No courtId found');  // ← Gives up. Court stays "In Use" forever.
    return;
  }
  await releaseCourt(courtId);
}
```

**Correct Pattern (✅):**
```typescript
async function completeMatch(matchId: string) {
  const matchDoc = await getDoc(matchRef);
  let courtId = matchDoc.data()?.courtId;

  // Fallback 1: Check in-memory state
  if (!courtId) {
    courtId = currentMatch.value?.courtId;
  }

  // Fallback 2: Reverse lookup — query courts that reference this match
  if (!courtId) {
    const courtsRef = collection(db, `tournaments/${tournamentId}/courts`);
    const q = query(courtsRef, where('currentMatchId', '==', matchId));
    const snap = await getDocs(q);
    if (!snap.empty) courtId = snap.docs[0].id;
  }

  if (courtId) await releaseCourt(courtId);
}
```

**Rule:** Any function that transitions state across collections (match ↔ court, player ↔ registration) MUST have at least one fallback mechanism for finding the related document.

**Detection:**
```bash
# Find state transitions that only use a single forward reference
grep -rn "courtId\|currentMatchId\|assignedMatchId" src/stores/ --include="*.ts" | grep -v "Fallback\|fallback\|reverse"
```

---

### CP-003: Always Clean Both Sides of a Relationship

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Zombie Court — match completed but court status not updated |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Only updating one side of the relationship
await updateDoc(matchRef, { status: 'completed' });
// ← Court still says "in_use" with currentMatchId pointing to this match!
```

**Correct Pattern (✅):**
```typescript
// Use a Firestore batch to update BOTH sides atomically
const batch = writeBatch(db);

// Update match
batch.update(matchRef, { status: 'completed', completedAt: serverTimestamp() });

// Update court (the other side)
batch.update(courtRef, {
  status: 'available',
  currentMatchId: null,
  assignedMatchId: null,
  lastFreedAt: serverTimestamp(),
});

await batch.commit();  // Both succeed or both fail
```

**Rule:** When two documents reference each other (match ↔ court), always use `writeBatch` to update both atomically.

**Detection:**
```bash
# Find status updates that might be missing the other side
grep -rn "status: 'completed'" src/stores/ --include="*.ts" -A 5 | grep -v "batch\|writeBatch"
```

---

## Category: Code Quality

### CP-004: No Duplicate Function Declarations

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Duplicate `releaseCourt` function caused runtime error |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Rule:** Before adding a function to a file, search for its name in the file first. If it exists, modify the existing function instead of adding a new one.

**Detection:**
```bash
# Find duplicate function names within each .vue/.ts file
for f in $(find src/ -name "*.vue" -o -name "*.ts"); do
  dups=$(grep -oP "(?:function |const )\K\w+(?= *[=(])" "$f" | sort | uniq -d)
  if [ -n "$dups" ]; then echo "$f: $dups"; fi
done
```

---

### CP-005: Use `notificationStore.showToast` for User Feedback

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Inconsistent error handling — some errors silent, some use `console.error` only |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
try {
  await doSomething();
} catch (error) {
  console.error(error);  // ← User sees nothing
}
```

**Correct Pattern (✅):**
```typescript
try {
  await doSomething();
  notificationStore.showToast('success', 'Action completed');
} catch (error) {
  console.error('Failed to do something:', error);
  notificationStore.showToast('error', 'Failed to do something');
}
```

**Detection:**
```bash
# Find catch blocks that only console.error without showing user feedback
grep -rn "catch" src/ --include="*.vue" --include="*.ts" -A 3 | grep "console.error" | grep -v "showToast"
```

---

## Category: Firestore

### CP-006: Use `serverTimestamp()` for All Timestamps

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | N/A — preventive pattern |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await updateDoc(ref, { updatedAt: new Date() });  // ← Client clock may be wrong
```

**Correct Pattern (✅):**
```typescript
await updateDoc(ref, { updatedAt: serverTimestamp() });  // ← Server's clock, always correct
```

**Detection:**
```bash
grep -rn "new Date()" src/stores/ --include="*.ts" | grep -i "update\|create\|set"
```

---

## Adding New Patterns

Use `TEMPLATE.md` in this directory. Every pattern needs:
1. **ID** (CP-NNN, sequential)
2. **Category** (UI, Data Integrity, Code Quality, Firestore, Performance)
3. **Source Bug** (what went wrong)
4. **Anti-Pattern** (bad code)
5. **Correct Pattern** (good code)
6. **Detection** (grep/script to find violations)
