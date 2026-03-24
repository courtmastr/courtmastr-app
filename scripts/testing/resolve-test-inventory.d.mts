import type { Catalog, InventoryEntry, ResolvedCatalogCase } from './catalog-utils.mjs';

export function collectTestInventory(rootDir?: string): Promise<InventoryEntry[]>;
export function resolveCatalogAgainstInventory(
  catalog: Catalog | null | undefined,
  inventory: InventoryEntry[] | null | undefined,
): ResolvedCatalogCase[];
