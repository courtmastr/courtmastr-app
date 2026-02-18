<!-- Context: project-intelligence/decisions | Priority: high | Version: 1.1 | Updated: 2026-02-17 -->

# Decisions Log

> CourtMaster v2: Major architectural and business decisions with context

## Quick Reference

- **Status**: Decided | Pending | Under Review | Deprecated
- **Owner**: Who made/owns the decision
- **Impact**: What changed because of this decision

---

## Decision: Firebase Platform

**Date**: 2025-06-15 | **Status**: Decided | **Owner**: @tech-lead

**Context**: Backend for real-time tournament management with offline, auth, and hosting needs.

**Decision**: Use Firebase (Firestore, Auth, Cloud Functions, Hosting).

**Rationale**: Time-to-market critical; integrated real-time sync essential for UX.

**Alternatives**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Self-hosted | Full control | 6+ months setup | ❌ Too slow |
| Supabase | Open source | Less mature real-time | ❌ Risk |
| **Firebase** | Integrated, fast | Vendor lock-in | ✅ **Chosen** |

**Impact**: +80% dev speed; -vendor independence  
**Related**: `technical-domain.md`, `business-tech-bridge.md`

---

## Decision: Vue 3 + TypeScript

**Date**: 2025-06-20 | **Status**: Decided | **Owner**: @tech-lead

**Context**: Modern frontend for complex state management and real-time UI.

**Decision**: Vue 3 with Composition API and TypeScript strict mode.

**Rationale**: Cleaner state management than React; better TS support than Vue 2.

**Alternatives**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| React 18 | Large ecosystem | More boilerplate | ❌ Overkill |
| Svelte | Less boilerplate | Small ecosystem | ❌ Hiring risk |
| **Vue 3** | Fast dev, great TS | Smaller ecosystem | ✅ **Chosen** |

**Impact**: +Fast dev; -hiring pool  
**Related**: `src/stores/tournaments.ts`

---

## Decision: Firestore vs PostgreSQL

**Date**: 2025-07-01 | **Status**: Decided | **Owner**: @tech-lead

**Context**: Choose database for real-time tournament data.

**Decision**: Firestore (NoSQL) with denormalized model.

**Rationale**: Real-time sync is core value; pay-per-use fits sporadic usage.

**Alternatives**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Cloud SQL | Relational, ACID | No real-time | ❌ UX requirement |
| MongoDB | Flexible schema | Another vendor | ❌ Lose Firebase benefits |
| **Firestore** | Real-time, offline | Limited queries | ✅ **Chosen** |

**Impact**: +Real-time/offline; -query limitations  
**Related**: `docs/migration/DATA_MODEL_MIGRATION_RULES.md`

---

## Decision: PWA vs Native Apps

**Date**: 2025-07-15 | **Status**: Decided | **Owner**: @product, @tech-lead

**Context**: Mobile interface for scorekeepers.

**Decision**: PWA with offline support.

**Rationale**: Single codebase; no app store delays; offline Service Workers sufficient.

**Alternatives**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| React Native | Native performance | 2x dev effort | ❌ Too costly |
| Flutter | Single codebase | Dart learning curve | ❌ Team unfamiliar |
| **PWA** | 3x faster, instant updates | Limited device access | ✅ **Chosen** |

**Impact**: +3x dev speed; -app store presence  
**Related**: `business-domain.md` (mobile constraint)

---

## Decision: brackets-manager Library

**Date**: 2025-08-01 | **Status**: Decided | **Owner**: @tech-lead

**Context**: Tournament bracket generation with seeding, byes, advancement logic.

**Decision**: Use `brackets-manager` npm library.

**Rationale**: Professional standards (ITTF/USATT compliant); battle-tested; handles edge cases.

**Alternatives**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Custom | Full control | 2-3 months dev | ❌ Reinventing wheel |
| API service | Zero maintenance | External dependency | ❌ Vendor lock-in |
| **brackets-manager** | Pro standards | Limited customization | ✅ **Chosen** |

**Impact**: +Pro brackets; -customization  
**Related**: `functions/src/bracket.ts`

---

## Decision: Dual Collection Data Model

**Date**: 2025-08-15 | **Status**: Decided | **Owner**: @tech-lead

**Context**: brackets-manager manages match structure; need operational data (scores, courts).

**Decision**: `/match` (read-only, library) + `/match_scores` (operational, app).

**Rationale**: Library compatibility + flexibility without breaking integration.

**Alternatives**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Single collection | Simpler queries | Breaks library | ❌ Compatibility |
| Extend library | Unified model | Maintenance burden | ❌ Forks library |
| **Dual collections** | Clean separation | Data duplication | ✅ **Chosen** |

**Impact**: +Library compatibility; -complexity  
**Related**: `technical-domain.md` (CP-006), `living-notes.md` (debt)

---

## Deprecated Decisions

| Decision | Date | Replaced By | Why |
|----------|------|-------------|-----|
| *None yet* | - | - | - |

## Onboarding Checklist

- [ ] Understand Firebase choice (time-to-market vs control)
- [ ] Know why Vue 3 was chosen over React (simpler state management)
- [ ] Understand Firestore vs PostgreSQL trade-off (real-time vs querying)
- [ ] Know why PWA over native (development speed)
- [ ] Understand dual collection data model
- [ ] Know where to find decision context

## 📂 Codebase References

**Implementation**: `technical-domain.md`, `business-tech-bridge.md`  
**Active Questions**: `living-notes.md`  
**Data Rules**: `docs/migration/DATA_MODEL_MIGRATION_RULES.md`

**Related**: `business-domain.md` (business constraints driving decisions)
