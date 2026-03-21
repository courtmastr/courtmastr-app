/**
 * csvParser.ts — Pure CSV import parsing for player registration.
 *
 * All functions are pure (no Vue reactivity, no Firebase) to enable
 * straightforward unit testing.
 */

import type { Category } from '@/types';

export interface ImportPreviewRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skillLevel: number;
  categoryName: string;
  categoryId: string | null;
  participantType: 'player' | 'team';
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
  partnerPhone: string;
  partnerSkillLevel: number | null;
  valid: boolean;
}

export interface ParseResult {
  preview: ImportPreviewRow[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helper utilities (exported for testing)
// ---------------------------------------------------------------------------

export function normalizeEmail(email?: string): string {
  return (email || '').trim().toLowerCase();
}

export function buildPlayerNameKey(firstName: string, lastName: string, phone?: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${(phone || '').trim().toLowerCase()}`;
}

export function normalizeCategoryName(categoryName: string): string {
  return categoryName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findCategoryByName(
  categoryName: string,
  categories: Category[]
): Category | undefined {
  const trimmedName = categoryName.trim();
  if (!trimmedName) return undefined;

  const exact = categories.find(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (exact) return exact;

  const normalizedInput = normalizeCategoryName(trimmedName);
  return categories.find((c) => normalizeCategoryName(c.name) === normalizedInput);
}

export function parseSkillLevel(
  raw: string,
  lineNumber: number,
  fieldName: string,
  errors: string[]
): number | null {
  if (!raw.trim()) return null;
  const parsed = parseInt(raw.trim(), 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 10) {
    errors.push(`Row ${lineNumber}: ${fieldName} must be 1-10`);
    return null;
  }
  return parsed;
}

export function parseImportColumns(line: string): string[] {
  if (line.includes(',')) {
    return line.split(',').map((v) => v.trim());
  }
  if (line.includes('|')) {
    return line.split('|').map((v) => v.trim());
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export function parseImportText(text: string, categories: Category[]): ParseResult {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));

  const errors: string[] = [];
  const preview: ImportPreviewRow[] = [];

  if (lines.length === 0) {
    return {
      preview: [],
      errors: ['No data found. Upload a file or paste rows to continue'],
    };
  }

  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('first name') ||
    firstLine.includes('last name') ||
    firstLine.includes('email') ||
    firstLine.includes('category');

  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const lineNumber = hasHeader ? i + 2 : i + 1;
    let firstName = '';
    let lastName = '';
    let email = '';
    let phone = '';
    let skillLevel = 5;
    let categoryName = '';
    let partnerFirstName = '';
    let partnerLastName = '';
    let partnerEmail = '';
    let partnerPhone = '';
    let partnerSkillLevel: number | null = null;

    const values = parseImportColumns(line);
    if (values.length > 0) {
      const skillLevelRaw = values[4] || '';
      const partnerSkillLevelRaw = values[10] || '';
      [
        firstName,
        lastName,
        email = '',
        phone = '',
        ,
        categoryName = '',
        partnerFirstName = '',
        partnerLastName = '',
        partnerEmail = '',
        partnerPhone = '',
      ] = values;

      const parsedSkill = parseSkillLevel(skillLevelRaw, lineNumber, 'Skill Level', errors);
      if (parsedSkill === null && skillLevelRaw.trim()) continue;
      skillLevel = parsedSkill ?? 5;

      const parsedPartnerSkill = parseSkillLevel(
        partnerSkillLevelRaw,
        lineNumber,
        'Partner Skill Level',
        errors
      );
      if (parsedPartnerSkill === null && partnerSkillLevelRaw.trim()) continue;
      partnerSkillLevel = parsedPartnerSkill;
    } else {
      // TXT-format rows (space-delimited) cannot carry email, which is now required.
      errors.push(
        `Row ${lineNumber}: TXT format cannot include email — use CSV format (comma or pipe-delimited with email in column 3)`
      );
      continue;
    }

    if (!firstName || !lastName) {
      errors.push(`Row ${lineNumber}: First Name and Last Name are required`);
      continue;
    }

    // Email is required for global player identity linking
    if (!email.trim()) {
      errors.push(`Row ${lineNumber}: Email is required for player identity linking`);
      continue;
    }

    const hasAnyPartnerField = Boolean(
      partnerFirstName || partnerLastName || partnerEmail || partnerPhone || partnerSkillLevel !== null
    );
    const hasPartnerName = Boolean(partnerFirstName && partnerLastName);

    if (hasAnyPartnerField && !hasPartnerName) {
      errors.push(
        `Row ${lineNumber}: Partner First Name and Partner Last Name are both required for doubles`
      );
      continue;
    }

    // Partner email is required when a partner is specified
    if (hasPartnerName && !partnerEmail.trim()) {
      errors.push(`Row ${lineNumber}: Partner Email is required for player identity linking`);
      continue;
    }

    if (
      hasPartnerName &&
      normalizeEmail(email) &&
      normalizeEmail(email) === normalizeEmail(partnerEmail)
    ) {
      errors.push(`Row ${lineNumber}: Player and partner email cannot be the same`);
      continue;
    }

    let matchedCategory: Category | undefined;
    if (categoryName) {
      matchedCategory = findCategoryByName(categoryName, categories);
      if (!matchedCategory) {
        errors.push(`Row ${lineNumber}: Category "${categoryName}" not found`);
        continue;
      }

      const isCategoryDoubles =
        matchedCategory.type === 'doubles' || matchedCategory.type === 'mixed_doubles';
      if (isCategoryDoubles && !hasPartnerName) {
        errors.push(
          `Row ${lineNumber}: ${matchedCategory.name} requires partner columns in the same row`
        );
        continue;
      }
      if (!isCategoryDoubles && hasPartnerName) {
        errors.push(
          `Row ${lineNumber}: Partner columns are only allowed for doubles/mixed doubles categories`
        );
        continue;
      }
    }

    preview.push({
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      skillLevel,
      categoryName: categoryName || '',
      categoryId: matchedCategory?.id || null,
      participantType: hasPartnerName ? 'team' : 'player',
      partnerFirstName,
      partnerLastName,
      partnerEmail: partnerEmail || '',
      partnerPhone: partnerPhone || '',
      partnerSkillLevel: hasPartnerName ? (partnerSkillLevel ?? skillLevel) : null,
      valid: true,
    });
  }

  return { preview, errors };
}
