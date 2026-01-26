# CourtMaster v2 - Next Release Features

This document tracks features that are planned for future releases but are not included in the current version.

---

## Deferred Features

### 1. Tournament Staff Management
**Priority:** High
**Category:** Tournament Administration
**Date Added:** 2025-01-25

**Description:**
Currently, users can register as "Scorekeeper" role, but there's no way to assign them to specific tournaments. Tournament organizers need the ability to:

- Invite/assign scorekeepers to their tournaments
- Manage staff permissions per tournament
- View which scorekeepers are available/assigned
- Allow scorekeepers to see only tournaments they're assigned to

**Current Workaround:**
Scorekeepers with the role can access scoring for any tournament they have the link to.

**Implementation Notes:**
- Add `tournamentStaff` collection in Firestore
- Create staff management UI in tournament settings
- Add invitation/request workflow for scorekeepers
- Update route guards to check tournament-specific permissions

---

## Feature Request Template

```markdown
### [Feature Name]
**Priority:** High | Medium | Low
**Category:** [Category]
**Date Added:** YYYY-MM-DD

**Description:**
[Detailed description of the feature]

**Current Workaround:**
[If any]

**Implementation Notes:**
- [Technical notes]
```

---

## Version History

| Version | Release Date | Major Features |
|---------|--------------|----------------|
| v2.0.0  | TBD          | Initial Vue 3 release with core tournament management |

---

*Last Updated: 2025-01-25*
