import { describe, expect, it } from 'vitest';
import {
  loadCatalog,
  resolveCatalogAgainstInventory,
} from '../../scripts/testing/catalog-utils.mjs';
import { collectTestInventory } from '../../scripts/testing/resolve-test-inventory.mjs';

describe('test catalog inventory resolution', () => {
  it('resolves the seeded catalog against real repo tests', async () => {
    const catalog = await loadCatalog();
    const inventory = await collectTestInventory(process.cwd());
    const resolved = resolveCatalogAgainstInventory(catalog, inventory);

    expect(inventory.some((entry) => entry.layer === 'e2e')).toBe(true);
    expect(inventory.some((entry) => entry.layer === 'unit')).toBe(true);
    expect(resolved.every((entry) => entry.hasFile)).toBe(true);
    expect(resolved.every((entry) => entry.hasMatch)).toBe(true);
    expect(resolved.every((entry) => entry.validationErrors.length === 0)).toBe(true);
  });

  it('flags a missing file and pattern mismatch clearly', async () => {
    const catalog = await loadCatalog();
    const inventory = await collectTestInventory(process.cwd());
    const brokenCatalog = {
      ...catalog,
      cases: [
        ...catalog.cases.slice(0, 1),
        {
          ...catalog.cases[0],
          id: 'broken.entry',
          test_file: 'tests/unit/does-not-exist.test.ts',
          test_name_pattern: 'missing test title',
        },
      ],
    };

    const resolved = resolveCatalogAgainstInventory(brokenCatalog, inventory);
    const broken = resolved.find((entry) => entry.id === 'broken.entry');

    expect(broken).toBeDefined();
    expect(broken?.hasFile).toBe(false);
    expect(broken?.hasMatch).toBe(false);
  });
});
