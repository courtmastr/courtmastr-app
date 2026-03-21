/**
 * csvParser unit tests
 *
 * Tests the pure parseImportText function for email-required validation
 * and other CSV parsing behaviours.
 */

import { describe, it, expect } from 'vitest';
import { parseImportText } from '@/features/registration/utils/csvParser';
import type { Category } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCategory(
  id: string,
  name: string,
  type: 'singles' | 'doubles' | 'mixed_doubles' = 'singles'
): Category {
  return {
    id,
    tournamentId: 't1',
    name,
    type,
    gender: 'men',
    ageGroup: 'open',
    maxParticipants: 32,
    registeredCount: 0,
    status: 'active',
    scoringConfig: { pointsToWin: 21, mustWinBy: 2, maxPoints: 30, gamesPerMatch: 3 },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Category;
}

const singlesCategory = makeCategory('cat-singles', "Men's Singles", 'singles');
const doublesCategory = makeCategory('cat-doubles', "Men's Doubles", 'doubles');
const categories = [singlesCategory, doublesCategory];

const HEADER = "First Name,Last Name,Email,Phone,Skill Level (1-10),Category,Partner First Name,Partner Last Name,Partner Email,Partner Phone,Partner Skill Level (1-10)";

function csvRow(fields: string[]): string {
  return `${HEADER}\n${fields.join(',')}`;
}

// ---------------------------------------------------------------------------
// Email required — singles
// ---------------------------------------------------------------------------

describe('parseImportText — email required (singles)', () => {
  it('rejects a row with missing email', () => {
    const text = csvRow(['John', 'Doe', '', '555-1234', '7', "Men's Singles", '', '', '', '', '']);
    const { preview, errors } = parseImportText(text, categories);

    expect(preview).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 2.*Email is required/i);
  });

  it('rejects a row with whitespace-only email', () => {
    const text = csvRow(['John', 'Doe', '   ', '555-1234', '7', "Men's Singles", '', '', '', '', '']);
    const { preview, errors } = parseImportText(text, categories);

    expect(preview).toHaveLength(0);
    expect(errors.some((e) => /email is required/i.test(e))).toBe(true);
  });

  it('accepts a row with a valid email', () => {
    const text = csvRow(['John', 'Doe', 'john@test.com', '555-1234', '7', "Men's Singles", '', '', '', '', '']);
    const { preview, errors } = parseImportText(text, categories);

    expect(errors).toHaveLength(0);
    expect(preview).toHaveLength(1);
    expect(preview[0].email).toBe('john@test.com');
  });

  it('accepts multiple valid rows', () => {
    const text = `${HEADER}
Alice,Smith,alice@test.com,,,
Bob,Jones,bob@test.com,,,`;
    const { preview, errors } = parseImportText(text, categories);

    expect(errors).toHaveLength(0);
    expect(preview).toHaveLength(2);
  });

  it('reports per-row line numbers correctly when header is present', () => {
    const text = `${HEADER}
Alice,Smith,alice@test.com,,,
Bob,Jones,,,,`;
    const { errors } = parseImportText(text, categories);

    // Bob is on line 3 (header=1, alice=2, bob=3)
    expect(errors[0]).toMatch(/Row 3.*Email is required/i);
  });
});

// ---------------------------------------------------------------------------
// Email required — doubles / partner
// ---------------------------------------------------------------------------

describe('parseImportText — partner email required (doubles)', () => {
  it('rejects a doubles row where partner email is missing', () => {
    const text = csvRow([
      'Alice', 'Smith', 'alice@test.com', '', '7', "Men's Doubles",
      'Bob', 'Jones', '', '', '7',
    ]);
    const { preview, errors } = parseImportText(text, categories);

    expect(preview).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Partner Email is required/i);
  });

  it('accepts a doubles row where both player and partner emails are present', () => {
    const text = csvRow([
      'Alice', 'Smith', 'alice@test.com', '', '7', "Men's Doubles",
      'Bob', 'Jones', 'bob@test.com', '', '7',
    ]);
    const { preview, errors } = parseImportText(text, categories);

    expect(errors).toHaveLength(0);
    expect(preview).toHaveLength(1);
    expect(preview[0].participantType).toBe('team');
    expect(preview[0].partnerEmail).toBe('bob@test.com');
  });

  it('still rejects when player and partner share the same email', () => {
    const text = csvRow([
      'Alice', 'Smith', 'same@test.com', '', '7', "Men's Doubles",
      'Bob', 'Jones', 'same@test.com', '', '7',
    ]);
    const { preview, errors } = parseImportText(text, categories);

    expect(preview).toHaveLength(0);
    expect(errors.some((e) => /same/i.test(e) || /cannot be the same/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TXT format rejection
// ---------------------------------------------------------------------------

describe('parseImportText — TXT format rejection', () => {
  it('rejects space-delimited rows because email cannot be included', () => {
    const text = 'John Doe';
    const { preview, errors } = parseImportText(text, []);

    expect(preview).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/TXT format cannot include email/i);
  });

  it('rejects pipe-less, comma-less rows even with valid first+last name', () => {
    // Pipe format is still accepted (it's pipe-delimited CSV, not TXT).
    // TXT here means no separators at all.
    const text = 'Jane Smith';
    const { preview, errors } = parseImportText(text, []);

    expect(preview).toHaveLength(0);
    expect(errors[0]).toMatch(/TXT format/i);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('parseImportText — empty input', () => {
  it('returns an error when input is empty', () => {
    const { preview, errors } = parseImportText('', categories);

    expect(preview).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no data/i);
  });

  it('ignores comment lines and blank lines', () => {
    const text = `# This is a comment\n\n# Another comment`;
    const { preview, errors } = parseImportText(text, categories);

    expect(preview).toHaveLength(0);
    expect(errors[0]).toMatch(/no data/i);
  });
});

// ---------------------------------------------------------------------------
// Other validation (existing, unaffected by email change)
// ---------------------------------------------------------------------------

describe('parseImportText — existing validations still work', () => {
  it('rejects a row missing first name', () => {
    const text = csvRow(['', 'Doe', 'john@test.com', '', '', '']);
    const { errors } = parseImportText(text, categories);

    expect(errors.some((e) => /First Name and Last Name/i.test(e))).toBe(true);
  });

  it('rejects invalid skill level', () => {
    const text = csvRow(['John', 'Doe', 'john@test.com', '', '99', '']);
    const { errors } = parseImportText(text, categories);

    expect(errors.some((e) => /Skill Level must be 1-10/i.test(e))).toBe(true);
  });

  it('rejects unknown category', () => {
    const text = csvRow(['John', 'Doe', 'john@test.com', '', '', 'Underwater Basket Weaving']);
    const { errors } = parseImportText(text, categories);

    expect(errors.some((e) => /not found/i.test(e))).toBe(true);
  });
});
