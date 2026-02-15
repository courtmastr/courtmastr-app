# Debug Knowledge Base System Implementation

## TL;DR

> **Quick Summary**: Implement a comprehensive Debug Knowledge Base system that captures command failures, generates fingerprints, and builds a searchable knowledge base of solutions for the courtmaster-v2 repository.
> 
> **Deliverables**:
> - AGENTS.md with Debug KB Protocol at repo root
> - Complete docs/debug-kb/ directory structure with templates
> - scripts/run-and-log.mjs for command output capture and fingerprinting
> - package.json :log script variants for all major commands
> - Working verification via npm -v through run-and-log
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request
User needs a comprehensive "Debug Knowledge Base" system with:
1. AGENTS.md protocol document
2. Structured docs/debug-kb/ directory with templates and artifacts
3. run-and-log.mjs script for capturing output and fingerprinting failures
4. package.json :log variants for dev, build, test, lint, and Firebase commands
5. Verification by running npm -v through the system

### Repository Analysis
**Findings**:
- Vue 3 + TypeScript + Firebase project
- Existing scripts: dev, build, test, lint, emulators, deploy variants
- firebase.json EXISTS (Firebase scripts needed)
- docs/ directory EXISTS
- scripts/ directory EXISTS with TypeScript files (*.ts pattern)
- No AGENTS.md exists yet
- No test infrastructure detected (manual verification approach)

### Gap Analysis (Self-Review)

**Auto-Resolved**:
- File path structure → Explicit paths provided in requirements
- Script naming → :log suffix pattern clear from requirements
- Fingerprint format → 8-character hex specified

**Defaults Applied**:
- Hash algorithm: Using SHA-256 truncated to 8 hex chars (standard for fingerprinting)
- Log file naming: `<timestamp>.<cmd>.log` pattern from requirements
- Timestamp format: ISO 8601 (YYYY-MM-DDTHH-mm-ss) for filesystem safety
- AGENTS.md location: Root directory as specified
- Output normalization: Strip ANSI codes, normalize paths (standard practice)

**Decisions Needed**: *(None - all requirements clear)*

---

## Work Objectives

### Core Objective
Create a Debug Knowledge Base infrastructure that automatically captures command failures, generates searchable fingerprints, and maintains a structured knowledge base of solutions.

### Concrete Deliverables
- `/AGENTS.md` - Protocol documentation
- `/docs/debug-kb/` - Directory structure
- `/docs/debug-kb/_artifacts/` - Log storage directory
- `/docs/debug-kb/TEMPLATE.md` - KB entry template
- `/docs/debug-kb/index.yml` - KB index file
- `/docs/debug-kb/README.md` - Usage documentation
- `/scripts/run-and-log.mjs` - Command wrapper with logging
- Updated `/package.json` - With :log script variants

### Definition of Done
- [ ] All files created and in correct locations
- [ ] AGENTS.md contains complete Debug KB Protocol
- [ ] run-and-log.mjs successfully captures output
- [ ] Fingerprint generation working (8 hex chars)
- [ ] package.json has all :log variants (dev, build, test, lint, firebase emulators/deploy)
- [ ] Verification: `node scripts/run-and-log.mjs npm -v` produces log file and shows fingerprint on "failure" simulation
- [ ] All templates are complete (no placeholder content)

### Must Have
- Working fingerprint generation from normalized output
- Tee functionality (output to both console AND log file)
- Timestamp-based log filenames
- All template files with complete, usable content
- Protocol that integrates into agent workflows

### Must NOT Have (Guardrails)
- No placeholder/TODO content in templates (must be complete)
- No test infrastructure setup (manual verification only)
- No automatic KB entry creation (protocol describes manual process)
- No git hooks or automatic enforcement (protocol is guidance)
- No external dependencies beyond Node.js built-ins (crypto, fs, child_process, path)
- No modification of existing scripts (only add new :log variants)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual-only
- **Framework**: none
- **QA approach**: Manual verification with specific commands

### Manual Verification (Agent-Executable)

Each task includes EXECUTABLE verification procedures:

**For File Creation Tasks** (using Bash):
```bash
# Agent verifies file exists
test -f /path/to/file && echo "EXISTS" || echo "MISSING"

# Agent verifies directory structure
ls -la docs/debug-kb/
# Assert: Shows _artifacts/, TEMPLATE.md, index.yml, README.md
```

**For Script Functionality** (using Bash):
```bash
# Agent runs run-and-log with successful command
node scripts/run-and-log.mjs npm -v
# Assert: Output shows npm version on console
# Assert: No "Fingerprint:" message (exit code 0)

# Agent simulates failure (non-existent command)
node scripts/run-and-log.mjs nonexistent-command 2>&1 || true
# Assert: Output contains "Fingerprint: [8 hex chars]"
# Assert: Output contains log file path
# Assert: Log file exists in docs/debug-kb/_artifacts/
```

**For package.json Scripts** (using Bash):
```bash
# Agent verifies scripts exist
cat package.json | grep -E '"(dev:log|build:log|test:log|lint:log|emulators:log|deploy:log)":'
# Assert: All 6 scripts present
```

**Evidence to Capture:**
- [ ] Directory listing of docs/debug-kb/ showing all files
- [ ] Output from `node scripts/run-and-log.mjs npm -v` showing version
- [ ] Output from simulated failure showing Fingerprint
- [ ] Contents of generated log file
- [ ] package.json excerpt showing :log scripts

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - Independent File Creation):
├── Task 1: Create directory structure (docs/debug-kb/)
├── Task 2: Create TEMPLATE.md
└── Task 3: Create index.yml

Wave 2 (After Wave 1 - Depends on directory structure):
├── Task 4: Create README.md (needs to reference structure)
└── Task 5: Create AGENTS.md (needs to reference structure/templates)

Wave 3 (After Wave 1 - Needs directory for log output):
└── Task 6: Create run-and-log.mjs (needs _artifacts/ dir)

Wave 4 (After Task 6 - Needs run-and-log.mjs):
└── Task 7: Update package.json with :log scripts

Wave 5 (After All - Final Verification):
└── Task 8: End-to-end verification

Critical Path: Task 1 → Task 6 → Task 7 → Task 8
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4, 5, 6 | None (foundation) |
| 2 | 1 | None | 3 |
| 3 | 1 | None | 2 |
| 4 | 1 | None | 5 |
| 5 | 1 | None | 4 |
| 6 | 1 | 7 | 2, 3, 4, 5 |
| 7 | 6 | 8 | None |
| 8 | 1, 2, 3, 4, 5, 6, 7 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2, 3 | quick (simple file creation) |
| 2 | 4, 5 | writing (documentation) |
| 3 | 6 | unspecified-low (script logic) |
| 4 | 7 | quick (JSON editing) |
| 5 | 8 | quick (verification commands) |

---

## TODOs

### Task 1: Create Debug KB Directory Structure

**What to do**:
- Create `docs/debug-kb/` directory
- Create `docs/debug-kb/_artifacts/` subdirectory (for log files)
- Verify directories exist with correct permissions

**Must NOT do**:
- Create placeholder files (wait for subsequent tasks)
- Add .gitignore entries (allow artifacts to be tracked if needed)

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Simple directory creation, trivial task
- **Skills**: None needed
  - Reason: Basic filesystem operation

**Skills Evaluated but Omitted**:
- All skills: Domain doesn't overlap (no specialized knowledge needed)

**Parallelization**:
- **Can Run In Parallel**: NO (foundation task)
- **Parallel Group**: Wave 1 (solo - others wait for completion)
- **Blocks**: Tasks 2, 3, 4, 5, 6 (all need directory structure)
- **Blocked By**: None (can start immediately)

**References**:

**Pattern References**: None (new structure)

**Documentation References**:
- User requirements: docs/debug-kb/ with _artifacts/ subdirectory

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies directory structure
ls -la docs/debug-kb/
# Assert: Output shows "." ".." "_artifacts"

test -d docs/debug-kb/ && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

test -d docs/debug-kb/_artifacts/ && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

# Verify write permissions
touch docs/debug-kb/_artifacts/test.log && rm docs/debug-kb/_artifacts/test.log && echo "WRITABLE" || echo "NOT_WRITABLE"
# Assert: Output is "WRITABLE"
```

**Evidence to Capture**:
- [ ] Terminal output from `ls -la docs/debug-kb/` showing _artifacts/

**Commit**: YES
- Message: `feat: add debug knowledge base directory structure`
- Files: `docs/debug-kb/`, `docs/debug-kb/_artifacts/`
- Pre-commit: None needed

---

### Task 2: Create TEMPLATE.md for KB Entries

**What to do**:
- Create `docs/debug-kb/TEMPLATE.md` with complete KB entry template
- Include sections: Signature, Context, Attempts, Fix (final), Tags
- Add inline documentation explaining each section
- Provide example content (not placeholders)

**Must NOT do**:
- Use TODO or placeholder markers
- Leave sections empty without explanation
- Create overly complex structure (keep it simple)

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: Documentation task requiring clear structure and examples
- **Skills**: None needed
  - Reason: Standard markdown documentation

**Skills Evaluated but Omitted**:
- `frontend-ui-ux`: Not UI work
- `git-master`: Not git-related
- All others: No domain overlap

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 3)
- **Blocks**: None
- **Blocked By**: Task 1 (needs directory)

**References**:

**Pattern References**:
- User requirements specify: "TEMPLATE.md with: Signature, Context, Attempts, Fix(final), Tags"

**External References**:
- KB entry best practices: Clear problem signatures, reproduction steps, root cause analysis

**WHY Each Reference Matters**:
- User requirements define exact section structure needed
- KB best practices ensure entries are searchable and actionable

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies file exists
test -f docs/debug-kb/TEMPLATE.md && echo "EXISTS" || echo "MISSING"
# Assert: Output is "EXISTS"

# Agent checks for required sections
grep -q "## Signature" docs/debug-kb/TEMPLATE.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "## Context" docs/debug-kb/TEMPLATE.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "## Attempts" docs/debug-kb/TEMPLATE.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "## Fix" docs/debug-kb/TEMPLATE.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "## Tags" docs/debug-kb/TEMPLATE.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

# Verify no placeholder content
! grep -i "TODO\|PLACEHOLDER\|XXX\|FIXME" docs/debug-kb/TEMPLATE.md && echo "NO_PLACEHOLDERS" || echo "HAS_PLACEHOLDERS"
# Assert: Output is "NO_PLACEHOLDERS"
```

**Evidence to Capture**:
- [ ] File contents showing all required sections
- [ ] Verification that no placeholders exist

**Commit**: YES
- Message: `feat: add debug KB entry template`
- Files: `docs/debug-kb/TEMPLATE.md`
- Pre-commit: None needed

---

### Task 3: Create index.yml Starter File

**What to do**:
- Create `docs/debug-kb/index.yml` with initial structure
- Include example entries showing the schema
- Add comments explaining fields (fingerprint, title, file, tags, date)
- Use YAML format with proper indentation

**Must NOT do**:
- Leave empty (must have example entries)
- Use invalid YAML syntax
- Over-complicate the schema

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Simple YAML file creation with examples
- **Skills**: None needed
  - Reason: Standard YAML structure

**Skills Evaluated but Omitted**:
- All skills: No specialized domain knowledge needed

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 2)
- **Blocks**: None
- **Blocked By**: Task 1 (needs directory)

**References**:

**Pattern References**: None (new file)

**External References**:
- YAML best practices: Clear indentation, comments for documentation

**WHY Each Reference Matters**:
- Example entries serve as template for future KB entries
- Comments make the schema self-documenting

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies file exists
test -f docs/debug-kb/index.yml && echo "EXISTS" || echo "MISSING"
# Assert: Output is "EXISTS"

# Agent validates YAML syntax (using Node.js)
node -e "const fs = require('fs'); const yaml = require('yaml'); try { yaml.parse(fs.readFileSync('docs/debug-kb/index.yml', 'utf8')); console.log('VALID'); } catch(e) { console.log('INVALID'); }"
# Assert: Output is "VALID" (or skip if yaml package not available)

# Agent checks for key fields in example entries
grep -q "fingerprint:" docs/debug-kb/index.yml && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "title:" docs/debug-kb/index.yml && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "tags:" docs/debug-kb/index.yml && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

# Verify has example entries (not empty)
wc -l docs/debug-kb/index.yml | awk '{print $1}'
# Assert: Line count > 10 (has content, not just comments)
```

**Evidence to Capture**:
- [ ] File contents showing example entries
- [ ] YAML validation result

**Commit**: YES
- Message: `feat: add debug KB index file`
- Files: `docs/debug-kb/index.yml`
- Pre-commit: None needed

---

### Task 4: Create README.md for Debug KB

**What to do**:
- Create `docs/debug-kb/README.md` explaining the Debug KB system
- Document the workflow: run :log script → capture fingerprint → search KB → create entry
- Explain directory structure and file purposes
- Provide usage examples
- Link to TEMPLATE.md and index.yml

**Must NOT do**:
- Duplicate AGENTS.md content (focus on user-facing docs)
- Use placeholder content
- Omit concrete examples

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: Documentation requiring clear explanation and examples
- **Skills**: None needed
  - Reason: Standard markdown documentation

**Skills Evaluated but Omitted**:
- All skills: No specialized domain needed

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Task 5)
- **Blocks**: None
- **Blocked By**: Task 1 (needs directory structure to reference)

**References**:

**Pattern References**:
- `docs/PRD.md` and `docs/TDD.md` - Existing documentation style in repo

**Documentation References**:
- User requirements: Usage explanation, workflow documentation

**WHY Each Reference Matters**:
- Existing docs show the documentation style for this repo
- Users need clear workflow explanation to adopt the system

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies file exists
test -f docs/debug-kb/README.md && echo "EXISTS" || echo "MISSING"
# Assert: Output is "EXISTS"

# Agent checks for key sections
grep -q -i "workflow\|usage" docs/debug-kb/README.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q "TEMPLATE.md" docs/debug-kb/README.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS" (references template)

grep -q "index.yml" docs/debug-kb/README.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS" (references index)

# Verify no placeholder content
! grep -i "TODO\|PLACEHOLDER\|XXX\|FIXME" docs/debug-kb/README.md && echo "NO_PLACEHOLDERS" || echo "HAS_PLACEHOLDERS"
# Assert: Output is "NO_PLACEHOLDERS"

# Verify has substantial content
wc -l docs/debug-kb/README.md | awk '{print $1}'
# Assert: Line count > 30 (comprehensive documentation)
```

**Evidence to Capture**:
- [ ] File contents showing workflow explanation
- [ ] Verification of references to TEMPLATE.md and index.yml

**Commit**: YES
- Message: `docs: add debug KB usage documentation`
- Files: `docs/debug-kb/README.md`
- Pre-commit: None needed

---

### Task 5: Create AGENTS.md with Debug KB Protocol

**What to do**:
- Create `AGENTS.md` at repository root
- Document the Debug KB Protocol for AI agents
- Include clear rules: prefer :log scripts, use fingerprints, search KB before creating entries
- Specify when to update KB (on success after fixing)
- Format as agent-actionable instructions

**Must NOT do**:
- Create overly verbose content (be concise)
- Duplicate README.md content (focus on agent behavior)
- Use placeholder content

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: Protocol documentation for AI agents
- **Skills**: None needed
  - Reason: Standard markdown documentation

**Skills Evaluated but Omitted**:
- All skills: No specialized domain overlap

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Task 4)
- **Blocks**: None
- **Blocked By**: Task 1 (needs directory structure to reference)

**References**:

**Pattern References**: None (new protocol document)

**Documentation References**:
- User requirements: "Debug KB Protocol" with specific rules
  - Always prefer :log scripts to capture output
  - On failure: use Fingerprint → search KB → try Fix → create entry if not found
  - On success: fill Root cause, Fix, Verification, update index.yml
  - Never skip KB updates

**WHY Each Reference Matters**:
- User requirements define the exact protocol behavior needed
- Agents need clear, actionable instructions for KB workflow

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies file exists
test -f AGENTS.md && echo "EXISTS" || echo "MISSING"
# Assert: Output is "EXISTS"

# Agent checks for protocol content
grep -q -i "debug.*kb.*protocol\|knowledge.*base.*protocol" AGENTS.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

# Agent verifies key protocol elements
grep -q ":log" AGENTS.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS" (mentions :log scripts)

grep -q -i "fingerprint" AGENTS.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS" (mentions fingerprinting)

grep -q -i "search.*kb\|kb.*search" AGENTS.md && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS" (mentions KB search)

# Verify no placeholder content
! grep -i "TODO\|PLACEHOLDER\|XXX\|FIXME" AGENTS.md && echo "NO_PLACEHOLDERS" || echo "HAS_PLACEHOLDERS"
# Assert: Output is "NO_PLACEHOLDERS"

# Verify has substantial content
wc -l AGENTS.md | awk '{print $1}'
# Assert: Line count > 20 (comprehensive protocol)
```

**Evidence to Capture**:
- [ ] File contents showing Debug KB Protocol
- [ ] Verification of key protocol elements (:log, fingerprint, search)

**Commit**: YES
- Message: `docs: add AGENTS.md with Debug KB protocol`
- Files: `AGENTS.md`
- Pre-commit: None needed

---

### Task 6: Create run-and-log.mjs Script

**What to do**:
- Create `scripts/run-and-log.mjs` that:
  - Takes command and args from process.argv
  - Spawns command with child_process
  - Tees stdout/stderr to console AND log file simultaneously
  - Generates timestamp-based log filename: `docs/debug-kb/_artifacts/<timestamp>.<cmd>.log`
  - On non-zero exit: normalizes output (strip ANSI, normalize paths), generates SHA-256 fingerprint (truncate to 8 hex), prints "Fingerprint: <8hex>", shows log path
  - Uses only Node.js built-ins (no external dependencies)
- Use ES modules (.mjs extension)
- Handle edge cases (command not found, no args, etc.)

**Must NOT do**:
- Add external dependencies (use only built-ins: crypto, fs, child_process, path)
- Over-engineer (keep it simple and focused)
- Skip error handling for edge cases

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
  - Reason: Moderate complexity script with stream handling and hashing
- **Skills**: None needed
  - Reason: Standard Node.js scripting, no specialized domain

**Skills Evaluated but Omitted**:
- `typescript-programmer`: Using .mjs, not TypeScript (existing scripts/*.ts don't matter)
- `python-programmer`: Node.js task
- All others: No domain overlap

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3 (with Tasks 2, 3, 4, 5 - after directory exists)
- **Blocks**: Task 7 (package.json needs working script)
- **Blocked By**: Task 1 (needs _artifacts/ directory)

**References**:

**Pattern References**:
- `scripts/*.ts` - Existing script patterns in repo (though this is .mjs)

**API/Type References**:
- Node.js child_process.spawn: For command execution
- Node.js crypto.createHash: For SHA-256 fingerprinting
- Node.js fs.createWriteStream: For log file writing
- Node.js stream: For teeing output

**External References**:
- Node.js docs: https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
- Node.js docs: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options

**WHY Each Reference Matters**:
- child_process.spawn enables command execution with stream access
- crypto.createHash provides fingerprint generation
- Stream handling enables tee functionality (console + file simultaneously)

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies file exists
test -f scripts/run-and-log.mjs && echo "EXISTS" || echo "MISSING"
# Assert: Output is "EXISTS"

# Agent verifies ES module syntax
head -n 5 scripts/run-and-log.mjs | grep -q "import\|export" && echo "ES_MODULE" || echo "NOT_ES_MODULE"
# Assert: Output is "ES_MODULE"

# Agent runs with successful command
node scripts/run-and-log.mjs npm -v
# Assert: Output shows npm version number
# Assert: Exit code 0
# Assert: No "Fingerprint:" in output

# Agent runs with failing command
node scripts/run-and-log.mjs nonexistent-command-12345 2>&1 || true
# Assert: Output contains "Fingerprint: " followed by 8 hex chars
# Assert: Output contains "docs/debug-kb/_artifacts/"

# Agent verifies log file was created
ls -lt docs/debug-kb/_artifacts/ | head -n 2
# Assert: Shows recent .log file

# Agent checks log file contains output
LATEST_LOG=$(ls -t docs/debug-kb/_artifacts/*.log | head -n 1)
test -s "$LATEST_LOG" && echo "LOG_HAS_CONTENT" || echo "LOG_EMPTY"
# Assert: Output is "LOG_HAS_CONTENT"

# Agent verifies fingerprint is exactly 8 hex chars
node scripts/run-and-log.mjs false 2>&1 | grep -oE "Fingerprint: [0-9a-f]{8}" && echo "VALID_FINGERPRINT" || echo "INVALID_FINGERPRINT"
# Assert: Output contains "VALID_FINGERPRINT"
```

**Evidence to Capture**:
- [ ] Output from successful command (npm -v) showing version
- [ ] Output from failed command showing Fingerprint
- [ ] Directory listing of _artifacts/ showing created log file
- [ ] Contents of log file showing captured output

**Commit**: YES
- Message: `feat: add run-and-log script for debug KB`
- Files: `scripts/run-and-log.mjs`
- Pre-commit: `node scripts/run-and-log.mjs npm -v` (verify it works)

---

### Task 7: Update package.json with :log Scripts

**What to do**:
- Add :log variants for existing scripts:
  - `dev:log` → `node scripts/run-and-log.mjs npm run dev`
  - `build:log` → `node scripts/run-and-log.mjs npm run build`
  - `test:log` → `node scripts/run-and-log.mjs npm run test`
  - `lint:log` → `node scripts/run-and-log.mjs npm run lint`
- Add Firebase-specific :log scripts (firebase.json exists):
  - `emulators:log` → `node scripts/run-and-log.mjs npm run emulators`
  - `deploy:log` → `node scripts/run-and-log.mjs npm run deploy`
- Maintain JSON formatting and structure

**Must NOT do**:
- Modify existing scripts (only add new ones)
- Break JSON syntax
- Add scripts for non-existent commands

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Simple JSON editing, adding new fields
- **Skills**: None needed
  - Reason: Basic package.json modification

**Skills Evaluated but Omitted**:
- All skills: No specialized domain needed

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4 (sequential after Task 6)
- **Blocks**: Task 8 (verification needs scripts)
- **Blocked By**: Task 6 (must have working run-and-log.mjs first)

**References**:

**Pattern References**:
- `package.json:scripts` - Existing script structure and naming patterns

**WHY Each Reference Matters**:
- Existing scripts show the command patterns to wrap with run-and-log
- Consistency with existing naming conventions

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# Agent verifies package.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('VALID_JSON')"
# Assert: Output is "VALID_JSON"

# Agent checks for all required :log scripts
grep -q '"dev:log":' package.json && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q '"build:log":' package.json && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q '"test:log":' package.json && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q '"lint:log":' package.json && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q '"emulators:log":' package.json && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

grep -q '"deploy:log":' package.json && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

# Agent verifies :log scripts reference run-and-log.mjs
cat package.json | grep ":log" | grep -q "run-and-log.mjs" && echo "PASS" || echo "FAIL"
# Assert: Output is "PASS"

# Agent counts :log scripts
cat package.json | grep -c ":log"
# Assert: Output is 6 (or higher)
```

**Evidence to Capture**:
- [ ] package.json excerpt showing all :log scripts
- [ ] JSON validation result

**Commit**: YES
- Message: `feat: add :log script variants for debug KB`
- Files: `package.json`
- Pre-commit: `node -e "JSON.parse(require('fs').readFileSync('package.json'))"`

---

### Task 8: End-to-End Verification

**What to do**:
- Run comprehensive verification of the entire Debug KB system
- Test npm -v through run-and-log (as specified in requirements)
- Verify all files exist and have content
- Test fingerprint generation with intentional failure
- Verify :log scripts are callable
- Document verification results

**Must NOT do**:
- Skip any verification steps
- Assume previous tasks worked without checking

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Running verification commands and checking results
- **Skills**: None needed
  - Reason: Basic command execution and verification

**Skills Evaluated but Omitted**:
- All skills: No specialized domain needed

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 5 (final verification, sequential)
- **Blocks**: None (final task)
- **Blocked By**: All previous tasks (1-7)

**References**:

**Pattern References**: None (verification task)

**Documentation References**:
- User requirements: "Verification by running npm -v through run-and-log"

**WHY Each Reference Matters**:
- User explicitly requested npm -v verification
- End-to-end test ensures system works as designed

**Acceptance Criteria**:

**Automated Verification** (using Bash):
```bash
# COMPREHENSIVE VERIFICATION SUITE

echo "=== 1. Directory Structure ==="
test -d docs/debug-kb/ && echo "✓ docs/debug-kb/" || echo "✗ docs/debug-kb/"
test -d docs/debug-kb/_artifacts/ && echo "✓ _artifacts/" || echo "✗ _artifacts/"

echo "=== 2. Template Files ==="
test -f docs/debug-kb/TEMPLATE.md && echo "✓ TEMPLATE.md" || echo "✗ TEMPLATE.md"
test -f docs/debug-kb/index.yml && echo "✓ index.yml" || echo "✗ index.yml"
test -f docs/debug-kb/README.md && echo "✓ README.md" || echo "✗ README.md"

echo "=== 3. Protocol Documentation ==="
test -f AGENTS.md && echo "✓ AGENTS.md" || echo "✗ AGENTS.md"

echo "=== 4. Scripts ==="
test -f scripts/run-and-log.mjs && echo "✓ run-and-log.mjs" || echo "✗ run-and-log.mjs"

echo "=== 5. Functional Test: npm -v (success case) ==="
node scripts/run-and-log.mjs npm -v
# Assert: Shows npm version number
# Assert: No "Fingerprint:" in output

echo "=== 6. Functional Test: Failure case ==="
node scripts/run-and-log.mjs false 2>&1 || true
# Assert: Output contains "Fingerprint: [8 hex chars]"
# Assert: Output contains log file path

echo "=== 7. Log File Verification ==="
ls -lh docs/debug-kb/_artifacts/*.log | tail -n 2
# Assert: Shows recent log files with size > 0

echo "=== 8. Package.json Scripts ==="
npm run | grep ":log" | wc -l
# Assert: Count >= 6

echo "=== 9. Sample :log Script Test ==="
npm run dev:log --dry-run 2>&1 || echo "Script registered"
# Assert: Script exists (may fail due to --dry-run, but should be found)

echo "=== VERIFICATION COMPLETE ==="
```

**Evidence to Capture**:
- [ ] Complete verification suite output
- [ ] npm -v output through run-and-log
- [ ] Fingerprint from intentional failure
- [ ] List of created log files

**Commit**: YES
- Message: `chore: verify debug KB system end-to-end`
- Files: None (verification only)
- Pre-commit: None

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat: add debug knowledge base directory structure` | docs/debug-kb/, docs/debug-kb/_artifacts/ | `test -d docs/debug-kb/_artifacts/` |
| 2 | `feat: add debug KB entry template` | docs/debug-kb/TEMPLATE.md | `grep -q "## Signature" docs/debug-kb/TEMPLATE.md` |
| 3 | `feat: add debug KB index file` | docs/debug-kb/index.yml | `test -f docs/debug-kb/index.yml` |
| 4 | `docs: add debug KB usage documentation` | docs/debug-kb/README.md | `grep -q "workflow" docs/debug-kb/README.md` |
| 5 | `docs: add AGENTS.md with Debug KB protocol` | AGENTS.md | `grep -q "Debug.*KB" AGENTS.md` |
| 6 | `feat: add run-and-log script for debug KB` | scripts/run-and-log.mjs | `node scripts/run-and-log.mjs npm -v` |
| 7 | `feat: add :log script variants for debug KB` | package.json | `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` |
| 8 | `chore: verify debug KB system end-to-end` | None | Full verification suite |

---

## Success Criteria

### Verification Commands
```bash
# All files exist
test -f AGENTS.md && \
test -f docs/debug-kb/TEMPLATE.md && \
test -f docs/debug-kb/index.yml && \
test -f docs/debug-kb/README.md && \
test -f scripts/run-and-log.mjs && \
echo "ALL FILES EXIST"

# run-and-log works
node scripts/run-and-log.mjs npm -v

# Fingerprinting works
node scripts/run-and-log.mjs false 2>&1 | grep -q "Fingerprint: [0-9a-f]\{8\}" && echo "FINGERPRINT OK"

# package.json has :log scripts
cat package.json | grep -c ":log"  # Should be >= 6
```

### Final Checklist
- [ ] All "Must Have" present (fingerprinting, tee, timestamps, templates, protocol)
- [ ] All "Must NOT Have" absent (no placeholders, no external deps, no modified scripts)
- [ ] All template files are complete and usable
- [ ] npm -v runs successfully through run-and-log
- [ ] Fingerprint generation confirmed working
- [ ] All 6+ :log scripts registered in package.json
- [ ] AGENTS.md contains complete Debug KB Protocol
