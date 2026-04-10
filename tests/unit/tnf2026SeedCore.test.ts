import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTNF2026Workbook } from '../../scripts/seed/tnf2026-core';

describe('parseTNF2026Workbook', () => {
  it('uses the authoritative women\'s doubles corrections and seeds', () => {
    const workbookPath = path.resolve(process.cwd(), 'TNF_Final_List_2026.xlsx');

    const parsedWorkbook = parseTNF2026Workbook(workbookPath);
    const womenDoublesRegistrations = parsedWorkbook.registrations
      .filter((registration) => registration.categoryKey === 'WD')
      .map((registration) => ({
        teamName: registration.participants.map((participant) => participant.name).join(' / '),
        seed: registration.seed,
      }));

    expect(womenDoublesRegistrations).toHaveLength(15);
    expect(womenDoublesRegistrations).toContainEqual({
      teamName: 'Kirthika Chockalingam / Akshaya Ramamoorthi',
      seed: 6,
    });
    expect(womenDoublesRegistrations).toContainEqual({
      teamName: 'Indu Kishore / Vinodhini Nirmal',
      seed: 13,
    });
    expect(womenDoublesRegistrations).toContainEqual({
      teamName: 'Levanshia Anthonysamy / Bhavana Sivakumar',
      seed: 5,
    });
    expect(womenDoublesRegistrations).not.toContainEqual({
      teamName: 'Kishore Subbarao / Na Na',
      seed: null,
    });
    expect(womenDoublesRegistrations.map((registration) => registration.seed)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });
});
