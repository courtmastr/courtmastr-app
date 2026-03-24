export type Workflow =
  | 'registration'
  | 'check-in'
  | 'scheduling'
  | 'publish'
  | 'match-control'
  | 'scoring'
  | 'public-views'
  | 'auth-roles'
  | 'leaderboard';

export type Layer = 'unit' | 'integration' | 'e2e' | 'unknown';
export type Risk = 'critical' | 'high' | 'medium' | 'low';
export type AutomationStatus = 'active' | 'retired';

export interface CatalogCase {
  id: string;
  title: string;
  workflow: Workflow;
  feature: string;
  risk: Risk;
  layer: Exclude<Layer, 'unknown'>;
  automation_status: AutomationStatus;
  required_for_release: boolean;
  test_file: string;
  test_name_pattern: string;
  notes?: string;
}

export interface Catalog {
  version: 1;
  generatedAt?: string | null;
  workflows: Workflow[];
  cases: CatalogCase[];
}

export interface InventoryEntry {
  test_file: string;
  absoluteFilePath: string;
  layer: Layer;
  hasFile: boolean;
  matchedTitles: string[];
}

export interface ResolvedCatalogCase extends CatalogCase {
  matchedTitles: string[];
  hasFile: boolean;
  hasMatch: boolean;
  validationErrors: string[];
}

export const WORKFLOWS: Workflow[];
export const LAYERS: Exclude<Layer, 'unknown'>[];
export const RISKS: Risk[];
export const AUTOMATION_STATUSES: AutomationStatus[];
export const CATALOG_PATH: string;

export function loadCatalog(catalogPath?: string): Promise<Catalog>;
export function validateCatalog(catalog: unknown): string[];
export function resolveCatalogAgainstInventory(
  catalog: Catalog | null | undefined,
  inventory: InventoryEntry[] | null | undefined,
): ResolvedCatalogCase[];
