# Draft: Courtmaster Testing Strategy

## Requirements (confirmed)

### User's Goal
Create a comprehensive testing strategy for the Courtmaster badminton tournament management application

### Testing Scope
1. **Functional Testing** - Test all major user flows
2. **UI/UX Testing** - Check for visual issues, responsive design
3. **Data Integrity Testing** - Verify Firestore data consistency
4. **Error Handling** - Check console for errors during operations
5. **Edge Cases** - Test boundary conditions

### Output Format
- Detailed testing plan document
- Test categories (Critical, High, Medium, Low priority)
- Specific test cases for each feature
- Expected vs actual results format
- Evidence collection strategy (screenshots, console logs)

## Technical Decisions

### Testing Infrastructure
- **Current**: Vitest already configured with minimal unit tests
  - `tests/unit/bracket.test.ts` - Bracket generation logic tests
  - `tests/unit/scoring.test.ts` - Badminton scoring rules tests
- **Decision needed**: E2E testing framework (Playwright vs Cypress vs manual)

### Data Model (Post-Feb 2026 Migration)
- `/match` collection = Bracket structure (brackets-manager, READ ONLY)
- `/match_scores` collection = Operational data (scores, courts, status)
- `/matches` collection = REMOVED (legacy)
- Must verify both collections stay in sync

### Key Features to Test (from router analysis)
**Public Routes (no auth):**
- Home page
- Self-registration
- Public bracket view
- Public live scores
- Public scoring interface

**Admin Routes (requires auth + admin role):**
- Tournament creation
- Tournament settings
- Registration management
- Match control
- Bracket generation

**Scorekeeper Routes (requires auth + scorekeeper role):**
- Match list view
- Scoring interface

## Research Findings

### From Codebase
- **Stack**: Vue 3 + TypeScript + Vite + Vuetify 3 + Firebase
- **State Management**: Pinia stores
- **Auth**: Firebase Auth with role-based access (admin, scorekeeper)
- **Data**: Firestore with real-time subscriptions
- **PWA**: Installable progressive web app
- **Testing**: Vitest configured, minimal coverage

### From AGENTS.md
- Must use Firebase emulators for testing
- Must run `:log` commands for verification
- Debug KB protocol for documenting failures
- No direct writes to `/match` collection (only via brackets-manager API)

## Open Questions

### Testing Approach
1. **E2E Testing Framework**: Should we use Playwright for automated browser testing, or rely on manual test procedures?
   - Playwright: Automated, repeatable, catches regressions
   - Manual: Faster to create initially, requires human execution
   
2. **Test Environment**: 
   - Firebase emulators (local, isolated)
   - Test Firebase project (cloud, realistic)
   - Both?

3. **Coverage Goals**:
   - What percentage of features need automated tests vs manual tests?
   - Critical paths only, or comprehensive coverage?

4. **Test Data Strategy**:
   - Use existing seed scripts (`npm run seed:simple`, `npm run seed:tnf`)?
   - Create dedicated test fixtures?
   - Reset database between tests?

5. **Evidence Collection**:
   - Screenshots automatically via Playwright?
   - Manual screenshots documented in test report?
   - Console log capture strategy?

6. **Priority Levels**:
   - How do we define Critical vs High vs Medium vs Low?
   - Based on user impact? Revenue impact? Data integrity risk?

### Scope Boundaries
- **Include testing**:
  - All user flows mentioned in requirements
  - Data integrity between /match and /match_scores
  - Role-based access control
  - Real-time updates
  - Mobile responsiveness (PWA)

- **Exclude from testing** (clarify):
  - Performance/load testing?
  - Security penetration testing?
  - Cross-browser compatibility (which browsers)?
  - Offline PWA functionality?

### Execution Strategy
- **Who runs tests**: Developers? QA team? You personally?
- **When to run**: Before each deployment? Daily? Per feature?
- **How to report failures**: Debug KB? GitHub issues? Spreadsheet?

## Next Steps
- Wait for explore/librarian agent results
- Ask clarifying questions
- Refine test categories and priorities
- Structure comprehensive test plan
