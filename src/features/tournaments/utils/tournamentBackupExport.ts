import * as XLSX from 'xlsx';
import type { Match, Category, Tournament, Court } from '@/types';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type WS = XLSX.WorkSheet;
type GetName = (id?: string, status?: string, catId?: string) => string;

/* ─── Styles ─────────────────────────────────────────────────────────────────── */
const S = {
  header: {
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1F3A6E' } },
    alignment: { horizontal: 'center' },
  },
  sectionHead: {
    font: { bold: true, sz: 11, color: { rgb: 'FF1F3A6E' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFD9E1F2' } },
  },
  scoreInput: {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFFFC000' } },
    font: { bold: true },
    protection: { locked: false },
  },
  formula: { fill: { patternType: 'solid', fgColor: { rgb: 'FFF5F5F5' } } },
  locked: { protection: { locked: true } },
};

/* ─── Column helpers ─────────────────────────────────────────────────────────── */
const scoreP1Col = (g: number) => 6 + (g - 1) * 2;  // g=1→6(G), g=2→8(I)
const scoreP2Col = (g: number) => 7 + (g - 1) * 2;  // g=1→7(H), g=2→9(J)
const setsP1Col  = (gpm: number) => 6 + gpm * 2;     // gpm=3→12(M)
const setsP2Col  = (gpm: number) => 7 + gpm * 2;     // gpm=3→13(N)
const ptsP1Col   = (gpm: number) => 8 + gpm * 2;     // gpm=3→14(O)
const ptsP2Col   = (gpm: number) => 9 + gpm * 2;     // gpm=3→15(P)
const winnerCol  = (gpm: number) => 10 + gpm * 2;    // gpm=3→16(Q)
const statusCol  = (gpm: number) => 11 + gpm * 2;    // gpm=3→17(R)

const SC = {
  RANK: 0, PLAYER: 1, PLAYED: 2, WON: 3, LOST: 4,
  WIN_PCT: 5, SETS_W: 6, SETS_L: 7, SET_DIFF: 8,
  PTS_FOR: 9, PTS_AGAINST: 10, PT_DIFF: 11, _SCORE: 12,
};

/* ─── Cell writers ───────────────────────────────────────────────────────────── */
const encRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });
const encCol = (c: number) => XLSX.utils.encode_col(c);

function wv(ws: WS, r: number, c: number, v: string | number | null | undefined, s?: object): void {
  const val = v ?? '';
  ws[encRef(r, c)] = typeof val === 'number'
    ? { t: 'n', v: val, ...(s ? { s } : {}) }
    : { t: 's', v: String(val), ...(s ? { s } : {}) };
}

function wf(ws: WS, r: number, c: number, formula: string, s?: object, fmt?: string): void {
  const cell: any = { t: 'n', f: formula };
  if (s) cell.s = s;
  if (fmt) cell.z = fmt;
  ws[encRef(r, c)] = cell;
}

function wscore(ws: WS, r: number, c: number, value?: number): void {
  ws[encRef(r, c)] = value !== undefined
    ? { t: 'n', v: value, s: S.scoreInput }
    : { t: 's', v: '', s: S.scoreInput };
}

function setRange(ws: WS, maxR: number, maxC: number): void {
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
}

function lockSheet(ws: WS): void {
  (ws as any)['!protect'] = {
    sheet: true,
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatRows: false,
    formatColumns: false,
    insertRows: false,
    deleteRows: false,
    sort: false,
  };
}

/* ─── Formula builders ───────────────────────────────────────────────────────── */
function fSets(er: number, gpm: number, p1: boolean): string {
  const g1p1 = `${encCol(6)}${er}`;
  const parts = Array.from({ length: gpm }, (_, i) => {
    const a = `${encCol(6 + i * 2)}${er}`;
    const b = `${encCol(7 + i * 2)}${er}`;
    const [win, lose] = p1 ? [a, b] : [b, a];
    return i === 0
      ? `IF(${win}>${lose},1,0)`
      : `IF(AND(${a}<>"",${win}>${lose}),1,0)`;
  });
  return `=IF(${g1p1}="","",${parts.join('+')})`;
}

function fPts(er: number, gpm: number, p1: boolean): string {
  return '=' + Array.from({ length: gpm }, (_, i) => {
    const c = encCol(6 + i * 2 + (p1 ? 0 : 1));
    return `IFERROR(${c}${er}*1,0)`;
  }).join('+');
}

function fWinner(er: number, gpm: number): string {
  const sp1 = encCol(setsP1Col(gpm));
  const sp2 = encCol(setsP2Col(gpm));
  return `=IF(${sp1}${er}="","",IF(${sp1}${er}>${sp2}${er},C${er},IF(${sp2}${er}>${sp1}${er},D${er},"")))`;
}

function fStatus(er: number, gpm: number): string {
  const w = encCol(winnerCol(gpm));
  return `=IF(AND(G${er}="",H${er}=""),"Pending",IF(${w}${er}<>"","Complete","In Progress"))`;
}

/* ─── Utilities ─────────────────────────────────────────────────────────────── */
function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  return undefined;
}

function fmtDate(d: unknown): string {
  const dt = toDate(d);
  if (!dt) return '';
  return dt.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(d: unknown): string {
  const dt = toDate(d);
  if (!dt) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getGPM(cat: Category, t: Tournament): number {
  return cat.gamesPerMatch ?? t.settings.gamesPerMatch ?? 3;
}

function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
}

function safeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'tournament';
}

function matchColWidths(gpm: number): XLSX.ColInfo[] {
  const scoreW = Array.from({ length: gpm * 2 }, () => ({ wch: 7 }));
  return [
    { wch: 7 },  // Round
    { wch: 8 },  // Match#
    { wch: 24 }, // Player 1
    { wch: 24 }, // Player 2
    { wch: 12 }, // Court
    { wch: 8 },  // Time
    ...scoreW,
    { wch: 8 },  // Sets P1
    { wch: 8 },  // Sets P2
    { wch: 8 },  // Pts P1
    { wch: 8 },  // Pts P2
    { wch: 24 }, // Winner
    { wch: 12 }, // Status
  ];
}

/* ─── Match section ──────────────────────────────────────────────────────────── */
interface SectionResult {
  nextRow: number;
  dataStart: number; // 1-indexed Excel row of first data row
  dataEnd: number;   // 1-indexed Excel row of last data row
}

function writeMatchSection(
  ws: WS,
  startRow: number,
  label: string,
  matches: Match[],
  gpm: number,
  getName: GetName,
  courts: Court[],
  catId: string,
): SectionResult {
  const getCourtName = (id?: string | null) => courts.find(c => c.id === id)?.name ?? '';
  let row = startRow;

  wv(ws, row, 0, label, S.sectionHead);
  row++;

  const headers = ['Round', 'Match#', 'Player 1', 'Player 2', 'Court', 'Time'];
  for (let g = 1; g <= gpm; g++) headers.push(`G${g} P1 ★`, `G${g} P2 ★`);
  headers.push('Sets P1', 'Sets P2', 'Pts P1', 'Pts P2', 'Winner', 'Status');
  headers.forEach((h, c) => wv(ws, row, c, h, S.header));
  row++;

  const dataStart = row + 1; // 1-indexed Excel

  const sorted = [...matches].sort((a, b) =>
    a.round !== b.round ? a.round - b.round : a.matchNumber - b.matchNumber,
  );

  for (const match of sorted) {
    const er = row + 1;
    wv(ws, row, 0, match.round);
    wv(ws, row, 1, match.matchNumber);
    wv(ws, row, 2, getName(match.participant1Id, match.status, catId));
    wv(ws, row, 3, getName(match.participant2Id, match.status, catId));
    wv(ws, row, 4, getCourtName(match.courtId));
    wv(ws, row, 5, fmtTime(match.plannedStartAt ?? match.scheduledTime));

    for (let g = 1; g <= gpm; g++) {
      const sc = match.scores?.find(s => s.gameNumber === g);
      wscore(ws, row, scoreP1Col(g), sc?.isComplete ? sc.score1 : undefined);
      wscore(ws, row, scoreP2Col(g), sc?.isComplete ? sc.score2 : undefined);
    }

    wf(ws, row, setsP1Col(gpm), fSets(er, gpm, true), S.formula);
    wf(ws, row, setsP2Col(gpm), fSets(er, gpm, false), S.formula);
    wf(ws, row, ptsP1Col(gpm), fPts(er, gpm, true), S.formula);
    wf(ws, row, ptsP2Col(gpm), fPts(er, gpm, false), S.formula);
    wf(ws, row, winnerCol(gpm), fWinner(er, gpm), S.formula);
    wf(ws, row, statusCol(gpm), fStatus(er, gpm), S.formula);
    row++;
  }

  return { nextRow: row, dataStart, dataEnd: row };
}

/* ─── Standings section ──────────────────────────────────────────────────────── */
function writeStandingsSection(
  ws: WS,
  startRow: number,
  label: string,
  playerNames: string[],
  dataStart: number,
  dataEnd: number,
  gpm: number,
): number {
  const statusC = encCol(statusCol(gpm));
  const winnerC = encCol(winnerCol(gpm));
  const sp1C    = encCol(setsP1Col(gpm));
  const sp2C    = encCol(setsP2Col(gpm));
  const pp1C    = encCol(ptsP1Col(gpm));
  const pp2C    = encCol(ptsP2Col(gpm));

  const p1R = `$C$${dataStart}:$C$${dataEnd}`;
  const p2R = `$D$${dataStart}:$D$${dataEnd}`;
  const stR = `$${statusC}$${dataStart}:$${statusC}$${dataEnd}`;
  const wiR = `$${winnerC}$${dataStart}:$${winnerC}$${dataEnd}`;
  const s1R = `$${sp1C}$${dataStart}:$${sp1C}$${dataEnd}`;
  const s2R = `$${sp2C}$${dataStart}:$${sp2C}$${dataEnd}`;
  const pf1R = `$${pp1C}$${dataStart}:$${pp1C}$${dataEnd}`;
  const pf2R = `$${pp2C}$${dataStart}:$${pp2C}$${dataEnd}`;

  let row = startRow;

  wv(ws, row, 0, label, S.sectionHead);
  row++;

  const sHeaders = ['Rank', 'Player', 'Played', 'M.Won', 'M.Lost', 'Win%', 'Sets W', 'Sets L', 'Set Diff', 'Pts For', 'Pts Against', 'Pt Diff'];
  sHeaders.forEach((h, c) => wv(ws, row, c, h, S.header));
  row++;

  const sdStart = row + 1; // 1-indexed Excel
  const sdEnd = sdStart + playerNames.length - 1;

  for (const name of playerNames) {
    const er = row + 1;
    const pRef = `B${er}`;

    wv(ws, row, SC.PLAYER, name);

    wf(ws, row, SC.PLAYED,
      `=COUNTIFS(${stR},"Complete",${p1R},${pRef})+COUNTIFS(${stR},"Complete",${p2R},${pRef})`,
      S.formula);
    wf(ws, row, SC.WON,
      `=COUNTIF(${wiR},${pRef})`,
      S.formula);
    wf(ws, row, SC.LOST,
      `=C${er}-D${er}`,
      S.formula);
    wf(ws, row, SC.WIN_PCT,
      `=IF(C${er}=0,0,D${er}/C${er})`,
      S.formula, '0%');
    wf(ws, row, SC.SETS_W,
      `=SUMIF(${p1R},${pRef},${s1R})+SUMIF(${p2R},${pRef},${s2R})`,
      S.formula);
    wf(ws, row, SC.SETS_L,
      `=SUMIF(${p1R},${pRef},${s2R})+SUMIF(${p2R},${pRef},${s1R})`,
      S.formula);
    wf(ws, row, SC.SET_DIFF,
      `=G${er}-H${er}`,
      S.formula);
    wf(ws, row, SC.PTS_FOR,
      `=SUMIF(${p1R},${pRef},${pf1R})+SUMIF(${p2R},${pRef},${pf2R})`,
      S.formula);
    wf(ws, row, SC.PTS_AGAINST,
      `=SUMIF(${p1R},${pRef},${pf2R})+SUMIF(${p2R},${pRef},${pf1R})`,
      S.formula);
    wf(ws, row, SC.PT_DIFF,
      `=J${er}-K${er}`,
      S.formula);
    // Hidden helper score for ranking: wins*100000 + setDiff*1000 + ptDiff
    wf(ws, row, SC._SCORE,
      `=D${er}*100000+I${er}*1000+L${er}`);
    // Rank
    wf(ws, row, SC.RANK,
      `=IFERROR(RANK(M${er},$M$${sdStart}:$M$${sdEnd},0),"")`,
      S.formula);
    row++;
  }

  return row;
}

/* ─── Player extraction ──────────────────────────────────────────────────────── */
function playersFromMatches(matches: Match[], getName: GetName, catId: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of matches) {
    for (const pid of [m.participant1Id, m.participant2Id]) {
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        names.push(getName(pid, m.status, catId));
      }
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/* ─── Category sheet (non-pool) ──────────────────────────────────────────────── */
function buildCategorySheet(
  cat: Category,
  matches: Match[],
  gpm: number,
  getName: GetName,
  courts: Court[],
): WS {
  const ws: WS = {};
  let row = 0;

  const { nextRow, dataStart, dataEnd } = writeMatchSection(
    ws, row, `── ${cat.name} — GAMES & RESULTS ──`, matches, gpm, getName, courts, cat.id,
  );

  row = nextRow + 1; // blank separator row

  const players = playersFromMatches(matches, getName, cat.id);
  const finalRow = writeStandingsSection(
    ws, row, `── ${cat.name} — LEADERBOARD ──`, players, dataStart, dataEnd, gpm,
  );

  setRange(ws, finalRow, statusCol(gpm));
  ws['!cols'] = matchColWidths(gpm);
  lockSheet(ws);
  return ws;
}

/* ─── Pool sheet ─────────────────────────────────────────────────────────────── */
function buildPoolSheet(
  cat: Category,
  poolMatches: Match[],
  gpm: number,
  getName: GetName,
  courts: Court[],
): WS {
  const ws: WS = {};
  let row = 0;

  // Group matches by groupId
  const groupMap = new Map<string, Match[]>();
  for (const m of poolMatches) {
    const key = m.groupId ?? 'ungrouped';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(m);
  }

  const groupIds = [...groupMap.keys()].sort();
  const poolLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (let i = 0; i < groupIds.length; i++) {
    const gid = groupIds[i];
    const gMatches = groupMap.get(gid)!;
    const label = `Pool ${poolLabels[i] ?? gid}`;

    // Standings first (compact — players see who's ahead)
    const players = playersFromMatches(gMatches, getName, cat.id);

    const matchResult = writeMatchSection(
      ws, row, `── ${label} — MATCHES ──`, gMatches, gpm, getName, courts, cat.id,
    );

    // Standings below matches
    const standingsStartRow = matchResult.nextRow + 1;
    const finalRow = writeStandingsSection(
      ws, standingsStartRow, `── ${label} — STANDINGS ──`,
      players, matchResult.dataStart, matchResult.dataEnd, gpm,
    );

    row = finalRow + 2; // blank separator between groups
  }

  setRange(ws, row, statusCol(gpm));
  ws['!cols'] = matchColWidths(gpm);
  lockSheet(ws);
  return ws;
}

/* ─── Bracket sheet ──────────────────────────────────────────────────────────── */
function buildBracketSheet(
  cat: Category,
  bracketMatches: Match[],
  gpm: number,
  getName: GetName,
  courts: Court[],
): WS {
  const ws: WS = {};
  let row = 0;

  const { nextRow, dataStart, dataEnd } = writeMatchSection(
    ws, row, `── ${cat.name} — BRACKET MATCHES ──`, bracketMatches, gpm, getName, courts, cat.id,
  );

  row = nextRow + 1;

  const players = playersFromMatches(bracketMatches, getName, cat.id);
  const finalRow = writeStandingsSection(
    ws, row, `── ${cat.name} — FINAL STANDINGS ──`, players, dataStart, dataEnd, gpm,
  );

  setRange(ws, finalRow, statusCol(gpm));
  ws['!cols'] = matchColWidths(gpm);
  lockSheet(ws);
  return ws;
}

/* ─── Overview sheet ─────────────────────────────────────────────────────────── */
function buildOverviewSheet(
  tournament: Tournament,
  categories: Category[],
  matches: Match[],
): WS {
  const ws: WS = {};
  let row = 0;

  wv(ws, row++, 0, `${tournament.name} — Tournament Backup`, S.sectionHead);
  wv(ws, row++, 0, `Generated: ${new Date().toLocaleString()}`);
  wv(ws, row++, 0, `Status: ${tournament.status}`);
  wv(ws, row++, 0, `Location: ${tournament.location ?? '—'}`);
  wv(ws, row++, 0, `Dates: ${fmtDate(tournament.startDate)} – ${fmtDate(tournament.endDate)}`);
  row++;

  wv(ws, row, 0, 'Category', S.header);
  wv(ws, row, 1, 'Format', S.header);
  wv(ws, row, 2, 'Total Matches', S.header);
  wv(ws, row, 3, 'Completed', S.header);
  wv(ws, row, 4, 'Pending', S.header);
  row++;

  let totalMatches = 0;
  let totalCompleted = 0;

  for (const cat of categories) {
    const catMatches = matches.filter(m => m.categoryId === cat.id);
    const completed = catMatches.filter(m => m.status === 'completed' || m.status === 'walkover').length;
    totalMatches += catMatches.length;
    totalCompleted += completed;

    wv(ws, row, 0, cat.name);
    wv(ws, row, 1, cat.format.replace(/_/g, ' '));
    wv(ws, row, 2, catMatches.length);
    wv(ws, row, 3, completed);
    wv(ws, row, 4, catMatches.length - completed);
    row++;
  }

  row++;
  wv(ws, row, 0, 'TOTAL', S.sectionHead);
  wv(ws, row, 2, totalMatches, S.sectionHead);
  wv(ws, row, 3, totalCompleted, S.sectionHead);
  wv(ws, row, 4, totalMatches - totalCompleted, S.sectionHead);
  row++;

  row++;
  wv(ws, row++, 0, '★ Yellow cells in category tabs = score entry cells', S.sectionHead);
  wv(ws, row++, 0, 'All other cells are read-only. Enter scores in G/H columns (Game 1), I/J (Game 2), K/L (Game 3).');
  wv(ws, row++, 0, 'Leaderboard recalculates automatically as you enter scores.');

  setRange(ws, row, 4);
  ws['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  lockSheet(ws);
  return ws;
}

/* ─── Main export function ───────────────────────────────────────────────────── */
export function downloadTournamentBackup(
  tournament: Tournament,
  matches: Match[],
  categories: Category[],
  courts: Court[],
  getName: GetName,
): void {
  const wb = XLSX.utils.book_new();

  // Overview tab
  XLSX.utils.book_append_sheet(wb, buildOverviewSheet(tournament, categories, matches), 'Overview');

  for (const cat of categories) {
    const catMatches = matches.filter(m => m.categoryId === cat.id);
    if (catMatches.length === 0) continue;

    const gpm = getGPM(cat, tournament);

    if (cat.format === 'pool_to_elimination') {
      const poolStageId = cat.poolStageId != null ? String(cat.poolStageId) : null;
      const elimStageId = cat.eliminationStageId != null ? String(cat.eliminationStageId) : null;

      const poolMatches = poolStageId
        ? catMatches.filter(m => m.stageId != null && String(m.stageId) === poolStageId)
        : catMatches.filter(m => m.groupId != null);

      const bracketMatches = elimStageId
        ? catMatches.filter(m => m.stageId != null && String(m.stageId) === elimStageId)
        : catMatches.filter(m => !poolMatches.includes(m));

      if (poolMatches.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          buildPoolSheet(cat, poolMatches, gpm, getName, courts),
          safeSheetName(`${cat.name} - Pools`),
        );
      }
      if (bracketMatches.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          buildBracketSheet(cat, bracketMatches, gpm, getName, courts),
          safeSheetName(`${cat.name} - Bracket`),
        );
      }
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        buildCategorySheet(cat, catMatches, gpm, getName, courts),
        safeSheetName(cat.name),
      );
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `backup-${safeFilename(tournament.name)}-${date}.xlsx`, { cellStyles: true });
}
