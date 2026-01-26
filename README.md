# CourtMaster v2 - Tournament Management System

A modern tournament management system for badminton tournaments, built with Vue 3, TypeScript, Vuetify, and Firebase.

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

### Installation

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

3. **Install Cloud Functions dependencies**
   ```bash
   cd functions
   npm install
   cd ..
   ```

4. **Start development**
   ```bash
   # Start Firebase emulators (in one terminal)
   npm run emulators

   # Start Vite dev server (in another terminal)
   npm run dev
   ```

5. **Access the app**
   - Frontend: http://localhost:3000
   - Firebase Emulator UI: http://localhost:4000

## Project Structure

```
courtmaster-v2/
├── src/
│   ├── components/          # Shared components
│   │   ├── common/          # Generic UI components
│   │   └── layout/          # Layout components
│   ├── features/            # Feature modules
│   │   ├── auth/            # Authentication
│   │   ├── tournaments/     # Tournament management
│   │   ├── scoring/         # Match scoring
│   │   ├── brackets/        # Bracket visualization
│   │   ├── registration/    # Player registration
│   │   └── public/          # Public-facing views
│   ├── stores/              # Pinia stores
│   ├── services/            # Firebase services
│   ├── types/               # TypeScript types
│   ├── router/              # Vue Router config
│   ├── plugins/             # Vue plugins (Vuetify)
│   └── utils/               # Utility functions
├── functions/               # Cloud Functions
│   └── src/
│       ├── bracket.ts       # Bracket generation
│       ├── scheduling.ts    # Schedule optimization
│       └── index.ts         # Function exports
├── tests/                   # Test files
│   ├── unit/                # Unit tests
│   └── components/          # Component tests
└── public/                  # Static assets
```

## Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run emulators        # Start Firebase emulators

# Testing
npm run test             # Run tests
npm run test:coverage    # Run tests with coverage

# Build & Deploy
npm run build            # Build for production
npm run deploy           # Build and deploy to Firebase
npm run deploy:hosting   # Deploy hosting only
npm run deploy:functions # Deploy functions only
npm run deploy:rules     # Deploy Firestore rules only

# Code Quality
npm run type-check       # Run TypeScript type checking
npm run lint             # Lint and fix code
```

## User Roles

1. **Admin**: Full access to create/manage tournaments, approve registrations, manage users
2. **Scorekeeper**: Can score matches, view tournament details
3. **Viewer**: Read-only access to public tournament information

## Scoring Rules (Badminton)

- Games to 21 points
- Win by 2 points
- Maximum 30 points (first to 30 wins at 29-29)
- Best of 3 games

## Deployment

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore, Authentication (Email/Password), and Functions
3. Copy your Firebase config to `.env.production`

### Deploy

```bash
# Deploy everything
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
