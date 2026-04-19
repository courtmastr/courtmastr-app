# CourtMastr v2 - Production Deployment Guide

## Release Governance

Primary production release path:

1. push code
2. open and merge a PR to `master`
3. let GitHub Actions run the release pipeline in `.github/workflows/ci-cd.yml`

The CI release job now owns the production release path. Production infrastructure is Terraform-managed, and production application rollout is CI-owned. Do not perform manual production deploys from a local shell.

### CI Release Pipeline

On every push to `master` that is not a release-metadata bot commit, GitHub Actions runs:

1. `ci` job
   - `npm ci`
   - `npm ci --prefix functions`
   - writes `.env.production` from GitHub secrets
   - `npm run lint`
   - `npm run test -- --run`
   - `npm run build`
2. `deploy` job
   - checks out full git history
   - installs Firebase CLI
   - authenticates with Google OIDC using:
     - `GCP_DEPLOY_SERVICE_ACCOUNT`
     - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - runs `npm run release:plan`
   - runs `npm run release:deploy`
     - bumps semver
     - writes versioned release notes
     - runs release verification
     - runs build and deploy logging
     - deploys to Firebase production
     - updates `docs/deployment/LAST_DEPLOY.md`
   - commits release metadata back to `master` with:
     - `chore: record release metadata [skip release]`
   - pushes that metadata commit without retriggering the release loop

Release metadata fast path:

1. PRs from `release-metadata/*` branches run the existing `Lint, Test, Build` check name in metadata mode.
2. Metadata mode validates only the release artifact payload:
   - allowed file set only
   - `package.json` and `package-lock.json` stay in sync
   - `docs/releases/v<version>.md` exists
   - `docs/deployment/LAST_DEPLOY.md` links to that release note
3. Merge commits with `[skip release]` and metadata-only diffs take the same fast path on `master`.
4. Full lint, unit test, and build execution remains required for normal app/function changes.

`release:deploy` will:
- classify the release as patch, minor, or major
- auto-bump the semantic version
- generate `docs/releases/v<version>.md`
- run release verification and build guardrails
- run the Firebase deploy commands
- update [LAST_DEPLOY.md](/Users/ramc/Documents/Code/courtmaster-v2/docs/deployment/LAST_DEPLOY.md) after success

Historical release notes live in [docs/releases/README.md](/Users/ramc/Documents/Code/courtmaster-v2/docs/releases/README.md).

## Terraform Layers

CourtMastr infrastructure is now intended to be split across:

- [infra/terraform/README.md](/Users/ramc/Documents/Code/courtmaster-v2/infra/terraform/README.md)
- [infra/terraform/bootstrap/README.md](/Users/ramc/Documents/Code/courtmaster-v2/infra/terraform/bootstrap/README.md)
- [infra/terraform/platform/README.md](/Users/ramc/Documents/Code/courtmaster-v2/infra/terraform/platform/README.md)
- [infra/terraform/deploy/README.md](/Users/ramc/Documents/Code/courtmaster-v2/infra/terraform/deploy/README.md)

The intended order is:

1. `bootstrap`
2. `platform`
3. `deploy`

The split is deliberate:

- Terraform manages infrastructure state
- GitHub Actions on `master` manages application rollout

### Bootstrap

The first apply still requires a project Owner or IAM admin. Terraform does not remove the bootstrap step; it makes steady-state deploy access reproducible after that.

### GitHub repository variables

After Terraform apply, set:

- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`

The existing Firebase web config secrets remain required for the build step.
Secret Manager secret values also still need to be populated after Terraform creates their containers.

### Local Operator Rule

Terraform may provision deploy identities and GitHub variables, but those identities exist for CI automation and infrastructure workflows. They are not a standing invitation to run local production deploys. Production rollout should occur only through the `master` GitHub Actions workflow unless the deployment strategy is explicitly changed and documented first.

### One-Time Environment Setup

Do this once per environment:

1. apply Terraform layers in order:
   - `infra/terraform/bootstrap`
   - `infra/terraform/platform`
   - `infra/terraform/deploy`
2. import existing production resources before the first apply where needed
3. set GitHub repository variables from Terraform outputs:
   - `GCP_DEPLOY_SERVICE_ACCOUNT`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
4. populate Firebase web config secrets for the build
5. populate Secret Manager secret values after Terraform creates the secret containers

### Repeat When Infrastructure Changes

Run Terraform again only when infrastructure changes, for example:

- new IAM roles or deploy identities
- new secret containers
- new Firebase web app registration
- Firestore/index/rules/storage-rule infrastructure changes
- new environments

### Repeat For Every App Release

For normal code releases, do not rerun Terraform. Use CI by default:

1. push your app change
2. merge a PR to `master`
3. watch the `CI-CD` workflow complete

The CI path is the primary release path for Hosting assets, Functions code, rules/index pushes, versioning, release notes, and deploy records.

## ✅ Pre-Deployment Tasks Completed

The following preparation tasks have been completed:

1. **✅ Security Rules Fixed**
   - [firestore.rules](firestore.rules) - Tournament creation now restricted to admins only
   - Previous: Any authenticated user could create tournaments
   - Now: Only admins can create/update tournaments

2. **✅ .gitignore Updated**
   - Added protection for .env files
   - Added Firebase debug logs
   - Added service account keys
   - Your credentials are now safe from accidental commits

3. **✅ Production Environment Template Created**
   - [.env.production](.env.production) - Template created (needs your Firebase credentials)
   - Instructions included in the file

4. **✅ Dependencies Installed**
   - Root packages: 563 packages installed
   - Functions packages: 291 packages installed
   - All dependencies up to date

5. **✅ Quality Checks Passed**
   - ✅ TypeScript type checking: Passed
   - ✅ Tests: 27 tests passed (2 test files)
   - Note: ESLint configuration needs update (not blocking)

6. **✅ Production Build Successful**
   - Build size: 2.4 MB total
   - Optimized bundles created
   - PWA service worker generated
   - Source maps generated

---

## ⚠️ Important: PWA Icons Still Needed

**Status**: The mask-icon.svg has been created, but you still need to generate the bitmap icons:

### Required Icons:
- ❌ `public/favicon.ico` - Browser favicon (32x32)
- ❌ `public/apple-touch-icon.png` - iOS home screen (180x180)
- ❌ `public/pwa-192x192.png` - Android icon (192x192)
- ❌ `public/pwa-512x512.png` - Android splash screen (512x512)
- ✅ `public/mask-icon.svg` - Safari pinned tab (created)

### How to Generate Icons:

**Option 1: Online Generator (Easiest)**
1. Go to https://favicon.io/favicon-generator/
2. Settings:
   - Text: `CM`
   - Background: Circle
   - Font Family: Roboto or similar
   - Font Color: White (#FFFFFF)
   - Background Color: Blue (#1976D2)
3. Click "Download" - you'll get a zip file
4. Extract and copy these files to `/Users/ramc/Documents/Code/courtmaster-v2/public/`:
   - `favicon.ico`
   - Rename `android-chrome-192x192.png` → `pwa-192x192.png`
   - Rename `android-chrome-512x512.png` → `pwa-512x512.png`
   - Rename `apple-touch-icon.png` → `apple-touch-icon.png` (keep name)

**Option 2: Use Existing Logo**
If you have a CourtMastr logo:
1. Go to https://realfavicongenerator.net/
2. Upload your logo
3. Generate all icons
4. Download and place in `public/` folder

**After generating icons, rebuild:**
```bash
npx vite build
```

---

## 📋 Deployment Checklist

### Phase 1: Firebase Project Setup (One-Time)

#### Step 1: Access Your Firebase Project
1. Go to https://console.firebase.google.com/
2. Select your production Firebase project
3. If you don't have one, create it:
   - Click "Add project"
   - Project name: `CourtMastr Production` (or your choice)
   - Analytics: Optional (recommended)
   - Choose billing account if you have one

#### Step 2: Enable Required Services

**2a. Firestore Database**
1. Firebase Console → Build → Firestore Database
2. Click "Create database"
3. **Important**: Choose "Start in production mode"
4. Select location (cannot be changed later):
   - Recommended: `us-central1` (Iowa) - lowest cost
   - Or choose closest to your users
5. Click "Enable"

**2b. Authentication**
1. Firebase Console → Build → Authentication
2. Click "Get started"
3. Sign-in method tab → Click "Email/Password"
4. Enable both:
   - ☑ Email/Password
   - ☐ Email link (passwordless sign-in) - keep disabled
5. Click "Save"

**2c. Upgrade to Blaze Plan (Required for Cloud Functions)**

See [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md) for detailed cost analysis.

1. Firebase Console → Upgrade (at bottom left)
2. Select "Blaze - Pay as you go"
3. Add payment method (credit card)
4. **Set up budget alerts** (IMPORTANT):
   - Go to Google Cloud Console → Billing → Budgets & alerts
   - Create budget: $10/month
   - Set alerts at: 50%, 80%, 100%, 120%
   - Add your email for notifications

**Expected costs**: $0-2/month for testing/small tournaments (see DEPLOYMENT_OPTIONS.md)

**2d. Hosting**
Should be enabled by default. If not:
1. Firebase Console → Build → Hosting
2. Click "Get started"

#### Step 3: Get Firebase Configuration
1. Firebase Console → Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. If no web app exists:
   - Click the web icon `</>` to add a web app
   - App nickname: "CourtMastr Web"
   - ☑ Also set up Firebase Hosting
   - Click "Register app"
4. Copy the config values (you'll see them like this):
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123:web:abc..."
   };
   ```

#### Step 4: Configure Production Environment
1. Open `.env.production` in your editor
2. Fill in the values from Firebase Console:
   ```bash
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123:web:abc...

   VITE_USE_FIREBASE_EMULATOR=false
   NODE_ENV=production
   ```
3. Save the file
4. **Verify** `.env.production` is in `.gitignore` (it is)

#### Step 5: Update Firebase Project Configuration
1. Open `.firebaserc`
2. Add your production project:
   ```json
   {
     "projects": {
       "default": "demo-courtmaster",
       "production": "your-project-id"
     }
   }
   ```
   Replace `your-project-id` with your actual Firebase project ID

---

### Phase 2: Initial Deployment

#### Step 1: Login to Firebase
```bash
firebase login
```
This will open a browser for authentication. Sign in with your Google account.

#### Step 2: Confirm Production Project Alias
```bash
firebase use production
```

Verify you're on the right project:
```bash
firebase projects:list
```
Should show `production` as (current)

#### Step 3: Generate PWA Icons (If Not Done)
See "PWA Icons Still Needed" section above.
After generating icons:
```bash
npx vite build
```

#### Step 4: Build Functions
```bash
cd functions
npm run build
ls -la lib/
# Should show compiled JavaScript files
cd ..
```

#### Step 5: Deploy in Stages (Recommended)

**Stage 1: Deploy Firestore Rules and Indexes**
```bash
# Deploy security rules
firebase deploy --only firestore:rules --project production

# Deploy indexes
firebase deploy --only firestore:indexes --project production

# Wait 2-3 minutes for indexes to build
firebase firestore:indexes
# Wait until all show "READY" status
```

**Stage 2: Deploy Cloud Functions**
```bash
firebase deploy --only functions --project production
```

This will deploy 5 functions:
- `generateBracket` - Creates tournament brackets
- `generateSchedule` - Generates match schedules
- `advanceWinner` - Advances winners to next round
- `onMatchUpdate` - Auto-updates match status (Firestore trigger)
- `healthCheck` - Health check endpoint

**Expected output:**
```
✔  functions: Finished running predeploy script.
i  functions: preparing codebase for deployment
✔  functions: deployed (5 functions)
```

**Stage 3: Deploy Hosting**
```bash
firebase deploy --only hosting --project production
```

**Expected output:**
```
✔  hosting: deploy complete!
Hosting URL: https://your-project-id.web.app
```

#### Alternative: Deploy Everything at Once
After testing the staged approach, you can use:
```bash
npm run deploy
# This runs: npm run build && firebase deploy --project production
```

---

### Phase 3: Post-Deployment Verification

#### Step 1: Access Your Deployed Application
1. Open the hosting URL: `https://your-project-id.web.app`
2. Check browser console (F12) - should have no errors
3. Verify the app loads correctly

#### Step 2: Test Health Check Endpoint
```bash
# Replace YOUR_PROJECT_ID with your actual project ID
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/healthCheck
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T...",
  "version": "1.0.0"
}
```

#### Step 3: Create First Admin User

**Option 1: Via Firebase Console (Easiest)**
1. Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Click "Add user"
5. **Copy the User UID** (you'll see it in the Users table)
6. Go to Firestore Database
7. Start collection: `users`
8. Document ID: Paste the User UID
9. Add fields:
   ```
   email: (string) your-admin-email@domain.com
   role: (string) admin
   displayName: (string) Admin
   createdAt: (timestamp) [Click "use server timestamp"]
   ```
10. Click "Save"

**Option 2: Via Script (Advanced)**
If you want to automate this, you can create a script (see plan for details).

#### Step 4: Test Admin Login
1. Go to your app URL
2. Sign in with the admin credentials
3. You should be redirected to the Dashboard
4. Verify you can access admin features:
   - Create Tournament
   - Add Categories
   - Add Courts

#### Step 5: Test Core Functionality

**✅ Authentication Tests:**
- [  ] Sign in with admin account works
- [  ] Dashboard loads after sign in
- [  ] Navigation menu shows admin options
- [  ] Sign out works

**✅ Admin Functions Tests:**
- [  ] Can create a tournament
- [  ] Can add categories to tournament
- [  ] Can add courts
- [  ] Can generate bracket (if registrations exist)
- [  ] Can generate schedule

**✅ PWA Tests:**
- [  ] PWA install prompt appears (Chrome address bar)
- [  ] App can be installed
- [  ] Installed app shows correct icon
- [  ] Service worker registers (DevTools → Application → Service Workers)

**✅ Real-time Tests:**
- [  ] Open app in two browser windows/tabs
- [  ] Make a change in one (e.g., create tournament)
- [  ] Verify change appears in other window in real-time

**✅ Security Tests:**
- [  ] Sign up as regular user (new email)
- [  ] Try to access `/tournaments/create` - should be blocked
- [  ] Regular user can self-register for tournaments (if enabled)
- [  ] Regular user CANNOT create tournaments

#### Step 6: Check Logs
```bash
# View function logs
firebase functions:log --limit 20

# View real-time logs
firebase functions:log --follow
```

Look for:
- ✅ No error messages
- ✅ Function invocations completing successfully
- ✅ Reasonable execution times (<2 seconds)

---

### Phase 4: Monitoring Setup (Recommended)

#### Step 1: Set Up Usage Alerts
1. Firebase Console → Usage and billing
2. Set up budget alerts (if not done):
   - Google Cloud Console → Billing → Budgets & alerts
   - Budget: $10/month
   - Alerts: 50%, 80%, 100%, 120%
   - Email notification: your-email@domain.com

#### Step 2: Enable Performance Monitoring
1. Firebase Console → Performance
2. Click "Enable" if not already enabled
3. Metrics to monitor:
   - Page load time
   - Time to Interactive
   - Network requests
   - Function execution times

#### Step 3: Set Up Function Alerts
1. Firebase Console → Functions → Logs
2. Click "Create alert" for:
   - Error rate > 5%
   - Execution time > 10 seconds
   - Function failures

---

## 🎉 Deployment Complete!

If all tests passed, your CourtMastr v2 tournament management system is now live in production!

### Your Deployment URLs:
- **Web App**: `https://your-project-id.web.app`
- **Alternative**: `https://your-project-id.firebaseapp.com`
- **Health Check**: `https://us-central1-your-project-id.cloudfunctions.net/healthCheck`

---

## 📊 Usage Monitoring

### Weekly Checklist:
- [  ] Check Firebase Console → Usage and billing
- [  ] Review Firestore read/write counts
- [  ] Review function invocation counts
- [  ] Check for any error spikes in logs
- [  ] Monitor costs (should be $0-2 for testing)

### Monthly Tasks:
- [  ] Review dependencies for updates: `npm outdated`
- [  ] Check Firebase Console for security alerts
- [  ] Backup important Firestore data
- [  ] Review and rotate admin passwords if needed

---

## 🔄 Future Deployments

After initial deployment, for code updates:

```bash
# 1. Make your code changes

# 2. Test locally with emulators
npm run emulators
# Test your changes thoroughly

# 3. Build for production
npx vite build

# 4. Deploy
npm run deploy

# 5. Verify deployment
# Check your app URL
# Check function logs
# Test core functionality
```

---

## 🐛 Troubleshooting

### Issue: "Permission denied" during deploy
**Solution**: Re-authenticate
```bash
firebase login --reauth
```

### Issue: "Billing required" error
**Solution**: Upgrade to Blaze plan (see Phase 1, Step 2c)

### Issue: Functions won't deploy
**Check**:
1. Node.js version: `node -v` (should be 18 or 20)
2. Functions build: `cd functions && npm run build && cd ..`
3. Check functions logs: `firebase functions:log`

### Issue: Build fails
**Solution**: Clean and rebuild
```bash
rm -rf node_modules dist
npm install
npx vite build
```

### Issue: PWA won't install
**Check**:
1. All required icons exist in `public/` folder
2. Icons are correct sizes
3. App is served over HTTPS (Firebase Hosting does this automatically)
4. Check browser console for service worker errors

### Issue: Firestore security rules blocking requests
**Check**:
1. User document has correct `role` field
2. Role is "admin", "scorekeeper", or regular user as expected
3. Review rules in Firebase Console → Firestore → Rules
4. Check browser console for specific permission errors

### Issue: Real-time updates not working
**Check**:
1. Browser console for WebSocket errors
2. Firestore indexes are built (Firebase Console → Firestore → Indexes)
3. Network tab shows active connections

---

## 📚 Additional Resources

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firestore Security Rules**: https://firebase.google.com/docs/firestore/security/get-started
- **Cloud Functions**: https://firebase.google.com/docs/functions
- **Firebase Hosting**: https://firebase.google.com/docs/hosting
- **Deployment Options**: [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md)
- **Full Deployment Plan**: `/Users/ramc/.claude/plans/parsed-growing-teacup.md`

---

## 🆘 Need Help?

- Firebase Status: https://status.firebase.google.com/
- Firebase Support: https://firebase.google.com/support
- Deployment Plan: Review the comprehensive plan at `/Users/ramc/.claude/plans/parsed-growing-teacup.md`

---

**Last Updated**: 2026-01-25
**Version**: 1.0.0
**Build Status**: ✅ Production Ready
