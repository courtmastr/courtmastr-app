<!-- Context: project-intelligence/notes | Priority: high | Version: 1.1 | Updated: 2026-02-17 -->

# Living Notes

> CourtMaster v2: Current state, active issues, and technical insights

## Quick Reference

- **Update**: Weekly or when status changes
- **Archive**: Move resolved items to bottom with status
- **Purpose**: Track debt, issues, and learnings

## Technical Debt

| Item | Impact | Priority | Mitigation |
|------|--------|----------|------------|
| **Bracket regeneration complexity** | Cannot regenerate once matches start; requires manual workarounds | High | Plan refactor with soft-delete pattern |
| **Firestore denormalization** | Multiple collections for same data (match vs match_scores) | Medium | Document data flow; consider read replicas |
| **Cloud Function cold starts** | First bracket generation slow (~3-5s) | Low | Acceptable for admin action |
| **Audit log growth** | Unbounded collection growth over time | Medium | Implement TTL policy; export to BigQuery |

### Debt: Bracket Regeneration

**Priority**: High  
**Impact**: Organizers cannot fix seeding errors after first match starts  
**Root Cause**: brackets-manager library deletes data on regeneration  
**Solution**: Implement soft-delete pattern; archive old brackets  
**Effort**: Medium (2-3 days)  
**Status**: Acknowledged - plan for Q2 2026

---

## Open Questions

| Question | Stakeholders | Status | Next Action |
|----------|--------------|--------|-------------|
| **Payment integration?** | Product, Legal | Open | Evaluate Stripe vs PayPal; assess PCI compliance |
| **Multi-sport support?** | Product, Tech Lead | In Progress | Research rule variations; design plugin architecture |
| **Mobile native apps?** | Business, Tech | Open | Monitor PWA adoption |
| **Tournament series?** | Product | Open | Gather requirements from 3+ organizers |
| **Live streaming integration?** | Marketing | Deferred | Wait for user requests |

---

## Known Issues

| Issue | Severity | Workaround | Status |
|-------|----------|------------|--------|
| **Bracket generation fails with >64 players** | High | Split into multiple categories | In Progress - fix targeted v1.3 |
| **Offline sync conflicts** | Medium | Refresh page if scores don't appear | Known - rare occurrence |
| **Court maintenance reassignment** | Medium | Manually reassign affected matches | In Progress - auto-reassignment v1.2 |
| **Slow tournament list load** | Low | Pagination implemented | Known - monitor growth |

### Issue: Bracket Generation Limit

**Severity**: High  
**Impact**: Tournaments with >64 players cannot use auto-generation  
**Reproduction**: Create category with 65+ registrations → Generate bracket → Error  
**Workaround**: Split into multiple categories (A and B draws)  
**Root Cause**: brackets-manager library memory constraints  
**Fix Plan**: Implement chunked processing; test up to 128 players  
**Status**: In Progress

---

## Insights & Lessons

### What Works Well ✅

- **Real-time sync via Firestore** - Users love instant score updates; zero latency complaints
- **Mobile-first scoring UI** - Scorekeepers praise large buttons; works on $100 tablets
- **PWA offline support** - Successfully operated 3 tournaments with WiFi outages
- **Emoji logging convention** - Makes debugging Cloud Functions faster (🎯, ❌, ✅)
- **Composables pattern** - useParticipantResolver prevents duplication across 8 components

### What Could Be Better ⚠️

- **Test coverage** - Only 45% coverage; brittle tests break on UI changes
- **Error messages** - Too technical for end users; need friendlier copy
- **Loading states** - Some operations lack visual feedback; users think app froze
- **Documentation** - Onboarding new developers takes 2-3 days

### Lessons Learned 🎓

- **Firestore listeners must be unsubscribed** - Memory leak caused browser crashes after 30min
- **Always use serverTimestamp()** - Client clock drift caused sorting issues
- **Participant.name is registration ID** - Confused developers 3 times; document prominently
- **Test with real tournament data** - Seed data didn't expose performance issues

---

## Patterns & Conventions

### Preserve These ✅

- **Pinia Setup Stores** - Clean separation of state/getters/actions
- **Composable Pattern** - Reusable logic with loading/error states
- **Firestore Collection Structure** - Tournament-scoped sub-collections
- **Cloud Function Error Handling** - Emoji-prefixed logs + structured errors

### Gotchas ⚠️

- **`participant.name` is registration ID** - The ID is numeric brackets-manager internal
- **`/match` is read-only** - brackets-manager manages this; write to `/match_scores` instead
- **Bracket generation is async** - UI must handle pending state
- **Firestore queries need composite indexes** - Check Firebase Console for errors
- **Timestamps vs Dates** - Convert Timestamp to Date in stores for Vue reactivity

---

## Active Projects

| Project | Goal | Owner | Timeline |
|---------|------|-------|----------|
| **Player Check-in System** | QR code check-in, reduce day-of chaos | @dev-team | Q1 2026 |
| **Score Correction** | Post-match editing with audit trail | @dev-team | Q1 2026 |
| **Reporting & Analytics** | Tournament statistics, exports | @product | Q2 2026 |
| **User Management Dashboard** | Admin interface for user roles | @dev-team | Q2 2026 |
| **Performance Optimization** | Reduce load times | @tech-lead | Ongoing |

---

## Archive

### Resolved: Firestore Listener Memory Leak

**Resolved**: 2026-01-15  
**Resolution**: Added unsubscribeAll() cleanup in component unmount  
**Learnings**: Always return unsubscribe function from onSnapshot

### Resolved: Duplicate Match Creation Bug

**Resolved**: 2026-01-10  
**Resolution**: Added unique constraint on matchId; idempotent Cloud Function  
**Learnings**: Race conditions with rapid clicks; debounce UI + enforce constraints

---

## 📂 Codebase References

**Debt Tracking**: GitHub Issues with `technical-debt` label  
**Active Work**: GitHub Projects "CourtMaster Roadmap"  
**Incident Log**: `docs/debug-kb/index.yml`

**Related**: `decisions-log.md`, `business-domain.md`, `technical-domain.md`
