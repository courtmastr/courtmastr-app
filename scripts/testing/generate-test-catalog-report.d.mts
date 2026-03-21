import type { Catalog, InventoryEntry, ResolvedCatalogCase } from './catalog-utils.mjs';
import type { RunSummary } from './write-test-run-summary.mjs';

export interface CatalogSummary {
  totalAutomated: number;
  totalE2E: number;
  totalUnit: number;
  totalIntegration: number;
  totalReleaseRequired: number;
  releaseCovered: number;
  workflows: Map<string, {
    total: number;
    releaseRequired: number;
    coveredLayers: Set<string>;
    cases: ResolvedCatalogCase[];
  }>;
  runSummary: RunSummary | null;
}

export interface InventorySummary {
  filesTotal: number;
  testsTotal: number;
  e2eFiles: number;
  unitFiles: number;
  integrationFiles: number;
  e2eTests: number;
  unitTests: number;
  integrationTests: number;
}

export const TESTING_DOCS_DIR: string;
export const MARKDOWN_REPORT_PATH: string;
export const HTML_REPORT_PATH: string;
export const RUN_SUMMARY_PATH: string;

export function summarizeCatalog(args: {
  catalog: Catalog;
  resolvedCases: ResolvedCatalogCase[];
  runSummary?: RunSummary | null;
}): CatalogSummary;

export function summarizeInventory(inventory?: InventoryEntry[]): InventorySummary;

export function buildMarkdownReport(args: {
  catalog: Pick<Catalog, 'workflows'>;
  resolvedCases: ResolvedCatalogCase[];
  inventory?: Pick<InventoryEntry, 'layer' | 'test_file' | 'matchedTitles'>[];
  runSummary?: RunSummary | null;
  generatedAt?: string;
}): string;

export function buildHtmlReport(args: {
  catalog: Pick<Catalog, 'workflows'>;
  resolvedCases: ResolvedCatalogCase[];
  inventory?: Pick<InventoryEntry, 'layer' | 'test_file' | 'matchedTitles'>[];
  runSummary?: RunSummary | null;
  generatedAt?: string;
}): string;

export function writeReports(args: {
  markdown: string;
  html: string;
  markdownPath?: string;
  htmlPath?: string;
}): void;

export function loadRunSummary(summaryPath?: string): RunSummary | null;

export function generateAndWriteReports(args: {
  catalog: Catalog;
  resolvedCases: ResolvedCatalogCase[];
  inventory?: InventoryEntry[];
  runSummary?: RunSummary | null;
  generatedAt?: string;
  markdownPath?: string;
  htmlPath?: string;
}): Promise<{ markdown: string; html: string }>;
