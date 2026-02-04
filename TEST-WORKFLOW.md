# Courtmaster Testing Workflow

## Quick Start

```bash
./test-workflow.sh
```

Or manually:
```bash
./start-dev-terminal.sh
# Wait 30 seconds for services to start
# Open http://localhost:3000
```

## Login Credentials
- **Email:** admin@courtmaster.local
- **Password:** admin123

## Complete Testing Checklist

### Phase 1: Initial Setup & Login
- [ ] App loads at http://localhost:3000
- [ ] Login page displays correctly
- [ ] Can login with admin@courtmaster.local / admin123
- [ ] Dashboard loads after login
- [ ] "Simple Test Tournament" is visible in the list

### Phase 2: Tournament Dashboard
- [ ] Clicking tournament opens dashboard
- [ ] Tournament info displays correctly
- [ ] Categories tab shows created categories
- [ ] Registrations tab shows players
- [ ] Courts tab shows available courts

### Phase 3: Generate Brackets
- [ ] Navigate to Brackets tab
- [ ] Click "Generate Brackets" button
- [ ] Brackets display correctly for each category
- [ ] All participants appear in bracket
- [ ] BYE matches are created properly (if odd number)
- [ ] No console errors during generation

### Phase 4: Start Tournament
- [ ] Click "Start Tournament" button
- [ ] Tournament status changes to "in_progress"
- [ ] No errors in console

### Phase 5: Match Control - Queue View
- [ ] Navigate to Match Control
- [ ] Queue view displays
- [ ] Courts show correct status (available/in_use)
- [ ] **BUG CHECK:** Matches appear in queue (should have status='scheduled')
- [ ] **BUG CHECK:** Queue shows correct number of pending matches

### Phase 6: Auto Schedule
- [ ] Click "Auto Schedule" button
- [ ] Dialog opens with options
- [ ] Select courts and time
- [ ] Click "Generate Schedule"
- [ ] **BUG CHECK:** Schedule generates successfully
- [ ] **BUG CHECK:** Shows "X matches scheduled" message
- [ ] **BUG CHECK:** Matches appear in queue with "Assign Court" dropdown
- [ ] **BUG CHECK:** Stats update (Needs Court count decreases)

### Phase 7: Manual Court Assignment
- [ ] Select court from dropdown for a queued match
- [ ] Match moves to "Ready" status
- [ ] Court status changes to "in_use"
- [ ] Match appears in "In Progress" section

### Phase 8: Score Entry
- [ ] Click "Enter Scores" button on a ready match
- [ ] Score dialog opens
- [ ] Can increment scores for both players
- [ ] Can mark game as complete
- [ ] Can complete match (best of 3)
- [ ] **BUG CHECK:** Winner advances to next round
- [ ] **BUG CHECK:** Next match in bracket shows correct participants

### Phase 9: Bracket Progression
- [ ] Navigate back to Brackets tab
- [ ] Verify winner appears in next round
- [ ] Verify bracket updates correctly
- [ ] Continue until semifinals/finals

### Phase 10: Complete Tournament
- [ ] Complete final match
- [ ] Tournament shows completion status
- [ ] Winner is displayed correctly
- [ ] Can view final bracket with all results

## Known Issue Areas (Check These Carefully)

### Data Flow Issues
1. **match_scores status not set** - Fixed in commit 31736da
   - Auto-schedule was not setting status='scheduled'
   - Should now work after fix

2. **Queue Display**
   - Check if matches with status='scheduled' appear in queue
   - Verify pendingMatches computed property filters correctly

3. **Bracket Advancement**
   - After match completion, check if winner advances
   - Verify brackets-manager updates next match opponents

### UI Issues
1. **Match Queue List**
   - Should show pending matches
   - Should allow court assignment

2. **Auto-Assignment**
   - Should auto-assign when court becomes available
   - Pause/Resume should work

3. **Score Dialog**
   - Should calculate winner correctly
   - Should update bracket on completion

## Bug Report Template

When you find a bug, document it with:

```
### Bug #[NUMBER]: [TITLE]
**Severity:** [Critical/High/Medium/Low]
**Phase:** [Which testing phase]
**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Screenshots:**
[Attach if possible]

**Console Errors:**
```
[Console error messages]
```

**Firestore State:**
[Relevant collection data if applicable]
```

## Commands

### Start Testing
```bash
./test-workflow.sh
```

### Reset Everything
```bash
# Stop all services
pkill -f "firebase\|vite"

# Clear emulator data
rm -rf logs/

# Restart
./test-workflow.sh
```

### Check Logs
```bash
# Latest session logs
tail -f logs/dev-session-*/emulators.log
tail -f logs/dev-session-*/site.log
```

## Decision Points

1. If auto-schedule says "0 games scheduled":
   - Check console for errors
   - Check if matches exist in /match collection
   - Check if status='scheduled' is being set

2. If queue shows no matches:
   - Verify matches have status='scheduled'
   - Check pendingMatches computed property
   - Check category filtering

3. If bracket doesn't advance:
   - Check console for updateMatch errors
   - Verify winnerId is set correctly
   - Check brackets-manager match updates

## Success Criteria

✅ All phases complete without blocking bugs
✅ Tournament can be started
✅ Matches can be scheduled
✅ Scores can be entered
✅ Bracket advances correctly
✅ Tournament can be completed
