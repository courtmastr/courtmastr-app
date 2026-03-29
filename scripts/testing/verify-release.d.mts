import type { Catalog, InventoryEntry, ResolvedCatalogCase } from './catalog-utils.mjs';
import type { ReleaseMetadata } from './release-notes-utils.mjs';
import type { RunSummary } from './write-test-run-summary.mjs';

export interface ReleaseCommands {
  vitest: string;
  e2e: string;
}

export interface ReleaseVerificationResult {
  runSummary: RunSummary;
  resolvedCases: ResolvedCatalogCase[];
}

export const DEFAULT_COMMANDS: ReleaseCommands;

export function runReleaseVerification(args: {
  commands?: ReleaseCommands;
  runCommand?: (command: string) => string;
  generateReports?: (args: {
    catalog: Catalog;
    resolvedCases: ResolvedCatalogCase[];
    inventory: InventoryEntry[];
    runSummary: RunSummary;
  }) => Promise<unknown>;
  verifyReleaseMetadata?: () => ReleaseMetadata;
  loadCatalog: () => Promise<Catalog> | Catalog;
  validateCatalog: (catalog: unknown) => string[];
  collectTestInventory: () => Promise<InventoryEntry[]> | InventoryEntry[];
  resolveCatalogAgainstInventory: (
    catalog: Catalog,
    inventory: InventoryEntry[],
  ) => ResolvedCatalogCase[];
  summaryPath?: string;
}): Promise<ReleaseVerificationResult>;
