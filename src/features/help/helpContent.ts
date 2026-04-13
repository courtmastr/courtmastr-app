import type { HelpRole, HelpRoleFilter, HelpTopic } from '@/features/help/helpTypes';

export const HELP_ROLE_FILTERS: HelpRoleFilter[] = [
  { value: 'organizer', label: 'Organizers', icon: 'mdi-account-tie' },
  { value: 'scorekeeper', label: 'Scorekeepers', icon: 'mdi-scoreboard' },
  { value: 'checkin', label: 'Check-in', icon: 'mdi-account-check' },
  { value: 'player', label: 'Players', icon: 'mdi-badminton' },
  { value: 'public', label: 'Public', icon: 'mdi-web' },
  { value: 'platform', label: 'Platform Admin', icon: 'mdi-shield-crown' },
];

const screenshot = (topic: string, title: string): { title: string; alt: string; src: string } => ({
  title,
  alt: `${title} screen in CourtMastr`,
  src: `/help/screenshots/${topic}/overview.png`,
});

const noScreenshot = (title: string, reason: string): { title: string; alt: string; notApplicableReason: string } => ({
  title,
  alt: `${title} screenshot not required`,
  notApplicableReason: reason,
});

export const helpTopics: HelpTopic[] = [
  {
    slug: 'run-a-tournament',
    title: 'Run a tournament',
    summary: 'Set up the event, prepare categories and courts, run day-of operations, and publish results.',
    purpose: 'Use this guide as the main organizer checklist from event creation through final results.',
    audience: ['organizer'],
    beforeYouStart: [
      'Sign in with an organizer or admin account.',
      'Create or select the tournament you want to manage.',
      'Confirm categories, courts, and registration rules before tournament day.',
    ],
    steps: [
      {
        title: 'Create the tournament shell',
        details: [
          'Open Tournaments, then choose Create Tournament.',
          'Enter the public event details, date, venue, and organizer settings.',
          'Save the tournament and open its Event Center.',
        ],
      },
      {
        title: 'Prepare competition data',
        details: [
          'Add categories, courts, registrations, participants, and seeds.',
          'Generate brackets after registrations are approved and checked.',
          'Use Match Control to review scheduling and readiness before going live.',
        ],
      },
      {
        title: 'Run the event day',
        details: [
          'Use Check-in to confirm arrivals.',
          'Use Match Control to assign courts, start matches, delay matches, and monitor alerts.',
          'Use Leaderboard and Reports to review results after play progresses.',
        ],
      },
    ],
    screenshots: [screenshot('run-a-tournament', 'Organizer Event Center')],
    commonProblems: [
      {
        problem: 'A match cannot be assigned to a court.',
        fix: 'Check Match Control alerts. Matches may be blocked until they are published, scheduled, and checked in.',
      },
      {
        problem: 'A public page looks empty.',
        fix: 'Confirm the category or tournament has generated brackets, scheduled matches, or completed scores.',
      },
    ],
    relatedTopics: ['manage-categories', 'manage-courts', 'schedule-matches', 'control-matches'],
    technicalNotes: [
      {
        title: 'Tournament state drives organizer actions',
        body: 'Organizer workflows combine route guards, tournament state, category state, and match score status before enabling operational actions.',
        sourceReferences: [
          'src/router/index.ts',
          'src/stores/tournaments.ts',
          'src/composables/useTournamentStateAdvance.ts',
          'docs/feature-rules/tournament-lifecycle-and-state.md',
        ],
      },
    ],
  },
  {
    slug: 'sign-in-and-roles',
    title: 'Sign in and roles',
    summary: 'Understand account access, public pages, and role-based areas.',
    purpose: 'Use this guide to know which account or access link is needed for each workflow.',
    audience: ['organizer', 'scorekeeper', 'player', 'platform'],
    beforeYouStart: [
      'Use the public pages without signing in.',
      'Use a staff account for organizer, scorekeeper, and platform workflows.',
      'Use volunteer access links when a tournament gives you a PIN.',
    ],
    steps: [
      {
        title: 'Open the right entry point',
        details: [
          'Use Login for staff accounts.',
          'Use Register only when creating a public player account.',
          'Use tournament volunteer access links for check-in or scorekeeper kiosks.',
        ],
      },
      {
        title: 'Follow the role-specific navigation',
        details: [
          'Organizers see tournament setup and day-of controls.',
          'Scorekeepers see scoring pages.',
          'Platform admins see moderation and platform dashboards.',
        ],
      },
    ],
    screenshots: [screenshot('sign-in-and-roles', 'Login and role access')],
    commonProblems: [
      {
        problem: 'You are redirected to Overview instead of the page you opened.',
        fix: 'Your account role does not have access to that page. Ask an organizer or platform admin to update access.',
      },
    ],
    relatedTopics: ['volunteer-access', 'score-matches', 'run-a-tournament'],
    technicalNotes: [
      {
        title: 'Route meta controls access',
        body: 'The router checks requiresAuth, requiresAdmin, requiresScorekeeper, requiresWebAdmin, and volunteer session metadata before allowing protected routes.',
        sourceReferences: ['src/router/index.ts', 'src/stores/auth.ts', 'src/stores/volunteerAccess.ts'],
      },
    ],
  },
  {
    slug: 'manage-categories',
    title: 'Manage categories',
    summary: 'Create categories, configure formats, manage pool levels, and prepare bracket generation.',
    purpose: 'Use this guide when defining the divisions players compete in.',
    audience: ['organizer'],
    beforeYouStart: [
      'Open the tournament as an organizer.',
      'Know each category name, match type, and format before adding it.',
    ],
    steps: [
      {
        title: 'Add the category',
        details: [
          'Open Categories from the tournament navigation.',
          'Choose Add Category and set the format, discipline, and draw method.',
          'Save and review the category card for setup actions.',
        ],
      },
      {
        title: 'Prepare pool or bracket structure',
        details: [
          'For pool-to-elimination formats, create levels or pools when needed.',
          'Review participant counts before generating brackets.',
          'Publish or unpublish category states according to tournament readiness.',
        ],
      },
    ],
    screenshots: [screenshot('manage-categories', 'Category management')],
    commonProblems: [
      {
        problem: 'A category action is disabled.',
        fix: 'Check whether the category has enough approved registrations and whether prior phase requirements are complete.',
      },
    ],
    relatedTopics: ['register-participants', 'generate-brackets', 'pool-leveling'],
    technicalNotes: [
      {
        title: 'Category cards centralize phase actions',
        body: 'Category management uses category state, pool phase, registration counts, and bracket availability to determine actions.',
        sourceReferences: [
          'src/features/tournaments/components/CategoryManagement.vue',
          'src/features/tournaments/components/CategoryRegistrationStats.vue',
          'docs/feature-rules/category-management.md',
          'docs/feature-rules/category-card-phase-progression.md',
        ],
      },
    ],
  },
  {
    slug: 'manage-courts',
    title: 'Manage courts',
    summary: 'Add courts, mark court availability, and release courts during tournament play.',
    purpose: 'Use this guide to keep physical court availability aligned with Match Control.',
    audience: ['organizer'],
    beforeYouStart: [
      'Open the tournament as an organizer.',
      'Confirm the physical courts available for the event.',
    ],
    steps: [
      {
        title: 'Add or update courts',
        details: [
          'Open Courts from the tournament navigation.',
          'Add each court with a clear court name.',
          'Use court status controls when a court is blocked, free, ready, or live.',
        ],
      },
      {
        title: 'Use courts during play',
        details: [
          'Assign ready matches to available courts from Match Control.',
          'Start a match when players are ready.',
          'Release a court when a match is complete or manually cleared.',
        ],
      },
    ],
    screenshots: [screenshot('manage-courts', 'Court management')],
    commonProblems: [
      {
        problem: 'A court still shows a match after completion.',
        fix: 'Use Match Control to verify match completion and release the court if an organizer action is still pending.',
      },
    ],
    relatedTopics: ['control-matches', 'schedule-matches', 'score-matches'],
    technicalNotes: [
      {
        title: 'Court cards show one authoritative status',
        body: 'Court display should use the single court-level status chip rather than mixing match and court statuses.',
        sourceReferences: [
          'src/features/tournaments/components/CourtCard.vue',
          'src/features/tournaments/components/CourtManagement.vue',
          'docs/coding-patterns/CODING_PATTERNS.md',
        ],
      },
    ],
  },
  {
    slug: 'register-participants',
    title: 'Register participants',
    summary: 'Manage self-registration, organizer-entered registrations, approval, and the active participant list.',
    purpose: 'Use this guide to move players and teams from signup to competition-ready participants.',
    audience: ['organizer', 'player', 'public'],
    beforeYouStart: [
      'Players need the public tournament registration link.',
      'Organizers need admin access to approve or update registrations.',
      'Categories should exist before registrations are reviewed.',
    ],
    steps: [
      {
        title: 'Collect registrations',
        details: [
          'Share the public registration link with players.',
          'Players fill in the required registration fields and submit.',
          'Organizers can also manage registrations directly from the tournament.',
        ],
      },
      {
        title: 'Approve and review',
        details: [
          'Open Registrations to approve, withdraw, or update entries.',
          'Open Participants for the active roster view.',
          'Use player management when duplicate global player records need review.',
        ],
      },
    ],
    screenshots: [screenshot('register-participants', 'Registration management')],
    commonProblems: [
      {
        problem: 'A player name does not show correctly in a match.',
        fix: 'Check the registration and player record. Team registrations use team names, while singles resolve through player details.',
      },
    ],
    relatedTopics: ['self-check-in', 'manage-categories', 'players-and-merge'],
    technicalNotes: [
      {
        title: 'Registration IDs are not bracket participant IDs',
        body: 'Match participant fields resolve through registration IDs. Code must not use numeric bracket participant IDs for registration lookups.',
        sourceReferences: [
          'src/composables/useParticipantResolver.ts',
          'src/stores/registrations.ts',
          'docs/migration/DATA_MODEL_MIGRATION_RULES.md',
        ],
      },
    ],
  },
  {
    slug: 'front-desk-check-in',
    title: 'Front desk check-in',
    summary: 'Search, scan, bulk check in, undo, and mark arrivals for tournament day.',
    purpose: 'Use this guide at the registration desk on tournament day.',
    audience: ['organizer', 'checkin'],
    beforeYouStart: [
      'Open the tournament check-in page or volunteer check-in kiosk.',
      'Make sure registrations are approved.',
      'Keep the scanner or search box focused for fast entry.',
    ],
    steps: [
      {
        title: 'Find a participant',
        details: [
          'Search by name, registration, team, or scan input.',
          'Review the row status before taking action.',
          'Use bulk actions when several selected participants need the same update.',
        ],
      },
      {
        title: 'Record check-in',
        details: [
          'Choose Check in for arriving players or teams.',
          'Use undo if the latest check-in was accidental.',
          'Mark no-show or restore entries when organizer policy requires it.',
        ],
      },
    ],
    screenshots: [screenshot('front-desk-check-in', 'Front desk check-in')],
    commonProblems: [
      {
        problem: 'A registration cannot be checked in.',
        fix: 'Confirm it is approved and not withdrawn. Withdrawn registrations are blocked from check-in.',
      },
    ],
    relatedTopics: ['volunteer-access', 'self-check-in', 'control-matches'],
    technicalNotes: [
      {
        title: 'Check-in workflow parses scanner input before lookup',
        body: 'The front-desk composable parses raw input, resolves eligible registrations, and writes status changes with notification feedback.',
        sourceReferences: [
          'src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts',
          'src/features/checkin/views/FrontDeskCheckInView.vue',
          'docs/feature-rules/front-desk-checkin.md',
        ],
      },
    ],
  },
  {
    slug: 'self-check-in',
    title: 'Self check-in',
    summary: 'Let players confirm arrival from the public self-check-in page.',
    purpose: 'Use this guide when players check themselves in without staff assistance.',
    audience: ['player', 'public', 'organizer'],
    beforeYouStart: [
      'Open the tournament self-check-in link.',
      'Search for the registration by player or team name.',
      'Use front-desk help if the registration cannot be found.',
    ],
    steps: [
      {
        title: 'Search for the registration',
        details: [
          'Enter a player, partner, or team name.',
          'Select the matching registration.',
          'Review the category and participant details.',
        ],
      },
      {
        title: 'Confirm arrival',
        details: [
          'Choose the check-in action.',
          'Wait for confirmation before leaving the page.',
          'Ask the desk for help if the status says withdrawn or already handled.',
        ],
      },
    ],
    screenshots: [screenshot('self-check-in', 'Self check-in')],
    commonProblems: [
      {
        problem: 'The registration search returns no match.',
        fix: 'Try a partner name, team name, or ask the organizer to confirm the approved registration.',
      },
    ],
    relatedTopics: ['register-participants', 'front-desk-check-in', 'public-pages'],
    technicalNotes: [
      {
        title: 'Self check-in uses dedicated domain helpers',
        body: 'Self check-in keeps search and eligibility behavior in composables so public UI and tests share the same rules.',
        sourceReferences: [
          'src/features/checkin/composables/useSelfCheckIn.ts',
          'src/features/checkin/composables/selfCheckInDomain.ts',
          'src/features/checkin/views/SelfCheckInView.vue',
        ],
      },
    ],
  },
  {
    slug: 'generate-brackets',
    title: 'Generate brackets',
    summary: 'Create match structures from approved registrations and category settings.',
    purpose: 'Use this guide when moving a category from roster setup to playable matches.',
    audience: ['organizer'],
    beforeYouStart: [
      'Approve registrations and review seeds.',
      'Confirm category format and pool settings.',
      'Make sure participant counts match the intended draw.',
    ],
    steps: [
      {
        title: 'Open bracket generation',
        details: [
          'Open Brackets or the category action menu.',
          'Select the category and confirm generation settings.',
          'Generate the bracket and review the resulting match layout.',
        ],
      },
      {
        title: 'Regenerate only when needed',
        details: [
          'Regeneration can replace existing bracket structure.',
          'Use it before scores are entered unless an organizer has a clear correction plan.',
          'Review public bracket output after generation.',
        ],
      },
    ],
    screenshots: [screenshot('generate-brackets', 'Bracket generation')],
    commonProblems: [
      {
        problem: 'Bracket generation creates byes or TBD slots.',
        fix: 'Review participant count and category format. Byes can be valid for uneven draw sizes.',
      },
    ],
    relatedTopics: ['manage-categories', 'pool-leveling', 'public-pages'],
    technicalNotes: [
      {
        title: 'Bracket structure is separate from operational scores',
        body: 'Bracket data lives in category-scoped match documents while operational score/status data is stored in match score records.',
        sourceReferences: [
          'src/composables/useBracketGenerator.ts',
          'src/services/brackets-storage.ts',
          'src/stores/bracketMatchAdapter.ts',
          'docs/feature-rules/bracket-generation.md',
        ],
      },
    ],
  },
  {
    slug: 'pool-leveling',
    title: 'Pool leveling',
    summary: 'Split players into levels or pools and manage pool-to-elimination progression.',
    purpose: 'Use this guide for pool formats where balanced levels or pool phase progression are needed.',
    audience: ['organizer'],
    beforeYouStart: [
      'Use a pool-to-elimination category.',
      'Approve enough registrations for pools.',
      'Confirm the draw method and level count.',
    ],
    steps: [
      {
        title: 'Create levels',
        details: [
          'Open the category action menu.',
          'Choose the level creation action.',
          'Review automatic level assignment and override entries when needed.',
        ],
      },
      {
        title: 'Advance pool results',
        details: [
          'Complete pool matches and review standings.',
          'Advance winners when the pool phase is complete.',
          'Generate or view the elimination phase after advancement.',
        ],
      },
    ],
    screenshots: [screenshot('pool-leveling', 'Pool leveling')],
    commonProblems: [
      {
        problem: 'Pool standings do not show final placement.',
        fix: 'Confirm all pool matches have completed scores and that ranking rules are configured for the category.',
      },
    ],
    relatedTopics: ['generate-brackets', 'leaderboards-and-reports', 'schedule-matches'],
    technicalNotes: [
      {
        title: 'Pool helpers compute assignments and progression',
        body: 'Pool leveling and standings rely on shared helpers so category cards, brackets, and leaderboard behavior stay aligned.',
        sourceReferences: [
          'src/composables/usePoolLeveling.ts',
          'src/features/brackets/components/PoolDrawTab.vue',
          'docs/feature-rules/pool-leveling.md',
        ],
      },
    ],
  },
  {
    slug: 'schedule-matches',
    title: 'Schedule matches',
    summary: 'Plan match times, export schedules, and avoid overloading court capacity.',
    purpose: 'Use this guide to create a playable time schedule before or during the event.',
    audience: ['organizer'],
    beforeYouStart: [
      'Generate match structures first.',
      'Add courts before scheduling.',
      'Know the event start time, match duration, and court capacity.',
    ],
    steps: [
      {
        title: 'Open scheduling controls',
        details: [
          'Use Match Control or schedule dialogs to create a time-first schedule.',
          'Choose category, level, and time scope carefully.',
          'Review the schedule grid before publishing assignments.',
        ],
      },
      {
        title: 'Export or adjust',
        details: [
          'Export schedules when staff or participants need a static copy.',
          'Clear or replace schedules only for the selected scope.',
          'Use capacity warnings to avoid too many simultaneous matches.',
        ],
      },
    ],
    screenshots: [screenshot('schedule-matches', 'Schedule grid')],
    commonProblems: [
      {
        problem: 'The schedule starts later than expected.',
        fix: 'Check court capacity and existing occupied court windows. The scheduler protects against overbooking.',
      },
    ],
    relatedTopics: ['control-matches', 'manage-courts', 'public-pages'],
    technicalNotes: [
      {
        title: 'Scheduling is scope-aware',
        body: 'Scheduler helpers support tournament, category, and level scopes so reruns do not wipe unrelated scheduled matches.',
        sourceReferences: [
          'src/composables/useTimeScheduler.ts',
          'src/composables/useMatchScheduler.ts',
          'src/features/tournaments/components/ScheduleGridView.vue',
          'docs/feature-rules/time-first-scheduling.md',
        ],
      },
    ],
  },
  {
    slug: 'control-matches',
    title: 'Control matches',
    summary: 'Assign courts, start matches, pause automation, handle delays, and resolve operational blockers.',
    purpose: 'Use this guide as the organizer command center during tournament play.',
    audience: ['organizer'],
    beforeYouStart: [
      'Open Match Control for the tournament.',
      'Confirm courts and schedules are ready.',
      'Keep check-in status current to avoid blocked assignments.',
    ],
    steps: [
      {
        title: 'Review readiness',
        details: [
          'Use alerts to find blocked or urgent matches.',
          'Review the ready queue and active court cards.',
          'Confirm whether auto-assignment should be running or paused.',
        ],
      },
      {
        title: 'Take match actions',
        details: [
          'Assign a court manually or let auto-assignment place eligible matches.',
          'Start matches when players are on court.',
          'Record delays, walkovers, corrections, or manual completions when needed.',
        ],
      },
    ],
    screenshots: [screenshot('control-matches', 'Match Control')],
    commonProblems: [
      {
        problem: 'A green assignment action is missing.',
        fix: 'The match is blocked by the shared assignment gate. Open alerts or the blocked reason for exact requirements.',
      },
    ],
    relatedTopics: ['manage-courts', 'front-desk-check-in', 'score-matches'],
    technicalNotes: [
      {
        title: 'One assignment gate controls queue, alerts, and auto-assign',
        body: 'Ready queue affordances, blocker alerts, and auto-assignment must derive from the same match-level gate.',
        sourceReferences: [
          'src/features/tournaments/views/MatchControlView.vue',
          'src/features/tournaments/components/ReadyQueue.vue',
          'src/features/tournaments/components/AlertsPanel.vue',
          'src/composables/useAutoAssignment.ts',
          'docs/coding-patterns/CODING_PATTERNS.md',
        ],
      },
    ],
  },
  {
    slug: 'score-matches',
    title: 'Score matches',
    summary: 'Enter live scores, use manual fallback, complete matches, and advance winners.',
    purpose: 'Use this guide for scorekeeper and organizer score entry.',
    audience: ['scorekeeper', 'organizer'],
    beforeYouStart: [
      'Open the assigned match scoring link or scorekeeper kiosk.',
      'Confirm the match and category are correct.',
      'Use manual fallback only when live scoring controls are not enough.',
    ],
    steps: [
      {
        title: 'Open the match',
        details: [
          'From Match List, Match Control, QR code, or scorekeeper kiosk, open the match scoring page.',
          'Confirm both participant names before entering scores.',
          'Use the category-aware link when navigating from match lists.',
        ],
      },
      {
        title: 'Enter and submit scores',
        details: [
          'Record each game score.',
          'Review winner and match completion state before submitting.',
          'Return to match list or Match Control after the match completes.',
        ],
      },
    ],
    screenshots: [screenshot('score-matches', 'Scoring interface')],
    commonProblems: [
      {
        problem: 'The scoring page says the match could not be opened.',
        fix: 'Open the match from a category-aware link. The route needs category context for category-scoped match paths.',
      },
    ],
    relatedTopics: ['score-corrections', 'control-matches', 'volunteer-access'],
    technicalNotes: [
      {
        title: 'Scoring routes need category context',
        body: 'Category-scoped matches require the category query when opening the scoring interface from operational match lists.',
        sourceReferences: [
          'src/features/scoring/views/ScoringInterfaceView.vue',
          'src/stores/matches.ts',
          'docs/coding-patterns/CODING_PATTERNS.md',
          'docs/feature-rules/scoring-and-match-completion.md',
        ],
      },
    ],
  },
  {
    slug: 'score-corrections',
    title: 'Score corrections',
    summary: 'Correct submitted scores while preserving operational status and auditability.',
    purpose: 'Use this guide when a completed or submitted score needs organizer review.',
    audience: ['organizer', 'scorekeeper'],
    beforeYouStart: [
      'Open the match scoring or correction flow.',
      'Confirm the correct participants and category.',
      'Know the final score that should replace the current value.',
    ],
    steps: [
      {
        title: 'Open correction controls',
        details: [
          'Find the match from Match Control or match list.',
          'Open score correction or manual fallback.',
          'Enter the corrected game values.',
        ],
      },
      {
        title: 'Save and verify',
        details: [
          'Submit the correction.',
          'Review match status and court state after saving.',
          'Check leaderboard or bracket output if standings depend on the corrected score.',
        ],
      },
    ],
    screenshots: [screenshot('score-corrections', 'Score correction dialog')],
    commonProblems: [
      {
        problem: 'A correction changes the displayed winner unexpectedly.',
        fix: 'Recheck every game score before saving. Winner advancement depends on the corrected score data.',
      },
    ],
    relatedTopics: ['score-matches', 'leaderboards-and-reports', 'control-matches'],
    technicalNotes: [
      {
        title: 'Corrections update operational match score data',
        body: 'Score correction behavior is covered by the matches store and scoring correction tests.',
        sourceReferences: [
          'src/features/scoring/components/ScoreCorrectionDialog.vue',
          'src/stores/matches.ts',
          'tests/integration/scoring-correction.integration.test.ts',
          'docs/feature-rules/score-correction.md',
        ],
      },
    ],
  },
  {
    slug: 'leaderboards-and-reports',
    title: 'Leaderboards and reports',
    summary: 'Review standings, tiebreakers, tournament summaries, and duration metrics.',
    purpose: 'Use this guide to understand results after matches are scored.',
    audience: ['organizer', 'player', 'public'],
    beforeYouStart: [
      'Complete or score matches first.',
      'Use filters when looking at a specific category, pool, or phase.',
      'Check ranking rules if standings look close.',
    ],
    steps: [
      {
        title: 'Open standings',
        details: [
          'Use Leaderboard from tournament navigation or public links.',
          'Select tournament, category, or pool scope when available.',
          'Read the tiebreaker explainer for ranking order.',
        ],
      },
      {
        title: 'Review reports',
        details: [
          'Open Reports as an organizer.',
          'Review duration, completed match, and tournament summary metrics.',
          'Use report output to improve scheduling and court planning.',
        ],
      },
    ],
    screenshots: [screenshot('leaderboards-and-reports', 'Leaderboard and reports')],
    commonProblems: [
      {
        problem: 'Pool scope is unavailable.',
        fix: 'Pool scope appears only for categories that support pool play and have pool data.',
      },
    ],
    relatedTopics: ['pool-leveling', 'score-matches', 'public-pages'],
    technicalNotes: [
      {
        title: 'Ranking config is resolved by scope',
        body: 'Leaderboard behavior combines selected phase scope with effective ranking presets from category and tournament settings.',
        sourceReferences: [
          'src/composables/useLeaderboard.ts',
          'src/features/leaderboard/effectiveRankingConfig.ts',
          'src/features/tournaments/views/LeaderboardView.vue',
          'docs/feature-rules/leaderboard-and-tiebreakers.md',
        ],
      },
    ],
  },
  {
    slug: 'public-pages',
    title: 'Public pages',
    summary: 'Share public schedule, bracket, scoring, player, landing, and champions pages.',
    purpose: 'Use this guide when players or spectators need live tournament information.',
    audience: ['public', 'player', 'organizer'],
    beforeYouStart: [
      'Use the tournament public links.',
      'No account is required for public pages.',
      'Published tournament data must exist before public pages have meaningful content.',
    ],
    steps: [
      {
        title: 'Open public tournament pages',
        details: [
          'Use Schedule to show time and court information.',
          'Use Bracket to show draw structure.',
          'Use Score or Player pages for score lookup and player-specific match context.',
        ],
      },
      {
        title: 'Use display views',
        details: [
          'Use display mode for venue screens when available.',
          'Share landing and champions pages after event details or results are ready.',
          'Refresh if live data is changing quickly.',
        ],
      },
    ],
    screenshots: [screenshot('public-pages', 'Public schedule')],
    commonProblems: [
      {
        problem: 'Public schedule shows no matches.',
        fix: 'The organizer may not have generated or scheduled matches yet, or the selected category filter has no matches.',
      },
    ],
    relatedTopics: ['schedule-matches', 'generate-brackets', 'leaderboards-and-reports'],
    technicalNotes: [
      {
        title: 'Public routes skip authentication',
        body: 'Public tournament routes use requiresAuth false and read tournament data through public views.',
        sourceReferences: [
          'src/router/index.ts',
          'src/features/public/views/PublicScheduleView.vue',
          'src/features/public/views/PublicBracketView.vue',
          'src/features/public/views/PublicScoringView.vue',
          'docs/feature-rules/public-views.md',
        ],
      },
    ],
  },
  {
    slug: 'volunteer-access',
    title: 'Volunteer access',
    summary: 'Use PIN-protected check-in and scorekeeper kiosks without full staff accounts.',
    purpose: 'Use this guide when volunteers operate limited tournament-day stations.',
    audience: ['checkin', 'scorekeeper', 'organizer'],
    beforeYouStart: [
      'Get the tournament volunteer access link from an organizer.',
      'Get the current PIN for the volunteer role.',
      'Use a device that can stay on the kiosk page during the session.',
    ],
    steps: [
      {
        title: 'Enter the kiosk',
        details: [
          'Open the check-in or scoring access link.',
          'Enter the PIN.',
          'Continue into the restricted kiosk workflow.',
        ],
      },
      {
        title: 'Work within the role',
        details: [
          'Check-in volunteers use front-desk check-in actions.',
          'Scorekeeper volunteers use match list and scoring pages.',
          'Ask an organizer for a new PIN if the session expires.',
        ],
      },
    ],
    screenshots: [screenshot('volunteer-access', 'Volunteer PIN access')],
    commonProblems: [
      {
        problem: 'The kiosk redirects back to PIN entry.',
        fix: 'The session is missing, expired, or for the wrong volunteer role. Re-enter the current PIN.',
      },
    ],
    relatedTopics: ['front-desk-check-in', 'score-matches', 'sign-in-and-roles'],
    technicalNotes: [
      {
        title: 'Volunteer sessions are route-scoped',
        body: 'Volunteer access routes check for a valid session matching the tournament and role before allowing kiosk pages.',
        sourceReferences: [
          'src/router/index.ts',
          'src/stores/volunteerAccess.ts',
          'src/features/volunteer/views/VolunteerAccessView.vue',
          'docs/feature-rules/auth-and-route-access.md',
        ],
      },
    ],
  },
  {
    slug: 'overlays-and-obs',
    title: 'Overlays and OBS',
    summary: 'Use venue overlays, ticker boards, court boards, and OBS score graphics.',
    purpose: 'Use this guide when streaming or showing tournament information on external displays.',
    audience: ['organizer', 'public'],
    beforeYouStart: [
      'Open overlay links from the tournament as an organizer.',
      'Copy the relevant overlay URL into OBS or a display browser.',
      'Make sure match and court data is live before relying on overlays.',
    ],
    steps: [
      {
        title: 'Open overlay links',
        details: [
          'Use Overlay Links from the tournament navigation.',
          'Choose court, board, ticker, or OBS scoreboard output.',
          'Copy the URL into the display or streaming software.',
        ],
      },
      {
        title: 'Keep data current',
        details: [
          'Start and score matches from operational pages.',
          'Use Match Control to keep court assignments accurate.',
          'Refresh the display if the browser loses connection.',
        ],
      },
    ],
    screenshots: [screenshot('overlays-and-obs', 'Overlay links')],
    commonProblems: [
      {
        problem: 'An overlay appears blank.',
        fix: 'Check that the target court or match exists and has live data to display.',
      },
    ],
    relatedTopics: ['control-matches', 'score-matches', 'public-pages'],
    technicalNotes: [
      {
        title: 'Overlay routes bypass auth',
        body: 'Overlay and OBS routes skip auth checks and use display-specific route metadata.',
        sourceReferences: [
          'src/router/index.ts',
          'src/features/overlay/views/OverlayLinksView.vue',
          'src/features/obs/views/ObsScoreboardView.vue',
          'docs/feature-rules/overlay-and-obs-views.md',
        ],
      },
    ],
  },
  {
    slug: 'players-and-merge',
    title: 'Players and merge',
    summary: 'Manage global player records, profiles, history, and duplicate merge requests.',
    purpose: 'Use this guide when maintaining player identity across tournaments.',
    audience: ['organizer', 'player'],
    beforeYouStart: [
      'Sign in with organizer access for player management.',
      'Search before creating or editing players.',
      'Review duplicate candidates carefully before merging.',
    ],
    steps: [
      {
        title: 'Find player records',
        details: [
          'Open Players from authenticated navigation.',
          'Search or open an individual player profile.',
          'Review match history and linked tournament participation.',
        ],
      },
      {
        title: 'Handle duplicates',
        details: [
          'Open merge tools when duplicate player records are suspected.',
          'Compare candidate details before choosing a target record.',
          'Submit or complete the merge according to organizer policy.',
        ],
      },
    ],
    screenshots: [screenshot('players-and-merge', 'Player management')],
    commonProblems: [
      {
        problem: 'Two players look like duplicates but have different histories.',
        fix: 'Do not merge until the identity is confirmed. Use profile details and registration history to compare.',
      },
    ],
    relatedTopics: ['register-participants', 'leaderboards-and-reports', 'sign-in-and-roles'],
    technicalNotes: [
      {
        title: 'Global player identity bridges tournament mirrors',
        body: 'Player identity services resolve global records and tournament participation while preserving existing tournament-scoped consumers.',
        sourceReferences: [
          'src/services/playerIdentityService.ts',
          'src/stores/players.ts',
          'src/stores/mergeRequests.ts',
          'src/features/players/views/PlayerMergeView.vue',
        ],
      },
    ],
  },
  {
    slug: 'notifications-and-audit',
    title: 'Notifications and audit',
    summary: 'Understand toasts, activity feeds, alerts, and audit trails.',
    purpose: 'Use this guide to know where operational feedback and historical records appear.',
    audience: ['organizer', 'platform'],
    beforeYouStart: [
      'Sign in with access to the tournament or platform area.',
      'Use page-level alerts for immediate blockers.',
      'Use audit views for historical review.',
    ],
    steps: [
      {
        title: 'Read live feedback',
        details: [
          'Watch toast notifications after creating, updating, or deleting records.',
          'Use Match Control alerts for operational blockers.',
          'Use activity feeds for recent tournament actions.',
        ],
      },
      {
        title: 'Review audit history',
        details: [
          'Open Audit Log from tournament admin navigation.',
          'Filter or review historical events.',
          'Use the log to investigate changes after tournament-day issues.',
        ],
      },
    ],
    screenshots: [screenshot('notifications-and-audit', 'Audit and alerts')],
    commonProblems: [
      {
        problem: 'An action fails without the expected result.',
        fix: 'Read the toast or alert message first, then check the audit/activity trail if an admin needs history.',
      },
    ],
    relatedTopics: ['control-matches', 'run-a-tournament', 'platform-administration'],
    technicalNotes: [
      {
        title: 'Stores centralize feedback and audit records',
        body: 'Notification, alert, activity, and audit stores support user feedback and historical operator visibility.',
        sourceReferences: [
          'src/stores/notifications.ts',
          'src/stores/alerts.ts',
          'src/stores/activities.ts',
          'src/stores/audit.ts',
          'docs/feature-rules/notifications-activities-alerts-audit.md',
        ],
      },
    ],
  },
  {
    slug: 'reviews-and-marketing',
    title: 'Reviews and marketing pages',
    summary: 'Use public marketing pages, reviews, and moderation workflows.',
    purpose: 'Use this guide to understand public brand pages and review moderation.',
    audience: ['public', 'platform', 'organizer'],
    beforeYouStart: [
      'Open public pages without an account.',
      'Sign in as platform admin to moderate reviews.',
      'Use public copy exactly as shown in CourtMastr.',
    ],
    steps: [
      {
        title: 'Use public marketing pages',
        details: [
          'Open Home, About, Pricing, Privacy, Terms, or Help from the public footer.',
          'Use tournament landing pages for event-specific public presentation.',
          'Use review cards where enabled to show approved feedback.',
        ],
      },
      {
        title: 'Moderate reviews',
        details: [
          'Open Review Moderation as a platform admin.',
          'Approve, reject, or review submissions.',
          'Only approved reviews appear in public sections.',
        ],
      },
    ],
    screenshots: [screenshot('reviews-and-marketing', 'Marketing and review moderation')],
    commonProblems: [
      {
        problem: 'A submitted review is not public.',
        fix: 'Confirm it is approved in Review Moderation. Public pages show approved reviews only.',
      },
    ],
    relatedTopics: ['public-pages', 'platform-administration', 'sign-in-and-roles'],
    technicalNotes: [
      {
        title: 'Reviews are moderated before display',
        body: 'Review store and service logic separate submitted reviews from approved public display.',
        sourceReferences: [
          'src/stores/reviews.ts',
          'src/services/reviewsService.ts',
          'src/features/reviews/views/AdminReviewsView.vue',
          'src/features/public/views/HomeView.vue',
        ],
      },
    ],
  },
  {
    slug: 'platform-administration',
    title: 'Platform administration',
    summary: 'Use platform dashboards, organization lists, user management, and review moderation.',
    purpose: 'Use this guide for web admin workflows outside a single tournament.',
    audience: ['platform'],
    beforeYouStart: [
      'Sign in with a platform admin account.',
      'Use Platform Dashboard for platform-wide context.',
      'Impersonate or enter org context only when support work requires it.',
    ],
    steps: [
      {
        title: 'Open platform tools',
        details: [
          'Use Platform Dashboard for admin overview.',
          'Use All Organizations to review orgs.',
          'Use Review Moderation for public feedback control.',
        ],
      },
      {
        title: 'Return to org workflows',
        details: [
          'Enter an organization context for org-specific tournament work.',
          'Use the Platform Admin navigation item to return to platform tools.',
          'Avoid changing tournament data unless requested by the organizer.',
        ],
      },
    ],
    screenshots: [screenshot('platform-administration', 'Platform admin dashboard')],
    commonProblems: [
      {
        problem: 'Organization navigation is hidden.',
        fix: 'You may be in pure platform admin mode. Enter or impersonate an organization context to see org-level navigation.',
      },
    ],
    relatedTopics: ['reviews-and-marketing', 'notifications-and-audit', 'sign-in-and-roles'],
    technicalNotes: [
      {
        title: 'Platform routes require web admin role',
        body: 'Platform dashboard, organization list, and review moderation use admin-only route checks and super admin store state.',
        sourceReferences: [
          'src/router/index.ts',
          'src/stores/superAdmin.ts',
          'src/features/super/views/SuperDashboardView.vue',
          'src/features/super/views/SuperOrgListView.vue',
        ],
      },
    ],
  },
  {
    slug: 'install-and-offline',
    title: 'Install and offline behavior',
    summary: 'Understand PWA installation prompts and browser behavior.',
    purpose: 'Use this guide when adding CourtMastr to a device home screen or handling connectivity changes.',
    audience: ['organizer', 'scorekeeper', 'checkin', 'player'],
    beforeYouStart: [
      'Use a modern browser.',
      'Sign in before tournament-day staff workflows.',
      'Keep a stable connection for live scoring and Firebase-backed updates.',
    ],
    steps: [
      {
        title: 'Install when prompted',
        details: [
          'Use the browser install prompt when available.',
          'Open the installed app from the device home screen or app launcher.',
          'Keep browser updates current for the best PWA support.',
        ],
      },
      {
        title: 'Handle connectivity',
        details: [
          'Refresh after reconnecting if live data appears stale.',
          'Do not assume score or check-in writes have completed until confirmation appears.',
          'Use organizer support if a device loses connection during a match.',
        ],
      },
    ],
    screenshots: [noScreenshot('PWA install prompt', 'Install prompts are browser-controlled and vary by device.')],
    commonProblems: [
      {
        problem: 'No install prompt appears.',
        fix: 'Use the browser menu install action if available. Some browsers hide the prompt or require repeat visits.',
      },
    ],
    relatedTopics: ['score-matches', 'front-desk-check-in', 'public-pages'],
    technicalNotes: [
      {
        title: 'PWA prompt state is isolated in a composable',
        body: 'The install prompt composable manages browser prompt availability and user actions without changing tournament data.',
        sourceReferences: [
          'src/composables/usePwaInstallPrompt.ts',
          'vite.config.ts',
          'tests/unit/usePwaInstallPrompt.test.ts',
        ],
      },
    ],
  },
];

export const getHelpTopicBySlug = (slug: string): HelpTopic | undefined =>
  helpTopics.find((topic) => topic.slug === slug);

export const getHelpTopicsForRole = (role: HelpRole): HelpTopic[] =>
  helpTopics.filter((topic) => topic.audience.includes(role));

export const searchHelpTopics = (query: string, role?: HelpRole): HelpTopic[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const roleTopics = role ? getHelpTopicsForRole(role) : helpTopics;

  if (!normalizedQuery) return roleTopics;

  return roleTopics.filter((topic) => {
    const searchableText = [
      topic.title,
      topic.summary,
      topic.purpose,
      ...topic.beforeYouStart,
      ...topic.steps.flatMap((step) => [step.title, ...step.details]),
      ...topic.commonProblems.flatMap((problem) => [problem.problem, problem.fix]),
    ].join(' ').toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
};
