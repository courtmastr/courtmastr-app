import fs from 'node:fs';
import path from 'node:path';

export const TEST_RUN_SUMMARY_PATH = path.resolve(process.cwd(), 'docs/testing/test-run-summary.json');

export const buildRunSummary = ({
  vitest,
  e2e,
  scope = 'full-release',
  generatedAt = new Date().toISOString(),
}) => ({
  generatedAt,
  scope,
  vitest,
  e2e,
});

export const parseVitestOutput = (output) => {
  const fileMatch = output.match(/Test Files\s+(\d+)\s+passed(?:\s+\((\d+)\))?/i);
  const testsMatch = output.match(/Tests\s+(\d+)\s+passed(?:\s+\((\d+)\))?/i);

  return {
    filesPassed: fileMatch ? Number(fileMatch[1]) : 0,
    testsPassed: testsMatch ? Number(testsMatch[1]) : 0,
  };
};

export const parsePlaywrightOutput = (output) => {
  const passed = Number(output.match(/(\d+)\s+passed/i)?.[1] ?? 0);
  const failed = Number(output.match(/(\d+)\s+failed/i)?.[1] ?? 0);
  const skipped = Number(output.match(/(\d+)\s+did not run/i)?.[1] ?? 0);
  const total = passed + failed + skipped;

  return {
    total,
    passed,
    failed,
    skipped,
  };
};

export const writeRunSummary = (summary, summaryPath = TEST_RUN_SUMMARY_PATH) => {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
};
