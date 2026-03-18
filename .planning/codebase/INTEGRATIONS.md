# Integrations

External services and internal integrations in CourtMastr v2.

## Firebase Suite
- **Firestore**: Primary data store. Uses `persistentLocalCache` and `persistentMultipleTabManager` for offline-first capabilities.
- **Auth**: Manages user sessions, registration, and role-based access control. Connects to `google.com` via social login and email/password.
- **Functions**: Handles server-side logic (e.g., seeding, complex calculations, third-party hooks).
- **Storage**: Stores branding assets (logos, sponsor images) and user-uploaded content.

## Domain Core Integrations
- **Brackets Manager**: Integrated for tournament structure management (rounds, groups, matches). The application reads from `/match` (READ ONLY) and writes operational data to `/match_scores`.
- **OpenCode / Agent-Browser**: Integrated for E2E testing and automated browser interactions.

## Development Tools
- **Firebase Emulators**: Used for local development and testing (Auth, Firestore, Functions, Storage).
- **Vite PWA Plugin**: Integrates service worker generation and manifest management.
