import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCatalog } from '../../scripts/testing/catalog-utils.mjs';

const catalogPath = path.resolve(process.cwd(), 'docs/testing/test-catalog.json');

describe('test catalog validation', () => {
  it('accepts the seeded catalog', async () => {
    const raw = await readFile(catalogPath, 'utf8');
    const catalog = JSON.parse(raw);
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it('rejects duplicate ids and invalid enum values', () => {
    const errors = validateCatalog({
      version: 1,
      workflows: ['registration'],
      cases: [
        {
          id: 'dup',
          title: 'One',
          workflow: 'registration',
          feature: 'feature',
          risk: 'low',
          layer: 'unit',
          automation_status: 'active',
          required_for_release: true,
          test_file: 'tests/unit/a.test.ts',
          test_name_pattern: 'One',
        },
        {
          id: 'dup',
          title: 'Two',
          workflow: 'not-a-workflow',
          feature: 'feature',
          risk: 'invalid-risk',
          layer: 'invalid-layer',
          automation_status: 'invalid-status',
          required_for_release: false,
          test_file: 'tests/unit/b.test.ts',
          test_name_pattern: 'Two',
        },
      ],
    });

    expect(errors).toContain('cases[1].id must be unique.');
    expect(errors.some((error) => error.includes('cases[1].workflow must be one of:'))).toBe(true);
    expect(errors.some((error) => error.includes('cases[1].layer must be one of:'))).toBe(true);
    expect(errors.some((error) => error.includes('cases[1].risk must be one of:'))).toBe(true);
    expect(errors.some((error) => error.includes('cases[1].automation_status must be one of:'))).toBe(true);
  });
});
