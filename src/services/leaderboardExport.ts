/**
 * Leaderboard Export Service
 *
 * Handles CSV and JSON export of leaderboard data.
 * PDF export is deferred to P2.
 */

import type { Leaderboard, LeaderboardEntry, ExportOptions } from '@/types/leaderboard';

const CSV_COLUMNS: { key: keyof LeaderboardEntry; header: string }[] = [
  { key: 'rank', header: 'Rank' },
  { key: 'participantName', header: 'Participant' },
  { key: 'categoryName', header: 'Category' },
  { key: 'matchesPlayed', header: 'Played' },
  { key: 'matchesWon', header: 'Won' },
  { key: 'matchesLost', header: 'Lost' },
  { key: 'winRate', header: 'Win%' },
  { key: 'matchPoints', header: 'Match Pts' },
  { key: 'gamesWon', header: 'Games Won' },
  { key: 'gamesLost', header: 'Games Lost' },
  { key: 'gameDifference', header: 'Game +/-' },
  { key: 'pointsFor', header: 'Points For' },
  { key: 'pointsAgainst', header: 'Points Against' },
  { key: 'pointDifference', header: 'Point +/-' },
  { key: 'eliminated', header: 'Eliminated' },
  { key: 'eliminationRound', header: 'Elimination Round' },
];

export async function exportLeaderboard(
  leaderboard: Leaderboard,
  options: ExportOptions
): Promise<void> {
  const filename =
    options.filename ??
    `leaderboard-${leaderboard.tournamentId}-${Date.now()}`;

  if (options.format === 'csv') {
    const header = CSV_COLUMNS.map((c) => c.header).join(',');
    const rows = leaderboard.entries.map((entry) =>
      CSV_COLUMNS.map((c) => {
        const val = entry[c.key];
        // Wrap strings that contain commas in quotes
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return String(val ?? '');
      }).join(',')
    );
    downloadText([header, ...rows].join('\n'), `${filename}.csv`, 'text/csv');
  } else if (options.format === 'json') {
    downloadText(
      JSON.stringify(leaderboard, null, 2),
      `${filename}.json`,
      'application/json'
    );
  }
}

function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
