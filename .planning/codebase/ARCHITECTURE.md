# Architecture

High-level design and architectural patterns of CourtMastr v2.

## Overview
CourtMastr v2 is a modern, offline-first PWA built with Vue 3 and Firebase. It follows a feature-based modular architecture to keep the codebase maintainable and scalable.

## Key Layers
- **Views/Features**: Components organized by domain (e.g., `scoring`, `tournaments`, `registration`).
- **Stores (Pinia)**: Centralized state management using the "Setup Store" pattern.
- **Composables**: Reusable business logic and state hooks (e.g., `useParticipantResolver`, `useMatchScheduler`).
- **Services**: Low-level integrations with Firebase and other external APIs (e.g., `src/services/firebase.ts`).
- **Types**: Centralized TypeScript definitions in `src/types/index.ts`.

## Data Flow
1. **Firebase Sync**: Pinia stores use Firestore listeners (`onSnapshot`) to react to real-time data changes.
2. **Action → Dispatch**: User actions trigger Pinia store actions, which call Firebase services or local composables.
3. **Reactive UI**: Components subscribe to store state and computed properties.

## Layout System
- **AppLayout**: Standard layout for organizers and public users.
- **VolunteerLayout**: Simplified layout for match scorers and volunteers with specific meta-tag routing.
- **Overlay Routes**: Transparency-enabled routes for OBS score bugs and graphics.

## Offline Strategy
- Uses Firestore's `persistentLocalCache`.
- PWA service worker handles asset caching for offline access.
- Operational data (`/match_scores`) is designed for resilient updates.
