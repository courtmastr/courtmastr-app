# Pool Data Investigation - Complete Index

## 📋 Investigation Overview

**Objective:** Investigate data loss of pool level data in Mens Doubles category after tournament progression to elimination rounds.

**Status:** ✅ **COMPLETE** - Root cause identified and documented

**Key Finding:** Pool data is **intentionally deleted** when transitioning from pool play to elimination rounds. This is permanent and unrecoverable unless Firestore backups exist.

---

## 📚 Documentation Files

### 1. **POOL_DATA_INVESTIGATION.md** (Primary Report)
**Length:** ~400 lines  
**Purpose:** Complete investigation report with root cause analysis

**Contents:**
- Executive summary
- Pool data storage architecture
- Data loss mechanism (step-by-step)
- Why pool data is deleted (design rationale)
- What data is preserved vs. lost
- File locations and code references
- Impact analysis
- Root cause summary
- Recommendations (short/medium/long-term)

**Read this if:** You need the complete picture and recommendations

---

### 2. **POOL_DATA_QUICK_REFERENCE.md** (Cheat Sheet)
**Length:** ~200 lines  
**Purpose:** Quick lookup guide for developers

**Contents:**
- File locations table
- Firestore collection structure (visual)
- Key functions with signatures
- Category fields reference
- Data loss timeline
- Detection commands
- Critical code sections
- Related patterns

**Read this if:** You need quick answers or are debugging

---

### 3. **POOL_DATA_FILES_SUMMARY.md** (Code Deep Dive)
**Length:** ~500 lines  
**Purpose:** Detailed code walkthrough with actual code snippets

**Contents:**
- Type definitions (full interfaces)
- Bracket generation code (pool creation)
- Elimination generation code (pool deletion)
- Pool standings calculation code
- Category stage status tracking
- Tournament store integration
- Firestore adapter details
- Leaderboard calculation
- Firestore collection structure (detailed)
- Data flow diagram

**Read this if:** You're implementing a fix or need code details

---

### 4. **POOL_DATA_INDEX.md** (This File)
**Purpose:** Navigation guide for all pool data documentation

---

## 🎯 Quick Navigation

### By Role

**Product Manager:**
1. Read: POOL_DATA_INVESTIGATION.md (Executive Summary section)
2. Review: Impact Analysis section
3. Check: Recommendations section

**Developer (Debugging):**
1. Start: POOL_DATA_QUICK_REFERENCE.md
2. Reference: POOL_DATA_FILES_SUMMARY.md
3. Deep dive: POOL_DATA_INVESTIGATION.md (Root Cause section)

**Developer (Implementing Fix):**
1. Read: POOL_DATA_INVESTIGATION.md (Recommendations section)
2. Study: POOL_DATA_FILES_SUMMARY.md (Code sections)
3. Reference: POOL_DATA_QUICK_REFERENCE.md (File locations)

**DevOps/Database:**
1. Check: POOL_DATA_INVESTIGATION.md (Data Loss Mechanism)
2. Review: POOL_DATA_QUICK_REFERENCE.md (Firestore Collections)
3. Plan: Recommendations section

---

## 🔍 Key Findings Summary

### What Happens

| Phase | Action | Data State |
|-------|--------|-----------|
| 1. Pool Generation | Create pool bracket | ✅ Pool data created |
| 2. Pool Play | Score matches | ✅ Pool data + scores |
| 3. Elimination Generation | Extract qualifiers | ✅ Still exists |
| 4. **Data Deletion** | **`deletePoolStageData()` called** | **❌ DELETED** |
| 5. Elimination Play | Score elimination | ✅ Elimination data |

### What Gets Deleted

```
❌ match/{matchId}           - Pool matches
❌ match_game/{gameId}       - Individual games
❌ round/{roundId}           - Round definitions
❌ group/{groupId}           - Pool groups
❌ stage/{stageId}           - Pool stage
❌ match_scores/{matchId}    - Match scores
```

### What's Preserved

```
✅ poolQualifiedRegistrationIds  - Who qualified
✅ poolGroupCount                - Number of pools
✅ poolQualifiersPerGroup        - Qualifiers per pool
✅ poolPhase                     - Current phase
✅ eliminationStageId            - Elimination stage ID
```

---

## 📍 Critical Code Locations

### Pool Data Deletion
**File:** `src/composables/useBracketGenerator.ts`  
**Function:** `deletePoolStageData()`  
**Lines:** 1039-1078  
**Trigger:** Called from `generateEliminationFromPool()` at line 384

### Pool Generation
**File:** `src/composables/useBracketGenerator.ts`  
**Function:** `generateBracket()`  
**Lines:** 211-234  
**Condition:** `category.format === 'pool_to_elimination'`

### Pool Standings Calculation
**File:** `src/composables/usePoolLeveling.ts`  
**Function:** `generatePreview()`  
**Lines:** 545-609  
**Dependency:** Requires pool data to exist

### Category State Tracking
**File:** `src/stores/tournaments.ts`  
**Lines:** 200-300  
**Tracks:** `poolStageId`, `poolPhase`, `poolGroupCount`, etc.

---

## 🛠️ Recommendations

### Immediate (Prevent Further Loss)
1. Archive pool data before deletion
2. Add confirmation dialog
3. Add audit logging

### Medium-term (Restore Functionality)
1. Implement pool standings persistence
2. Create pool history view
3. Update leaderboard to include pool results

### Long-term (Architecture)
1. Separate pool and elimination data
2. Implement data versioning
3. Add data retention policy

---

## 📊 Investigation Artifacts

### Files Examined
- ✅ `src/types/index.ts` - Type definitions
- ✅ `src/composables/useBracketGenerator.ts` - Bracket generation
- ✅ `src/composables/usePoolLeveling.ts` - Pool standings
- ✅ `src/composables/useCategoryStageStatus.ts` - Category state
- ✅ `src/stores/tournaments.ts` - Tournament state
- ✅ `src/services/brackets-storage.ts` - Firestore adapter
- ✅ `src/composables/useLeaderboard.ts` - Leaderboard calculation

### Code Patterns Identified
- **CP-POOL-001:** Pool data deleted on elimination generation
- **CP-POOL-002:** No archive/backup before deletion
- **CP-POOL-003:** Qualifiers stored in `poolQualifiedRegistrationIds`
- **CP-POOL-004:** Pool standings calculated on-demand

---

## 🔗 Related Documentation

### In This Investigation
- [POOL_DATA_INVESTIGATION.md](./POOL_DATA_INVESTIGATION.md) - Full report
- [POOL_DATA_QUICK_REFERENCE.md](./POOL_DATA_QUICK_REFERENCE.md) - Quick reference
- [POOL_DATA_FILES_SUMMARY.md](./POOL_DATA_FILES_SUMMARY.md) - Code details

### Project Documentation
- [TOURNAMENT_LEADERBOARD_PLAN.md](./TOURNAMENT_LEADERBOARD_PLAN.md) - Leaderboard architecture
- [DATA_MODEL_MIGRATION_RULES.md](./migration/DATA_MODEL_MIGRATION_RULES.md) - Data model rules
- [AGENTS.md](../AGENTS.md) - Project contract and standards

---

## ❓ FAQ

**Q: Is pool data being overwritten?**  
A: No, it's being deleted completely.

**Q: Is it a display issue?**  
A: No, the data is actually gone from Firestore.

**Q: Is it intentional?**  
A: Yes, by design in `generateEliminationFromPool()`.

**Q: Can we recover it?**  
A: Only if Firestore backups exist. Otherwise, no.

**Q: When does deletion occur?**  
A: When `generateEliminationFromPool()` is called.

**Q: What data is preserved?**  
A: Only the list of qualified participants.

**Q: Can we prevent this?**  
A: Yes, by archiving pool data before deletion.

---

## 📞 Next Steps

1. **Review** the appropriate documentation for your role
2. **Understand** the root cause and impact
3. **Plan** implementation of recommendations
4. **Execute** fixes to preserve pool data
5. **Test** to ensure pool standings are accessible

---

**Investigation Date:** February 21, 2026  
**Status:** Complete  
**Severity:** Critical  
**Action Required:** Yes - Implement recommendations to preserve pool data
