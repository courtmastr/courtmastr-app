# Bracket Storage Undefined Values

**Status:** ✅ fixed  
**Fingerprint:** brk-undef  
**Created:** 2026-01-31  
**Updated:** 2026-01-31

---

## Error Signatures

1. `Unsupported field value: undefined (found in field opponent1.position ...)`
2. `TypeError: Cannot convert undefined or null to object at Object.entries`
3. `Unsupported field value: undefined (found in field stageId ...)`

---

## Root Cause

The `ClientFirestoreStorage` adapter in `src/services/brackets-storage.ts` had data handling issues incompatible with Firestore:

1. **Nested undefined values**: `removeUndefined()` wasn't recursive
2. **Null filter args**: `update()` didn't guard against null/undefined args
3. **ID generation**: `insert()` didn't properly handle stages without pre-assigned IDs

---

## Fix (final)

### File: `src/services/brackets-storage.ts`

1. **Make `removeUndefined` recursive** (line 33):
```typescript
cleaned[key] = this.removeUndefined(value);
```

2. **Guard null args in `update`** (line 161):
```typescript
} else if (arg !== null && arg !== undefined) {
```

3. **Fix `insert` ID handling** - Always generate Firestore doc ID, store original numeric ID if provided:
```typescript
const docRef = doc(colRef);
const idToStore = originalId !== undefined ? originalId : docRef.id;
```

### File: `src/composables/useBracketGenerator.ts`

4. **Fetch stageId from storage if undefined**, use null for Firestore:
```typescript
let stageId = stage?.id;
if (stageId === undefined) {
  const stages = await storage.select('stage', { tournament_id: categoryId });
  if (stages?.length > 0) stageId = stages[0].id;
}
```

---

## Verification

Console should show:
- `📝 [ClientFirestoreStorage] Inserting stage with id: <id>`
- `📌 Stage created with ID: <id>`
- `✅ Bracket generated and saved to ...`
