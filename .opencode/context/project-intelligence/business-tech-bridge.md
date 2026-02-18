<!-- Context: project-intelligence/bridge | Priority: high | Version: 1.1 | Updated: 2026-02-17 -->

# Business ↔ Tech Bridge

> How CourtMaster's business needs map to Vue 3 + Firebase technical solutions

## Quick Reference

- **Purpose**: Connect business requirements to technical implementation
- **Pattern**: Each feature has business context → technical solution → value delivered
- **Update**: When features change, trade-offs emerge, or architecture shifts

## Core Mapping

| Business Need | Technical Solution | Why This Works | Business Value |
|---------------|-------------------|----------------|----------------|
| **Real-time scoring visibility** | Firestore real-time listeners | Instant sync without WebSocket complexity | Spectators see scores update live; no refresh needed |
| **Offline support at venues** | Firestore offline persistence + PWA | Badminton venues often have poor connectivity | Scorekeepers can continue scoring offline; syncs when connection restored |
| **Mobile scoring interface** | Vue 3 + Vuetify responsive design | Scorekeepers use tablets/phones on court | Touch-friendly UI with large buttons works on any device |
| **Automated bracket management** | brackets-manager library + Cloud Functions | Manual bracket creation takes hours | 2-hour manual task becomes 30-second automated process |
| **Public tournament viewing** | Firebase Hosting + unauthenticated Firestore rules | Spectators shouldn't need accounts | Anyone with URL can view live brackets; increases engagement |
| **Multi-user concurrent scoring** | Firestore transactions + optimistic updates | Multiple scorekeepers may score simultaneously | No data loss when multiple users edit; automatic conflict resolution |
| **Audit trail for disputes** | Cloud Functions + audit log collection | Tournament disputes require proof | Every score change logged with timestamp and user; supports dispute resolution |

## Feature Mapping

### Feature: Tournament Management

**Business Context**:
- **User need**: Organizers need to create and configure tournaments quickly without technical expertise
- **Business goal**: Reduce tournament setup time from hours to minutes
- **Priority**: Critical - core functionality that everything else depends on

**Technical Implementation**:
- **Solution**: Vue 3 wizard-style form with Pinia state management + Firestore document structure
- **Architecture**: Tournament document with sub-collections for categories, courts, registrations
- **Trade-offs**: 
  - Considered: Spreadsheet import for bulk setup
  - Chosen: Web form with real-time validation for better UX and data integrity

**Connection**:
The web-based form with validation prevents setup errors that would cause problems later. Real-time saves allow organizers to pause and resume setup. The document structure enables efficient queries for tournament listings and details.

**Without this**: Organizers would need technical knowledge to set up Firebase directly, or use spreadsheets that lack validation and real-time collaboration.

---

### Feature: Player Registration

**Business Context**:
- **User need**: Players want self-service registration without paperwork; admins need oversight
- **Business goal**: Streamline registration process, reduce admin workload, track payments
- **Priority**: High - essential for tournament participation

**Technical Implementation**:
- **Solution**: Self-service registration form + admin approval workflow in Firestore
- **Architecture**: Registration documents with status field (pending → approved → checked_in), payment tracking fields
- **Trade-offs**:
  - Considered: Automated payment processing integration
  - Chosen: External payment tracking (manual mark-as-paid) to avoid PCI compliance complexity

**Connection**:
Self-service reduces admin workload by 70% (based on typical tournament sizes). The approval workflow prevents unqualified players from entering. Payment tracking gives organizers visibility without requiring complex payment gateway integration.

**Without this**: Admins would manually collect paper forms, track payments in spreadsheets, and risk errors in communication.

---

### Feature: Bracket Generation

**Business Context**:
- **User need**: Fair tournament brackets with proper seeding; instant availability once registration closes
- **Business goal**: Eliminate manual bracket creation errors; provide immediate visibility to players
- **Priority**: Critical - core differentiator from manual tournament management

**Technical Implementation**:
- **Solution**: brackets-manager library in Cloud Functions with Firestore storage
- **Architecture**: Cloud Function triggered by admin action; stores bracket in Firestore with /match collection
- **Trade-offs**:
  - Considered: Client-side generation
  - Chosen: Cloud Function for consistent algorithms and to hide complexity from client

**Connection**:
The brackets-manager library implements professional tournament standards (ITTF/USATT compliant). Cloud Functions ensure consistent, tested algorithms regardless of client device. Firestore storage enables real-time bracket updates as matches complete.

**Without this**: Organizers manually create brackets in Excel (2-4 hours, error-prone), or use external tools that don't integrate with scoring.

---

### Feature: Real-Time Scoring

**Business Context**:
- **User need**: Scorekeepers need mobile-friendly scoring; players/spectators want instant results
- **Business goal**: Enable real-time tournament tracking; reduce result latency from hours to seconds
- **Priority**: Critical - primary value proposition for spectators

**Technical Implementation**:
- **Solution**: Vue 3 mobile-optimized UI + Firestore real-time sync + Cloud Functions for bracket advancement
- **Architecture**: Match scores in /match_scores collection; listeners update UI instantly; Cloud Function advances bracket when match completes
- **Trade-offs**:
  - Considered: WebSocket custom implementation
  - Chosen: Firestore listeners for automatic scaling and offline support

**Connection**:
Mobile-optimized UI (large touch targets) enables efficient scoring on phones/tablets. Real-time sync means spectators see updates instantly without refresh. Automatic bracket advancement eliminates manual bracket updates.

**Without this**: Paper score sheets get lost; results entered hours later; spectators have no visibility into tournament progress.

---

### Feature: Public Live Brackets

**Business Context**:
- **User need**: Spectators, coaches, parents want to follow tournaments remotely without accounts
- **Business goal**: Increase tournament engagement; provide professional experience
- **Priority**: High - marketing value and user satisfaction

**Technical Implementation**:
- **Solution**: Public-facing Vue 3 view with unauthenticated Firestore access + Firebase Hosting CDN
- **Architecture**: Separate read-only views with relaxed Firestore rules; global CDN for fast loading
- **Trade-offs**:
  - Considered: Authentication required for all views
  - Chosen: Public access for brackets increases engagement; authentication only for scoring

**Connection**:
Firebase Hosting's global CDN ensures fast bracket loading worldwide. Unauthenticated access removes friction for spectators. Real-time updates create engaging "live event" experience even for remote viewers.

**Without this**: Spectators must be physically present or wait for email updates; reduced tournament engagement and professionalism.

---

### Feature: Court Management

**Business Context**:
- **User need**: Efficiently utilize multiple courts; handle court maintenance issues
- **Business goal**: Maximize court utilization; minimize downtime from maintenance
- **Priority**: Medium - operational efficiency for larger tournaments

**Technical Implementation**:
- **Solution**: Court status tracking in Firestore + match assignment workflow
- **Architecture**: Court documents with status field (available, in_use, maintenance); match assignment updates court status
- **Trade-offs**:
  - Considered: Automated court assignment algorithm
  - Chosen: Manual assignment with suggestions for organizer control

**Connection**:
Real-time court status visible to all organizers prevents double-booking. Maintenance mode with automatic match reassignment prevents scheduling conflicts. Court utilization metrics help optimize tournament flow.

**Without this**: Courts double-booked manually; maintenance issues cause confusion; no visibility into utilization rates.

## Trade-off Decisions

| Situation | Business Priority | Technical Priority | Decision | Rationale |
|-----------|-------------------|-------------------|----------|-----------|
| **Firebase vs Self-Hosted** | Cost control, vendor independence | Flexibility, customization | **Firebase** | Time-to-market critical; Firebase provides auth, database, hosting, functions out-of-box; 80% faster development |
| **Firestore vs PostgreSQL** | Cost (Firestore pay-per-use) | Query flexibility, relational data | **Firestore** | Sporadic tournament usage pattern fits pay-per-use; real-time sync essential for UX; denormalization acceptable for read-heavy workload |
| **PWA vs Native Apps** | Development cost (single codebase) | Performance, device access | **PWA** | 3x faster development; works on all devices; offline support via Service Workers sufficient for venue use |
| **Client vs Cloud Bracket Generation** | Instant feedback | Algorithm consistency, IP protection | **Cloud Functions** | Ensures fair, tested algorithms; hides complexity; enables future bracket logic updates without client updates |
| **Manual vs Automated Payment** | PCI compliance (avoid) | Revenue automation | **Manual Tracking** | Payment integration requires compliance; external tracking sufficient for MVP; can add integration later |
| **Real-time vs Batch Updates** | Server cost optimization | User experience | **Real-time** | Core value proposition; Firestore pricing acceptable at scale; batching would degrade UX significantly |

## Common Misalignments

| Misalignment | Warning Signs | Resolution |
|--------------|---------------|------------|
| **Performance vs Cost** | "Why is this slow?" vs "Firebase bill is too high" | Document performance expectations; use pagination; implement caching for read-heavy operations |
| **Feature Completeness vs MVP** | Scope creep requests vs "when will this ship?" | Maintain prioritized backlog; reference roadmap in business-domain.md; say "not yet" to out-of-scope requests |
| **Mobile-First vs Desktop** | "This button is too small on my laptop" vs "I can't tap this on my phone" | Design mobile-first (scorekeepers are primary mobile users); test on actual devices; use responsive breakpoints |
| **Real-Time vs Offline** | "I updated but they don't see it" vs "It works offline but sync is confusing" | Clear UX indicators for sync status; implement offline queue with visual feedback; educate users on connectivity requirements |
| **Customization vs Standardization** | "Can you add [sport-specific rule]?" vs "We need to maintain one codebase" | Plugin architecture for rule variations; focus on badminton first; document extension points for future sports |

## Stakeholder Communication

**For Business**: Firebase costs scale with activity; PWA eliminates app store delays; real-time features differentiate from competitors

**For Technical**: Business constraints drive architecture; revenue model justifies Firebase costs; roadmap guides technical decisions

## Onboarding Checklist

- [ ] Understand 7 core business-to-technical mappings
- [ ] Know the 6 major features and their business value
- [ ] Understand 6 key trade-off decisions
- [ ] Know common misalignments and resolutions

## 📂 Codebase References

**Business Logic**: `docs/PRD.md`, `docs/TDD.md`
**Implementation**: `functions/src/bracket.ts`, `src/stores/tournaments.ts`, `src/composables/useMatchScheduler.ts`
**Related**: `business-domain.md`, `technical-domain.md`, `decisions-log.md`
