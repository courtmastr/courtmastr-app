export interface VitestRunSummary {
  filesPassed: number;
  testsPassed: number;
}

export interface E2ERunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface RunSummary {
  generatedAt: string;
  scope: 'full-release' | 'custom';
  vitest: VitestRunSummary;
  e2e: E2ERunSummary;
}

export const TEST_RUN_SUMMARY_PATH: string;

export function buildRunSummary(args: {
  vitest: VitestRunSummary;
  e2e: E2ERunSummary;
  scope?: 'full-release' | 'custom';
  generatedAt?: string;
}): RunSummary;

export function parseVitestOutput(output: string): VitestRunSummary;
export function parsePlaywrightOutput(output: string): E2ERunSummary;
export function writeRunSummary(summary: RunSummary, summaryPath?: string): void;
