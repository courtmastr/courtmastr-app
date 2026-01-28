# Running Bracket Diagnostic Tests

## Quick Start (Auto-connects to Emulator!)

All diagnostic scripts now automatically connect to the emulator at `localhost:8080`.

### Step 1: Start Firebase Emulator

In **Terminal 1**:
```bash
npm run emulators
```

Wait for the message showing the emulator is running (usually shows Firestore on `localhost:8080`).

### Step 2: Run Diagnostic Script

In **Terminal 2**:
```bash
cd functions
npx ts-node src/diagnose_bracket_issue.ts
```

No need to set `FIRESTORE_EMULATOR_HOST` - it's automatic!

### Step 3: Run Complete Flow Test

```bash
cd functions
npx ts-node src/test_complete_flow.ts
```

## Expected Results

### Diagnostic Script (diagnose_bracket_issue.ts)
```
✅ TEST 1: Single insert returns string/number ID
✅ TEST 2: Array insert returns boolean (true)
✅ TEST 3: Stage creation generates 6-7 matches for 4 players
```

### Complete Flow Test (test_complete_flow.ts)
```
✅ Setup complete: 8 players
✅ Generated double_elimination bracket
✅ Stages: 1 ✅
✅ Groups: 3 ✅ (expected 3: WB, LB, Finals)
✅ Matches: 12 ✅
✅ Participants: 8 ✅
✅ Legacy matches: 12 ✅
✅ Has winners bracket: ✅
✅ Has losers bracket: ✅
✅ Has finals: ✅
✅ TEST PASSED: Double elimination bracket generated successfully!
```

## What These Tests Verify

### diagnose_bracket_issue.ts
1. **Return Type Contract**: Verifies FirestoreAdapter returns correct types
   - Single insert → returns ID (string/number)
   - Array insert → returns boolean
2. **Reference Normalization**: Ensures object references are converted to IDs
3. **Match Generation**: Confirms brackets-manager creates matches

### test_complete_flow.ts
1. **End-to-End Flow**: Tests the complete bracket generation process
2. **Data Consistency**: Verifies all collections are populated correctly
3. **Legacy Sync**: Confirms matches are copied to legacy schema
4. **Bracket Types**: Ensures Winners, Losers, and Finals brackets exist

## Troubleshooting

### "Could not load default credentials"
- **Fix**: Make sure the emulator is running first: `npm run emulators`
- The scripts will auto-connect to `localhost:8080`

### "Connection refused" or "ECONNREFUSED"
- **Fix**: Check that the emulator started successfully
- Verify it shows: `✔  firestore: Firestore Emulator running on http://localhost:8080`

### "No matches created" in diagnostic
- This indicates the normalizeReferences() fix isn't working
- Check console logs for `stage_id` types
- Expected: `stage_id: "abc123" Type: string`
- Wrong: `stage_id: {id: "abc123", ...} Type: object`

### Tests pass but UI still shows empty brackets
1. Clear browser cache and reload
2. Check browser console for errors
3. Verify the tournament uses the emulator data
4. Run `deep_debug.ts` with your actual tournament ID
