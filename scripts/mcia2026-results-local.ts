/**
 * MCIA 2026 Pool Results Updater (Local Emulator)
 *
 * Applies all provided Group A-G pool match results to an existing
 * Men's Doubles pool_to_elimination category.
 *
 * Usage:
 *   npm run results:mcia2026:local
 *   npm run results:mcia2026:local -- --dry-run
 *   npm run results:mcia2026:local -- --tournament <tournamentId> --category <categoryId>
 *   npm run results:mcia2026:local -- --tournament <tournamentId> --category <categoryId> --dry-run
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createOrSignIn } from './seed/helpers';

interface CliOptions {
  tournamentId?: string;
  categoryId?: string;
  dryRun: boolean;
}

interface ScorePair {
  teamAScore: number;
  teamBScore: number;
}

interface ParsedResult {
  teamA: string;
  teamB: string;
  group: string;
  scores: ScorePair[];
  rawLine: string;
}

interface RegistrationDoc {
  teamName?: string;
}

interface ParticipantDoc {
  id: number | string;
  name: string; // registration ID
}

interface StoredOpponent {
  id?: number | string;
  result?: 'win' | 'loss' | 'draw';
}

interface MatchDoc {
  id: string;
  stage_id?: number | string;
  opponent1?: StoredOpponent | null;
  opponent2?: StoredOpponent | null;
}

interface CategoryDoc {
  name?: string;
  format?: string;
  poolStageId?: number | string | null;
}

const GAMES_PER_MATCH = 3;
const GAMES_NEEDED_TO_WIN = Math.ceil(GAMES_PER_MATCH / 2);

const RAW_RESULTS = `Kishore Subbarao & Ramc Venkatasamy / Sivakumar Srinivasulu & Vijaysivakumar Moorthy - 15-5, 15-11 Group A
Sakthi & Sahaya Vinodh / Christuraj & Abhiram Madugula - 8-15, 10-15 Group A
Christuraj & Abhiram Madugula / Kishore Subbarao & Ramc Venkatasamy - 15-13, 15-7 Group A
Sivakumar Srinivasulu & Vijaysivakumar Moorthy / Sakthi & Sahaya Vinodh - 15-13, 5-15, 11-4 Group A
Sakthi & Sahaya Vinodh / Kishore Subbarao & Ramc Venkatasamy - 11-15, 10-15 Group A
Sivakumar Srinivasulu & Vijaysivakumar Moorthy / Christuraj & Abhiram Madugula - 9-15, 5-15 Group A
Sakthivel Shanmugam & Sakthinesan / Sai kiran Chekuri & Prakash Mukku - 8-15, 12-15 Group B
Shakthi Rajendran & Nirmal Anandam / Gowtham Kandasamy & Arjun Ponnapati - 7-15, 9-15 Group B
Gowtham Kandasamy & Arjun Ponnapati / Sakthivel Shanmugam & Sakthinesan - 14-15, 10-15 Group B
Sai kiran Chekuri & Prakash Mukku / Shakthi Rajendran & Nirmal Anandam - 8-15, 15-3, 11-3 Group B
Shakthi Rajendran & Nirmal Anandam / Sakthivel Shanmugam & Sakthinesan - 8-15, 14-15 Group B
Sai kiran Chekuri & Prakash Mukku / Gowtham Kandasamy & Arjun Ponnapati - 15-12, 11-15, 11-9 Group B
Ranjith Vijayasekar & Vinothkumar Nagarajan / Dinesh Krishnan & Siva shankar Raghunathan - 15-9, 15-11 Group C
Mathibal Balasubramanian & Srikanth Marikkannu / Sudhan Sekar & Dhrumil Trivedj - 5-15, 5-15 Group C
Sudhan Sekar & Dhrumil Trivedj / Ranjith Vijayasekar & Vinothkumar Nagarajan - 15-7, 15-6 Group C
Dinesh Krishnan & Siva shankar Raghunathan / Mathibal Balasubramanian & Srikanth Marikkannu - 7-15, 15-11, 7-11 Group C
Mathibal Balasubramanian & Srikanth Marikkannu / Ranjith Vijayasekar & Vinothkumar Nagarajan - 10-15, 11-15 Group C
Dinesh Krishnan & Siva shankar Raghunathan / Sudhan Sekar & Dhrumil Trivedj - 7-15, 8-15 Group C
Arjun Chinamgari & Himesh Reddivari / Aamir Abdullah & Rajesh Panicker - 6-15, 6-15 Group D
Kothandaraman Narasiman & Jawaharbabu Jayaram / Karthik Kalairajan & Manoj Edward - 4-15, 10-15 Group D
Karthik Kalairajan & Manoj Edward / Arjun Chinamgari & Himesh Reddivari - 13-15, 14-15 Group D
Aamir Abdullah & Rajesh Panicker / Kothandaraman Narasiman & Jawaharbabu Jayaram - 15-3, 15-2 Group D
Kothandaraman Narasiman & Jawaharbabu Jayaram / Arjun Chinamgari & Himesh Reddivari - 15-13, 11-15, 7-11 Group D
Aamir Abdullah & Rajesh Panicker / Karthik Kalairajan & Manoj Edward - 15-6, 15-7 Group D
Arun Kumar Jayagopal & Karthikeyan S / Sriraman Balakrishnan & Kumaran Thirunavukkarasu - 8-15, 15-12, 11-10 Group E
Adinarayana Botlagunta & Ravi Bhushan Mishra / Mohan Krishnan & Rahul Yadav Gopalakrishnan - 12-15, 9-15 Group E
Mohan Krishnan & Rahul Yadav Gopalakrishnan / Arun Kumar Jayagopal & Karthikeyan S - 15-10, 15-3 Group E
Sriraman Balakrishnan & Kumaran Thirunavukkarasu / Adinarayana Botlagunta & Ravi Bhushan Mishra - 15-13, 15-12 Group E
Adinarayana Botlagunta & Ravi Bhushan Mishra / Arun Kumar Jayagopal & Karthikeyan S - 15-13, 13-15, 9-11 Group E
Sriraman Balakrishnan & Kumaran Thirunavukkarasu / Mohan Krishnan & Rahul Yadav Gopalakrishnan - 15-11, 10-15, 5-11 Group E
Hemchandran Manivannan & Anand Seenivasan / Satheeshkumar Kannan & Naveenkumar Pari - 15-9, 15-12 Group F
Rohith Kariveda & Venkatesh Prabhu / Raja Kakani & Amit Vyas - 15-11, 2-15, 7-11 Group F
Raja Kakani & Amit Vyas / Hemchandran Manivannan & Anand Seenivasan - 15-7, 15-8 Group F
Satheeshkumar Kannan & Naveenkumar Pari / Rohith Kariveda & Venkatesh Prabhu - 9-15, 10-15 Group F
Rohith Kariveda & Venkatesh Prabhu / Hemchandran Manivannan & Anand Seenivasan - 9-15, 8-15 Group F
Satheeshkumar Kannan & Naveenkumar Pari / Raja Kakani & Amit Vyas - 7-15, 6-15 Group F
Vinay Patnaik & Vishnu / Mahesh & Sudheer - 10-15, 15-11, 11-7 Group G
Aakash Paranjape & Subhash Varikuti / Prem & Raj - 5-15, 3-15 Group G
Prem & Raj / Vinay Patnaik & Vishnu - 15-14, 9-15, 6-11 Group G
Mahesh & Sudheer / Aakash Paranjape & Subhash Varikuti - 15-4, 15-5 Group G
Aakash Paranjape & Subhash Varikuti / Vinay Patnaik & Vishnu - 2-15, 9-15 Group G
Mahesh & Sudheer / Prem & Raj - 8-15, 15-14, 11-9 Group G`;

function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function asNumber(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pairKey(left: number | string, right: number | string): string {
  return String(left) < String(right) ? `${left}-${right}` : `${right}-${left}`;
}

function parseCliArgs(argv: string[]): CliOptions {
  let tournamentId: string | undefined;
  let categoryId: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tournament') {
      tournamentId = argv[i + 1] || undefined;
      i += 1;
      continue;
    }
    if (arg === '--category') {
      categoryId = argv[i + 1] || undefined;
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  if (categoryId && !tournamentId) {
    throw new Error('When using --category, --tournament is also required.');
  }

  return { tournamentId, categoryId, dryRun };
}

function parseResults(raw: string): ParsedResult[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: ParsedResult[] = [];

  for (const line of lines) {
    // Accept either hyphen or em-dash separator before scores.
    const match = line.match(/^(.*?)\s*\/\s*(.*?)\s*[-—]\s*(.*?)\s+Group\s+([A-G])$/i);
    if (!match) {
      throw new Error(`Unable to parse line: ${line}`);
    }

    const teamA = match[1]?.trim() || '';
    const teamB = match[2]?.trim() || '';
    const scoresRaw = match[3]?.trim() || '';
    const group = (match[4] || '').toUpperCase();

    const scores: ScorePair[] = scoresRaw.split(',').map((token) => {
      const scoreMatch = token.trim().match(/^(\d+)\s*-\s*(\d+)$/);
      if (!scoreMatch) {
        throw new Error(`Unable to parse score token "${token}" in line: ${line}`);
      }
      return {
        teamAScore: Number(scoreMatch[1]),
        teamBScore: Number(scoreMatch[2]),
      };
    });

    if (scores.length > GAMES_PER_MATCH) {
      throw new Error(`Too many games (${scores.length}) in line: ${line}`);
    }

    let teamAWins = 0;
    let teamBWins = 0;
    for (let i = 0; i < scores.length; i += 1) {
      const game = scores[i];
      if (game.teamAScore > game.teamBScore) {
        teamAWins += 1;
      } else if (game.teamBScore > game.teamAScore) {
        teamBWins += 1;
      } else {
        throw new Error(`Invalid tied game score in line: ${line}`);
      }

      const matchDecided = teamAWins >= GAMES_NEEDED_TO_WIN || teamBWins >= GAMES_NEEDED_TO_WIN;
      if (matchDecided && i < scores.length - 1) {
        throw new Error(`Post-clinch game found in line: ${line}`);
      }
    }

    if (teamAWins < GAMES_NEEDED_TO_WIN && teamBWins < GAMES_NEEDED_TO_WIN) {
      throw new Error(`No winner resolved from line: ${line}`);
    }

    parsed.push({ teamA, teamB, group, scores, rawLine: line });
  }

  return parsed;
}

function scoreWinnerRegId(score: ScorePair, regA: string, regB: string): string {
  if (score.teamAScore > score.teamBScore) return regA;
  if (score.teamBScore > score.teamAScore) return regB;
  throw new Error(`Invalid tied game score: ${score.teamAScore}-${score.teamBScore}`);
}

async function printLookupHints(tournamentId: string, categoryId: string): Promise<void> {
  console.log('Example commands:');
  console.log('  npm run results:mcia2026:local -- --dry-run');
  console.log('  npm run results:mcia2026:local');
  console.log(`  npm run results:mcia2026:local -- --tournament ${tournamentId} --category ${categoryId}`);
}

function timestampMillis(value: unknown): number {
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    if (
      'seconds' in value &&
      typeof (value as { seconds?: unknown }).seconds === 'number'
    ) {
      return Number((value as { seconds: number }).seconds) * 1000;
    }
  }
  return 0;
}

async function resolveTargetIds(
  db: ReturnType<typeof getFirestore>,
  options: CliOptions
): Promise<{ tournamentId: string; categoryId: string }> {
  let tournamentId = options.tournamentId;
  let categoryId = options.categoryId;

  if (!tournamentId) {
    const tournamentsSnap = await getDocs(
      query(collection(db, 'tournaments'), where('name', '==', 'MCIA Badminton 2026'))
    );

    if (tournamentsSnap.empty) {
      throw new Error('No tournament found with name "MCIA Badminton 2026". Run seed first.');
    }

    const sorted = tournamentsSnap.docs
      .slice()
      .sort((a, b) => {
        const aTs = timestampMillis(a.data().createdAt);
        const bTs = timestampMillis(b.data().createdAt);
        if (aTs !== bTs) return bTs - aTs;
        return b.id.localeCompare(a.id);
      });

    tournamentId = sorted[0]?.id;
    console.log(`  Auto-selected tournament: ${tournamentId}`);
  }

  if (!categoryId) {
    const categoriesSnap = await getDocs(
      query(
        collection(db, 'tournaments', tournamentId, 'categories'),
        where('name', '==', "Men's Doubles")
      )
    );

    if (categoriesSnap.empty) {
      throw new Error(
        `No category found with name "Men's Doubles" in tournament ${tournamentId}`
      );
    }

    const sorted = categoriesSnap.docs
      .slice()
      .sort((a, b) => {
        const aTs = timestampMillis(a.data().updatedAt) || timestampMillis(a.data().createdAt);
        const bTs = timestampMillis(b.data().updatedAt) || timestampMillis(b.data().createdAt);
        if (aTs !== bTs) return bTs - aTs;
        return b.id.localeCompare(a.id);
      });

    categoryId = sorted[0]?.id;
    console.log(`  Auto-selected category:   ${categoryId}`);
  }

  return {
    tournamentId,
    categoryId,
  };
}

async function main(): Promise<void> {
  const app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: 'demo-courtmaster.firebaseapp.com',
    projectId: 'demo-courtmaster',
  });

  const auth = getAuth(app);
  const db = getFirestore(app);

  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);

  const options = parseCliArgs(process.argv.slice(2));

  console.log('\n' + '='.repeat(64));
  console.log('  MCIA 2026 Pool Results Updater (Emulator)');
  console.log('='.repeat(64));
  console.log(`  Mode:       ${options.dryRun ? 'DRY RUN' : 'APPLY'}`);

  try {
    console.log('\n[1] Authenticating admin user...');
    await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    console.log('\n[2] Resolving tournament/category...');
    const resolved = await resolveTargetIds(db, options);

    const tournamentId = resolved.tournamentId;
    const categoryId = resolved.categoryId;
    console.log(`  Tournament: ${tournamentId}`);
    console.log(`  Category:   ${categoryId}`);

    console.log('\n[3] Loading tournament/category...');
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const categoryRef = doc(db, 'tournaments', tournamentId, 'categories', categoryId);
    const categorySnap = await getDoc(categoryRef);
    if (!categorySnap.exists()) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    const category = categorySnap.data() as CategoryDoc;
    if (category.name !== "Men's Doubles") {
      console.warn(`  Warning: category name is "${category.name || 'unknown'}"`);
    }
    if (category.format !== 'pool_to_elimination') {
      console.warn(`  Warning: category format is "${category.format || 'unknown'}"`);
    }

    const poolStageId = category.poolStageId != null ? String(category.poolStageId) : null;
    if (poolStageId === null) {
      throw new Error('poolStageId is missing. Generate pools in UI first.');
    }

    console.log(`  Resolved poolStageId: ${poolStageId}`);

    console.log('\n[4] Parsing provided result lines...');
    const parsedResults = parseResults(RAW_RESULTS);
    if (parsedResults.length !== 42) {
      throw new Error(`Expected 42 match results, got ${parsedResults.length}`);
    }
    console.log(`  Parsed ${parsedResults.length} results`);

    console.log('\n[5] Loading registrations, participants, and matches...');
    const registrationsSnap = await getDocs(
      query(
        collection(db, 'tournaments', tournamentId, 'registrations'),
        where('categoryId', '==', categoryId)
      )
    );

    const participantsSnap = await getDocs(
      collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'participant')
    );

    const matchesSnap = await getDocs(
      collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match')
    );

    const regIdByTeamKey = new Map<string, string>();
    registrationsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as RegistrationDoc;
      if (!data.teamName) return;
      regIdByTeamKey.set(normalizeTeamName(data.teamName), docSnap.id);
    });

    const participantIdByRegId = new Map<string, string>();
    const regIdByParticipantId = new Map<string, string>();
    participantsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as ParticipantDoc;
      if (data.id == null) return;
      const participantId = String(data.id);
      participantIdByRegId.set(String(data.name), participantId);
      regIdByParticipantId.set(participantId, String(data.name));
    });

    const poolMatches: MatchDoc[] = [];
    matchesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as Omit<MatchDoc, 'id'>;
      if (data.stage_id == null || String(data.stage_id) !== poolStageId) return;
      poolMatches.push({ ...data, id: docSnap.id });
    });

    if (poolMatches.length === 0) {
      throw new Error(`No matches found for poolStageId ${poolStageId}. Generate pools first.`);
    }

    const matchByPair = new Map<string, MatchDoc>();
    for (const match of poolMatches) {
      const p1 = asNumber(match.opponent1?.id);
      const p2 = asNumber(match.opponent2?.id);
      if (p1 === null || p2 === null) continue;

      const key = pairKey(p1, p2);
      if (matchByPair.has(key)) {
        throw new Error(`Duplicate pool pair mapping detected for key ${key}`);
      }
      matchByPair.set(key, match);
    }

    console.log(`  Registrations: ${registrationsSnap.size}`);
    console.log(`  Participants:  ${participantsSnap.size}`);
    console.log(`  Pool matches:  ${poolMatches.length}`);

    console.log('\n[6] Resolving match IDs for each score line...');

    const batch = writeBatch(db);
    const seenMatchIds = new Set<string>();
    let resolvedCount = 0;

    for (const result of parsedResults) {
      const regA = regIdByTeamKey.get(normalizeTeamName(result.teamA));
      const regB = regIdByTeamKey.get(normalizeTeamName(result.teamB));

      if (!regA) throw new Error(`Team not found in registrations: ${result.teamA}`);
      if (!regB) throw new Error(`Team not found in registrations: ${result.teamB}`);

      const participantA = participantIdByRegId.get(regA);
      const participantB = participantIdByRegId.get(regB);

      if (participantA === undefined) throw new Error(`Participant not found for team: ${result.teamA}`);
      if (participantB === undefined) throw new Error(`Participant not found for team: ${result.teamB}`);

      const key = pairKey(participantA, participantB);
      const match = matchByPair.get(key);
      if (!match) {
        throw new Error(`No pool match found for pairing: ${result.teamA} vs ${result.teamB}`);
      }

      if (seenMatchIds.has(match.id)) {
        throw new Error(`Duplicate result targeting match ${match.id}: ${result.rawLine}`);
      }
      seenMatchIds.add(match.id);

      const opponent1Id = match.opponent1?.id != null ? String(match.opponent1.id) : null;
      const opponent2Id = match.opponent2?.id != null ? String(match.opponent2.id) : null;
      if (opponent1Id === null || opponent2Id === null) {
        throw new Error(`Match ${match.id} has incomplete opponents`);
      }

      const regOpponent1 = regIdByParticipantId.get(opponent1Id);
      const regOpponent2 = regIdByParticipantId.get(opponent2Id);
      if (!regOpponent1 || !regOpponent2) {
        throw new Error(`Failed to resolve registration IDs for match ${match.id}`);
      }

      let teamAIsOpponent1 = false;
      if (regOpponent1 === regA && regOpponent2 === regB) {
        teamAIsOpponent1 = true;
      } else if (regOpponent1 === regB && regOpponent2 === regA) {
        teamAIsOpponent1 = false;
      } else {
        throw new Error(`Registration mapping mismatch for match ${match.id}`);
      }

      let teamAWins = 0;
      let teamBWins = 0;

      const normalizedScores = result.scores.map((score, index) => {
        if (score.teamAScore > score.teamBScore) {
          teamAWins += 1;
        } else if (score.teamBScore > score.teamAScore) {
          teamBWins += 1;
        } else {
          throw new Error(`Invalid tied game score in ${result.rawLine}`);
        }

        const score1 = teamAIsOpponent1 ? score.teamAScore : score.teamBScore;
        const score2 = teamAIsOpponent1 ? score.teamBScore : score.teamAScore;

        return {
          gameNumber: index + 1,
          score1,
          score2,
          winnerId: scoreWinnerRegId(score, regA, regB),
          isComplete: true,
        };
      });

      if (teamAWins === teamBWins) {
        throw new Error(`Unable to determine winner from scores: ${result.rawLine}`);
      }

      const winnerRegId = teamAWins > teamBWins ? regA : regB;

      const matchScoreRef = doc(
        db,
        'tournaments',
        tournamentId,
        'categories',
        categoryId,
        'match_scores',
        match.id
      );

      const opponent1Result: 'win' | 'loss' = winnerRegId === regOpponent1 ? 'win' : 'loss';
      const opponent2Result: 'win' | 'loss' = winnerRegId === regOpponent2 ? 'win' : 'loss';

      const matchRef = doc(
        db,
        'tournaments',
        tournamentId,
        'categories',
        categoryId,
        'match',
        match.id
      );

      batch.set(
        matchScoreRef,
        {
          status: 'completed',
          winnerId: winnerRegId,
          scores: normalizedScores,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        matchRef,
        {
          status: 4,
          opponent1: {
            ...(match.opponent1 || {}),
            result: opponent1Result,
          },
          opponent2: {
            ...(match.opponent2 || {}),
            result: opponent2Result,
          },
        },
        { merge: true }
      );

      resolvedCount += 1;
      console.log(`  [${result.group}] ${match.id} -> ${winnerRegId}`);
    }

    if (resolvedCount !== parsedResults.length) {
      throw new Error(`Resolved ${resolvedCount} results but parsed ${parsedResults.length}`);
    }

    const categoryUpdateRef = doc(db, 'tournaments', tournamentId, 'categories', categoryId);
    batch.set(
      categoryUpdateRef,
      {
        poolCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (options.dryRun) {
      console.log('\nDry run successful. No writes committed.');
      await printLookupHints(tournamentId, categoryId);
      process.exit(0);
      return;
    }

    console.log('\n[7] Committing result updates...');
    await batch.commit();

    console.log('\n' + '='.repeat(64));
    console.log('  MCIA results applied successfully');
    console.log('='.repeat(64));
    console.log(`  Updated matches: ${resolvedCount}`);
    console.log(`  Tournament ID:   ${tournamentId}`);
    console.log(`  Category ID:     ${categoryId}`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nFailed to apply MCIA results:', error);
    process.exit(1);
  }
}

main();
