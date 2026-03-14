# CourtMastr Documentation

Welcome to the CourtMastr v2 documentation. This directory contains comprehensive documentation for the tournament management system, organized by purpose and audience.

## 📚 Documentation Quick Links

### Getting Started
- [Project README](../README.md) - Overview, setup, and quick start
- [Product Requirements (PRD)](./PRD.md) - Features, user flows, requirements
- [Technical Design (TDD)](./TDD.md) - Architecture and implementation details

### Project Intelligence (AI-First Documentation)
Located in `.opencode/context/project-intelligence/`:
- **[Technical Domain](../.opencode/context/project-intelligence/technical-domain.md)** - Tech stack, code patterns, standards
- **[Business Domain](../.opencode/context/project-intelligence/business-domain.md)** - Users, value prop, roadmap
- **[Business-Tech Bridge](../.opencode/context/project-intelligence/business-tech-bridge.md)** - Feature mappings
- **[Decisions Log](../.opencode/context/project-intelligence/decisions-log.md)** - Architectural decisions
- **[Living Notes](../.opencode/context/project-intelligence/living-notes.md)** - Active issues and debt

---

## 📖 Documentation Structure

### Core Documentation
| Document | Purpose | Audience |
|----------|---------|----------|
| [PRD](./PRD.md) | Product requirements, features, user flows | Product, Design, Engineering |
| [TDD](./TDD.md) | Architecture, data models, APIs | Engineering |
| [README](../README.md) | Setup, development, deployment | Developers, DevOps |

### Architecture & Design
| Document | Purpose | Audience |
|----------|---------|----------|
| [Data Model Architecture](./architecture/DATA_MODEL_ARCHITECTURE.md) | Database design and relationships | Engineering |
| [Data Model Quick Ref](./architecture/DATA_MODEL_QUICK_REF.md) | Quick reference for data structures | Engineering |
| [Implementation Checklist](./architecture/IMPLEMENTATION_CHECKLIST.md) | Development tracking | Engineering |
| [Testing Strategy](./architecture/TESTING_STRATEGY.md) | Testing approach and coverage | QA, Engineering |
| [Rollback Plan](./architecture/ROLLBACK_PLAN.md) | Production rollback procedures | DevOps |

### Data Model & Migration
| Document | Purpose | Audience |
|----------|---------|----------|
| **[DATA_MODEL_MIGRATION_RULES](./migration/DATA_MODEL_MIGRATION_RULES.md)** | **Critical rules for data model** | **All Developers** |
| [Migration Summary](./migration/SUMMARY.md) | Migration phases and status | Engineering |
| [Master Plan](./migration/MASTER_PLAN.md) | Complete migration plan | Engineering |

### Feature Specifications
| Feature | Status | Priority | Document |
|---------|--------|----------|----------|
| User Management Dashboard | Not Started | Critical | [Spec](./features/USER_MANAGEMENT_DASHBOARD.md) |
| Reporting & Analytics | Not Started | High | [Spec](./features/REPORTING_ANALYTICS.md) |
| Player Check-in | Partial | High | [Spec](./features/PLAYER_CHECK_IN.md) |
| Score Correction | Partial | High | [Spec](./features/SCORE_CORRECTION.md) |

### UI/UX Design
| Document | Purpose | Audience |
|----------|---------|----------|
| [UI Improvements Comprehensive](./ui-improvements-comprehensive.md) | Complete UI/UX improvements | Design, Engineering |
| [Navigation & IA](./navigation-information-architecture-improvements.md) | Navigation redesign | Design, Engineering |
| [Match Control UI](./match-control-ui-improvements.md) | Scoring interface design | Design, Engineering |
| [Apple-Inspired Redesign](./apple-inspired-ui-redesign-plan.md) | Visual design direction | Design |

### Debugging & Troubleshooting
| Document | Purpose | Audience |
|----------|---------|----------|
| [Debug Knowledge Base](./debug-kb/README.md) | Error resolution | Engineering |
| [Debug KB Index](./debug-kb/index.yml) | Searchable error database | Engineering |
| [Coding Patterns](./coding-patterns/CODING_PATTERNS.md) | Code patterns and anti-patterns | Engineering |

### Testing
| Document | Purpose | Audience |
|----------|---------|----------|
| [Test Cases Inventory](./testing/TEST_CASES_INVENTORY.md) | Test case catalog | QA |
| [Test Execution Report](./testing/TEST_EXECUTION_REPORT.md) | Test results | QA |
| [P0 Final Report](./testing/P0_FINAL_REPORT.md) | Critical test results | QA, Engineering |

---

## 🎯 Documentation by Role

### For Product Managers
1. [Business Domain](../.opencode/context/project-intelligence/business-domain.md) - Understand users and value
2. [PRD](./PRD.md) - Feature requirements
3. [Feature Specs](./features/) - Detailed feature documentation

### For Designers
1. [UI Improvements Comprehensive](./ui-improvements-comprehensive.md) - Design direction
2. [PRD](./PRD.md) - User flows and requirements
3. [Business Domain](../.opencode/context/project-intelligence/business-domain.md) - User needs

### For Engineers
1. [Technical Domain](../.opencode/context/project-intelligence/technical-domain.md) - Code patterns
2. **[DATA_MODEL_MIGRATION_RULES](./migration/DATA_MODEL_MIGRATION_RULES.md)** - **Critical data rules**
3. [TDD](./TDD.md) - Architecture details
4. [Decisions Log](../.opencode/context/project-intelligence/decisions-log.md) - Why we chose X
5. [Living Notes](../.opencode/context/project-intelligence/living-notes.md) - Known issues

### For DevOps
1. [README](../README.md) - Deployment procedures
2. [Rollback Plan](./architecture/ROLLBACK_PLAN.md) - Emergency procedures
3. [Architecture Diagrams](./architecture/DIAGRAMS.md) - System overview

---

## 🆘 Critical Resources

### Must-Read Before Coding
1. **[DATA_MODEL_MIGRATION_RULES](./migration/DATA_MODEL_MIGRATION_RULES.md)** - Data model rules
2. [Coding Patterns](./coding-patterns/CODING_PATTERNS.md) - Code standards
3. [Project Contract](../AGENTS.md) - System-wide rules

### Debugging Resources
- [Debug KB](./debug-kb/README.md) - Search by error fingerprint
- [Living Notes](../.opencode/context/project-intelligence/living-notes.md) - Active issues

### Quick References
- [Data Model Quick Ref](./architecture/DATA_MODEL_QUICK_REF.md) - Data structures
- [Technical Domain](../.opencode/context/project-intelligence/technical-domain.md) - Tech stack summary

---

## ✍️ Creating New Documentation

When adding documentation:

1. **Choose the right location**:
   - UI/UX designs → `docs/` root
   - Technical specs → `docs/architecture/` or `docs/features/`
   - Bug fixes → `docs/debug-kb/` or `docs/migration/`

2. **Follow the template**:
   - [Coding Patterns Template](./coding-patterns/TEMPLATE.md)
   - [Debug KB Template](./debug-kb/TEMPLATE.md)

3. **Update this README** with the new document

4. **Link to Project Intelligence** if relevant:
   - Technical decisions → Update [Decisions Log](../.opencode/context/project-intelligence/decisions-log.md)
   - New patterns → Update [Technical Domain](../.opencode/context/project-intelligence/technical-domain.md)
   - Known issues → Update [Living Notes](../.opencode/context/project-intelligence/living-notes.md)

---

## 📊 Documentation Status

- **Core Docs**: ✅ Complete (PRD, TDD, README)
- **Project Intelligence**: ✅ Complete (6/6 files)
- **Architecture**: ✅ Complete
- **Feature Specs**: 📝 In Progress (4 features documented)
- **UI/UX Design**: ✅ Complete
- **Debug KB**: ✅ Active (20+ entries)

---

*Last Updated: 2026-02-17*