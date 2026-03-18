# Project State: CourtMastr v2

## Context
CourtMastr v2 is an established codebase being transitioned into a structured GSD (Get Shit Done) workflow. The core technical mapping has been completed.

## Technical Snapshot
- **Last Mapping**: 2026-03-18
- **Stack**: Vue 3, TS, Vite, Vuetify, Pinia, Firebase.
- **Integrations**: Firestore (offline-first), Auth, Cloud Functions, Storage.
- **Active Patterns**: 60+ documented in `docs/coding-patterns/CODING_PATTERNS.md`.

## Milestone Progress
- **Milestone 1**: 100% Complete. Branding implemented, core features stable.
- **Milestone 2**: 0% Complete. Starting Phase 1 (Player Check-In).

## Known Issues & Debt
- Shared participant resolution needs wider adoption (`useParticipantResolver`).
- Category-scoped scoring paths migration is ongoing.
- High volume of historical debug entries in KB (120+).

## Recent Activity
- **2026-03-18**: Codebase mapping complete. GSD workflow initialized.
- **2026-03-14**: Production environment build guards implemented.
