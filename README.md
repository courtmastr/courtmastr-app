# CourtMaster v2 - Tournament Management System

[![Vue 3](https://img.shields.io/badge/Vue-3.0-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Cloud%20Platform-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Vuetify](https://img.shields.io/badge/Vuetify-3.0-1867C0?logo=vuetify)](https://vuetifyjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, real-time tournament management system designed specifically for badminton tournaments. Built with Vue 3, TypeScript, and Firebase for lightning-fast setup and professional tournament experiences.

## 🎯 Why CourtMaster?

**For Tournament Organizers:**
- ⚡ **Generate brackets in 30 seconds** (not 2-4 hours)
- 📱 **Mobile-optimized scoring** works on any device
- 🔄 **Real-time updates** visible instantly to all participants
- 📊 **Professional presentation** impresses players and sponsors

**For Scorekeepers:**
- 👆 **Large touch-friendly buttons** work with gloves
- 📶 **Offline support** for venues with poor connectivity
- ⚙️ **Automatic badminton rules** (21-point games, win by 2, max 30)
- 🎯 **Queue visibility** for upcoming matches

**For Players & Spectators:**
- 🔗 **Public brackets** via shareable URLs
- 📈 **Live scores** updating in real-time
- 📅 **Self-service registration** without paperwork
- 🏆 **Immediate results** when matches complete

## 📚 Documentation

### Quick Start
- **[Getting Started](#getting-started)** - Installation and local development
- **[Deployment Guide](#deployment-production)** - Production deployment steps

### Project Documentation
- **[Product Requirements (PRD)](docs/PRD.md)** - Features, user flows, and requirements
- **[Technical Design (TDD)](docs/TDD.md)** - Architecture, data models, implementation details
- **[Documentation Index](docs/README.md)** - Complete documentation directory

### Development Guides
- **[Coding Patterns](docs/coding-patterns/CODING_PATTERNS.md)** - Code patterns and anti-patterns
- **[Data Model Rules](docs/migration/DATA_MODEL_MIGRATION_RULES.md)** - Critical data model guidelines
- **[Debug Knowledge Base](docs/debug-kb/README.md)** - Troubleshooting and error resolution

### Project Intelligence (for AI Agents)
- **[Technical Domain](.opencode/context/project-intelligence/technical-domain.md)** - Tech stack, architecture, patterns
- **[Business Domain](.opencode/context/project-intelligence/business-domain.md)** - User needs, value proposition, roadmap
- **[Business-Tech Bridge](.opencode/context/project-intelligence/business-tech-bridge.md)** - Feature mappings and trade-offs
- **[Decisions Log](.opencode/context/project-intelligence/decisions-log.md)** - Architectural decisions with context

## ✨ Features

### Core Tournament Lifecycle
- **🏆 Tournament Management** - Create tournaments with flexible settings, dates, and locations
- **📋 Categories** - Support for singles, doubles, mixed doubles across age groups (U10 to 55+)
- **📝 Player Registration** - Self-service registration with admin approval workflow
- **🏅 Bracket Generation** - Single/double elimination and round robin with smart seeding
- **📱 Real-time Scoring** - Mobile-optimized interface with automatic badminton rules
- **📊 Public Brackets** - Shareable, real-time updating brackets for spectators

### Advanced Features
- **⚡ Smart Scheduling** - Automated court assignment with rest time constraints
- **🏟️ Court Management** - Track court status, handle maintenance, optimize utilization
- **🔄 Real-time Sync** - Firestore-powered instant updates across all devices
- **📴 Offline Support** - PWA works without connectivity, syncs when restored
- **🔒 Role-based Access** - Admin, organizer, scorekeeper, player permissions
- **📈 Audit Logging** - Complete history of all changes for dispute resolution

## 🛠️ Tech Stack

### Frontend
- **[Vue 3](https://vuejs.org/)** - Composition API for complex state management
- **[TypeScript](https://www.typescriptlang.org/)** - Strict mode for type safety
- **[Vite](https://vitejs.dev/)** - Fast HMR and optimized builds
- **[Vuetify 3](https://vuetifyjs.com/)** - Material Design components
- **[Pinia](https://pinia.vuejs.org/)** - Official Vue 3 state management

### Backend & Infrastructure
- **[Firebase](https://firebase.google.com/)** - Full BaaS platform
  - **Firestore** - Real-time NoSQL database with offline persistence
  - **Authentication** - Secure user management with role-based access
  - **Cloud Functions** - Serverless bracket generation and business logic
  - **Hosting** - Global CDN with SSL
- **[brackets-manager](https://www.npmjs.com/package/brackets-manager)** - Professional tournament bracket algorithms

### Development & Testing
- **[Vitest](https://vitest.dev/)** - Fast unit testing
- **[Playwright](https://playwright.dev/)** - E2E browser automation
- **[Vite PWA Plugin](https://vite-pwa-org.netlify.app/)** - Progressive Web App capabilities

### Architecture Highlights
- 🏗️ **Serverless Cloud-Native** - Firebase handles scaling automatically
- 📱 **PWA with Offline Support** - Works at venues with poor connectivity
- 🔄 **Real-time Data Sync** - Firestore listeners for instant updates
- 🎯 **TypeScript Strict Mode** - No `any`, explicit types throughout

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **Firebase CLI** - `npm install -g firebase-tools`
- **Git** ([Download](https://git-scm.com/))

### Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone <repository-url>
cd courtmaster-v2

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.template .env.development
# Edit .env.development with your Firebase credentials (see below)

# 4. Start development (run in separate terminals)
npm run emulators  # Terminal 1: Firebase emulators
npm run dev        # Terminal 2: Vite dev server

# 5. (Optional) Seed test data
npm run seed:simple
```

**Access Points:**
- 🌐 **Application**: http://localhost:3000
- 🔧 **Emulator UI**: http://localhost:4000
- 📊 **Firestore**: http://localhost:4000/firestore

### Firebase Configuration

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore**, **Authentication** (Email/Password), and **Functions**
3. Get your Firebase config from Project Settings → General → Your apps
4. Add to `.env.development`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_USE_FIREBASE_EMULATOR=true
VITE_FIREBASE_EMULATOR_HOST=localhost
```

### Development Workflow

**Recommended Terminal Setup:**

| Terminal | Command | Purpose |
|----------|---------|---------|
| 1 | `npm run emulators` | Firebase emulators (Firestore, Auth, Functions) |
| 2 | `npm run dev` | Vite dev server with HMR |
| 3 | `npm run test` | Vitest in watch mode (optional) |

**Useful Commands:**

```bash
# Development
npm run dev              # Start Vite dev server
npm run dev:log          # Dev server with logging
npm run emulators        # Start Firebase emulators
npm run seed:simple      # Seed with test tournament data

# Testing
npm run test             # Run Vitest in watch mode
npm run test -- --run    # Run tests once (CI mode)
npx playwright test      # Run E2E tests

# Build & Deploy
npm run build            # Production build
npm run preview          # Preview production build
npm run deploy           # Deploy to Firebase
npm run deploy:hosting   # Deploy only hosting
npm run deploy:functions # Deploy only functions

# Code Quality
npm run lint             # ESLint with auto-fix
npm run type-check       # TypeScript checking
```

---

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Vue 3 App   │  │  PWA Service │  │  Firebase Auth   │  │
│  │  (Pinia)      │  │   Worker     │  │   (Roles)        │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTPS / WebSocket
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Firebase Platform                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Firestore   │  │   Hosting    │  │ Cloud Functions  │  │
│  │  (Real-time)  │  │    (CDN)     │  │ (brackets-api)   │  │
│  └───────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
courtmaster-v2/
├── src/                          # Frontend application
│   ├── components/               # Vue components (PascalCase .vue)
│   │   ├── common/              # Shared UI components
│   │   ├── navigation/          # Navigation components
│   │   └── leaderboard/         # Leaderboard components
│   ├── composables/             # Vue composables (use*.ts)
│   ├── features/                # Feature-based views
│   ├── services/                # Firebase and external services
│   ├── stores/                  # Pinia stores (Setup Store pattern)
│   └── types/                   # Central TypeScript definitions
├── functions/                   # Firebase Cloud Functions
│   └── src/
│       ├── bracket.ts           # Bracket generation
│       ├── scheduling.ts        # Match scheduling
│       └── storage/             # Firestore adapters
├── docs/                        # Documentation
│   ├── PRD.md                   # Product requirements
│   ├── TDD.md                   # Technical design
│   ├── features/                # Feature specifications
│   └── migration/               # Migration guides
├── tests/                       # Test files
└── .opencode/                   # Project Intelligence (AI context)
    └── context/
        └── project-intelligence/# Domain knowledge for AI agents
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Firebase (BaaS)** | 80% faster development; integrated real-time sync essential for UX |
| **Vue 3 + TypeScript** | Cleaner state management than React; excellent TypeScript support |
| **Firestore (NoSQL)** | Real-time sync and offline support are core requirements |
| **PWA over Native** | 3x faster development; single codebase for all platforms |
| **Dual Collection Model** | `/match` (library-managed) + `/match_scores` (app-managed) for flexibility |

See **[Decisions Log](.opencode/context/project-intelligence/decisions-log.md)** for full context.

---

## 📖 Project Intelligence (AI-First Documentation)

This project includes comprehensive **Project Intelligence** in `.opencode/context/project-intelligence/` designed for AI agents and new team members:

| Document | Purpose |
|----------|---------|
| **[Technical Domain](.opencode/context/project-intelligence/technical-domain.md)** | Tech stack, code patterns, naming conventions, standards |
| **[Business Domain](.opencode/context/project-intelligence/business-domain.md)** | User needs, value proposition, roadmap, success metrics |
| **[Business-Tech Bridge](.opencode/context/project-intelligence/business-tech-bridge.md)** | How features map to technical solutions |
| **[Decisions Log](.opencode/context/project-intelligence/decisions-log.md)** | Architectural decisions with alternatives and rationale |
| **[Living Notes](.opencode/context/project-intelligence/living-notes.md)** | Active issues, technical debt, lessons learned |

### Quick Intelligence Reference

**Tech Stack**: Vue 3 + TypeScript + Firebase + Vuetify 3 + Pinia

**Code Patterns**:
- Vue 3 Composition API with `<script setup lang="ts">`
- Pinia Setup Stores (ref() state, computed() getters, async actions)
- Composables for reusable logic (`useParticipantResolver`, `useMatchScheduler`)
- Firestore listeners with cleanup in component unmount

**Critical Data Rules**:
- `/match` = read-only bracket structure (brackets-manager)
- `/match_scores` = operational data (scores, courts, status)
- `participant.name` = registration ID (not `participant.id`)
- Always use `serverTimestamp()`, never `new Date()`

---

## 🚢 Deployment (Production)

### Pre-Deployment Checklist

- [ ] Firebase project created with Blaze plan (pay-as-you-go)
- [ ] Firestore, Authentication, and Functions enabled
- [ ] Production Firebase config in `.env.production`
- [ ] Firestore security rules reviewed and tested
- [ ] All tests passing (`npm run test -- --run`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)

### Production Deployment

```bash
# 1. Build for production
npm run build

# 2. Deploy everything
npm run deploy

# Or deploy components separately:
npm run deploy:hosting    # Frontend only
npm run deploy:functions  # Cloud Functions only
npm run deploy:rules      # Firestore rules only
```

### Environment Variables (Production)

Create `.env.production`:

```env
VITE_FIREBASE_API_KEY=prod_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=prod_sender_id
VITE_FIREBASE_APP_ID=prod_app_id
VITE_USE_FIREBASE_EMULATOR=false
```

---

## 🧪 Testing

### Test Strategy

| Type | Tool | Command | Coverage Target |
|------|------|---------|----------------|
| **Unit** | Vitest | `npm run test` | 80% |
| **E2E** | Playwright | `npx playwright test` | Critical paths |
| **Manual** | Browser | `npm run dev` | UX validation |

### Running Tests

```bash
# Unit tests (watch mode)
npm run test

# Unit tests (CI mode)
npm run test -- --run

# E2E tests
npx playwright test

# E2E with UI
npx playwright test --ui

# E2E headed (see browser)
npx playwright test --headed
```

---

## 🏗️ Development Guide

### Code Standards

1. **TypeScript Strict Mode** - No `any`, explicit return types
2. **Vue 3 Composition API** - Use `<script setup lang="ts">`
3. **Import Order** - Vue → Router → Pinia → composables → services → types
4. **Vuetify Components** - Use Material Design components exclusively
5. **Error Handling** - Try/catch with emoji-prefixed logs (🎯, ❌, ✅)
6. **Firebase** - Always use `serverTimestamp()`, never `new Date()`

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `use-match-scheduler.ts` |
| Components | PascalCase | `StatusBadge.vue` |
| Composables | camelCase with `use` | `useTournamentStore` |
| Types | PascalCase | `Tournament`, `MatchStatus` |
| Constants | UPPER_SNAKE | `USE_CLOUD_FUNCTION` |

See **[Coding Patterns](docs/coding-patterns/CODING_PATTERNS.md)** for complete guidelines.

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following our [coding patterns](docs/coding-patterns/CODING_PATTERNS.md)
4. **Run tests**: `npm run test -- --run`
5. **Run linting**: `npm run lint`
6. **Run type check**: `npm run type-check`
7. **Commit** with descriptive messages
8. **Push** and create a Pull Request

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(scoring): add score correction with audit trail

- Allow admins to correct scores post-match
- Log all corrections to audit collection
- Show correction history in match details
```

---

## 📊 Project Status

### Implemented ✅
- Tournament and category management
- Player registration with approval workflow
- Single/double elimination bracket generation
- Mobile-optimized real-time scoring
- Public live brackets
- Court management and assignment
- PWA with offline support

### In Progress 🚧
- Player check-in system (Q1 2026)
- Score correction with audit trail (Q1 2026)

### Planned 📋
- Reporting and analytics (Q2 2026)
- User management dashboard (Q2 2026)
- Payment integration (under evaluation)
- Multi-sport support (research phase)

See **[Living Notes](.opencode/context/project-intelligence/living-notes.md)** for detailed status.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Resources

- **Documentation**: [docs/README.md](docs/README.md)
- **Debug KB**: [docs/debug-kb/README.md](docs/debug-kb/README.md)
- **Data Model Rules**: [docs/migration/DATA_MODEL_MIGRATION_RULES.md](docs/migration/DATA_MODEL_MIGRATION_RULES.md)
- **Issues**: [GitHub Issues](../../issues)

---

<p align="center">
  Built with ❤️ for the badminton community
</p>
