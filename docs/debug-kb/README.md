# Debug Knowledge Base Protocol

## Overview

This repository uses a **Debug Knowledge Base (KB)** system to track, document, and resolve issues systematically. Every failure is an opportunity to build institutional knowledge.

## Core Principle

> **"Never debug the same problem twice"**

## Protocol Rules

### 1. Always Use :log Scripts

When running any command that might fail, use the `:log` variant to capture output:

```bash
npm run dev:log        # instead of npm run dev
npm run build:log      # instead of npm run build
npm run test:log       # instead of npm run test
npm run firebase:deploy:log  # instead of firebase deploy
```

### 2. On Failure - Follow the Fingerprint

When a command fails, you'll see:
```
❌ Command failed with exit code 1
Fingerprint: a3f7b2d9
Log saved to: docs/debug-kb/_artifacts/20260131-120000.npm-run-build.log
```

**Steps:**

1. **Use the Fingerprint** (8-char hex ID)
2. **Search existing KB**:
   - Check `docs/debug-kb/<fingerprint>.md`
   - Check `docs/debug-kb/index.yml`
3. **If found**: Try the "Fix (final)" steps first
4. **If not found**: Create `docs/debug-kb/<fingerprint>.md` from TEMPLATE.md
5. **Document attempts**: Append one numbered "Attempt" per change tried
6. **Link artifacts**: Reference the generated log file

### 3. Creating New KB Entries

```bash
# Copy template
cp docs/debug-kb/TEMPLATE.md docs/debug-kb/a3f7b2d9.md

# Fill in:
# - id: a3f7b2d9 (from fingerprint)
# - title: Brief description
# - signature: Normalized error signature
# - context: What you were trying to do
# - Attempt 1: What you tried and the result
```

### 4. On Success - Complete the Entry

Once fixed, fill in:
- **Root cause**: Why it actually failed
- **Fix (final)**: Exact steps/commands that resolved it
- **Verification**: How you confirmed it's fixed
- **Status**: ✅ fixed
- Update `docs/debug-kb/index.yml` with the entry

### 5. Never Skip KB Updates

Even if you can't solve it:
- Log all attempts
- Mark as ❌ unresolved
- Leave it for future you or teammates

## File Structure

```
docs/debug-kb/
├── README.md              # This file
├── TEMPLATE.md            # Template for new entries
├── index.yml              # Searchable index of all issues
├── _artifacts/            # Log files (gitignored)
│   ├── 20260131-120000.npm-run-build.log
│   └── ...
├── a3f7b2d9.md           # Individual KB entry
├── b8e1c4f2.md           # Another entry
└── ...
```

## KB Entry Template

Each KB entry follows this structure:

```markdown
---
id: a3f7b2d9
title: "Build fails with TypeScript errors"
signature: "error TS Cannot find module"
area: build
tags: [typescript, build, module-resolution]
status: ✅ fixed
artifact: 20260131-120000.npm-run-build.log
---

## Context
What I was trying to do...

## Attempt 1
Change: Ran npm install
Result: Same error

## Attempt 2
Change: Updated tsconfig.json paths
Result: Same error

## Root Cause
The actual reason...

## Fix (final)
Exact steps to fix...

## Verification
How I confirmed it's fixed...
```

## Quick Reference

### Search KB by fingerprint
```bash
ls docs/debug-kb/ | grep a3f7b2d9
```

### Search KB by error message
```bash
grep -r "Cannot find module" docs/debug-kb/*.md
```

### View recent artifacts
```bash
ls -lt docs/debug-kb/_artifacts/ | head -10
```

### Check index
```bash
cat docs/debug-kb/index.yml
```

## Agent Instructions

When working on this codebase:

1. **Before implementing**: Check KB for similar issues
2. **During debugging**: Use `:log` scripts, document attempts
3. **After fixing**: Update KB with solution
4. **Before committing**: Ensure KB is current

## Success Criteria

- [ ] All failures produce a fingerprint
- [ ] All fingerprints have KB entries
- [ ] KB entries have root cause documented
- [ ] KB entries have verified fixes
- [ ] Index is up to date

---

**Remember**: The KB is only useful if it's maintained. Take the extra 2 minutes to document your debugging journey.
