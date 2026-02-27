import * as XLSX from 'xlsx';
import type { Match } from '@/types';
import {
  buildDisplayCodeMap,
  buildGlobalMatchKey,
} from '@/features/tournaments/utils/matchDisplayIdentity';

export interface ScheduleExportRow {
  displayCode: string;
  globalMatchKey: string;
  matchId: string;
  plannedStartDisplay: string;
  plannedEndDisplay: string;
  durationMinutes: number;
  categoryName: string;
  round: number;
  matchNumber: number;
  participant1: string;
  participant2: string;
  courtName: string;
  scheduleStatus: string;
  matchStatus: string;
}

const getPlannedStart = (match: Match): Date | undefined => match.plannedStartAt ?? match.scheduledTime;

export interface BuildScheduleExportRowsOptions {
  allMatches?: Match[];
}

export const formatExportTime = (date: Date | undefined): string => {
  if (!date) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const buildScheduleExportRows = (
  matches: Match[],
  getCategoryName: (id: string) => string,
  getParticipantName: (id: string | undefined) => string,
  getCourtName: (id: string | undefined) => string,
  options: BuildScheduleExportRowsOptions = {}
): ScheduleExportRow[] => {
  const identitySourceMatches = options.allMatches ?? matches;
  const displayCodeMap = buildDisplayCodeMap(identitySourceMatches, getCategoryName);

  const scheduled = matches
    .filter((match) => Boolean(getPlannedStart(match)))
    .sort((a, b) => {
      const startA = getPlannedStart(a)?.getTime() ?? Number.POSITIVE_INFINITY;
      const startB = getPlannedStart(b)?.getTime() ?? Number.POSITIVE_INFINITY;
      if (startA !== startB) return startA - startB;

      const courtA = getCourtName(a.courtId ?? undefined) ?? '';
      const courtB = getCourtName(b.courtId ?? undefined) ?? '';
      return courtA.localeCompare(courtB);
    });

  const unscheduled = matches.filter((match) => !getPlannedStart(match));

  const toRow = (match: Match): ScheduleExportRow => {
    const plannedStart = getPlannedStart(match);
    const plannedEnd = match.plannedEndAt;
    const globalMatchKey = buildGlobalMatchKey(match);
    const durationMinutes = plannedStart && plannedEnd
      ? Math.max(0, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60_000))
      : 0;

    return {
      displayCode: displayCodeMap.get(globalMatchKey) ?? '',
      globalMatchKey,
      matchId: match.id,
      plannedStartDisplay: formatExportTime(plannedStart),
      plannedEndDisplay: formatExportTime(plannedEnd),
      durationMinutes,
      categoryName: getCategoryName(match.categoryId),
      round: match.round,
      matchNumber: match.matchNumber,
      participant1: getParticipantName(match.participant1Id),
      participant2: getParticipantName(match.participant2Id),
      courtName: getCourtName(match.courtId ?? undefined),
      scheduleStatus: match.scheduleStatus ?? 'not_scheduled',
      matchStatus: match.status,
    };
  };

  return [...scheduled, ...unscheduled].map(toRow);
};

export const downloadScheduleAsExcel = (
  rows: ScheduleExportRow[],
  tournamentName: string
): void => {
  const headers = [
    'Display Code',
    'Global Match Key',
    'Time',
    'End Time',
    'Duration (min)',
    'Match #',
    'Category',
    'Round',
    'Participant 1',
    'Participant 2',
    'Court',
    'Schedule Status',
    'Match Status',
  ];

  const data = rows.map((row) => [
    row.displayCode,
    row.globalMatchKey,
    row.plannedStartDisplay,
    row.plannedEndDisplay,
    row.durationMinutes || '',
    row.matchNumber,
    row.categoryName,
    row.round,
    row.participant1,
    row.participant2,
    row.courtName,
    row.scheduleStatus,
    row.matchStatus,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 8 },
    { wch: 24 },
    { wch: 8 },
    { wch: 24 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

  const date = new Date().toISOString().slice(0, 10);
  const safeTournamentName = tournamentName.trim()
    ? tournamentName.replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'tournament';

  XLSX.writeFile(workbook, `schedule-${safeTournamentName}-${date}.xlsx`);
};
