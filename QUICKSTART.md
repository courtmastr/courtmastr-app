# Quick Start Guide

Get CourtMaster running locally in 5 minutes.

## ⚡ Prerequisites

- [Node.js 18+](https://nodejs.org/) installed
- [Git](https://git-scm.com/) installed
- Firebase CLI (install below)

## 🚀 5-Minute Setup

### Step 1: Clone and Install (1 min)

```bash
git clone <repository-url>
cd courtmaster-v2
npm install
```

### Step 2: Install Firebase CLI (1 min)

```bash
npm install -g firebase-tools
firebase login
```

### Step 3: Configure Environment (1 min)

```bash
cp .env.template .env.development
```

Create a Firebase project:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create Project"
3. Enable Firestore, Authentication, and Functions

Get your Firebase config:
1. Project Settings → General → Your apps → Web
2. Copy the config object
3. Paste values into `.env.development`:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_USE_FIREBASE_EMULATOR=true
VITE_FIREBASE_EMULATOR_HOST=localhost
```

### Step 4: Start Development (2 mins)

Open **three terminal windows**:

**Terminal 1 - Firebase Emulators:**
```bash
npm run emulators
```

**Terminal 2 - Vite Dev Server:**
```bash
npm run dev
```

**Terminal 3 - (Optional) Seed Data:**
```bash
npm run seed:simple
```

### Step 5: Open in Browser

- **App**: http://localhost:3000
- **Emulator UI**: http://localhost:4000

Login with test credentials:
- Email: `admin@courtmaster.local`
- Password: `admin123`

## 🧪 Verify Installation

### Run Tests

```bash
# Unit tests
npm run test -- --run

# Type checking
npm run type-check

# Linting
npm run lint
```

### Check Development Setup

1. ✅ Can login with test account
2. ✅ Can create a tournament
3. ✅ Can add a category
4. ✅ Can view Firestore data at http://localhost:4000/firestore

## 🛠️ Common Issues

### Issue: "Firebase project not found"

**Solution**: Check your `.env.development` file has correct `VITE_FIREBASE_PROJECT_ID`

### Issue: "Firestore permission denied"

**Solution**: 
1. Check emulators are running (`npm run emulators`)
2. Verify `VITE_USE_FIREBASE_EMULATOR=true` in `.env.development`
3. Check Firestore rules are deployed: `npm run deploy:rules`

### Issue: "Module not found" errors

**Solution**:
```bash
rm -rf node_modules
npm install
```

### Issue: Port 3000 already in use

**Solution**: 
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

## 📝 Next Steps

### Learn the Codebase

1. Read [Project Intelligence](../.opencode/context/project-intelligence/technical-domain.md) (10 min)
2. Review [Data Model Rules](docs/migration/DATA_MODEL_MIGRATION_RULES.md) (5 min)
3. Check [Coding Patterns](docs/coding-patterns/CODING_PATTERNS.md) (5 min)

### Make Your First Change

1. Create a branch: `git checkout -b feature/my-first-feature`
2. Find a "good first issue" in GitHub Issues
3. Make changes following [code standards](../CONTRIBUTING.md#code-standards)
4. Run tests: `npm run test -- --run`
5. Commit and push

### Understanding the Structure

```
src/
├── components/     # Vue components (.vue files)
├── composables/    # Reusable logic (use*.ts)
├── stores/         # Pinia stores
├── services/       # Firebase config
└── types/          # TypeScript types

Key files to know:
- src/stores/tournaments.ts     # Tournament state
- src/composables/useMatchScheduler.ts  # Scheduling logic
- functions/src/bracket.ts      # Bracket generation
```

## 🆘 Getting Help

- **Stuck?** Check [Debug KB](docs/debug-kb/README.md)
- **Questions?** Open a [GitHub Discussion](../../discussions)
- **Found a bug?** Create an [issue](../../issues)

## 🎉 You're Ready!

Start developing:
```bash
# Keep emulators running
npm run emulators

# In another terminal
npm run dev
```

Happy coding! 🏸
