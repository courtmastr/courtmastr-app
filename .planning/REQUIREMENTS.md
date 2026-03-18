# Requirements: CourtMastr v2

## Functional Requirements

### 1. Tournament Management
- Create and configure tournaments (dates, location, settings).
- Support for multiple categories (Singles, Doubles, Mixed, Age Groups).
- Admin approval workflow for player registrations.

### 2. Bracket & Match Operations
- Intelligent bracket generation (Single/Double Elimination, Round Robin).
- Smart scheduling with court assignment and rest-time constraints.
- Real-time scoring interface with automatic badminton rules (e.g., win by 2).

### 3. Public Experience
- Live public brackets and scoreboards via shareable URLs.
- Print-friendly QR codes for venue signage.
- OBS-ready score bugs and graphics for live streams.

### 4. Resilience
- Full offline scoring capability with automatic sync upon reconnection.
- Role-based access control (Admin, Organizer, Volunteer, Public).

## Non-Functional Requirements
- **Performance**: < 500ms response time for UI interactions.
- **Reliability**: Zero data loss during offline/online transitions.
- **Scalability**: Support tournaments with up to 512 participants and 24 courts.
- **Usability**: Accessible interface for mobile devices under high-glare or venue conditions.

## Technical Constraints
- Must use Vue 3, TypeScript, and Firebase.
- Must follow the "Agent Authority Contract" (`AGENTS.md`) and Coding Patterns.
- Must use `brackets-manager` for core bracket algorithms.
