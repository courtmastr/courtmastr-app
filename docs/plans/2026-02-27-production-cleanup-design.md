# Production-Grade Repository Cleanup Design

**Date:** 2026-02-27  
**Scope:** Transform CourtMastr v2 from development-mode repository to production-grade open-source project  
**Approach:** Option B - Standard Cleanup (4-6 hours)  
**Status:** Design Complete → Ready for Implementation

---

## Executive Summary

This repository has accumulated significant structural debt during rapid development. Critical security issues (exposed Firebase credentials), repository hygiene violations (committed env files, debug logs), and organizational clutter (19 markdown files at root level) prevent this from being production-grade.

This design provides a comprehensive cleanup plan that addresses security, compliance, and professional appearance without over-engineering.

---

## Current State Assessment

### Critical Issues Found

| Category | Severity | Issue | Impact |
|----------|----------|-------|--------|
| **Security** | 🔴 CRITICAL | `.env.production` with live Firebase API keys committed to git | Anyone can access production Firebase |
| **Compliance** | 🔴 CRITICAL | Missing LICENSE file (claims MIT in README but no file) | Legal ambiguity |
| **Git Hygiene** | 🔴 HIGH | `.env`, `.env.development`, `.env.production` committed despite .gitignore | Credential exposure |
| **Git Hygiene** | 🔴 HIGH | 20k+ lines of debug logs committed (firebase-debug.log, firestore-debug.log) | Repo bloat, noise |
| **Structure** | 🟡 HIGH | 19 markdown files at root (6,215 lines) | Unprofessional, hard to navigate |
| **Structure** | 🟡 HIGH | 6 development scripts at root level | Should be in `scripts/` |
| **Config** | 🟡 MEDIUM | Corrupted .gitignore line `#TJ|.cgcignore` | Syntax error |
| **Config** | 🟡 MEDIUM | Missing entries: `.worktrees/` (846MB), `.venv/` (236MB), `.axon/` (114MB) | Massive repo bloat |
| **Standards** | 🟡 MEDIUM | Missing: SECURITY.md, CHANGELOG.md, CODEOWNERS, .editorconfig | Not production-ready |
| **Firebase** | 🟡 MEDIUM | Overly permissive Firestore reads (`allow read: if true`) | Data exposure |

### Repository Statistics

- **Root-level markdown files:** 19
- **Root-level scripts:** 6
- **Root-level log files:** 5
- **Total lines at root:** 6,215 (documentation)
- **Committed tool directories:** 1.2GB+ (`.worktrees/`, `.venv/`, `.axon/`)
- **Security exposure:** Live Firebase credentials in git history

### What's Working Well

- ✅ CI/CD pipeline configured (`.github/workflows/ci-cd.yml`)
- ✅ Test suite (unit + e2e) with good coverage
- ✅ TypeScript strict mode enabled
- ✅ Well-organized `docs/` subdirectory structure exists
- ✅ `.opencode/` project intelligence (valuable for AI context)
- ✅ Proper Firebase emulator configuration

---

## Proposed Solution

### Option A: Minimal Fix (2-3 hours)
- Rotate exposed Firebase credentials
- Create LICENSE, SECURITY.md, CODEOWNERS
- Fix .gitignore and remove committed env files/logs
- Move obvious clutter (logs, test artifacts)

### Option B: Standard Cleanup (4-6 hours) ← **SELECTED**
- All of Option A, plus:
- Reorganize all 19 root markdown files into `docs/` structure
- Move 6 dev scripts to `scripts/` directory
- Add missing standard files (.editorconfig, CHANGELOG.md)
- Update package.json with proper metadata
- Basic Firebase security fixes (restrict reads, fix scorekeeper perms)

### Option C: Production-Grade Overhaul (1-2 days)
- All of Option B, plus:
- Comprehensive Firebase security audit and fixes
- Add security headers to firebase.json
- Implement rate limiting
- Complete documentation restructure with navigation
- Git history cleanup (remove credentials from history)
- Add automated security scanning to CI/CD

**Rationale for Option B:** Addresses all critical security issues and structural debt while avoiding over-engineering. Git history cleanup (Option C) can be done later if needed.

---

## Implementation Phases

### Phase 1: Security & Compliance (Critical - Do First)

**Priority:** P0 - Must complete before any other work  
**Estimated Time:** 30 minutes

#### 1.1 Rotate Exposed Firebase Credentials

**Action Required:**
1. Go to Firebase Console → Project Settings → General
2. Find Web API Key → Click "Rotate"
3. Update `.env.production` locally with new keys
4. Verify `.env.production` is in `.gitignore` (already done)

**Note:** Credentials are in git history. Full removal requires `git filter-branch` or BFG Repo-Cleaner, which is risky. For now, rotating keys is sufficient mitigation.

#### 1.2 Create Missing Standard Files

**LICENSE** (MIT):
```
MIT License

Copyright (c) 2026 RamC Venkatasamy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**SECURITY.md**:
```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing:

**ramc.venkatasamy@e14s.com**

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work to resolve the issue promptly.

## Security Best Practices

This application handles tournament data and user information. Please ensure:
- Firebase credentials are never committed to git
- Firestore security rules are tested before deployment
- User data is handled according to applicable privacy laws
```

**CODEOWNERS**:
```
# Global code owners
* @Ramc4685

# Documentation
/docs/ @Ramc4685

# Firebase configuration
*.rules @Ramc4685
firebase.json @Ramc4685

# CI/CD
/.github/ @Ramc4685
```

#### 1.3 Remove Committed Files from Git

**Commands:**
```bash
# Remove environment files
git rm --cached .env .env.development .env.production

# Remove debug logs
git rm --cached firebase-debug.log firestore-debug.log

# Remove test artifacts
git rm --cached automated-test-output.log full-test-run.log

# Remove system files
git rm --cached .DS_Store

# Commit
git commit -m "security: remove committed env files and logs from git"
```

---

### Phase 2: Repository Structure Cleanup

**Priority:** P1 - High priority  
**Estimated Time:** 2 hours

#### 2.1 Move Documentation Files

**Create directories:**
```bash
mkdir -p docs/architecture docs/deployment docs/testing docs/features docs/roadmap
```

**Move to `docs/architecture/`:**
- ARCHITECTURE.md
- ARCHITECTURE_ANALYSIS.md
- ARCHITECTURE_DECISION.md
- ARCHITECTURE_DECISION_COST_EFFECTIVE.md

**Move to `docs/deployment/`:**
- DEPLOYMENT_GUIDE.md
- DEPLOYMENT_OPTIONS.md
- QUICKSTART.md

**Move to `docs/testing/`:**
- TEST-WORKFLOW.md
- TESTING-SUMMARY.md
- VERIFICATION_REPORT.md
- FINAL-BUG-REPORT.md
- BUG-REPORTS.md

**Move to `docs/features/`:**
- BASEDIALOG_SUMMARY.md
- BASEDIALOG_USAGE.md
- BRACKET_INTEGRATION.md

**Move to `docs/roadmap/`:**
- NEXT_RELEASE_FEATURES.md

**Keep at root:**
- README.md (standard practice)
- AGENTS.md (AI-specific, keep visible)
- CLAUDE.md (AI-specific, consider moving to docs/)
- CONTRIBUTING.md (standard to keep at root)

#### 2.2 Move Development Scripts

**Ensure `scripts/` exists** (already does), then move:
- `automated-test.cjs` → `scripts/`
- `full-tournament-test.cjs` → `scripts/`
- `log-capture.mjs` → `scripts/`
- `start-dev.mjs` → `scripts/`
- `start-dev-terminal.sh` → `scripts/`
- `test-workflow.sh` → `scripts/`

**Verify if needed:**
- `main.py` - Check if used; if not, delete

**Update package.json scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "dev:log": "node scripts/run-and-log.mjs vite",
    "build": "vue-tsc -b && vite build",
    "build:log": "node scripts/run-and-log.mjs vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:log": "node scripts/run-and-log.mjs vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "ESLINT_USE_FLAT_CONFIG=false eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore",
    "lint:log": "ESLINT_USE_FLAT_CONFIG=false node scripts/run-and-log.mjs eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore",
    "type-check": "vue-tsc --noEmit",
    "emulators": "npm run build --prefix functions && firebase emulators:start --project demo-courtmaster",
    "emulators:log": "node scripts/run-and-log.mjs npm run build --prefix functions && firebase emulators:start --project demo-courtmaster",
    "emulators:capture": "node scripts/log-capture.mjs",
    "logs:view": "ls -t logs/ | head -10",
    "logs:tail": "tail -f logs/emulators-*.log 2>/dev/null || echo 'No log files found. Run emulators:capture first.'",
    "seed:local": "npx tsx scripts/seed/local.ts",
    "seed:prod": "npx tsx scripts/seed/production.ts",
    "seed:tnf2025:local": "npx tsx scripts/seed/tnf2025-local.ts",
    "seed:tnf2025:prod": "npx tsx scripts/seed/tnf2025-prod.ts",
    "seed:spring2025:local": "npx tsx scripts/seed/spring2025-local.ts",
    "seed:spring2025:prod": "npx tsx scripts/seed/spring2025-prod.ts",
    "start:dev": "node scripts/start-dev.mjs",
    "killall": "pkill -f 'firebase' 2>/dev/null; pkill -f 'vite' 2>/dev/null; pkill -f 'node.*emulator' 2>/dev/null || echo 'No processes found'",
    "deploy": "npm run build && firebase deploy",
    "deploy:log": "node scripts/run-and-log.mjs npm run build && firebase deploy",
    "deploy:hosting": "npm run build && firebase deploy --only hosting",
    "deploy:functions": "firebase deploy --only functions",
    "deploy:rules": "firebase deploy --only firestore:rules"
  }
}
```

#### 2.3 Handle Test Artifacts

**Move or delete:**
- `tournament-dashboard-overview.png` → `docs/assets/` OR delete if not needed
- `AUTOMATED-TEST-RESULTS.json` → `test-results/` OR delete

---

### Phase 3: Configuration Updates

**Priority:** P1 - High priority  
**Estimated Time:** 1 hour

#### 3.1 Fix .gitignore

**Remove corrupted line:**
- Delete: `#TJ|.cgcignore` (line 56)

**Add missing entries:**
```gitignore
# Development tool directories
.agent/
.agent-browser/
.axon/
.claude/
.playwright-mcp/
.sisyphus/
.tmp/
.venv/
.worktrees/

# Python artifacts
pyproject.toml
uv.lock
.python-version

# Additional logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Large artifacts
tournament-dashboard-overview.png
AUTOMATED-TEST-RESULTS.json
```

#### 3.2 Update package.json Metadata

**Add missing fields:**
```json
{
  "name": "courtmaster-v2",
  "private": true,
  "version": "1.0.0",
  "description": "Professional tournament management system for badminton tournaments",
  "author": "RamC Venkatasamy <ramc.venkatasamy@e14s.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Ramc4685/courtmaster-v2.git"
  },
  "bugs": {
    "url": "https://github.com/Ramc4685/courtmaster-v2/issues"
  },
  "homepage": "https://courtmaster-v2.web.app",
  "keywords": [
    "badminton",
    "tournament",
    "management",
    "vue",
    "firebase",
    "brackets"
  ],
  "type": "module"
}
```

#### 3.3 Create .editorconfig

```
# EditorConfig is awesome: https://EditorConfig.org

# top-most EditorConfig file
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2
```

#### 3.4 Create CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-27

### Added
- Production-grade repository cleanup
- Security policy and vulnerability reporting
- MIT license
- Code owners configuration
- EditorConfig for consistent formatting
- CHANGELOG for version tracking

### Security
- Rotated exposed Firebase credentials
- Removed committed environment files from git
- Removed committed debug logs from git

### Changed
- Reorganized documentation into structured directories
- Moved development scripts to scripts/ directory
- Updated .gitignore with comprehensive exclusions
- Updated package.json with proper metadata

## [Unreleased]

### Added
- Initial tournament management system
- Vue 3 + TypeScript + Firebase architecture
- Bracket generation with brackets-manager
- Real-time scoring interface
- PWA support with offline capabilities
- CI/CD pipeline with GitHub Actions
```

---

### Phase 4: Firebase Security Hardening

**Priority:** P2 - Medium priority  
**Estimated Time:** 1 hour  
**Risk:** Test thoroughly in emulator before deploying

#### 4.1 Basic Firestore Rules Fixes

**Restrict public reads on sensitive collections:**

Current (too open):
```
match /tournaments/{tournamentId} {
  allow read: if true;
  allow create: if isAdmin();
  allow update, delete: if isAdmin() || isOrganizerOf(tournamentId);
}
```

Better:
```
match /tournaments/{tournamentId} {
  allow read: if isAuthenticated();
  allow create: if isAdmin();
  allow update, delete: if isAdmin() || isOrganizerOf(tournamentId);
}
```

**Apply to:** tournaments, categories, courts, players, registrations, activities

**Keep public for:** public brackets, public schedules (if intentionally public)

#### 4.2 Fix Scorekeeper Permissions

**Issue:** Scorekeepers can write to `/match` (brackets-manager data)

**Fix:** Remove `isScorekeeper()` from `/match` write rules:

```
// /tournaments/{tournamentId}/categories/{categoryId}/match/{matchId}
match /match/{matchId} {
  allow read: if true;
  // Only admins and organizers can modify bracket structure
  allow write: if isAdmin() || isOrganizerOf(tournamentId);
}

// /tournaments/{tournamentId}/categories/{categoryId}/match_scores/{matchId}
match /match_scores/{matchId} {
  allow read: if true;
  // Scorekeepers can update scores
  allow write: if isAdmin() || isOrganizerOf(tournamentId) || isScorekeeper();
}
```

#### 4.3 Restrict Activities Feed

**Current:** Any authenticated user can create activity entries

**Better:** Only Cloud Functions via admin SDK:

```
match /tournaments/{tournamentId}/activities/{activityId} {
  allow read: if isAuthenticated();
  // Only Cloud Functions should create activities
  allow create: if false;
  allow update, delete: if false;
}
```

#### 4.4 Add Security Headers to firebase.json

**Add to firebase.json hosting configuration:**

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net;"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

---

## Testing Strategy

### Pre-Implementation Verification

Before making changes:
1. Run full test suite: `npm run test -- --run`
2. Verify build: `npm run build`
3. Run lint: `npm run lint`
4. Test emulators: `npm run emulators` (smoke test)

### Post-Implementation Verification

After each phase:
1. **Phase 1:** Verify no env files in `git ls-files | grep -E '^\.env'`
2. **Phase 2:** Verify scripts work from new locations
3. **Phase 3:** Verify .gitignore properly excludes tool directories
4. **Phase 4:** Test Firestore rules in emulator before deploying

### Acceptance Criteria

- [ ] No credentials exposed in repository
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Root directory contains only essential files
- [ ] Documentation is organized and navigable
- [ ] Firebase rules deploy successfully
- [ ] CI/CD pipeline passes

---

## Rollback Plan

If issues arise:

1. **Git-based rollback:**
   ```bash
   git reset --hard HEAD~1  # Undo last commit
   ```

2. **Firebase rules rollback:**
   ```bash
   firebase deploy --only firestore:rules --project production
   # Deploy previous rules version from backup
   ```

3. **Emergency restore:**
   - Keep copy of original files before moving
   - Use `git checkout HEAD~1 -- <file>` to restore specific files

---

## Success Metrics

After completion, this repository will have:

### Security
- ✅ No exposed credentials in git
- ✅ Environment files properly ignored
- ✅ Debug logs not committed
- ✅ Basic Firebase security hardening

### Structure
- ✅ ≤10 files at root level (excluding dotfiles)
- ✅ All documentation organized in `docs/`
- ✅ All scripts in `scripts/`
- ✅ No committed tool directories

### Compliance
- ✅ MIT license file present
- ✅ Security policy documented
- ✅ Code owners defined
- ✅ Changelog maintained

### Professionalism
- ✅ Complete package.json metadata
- ✅ EditorConfig for consistency
- ✅ Clean .gitignore
- ✅ CI/CD pipeline passing

---

## Next Steps

1. **Review this design** with stakeholders
2. **Create implementation plan** using `/writing-plans` skill
3. **Execute cleanup** following phased approach
4. **Verify** all acceptance criteria met
5. **Document** any lessons learned

---

## Appendix A: Root Directory Target State

After cleanup, root should contain:

```
courtmaster-v2/
├── .github/           # CI/CD workflows
├── .opencode/         # Project intelligence (AI context)
├── .vscode/           # Team editor settings
├── docs/              # All documentation
├── e2e/               # E2E tests
├── functions/         # Firebase Cloud Functions
├── logs/              # Log files (gitignored)
├── public/            # Static assets
├── scripts/           # Development scripts
├── src/               # Application source
├── tests/             # Unit tests
├── .editorconfig      # Editor configuration
├── .env.template      # Environment template
├── .eslintrc.cjs      # ESLint config
├── .firebaserc        # Firebase project aliases
├── .gitignore         # Git ignore rules
├── CHANGELOG.md       # Version history
├── CODEOWNERS         # Code ownership
├── CONTRIBUTING.md    # Contribution guidelines
├── firebase.json      # Firebase configuration
├── firestore.indexes.json  # Firestore indexes
├── firestore.rules    # Firestore security rules
├── index.html         # HTML entry point
├── LICENSE            # MIT license
├── package.json       # NPM manifest
├── package-lock.json  # NPM lockfile
├── playwright.config.ts   # Playwright config
├── README.md          # Project readme
├── SECURITY.md        # Security policy
├── storage.rules      # Storage security rules
├── tsconfig.app.json  # TypeScript config (app)
├── tsconfig.json      # TypeScript config (base)
├── tsconfig.node.json # TypeScript config (node)
├── vite.config.ts     # Vite config
└── vitest.config.ts   # Vitest config
```

**Total root files:** ~30 (down from 57+)

---

## Appendix B: Firebase Rules Testing

Before deploying rule changes, test in emulator:

```bash
# Start emulator
npm run emulators

# In another terminal, run rules tests
npm run test -- tests/integration/firebase-rules.test.ts
```

Test cases should cover:
- Unauthenticated reads denied on sensitive collections
- Authenticated reads allowed
- Scorekeeper writes to `/match` denied
- Scorekeeper writes to `/match_scores` allowed
- Activities creation from client denied
```

---

**Document Version:** 1.0  
**Author:** Sisyphus (AI Agent)  
**Review Status:** Pending User Approval
