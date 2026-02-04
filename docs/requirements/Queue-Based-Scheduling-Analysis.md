# Queue-Based Scheduling System - Requirements Analysis

**Date:** 2026-02-03
**User Request:** "8 matches ready to schedule with only 4 courts doesn't make sense. Matches should wait in queue and auto-assign to courts as they become available."

---

## 📊 Current System vs Desired System

### Current: TIME-SLOT PRE-SCHEDULING

**How it works:**
```
User clicks "Auto Schedule" → System assigns BOTH court AND time to ALL matches

Example with 8 matches, 4 courts:
┌─────────────────────────────────────────┐
│ Time Slot 1: 10:00 AM                   │
│ Court 1: Match 1                        │
│ Court 2: Match 2                        │
│ Court 3: Match 3                        │
│ Court 4: Match 4                        │
└─────────────────────────────────────────┘
         ↓ (20 min play + 5 min break)
┌─────────────────────────────────────────┐
│ Time Slot 2: 10:25 AM                   │
│ Court 1: Match 5                        │
│ Court 2: Match 6                        │
│ Court 3: Match 7                        │
│ Court 4: Match 8                        │
└─────────────────────────────────────────┘
```

**Status Flow:**
```
Ready → Scheduled (court + time assigned) → In Progress → Completed
```

**Pros:**
- ✅ Everyone knows their match time in advance
- ✅ Participants can plan arrival
- ✅ Tournament timeline is predictable
- ✅ Works well for large tournaments

**Cons:**
- ❌ Inflexible if matches finish early/late
- ❌ Courts sit idle if match finishes early
- ❌ Can't adjust to real-time delays
- ❌ Confusing that "8 matches scheduled" with "4 courts"

---

### Desired: DYNAMIC QUEUE SYSTEM

**How it should work:**
```
Matches wait in queue → Courts become available → Next match auto-assigned

Example with 8 matches, 4 courts:
┌─────────────────────────────────────────┐
│ Playing (4 matches - using all courts)  │
│ Court 1: Match 1  ⚫ IN PROGRESS        │
│ Court 2: Match 2  ⚫ IN PROGRESS        │
│ Court 3: Match 3  ⚫ IN PROGRESS        │
│ Court 4: Match 4  ⚫ IN PROGRESS        │
└─────────────────────────────────────────┘
         ↓ Court 1 finishes
┌─────────────────────────────────────────┐
│ Court 1: Match 5  🟢 AUTO-ASSIGNED     │  ← Next in queue
│ Court 2: Match 2  ⚫ IN PROGRESS        │
│ Court 3: Match 3  ⚫ IN PROGRESS        │
│ Court 4: Match 4  ⚫ IN PROGRESS        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Queue (4 matches waiting)                │
│ 🔵 Match 6 - NEEDS COURT                │
│ 🔵 Match 7 - NEEDS COURT                │
│ 🔵 Match 8 - NEEDS COURT                │
└─────────────────────────────────────────┘
```

**Status Flow:**
```
Ready → Needs Court (waiting) → Ready to Start (court assigned, can begin)
         ↑                                  ↓
         │                           In Progress
         │                                  ↓
         └───────← Court freed ←─────── Completed
                 (auto-assign next)
```

**Pros:**
- ✅ Maximum court utilization (no idle time)
- ✅ Adapts to real-time match durations
- ✅ Clear queue shows who's next
- ✅ Only 4 matches "active" at a time (matches court count)
- ✅ Handles delays gracefully

**Cons:**
- ❌ Participants don't know exact match time
- ❌ Players must stay near venue
- ❌ Harder to predict tournament end time
- ❌ More complex to implement

---

## 🎯 User's Requirements (Clarified)

From your message, you want:

1. **"8 matches ready to schedule with only 4 courts needs to be..."**
   - Only 4 matches can be "active" (have courts) at once
   - Other 4 wait in "Needs Court" queue

2. **"Ready to start is when court is assigned"**
   - Status: "Ready to Start" = has court assigned, can begin play
   - Not "Scheduled" with future time

3. **"In progress is auto moved once the court gets ready"**
   - When court finishes → next match automatically gets that court
   - No manual assignment needed

4. **"Next in line get the court"**
   - FIFO (First In, First Out) queue
   - Match that's been waiting longest gets next available court

---

## 🏗️ System Design: Dynamic Queue

### New Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| **Ready** | Match is ready, waiting in queue | Waiting for court |
| **Ready to Start** | Court assigned, can begin | Announce/call match |
| **In Progress** | Currently playing | Track score |
| **Completed** | Finished | Free court → assign next |

### Court States

| State | Meaning | Next Action |
|-------|---------|-------------|
| **Available** | No match assigned | Assign next queued match |
| **Assigned** | Match assigned, not started | Wait for match to start |
| **In Use** | Match in progress | Wait for completion |
| **Maintenance** | Unavailable | Skip |

### Auto-Assignment Logic

```typescript
// When match completes or court is freed:
function onCourtAvailable(courtId: string) {
  // 1. Get next match in queue
  const nextMatch = getNextQueuedMatch(); // Oldest "Ready" status match

  // 2. Assign court to match
  if (nextMatch) {
    assignCourtToMatch(nextMatch.id, courtId);
    updateMatchStatus(nextMatch.id, 'ready_to_start');
    updateCourtStatus(courtId, 'assigned');

    // 3. Notify/announce match
    announceMatch(nextMatch);
  } else {
    // No matches waiting → court becomes available
    updateCourtStatus(courtId, 'available');
  }
}
```

### Match Queue Priority

**Default: FIFO (First Come, First Served)**
```
Queue Order:
1. Match 5 (waiting 10 min)
2. Match 6 (waiting 8 min)
3. Match 7 (waiting 5 min)
4. Match 8 (waiting 2 min)

Next available court → Match 5
```

**Advanced: Priority Rules** (Optional)
- Same round matches first
- VIP/featured matches
- Participants who've waited longest
- Avoid same participants back-to-back

---

## 📱 UI Changes Needed

### Match Control View

#### Current Tabs:
```
In Progress (0) | Ready to Start (8)
```

#### Proposed Tabs:
```
In Progress (4) | Ready to Start (0) | Needs Court (4) | Completed (0)
```

**Tab Descriptions:**
- **In Progress:** Matches currently being played
- **Ready to Start:** Matches with court assigned, can begin
- **Needs Court:** Matches waiting in queue for available court
- **Completed:** Finished matches

### Queue View

```
┌──────────────────────────────────────┐
│ 🟢 ACTIVE MATCHES (4/4 courts used) │
├──────────────────────────────────────┤
│ Court 1: Anderson/Wilson vs Roberts │  [IN PROGRESS]
│ Court 2: Nelson/Thomas vs Oliver    │  [IN PROGRESS]
│ Court 3: Carter/Moore vs Quinn      │  [IN PROGRESS]
│ Court 4: Martinez/Taylor vs Parker  │  [IN PROGRESS]
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 🔵 WAITING IN QUEUE (4 matches)     │
├──────────────────────────────────────┤
│ #1  Thomas Harris vs Christopher    │  ⏱️ 12 min
│ #2  David Evans vs Anthony Lopez    │  ⏱️ 8 min
│ #3  Joseph Garcia vs Daniel Jones   │  ⏱️ 5 min
│ #4  Richard Foster vs Matthew King  │  ⏱️ 2 min
└──────────────────────────────────────┘
```

### Court Status Board

```
┌─────────────────────────────────────┐
│ COURT STATUS                         │
├─────────────────────────────────────┤
│ Court 1: IN USE          [FINISH]   │
│          Match 1 - 15:32 elapsed    │
│                                      │
│ Court 2: IN USE          [FINISH]   │
│          Match 2 - 12:05 elapsed    │
│                                      │
│ Court 3: IN USE          [FINISH]   │
│          Match 3 - 18:47 elapsed    │
│                                      │
│ Court 4: AVAILABLE   [ASSIGN NEXT]  │
│          Ready for next match       │
└─────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Database Schema Changes

**match_scores collection:**
```typescript
{
  matchId: string;
  status: 'ready' | 'ready_to_start' | 'in_progress' | 'completed';
  courtId?: string;          // Assigned court (if any)
  queuePosition?: number;    // Position in queue (if waiting)
  queuedAt?: Timestamp;      // When added to queue
  calledAt?: Timestamp;      // When called/announced
  startedAt?: Timestamp;     // When started playing
  completedAt?: Timestamp;   // When finished
}
```

**courts collection:**
```typescript
{
  id: string;
  name: string;
  number: number;
  status: 'available' | 'assigned' | 'in_use' | 'maintenance';
  currentMatchId?: string;   // Match currently assigned
  lastFreedAt?: Timestamp;   // When court became available
}
```

### Real-Time Listeners

**Listen for court status changes:**
```typescript
// When court becomes available
onSnapshot(courtsCollection, (snapshot) => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'modified') {
      const court = change.doc.data();
      if (court.status === 'available') {
        autoAssignNextMatch(court.id);
      }
    }
  });
});
```

### Auto-Assignment Function

```typescript
async function autoAssignNextMatch(courtId: string) {
  // 1. Get next match in queue (oldest first)
  const queuedMatches = await getDocs(
    query(
      matchScoresCollection,
      where('status', '==', 'ready'),
      orderBy('queuedAt', 'asc'),
      limit(1)
    )
  );

  if (queuedMatches.empty) {
    console.log('No matches in queue');
    return;
  }

  const nextMatch = queuedMatches.docs[0];

  // 2. Assign court to match
  await updateDoc(nextMatch.ref, {
    courtId,
    status: 'ready_to_start',
    calledAt: serverTimestamp()
  });

  // 3. Update court status
  await updateDoc(doc(db, 'courts', courtId), {
    status: 'assigned',
    currentMatchId: nextMatch.id
  });

  // 4. Trigger notification/announcement
  await announceMatch(nextMatch.id);
}
```

---

## 🎛️ Match Control Features Review

### Current Features ✅

From the screenshot:
- ✅ Match queue tabs (In Progress, Ready to Start)
- ✅ Category filter
- ✅ Court status (4 courts available)
- ✅ Auto Schedule button
- ✅ Share Links button
- ✅ Live View button
- ✅ Match cards with START MATCH button
- ✅ Match status tracking

### Missing Features ❌

**Essential for Tournament Organizers:**

1. **❌ Match Announcements/Calling System**
   - "Now playing on Court 1: Anderson vs Wilson"
   - Audio announcements
   - Display board integration

2. **❌ Manual Court Assignment**
   - Drag-and-drop match to court
   - Override auto-assignment if needed

3. **❌ Match Delays/Holds**
   - Pause queue for delays
   - Hold specific match (injury, player late, etc.)
   - Resume queue

4. **❌ Walkover/Forfeit Handling**
   - Mark match as walkover
   - Auto-advance winner
   - Don't use court time

5. **❌ Match Reordering**
   - Move match up/down in queue
   - Prioritize VIP matches
   - Group same-team matches

6. **❌ Court Maintenance Mode**
   - Mark court as unavailable
   - Auto-redistribute matches
   - Maintenance notes

7. **❌ Estimated Wait Time**
   - Show players: "Approximately 25 minutes"
   - Based on average match duration
   - Updates in real-time

8. **❌ Match History/Log**
   - Who started the match
   - Duration of each match
   - Delays/issues logged

9. **❌ Bulk Actions**
   - "Start all ready matches"
   - "Clear all court assignments"
   - "Reset queue"

10. **❌ Export/Print Schedule**
    - Print today's schedule
    - Export to PDF/CSV
    - Share with participants

11. **❌ Participant Notifications**
    - SMS/Email when match is called
    - "Your match in 2 matches"
    - Push notifications

12. **❌ Match Statistics Dashboard**
    - Average match duration
    - Court utilization %
    - Matches completed per hour
    - Tournament progress

---

## 🤔 Decision Points

### Question 1: Which System Do You Want?

**Option A: Keep Time-Slot Scheduling (Current)**
- Pre-schedule all matches with times
- Participants know exact times
- Better for large tournaments
- **Effort:** None (already works)

**Option B: Switch to Dynamic Queue (Your Request)**
- Matches auto-assign as courts free
- Maximum court utilization
- Better for small/medium tournaments
- **Effort:** 2-3 days implementation

**Option C: Support Both Modes**
- Tournament organizer chooses at setup
- "Time-slot" or "Queue" mode
- Most flexible
- **Effort:** 3-4 days implementation

**👉 Which do you prefer?**

---

### Question 2: Auto-Assignment Trigger

**When should next match auto-assign?**

**Option A: On Match Completion**
- When organizer clicks "Finish Match" → next match auto-assigned
- Immediate transition
- No idle time

**Option B: Manual Trigger**
- Organizer manually clicks "Assign Next Match" when ready
- More control
- Can handle delays between matches

**Option C: Hybrid**
- Auto-assign by default
- Option to pause/override

**👉 Which do you prefer?**

---

### Question 3: Queue Priority

**How should queue be ordered?**

**Option A: FIFO (First In, First Out)**
- Oldest match gets next court
- Simple, fair
- Default for most sports

**Option B: Round-Based Priority**
- All Round 1 matches before Round 2
- Keeps bracket progression smooth
- Better for elimination tournaments

**Option C: Configurable**
- Organizer can reorder queue manually
- Drag-and-drop priority
- Most flexible

**👉 Which do you prefer?**

---

### Question 4: Scope of Implementation

**What should I implement first?**

**Option A: Core Queue System Only**
- Dynamic court assignment
- Auto-assign on completion
- Basic queue display
- **Effort:** 2-3 days

**Option B: Core + Essential Features**
- Core queue system
- + Announcements
- + Manual override
- + Walkover handling
- **Effort:** 4-5 days

**Option C: Full Feature Set**
- Everything in Option B
- + Match reordering
- + Statistics dashboard
- + Notifications
- + Export/print
- **Effort:** 1-2 weeks

**👉 Which do you prefer?**

---

## 📋 Summary

**Current Issue:**
- "8 matches ready to schedule with 4 courts" is confusing
- System uses time-slot pre-scheduling (all matches get times)
- You want dynamic queue (matches wait for courts)

**Your Requirements:**
1. Only 4 matches active at once (matching court count)
2. Other matches wait in "Needs Court" queue
3. Auto-assign next match when court becomes available
4. FIFO or priority-based queue

**Missing Features Identified:**
- 12 features tournament organizers typically need
- Most critical: Announcements, Manual override, Walkover handling

**Next Steps:**
1. **YOU DECIDE:** Which system? (Time-slot vs Queue vs Both)
2. **YOU DECIDE:** Auto-assign trigger? (Immediate vs Manual vs Hybrid)
3. **YOU DECIDE:** Queue priority? (FIFO vs Round vs Configurable)
4. **YOU DECIDE:** Implementation scope? (Core vs Essential vs Full)

Once you answer these 4 questions, I can create a detailed implementation plan!
