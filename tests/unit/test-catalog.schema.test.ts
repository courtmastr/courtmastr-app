import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const catalogPath = path.resolve(process.cwd(), 'docs/testing/test-catalog.json');

describe('test catalog schema', () => {
  it('loads a valid catalog document with seeded entries', async () => {
    const raw = await readFile(catalogPath, 'utf8');
    const catalog = JSON.parse(raw) as {
      version: number;
      generatedAt: null | string;
      workflows: string[];
      cases: Array<{ id: string; title: string; workflow: string; layer: string; required_for_release: boolean }>;
    };

    expect(catalog.version).toBe(1);
    expect(catalog.generatedAt).toBeNull();
    expect(Array.isArray(catalog.workflows)).toBe(true);
    expect(Array.isArray(catalog.cases)).toBe(true);
    expect(catalog.workflows.length).toBeGreaterThan(0);
    expect(catalog.cases.length).toBeGreaterThan(0);

    const ids = new Set(catalog.cases.map((entry) => entry.id));
    expect(ids.size).toBe(catalog.cases.length);
    expect(catalog.cases.every((entry) => entry.title.length > 0)).toBe(true);
    expect(catalog.cases.every((entry) => entry.workflow.length > 0)).toBe(true);
    expect(catalog.cases.every((entry) => entry.layer.length > 0)).toBe(true);
    expect(catalog.cases.every((entry) => typeof entry.required_for_release === 'boolean')).toBe(true);
  });
});
