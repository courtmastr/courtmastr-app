# CourtMaster v2 - Tournament Management System

A modern tournament management system for badminton tournaments, built with Vue 3, TypeScript, Vuetify, and Firebase.

## Documentation

- **[Product Requirements Document (PRD)](docs/PRD.md)** - Product overview, features, and user flows
- **[Technical Design Document (TDD)](docs/TDD.md)** - Architecture, data models, and implementation details

## Features

- **Tournament Management**: Create and manage badminton tournaments with single/double elimination formats
- **Real-time Scoring**: Mobile-optimized scoring interface for scorekeepers
- **Smart Scheduling**: Automated scheduling algorithm with rest time constraints
- **Player Registration**: Self-service registration and admin bulk import
- **Live Brackets**: Public-facing bracket visualization with real-time updates
- **PWA Support**: Installable progressive web app

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **UI Framework**: Vuetify 3 (Material Design)
- **State Management**: Pinia
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, Hosting)
- **PWA**: Vite PWA Plugin

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)

### Installation & Local Development

1. **Clone and install dependencies**
   ```bash
   cd courtmaster-v2
   npm install
   ```

2. **Configure Firebase**
   ```bash
   # Copy environment template
   cp .env.template .env.development
   # Edit .env.development with your Firebase credentials
   ```

3. **Start Development (Local Emulators)**
   Run these in separate terminal windows:

   **Terminal 1: Firebase Emulators**
   ```bash
   npm install -D firebase-tools && npm run build --prefix functions && ./node_modules/.bin/firebase emulators:start --project demo-courtmaster
   ```

   **Terminal 2: Vite Dev Server**
   ```bash
   npm run dev
   ```

   **Terminal 3: Seed Data (Optional)**
   ```bash
   npm run seed:simple
   ```

   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Emulator UI**: [http://localhost:4000](http://localhost:4000)

---

## Going Live Locally (Preview)

Before deploying, you can preview the production build on your local machine:

1. **Build and Preview**
   ```bash
   npm run build
   npm run preview
   ```
   - **Preview URL**: [http://localhost:4173](http://localhost:4173) (default Vite preview port)

---

## Deployment (Production)

### 1. Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore**, **Authentication**, and **Functions**.
3. **Upgrade to Blaze Plan** (Required for Cloud Functions).
4. Copy your production credentials to `.env.production`.

### 2. Deploy to Production
```bash
# Build and deploy everything
npm run deploy

# Or deploy components separately
npm run deploy:hosting
npm run deploy:functions
npm run deploy:rules
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
