import { execSync } from 'node:child_process';
import { buildRunSummary, parsePlaywrightOutput, parseVitestOutput, writeRunSummary, TEST_RUN_SUMMARY_PATH } from './write-test-run-summary.mjs';
import { generateAndWriteReports } from './generate-test-catalog-report.mjs';

export const DEFAULT_COMMANDS = {
  vitest: process.env.VERIFY_RELEASE_VITEST_COMMAND || 'npm run test -- --run',
  e2e: process.env.VERIFY_RELEASE_E2E_COMMAND || 'npx playwright test',
};

export const runReleaseVerification = async ({
  commands = DEFAULT_COMMANDS,
  runCommand = (command) => execSync(command, { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 }),
  generateReports = generateAndWriteReports,
  loadCatalog,
  validateCatalog,
  collectTestInventory,
  resolveCatalogAgainstInventory,
  summaryPath = TEST_RUN_SUMMARY_PATH,
}) => {
  const catalog = await loadCatalog();
  const validationErrors = validateCatalog(catalog) ?? [];
  if (validationErrors.length > 0) {
    throw new Error(`Invalid test catalog: ${validationErrors.join(', ')}`);
  }

  const inventory = await collectTestInventory();
  const resolvedCases = resolveCatalogAgainstInventory(catalog, inventory);
  const missingReleaseCoverage = resolvedCases.filter((entry) =>
    entry.automation_status === 'active'
    && entry.required_for_release
    && (!entry.hasFile || !entry.hasMatch),
  );

  if (missingReleaseCoverage.length > 0) {
    throw new Error(`Release catalog has missing coverage: ${missingReleaseCoverage.map((entry) => entry.id).join(', ')}`);
  }

  const vitestOutput = runCommand(commands.vitest);
  const vitest = parseVitestOutput(vitestOutput);

  const e2eOutput = runCommand(commands.e2e);
  const e2e = parsePlaywrightOutput(e2eOutput);

  if (e2e.failed > 0) {
    throw new Error(`E2E run failed: ${e2e.failed} failing test(s)`);
  }

  const runSummary = buildRunSummary({
    vitest,
    e2e,
    scope:
      commands.vitest === DEFAULT_COMMANDS.vitest && commands.e2e === DEFAULT_COMMANDS.e2e
        ? 'full-release'
        : 'custom',
  });
  writeRunSummary(runSummary, summaryPath);
  await generateReports({ catalog, resolvedCases, inventory, runSummary });

  return {
    runSummary,
    resolvedCases,
  };
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { loadCatalog, validateCatalog } = await import('./catalog-utils.mjs');
  const { collectTestInventory, resolveCatalogAgainstInventory } = await import('./resolve-test-inventory.mjs');
  const result = await runReleaseVerification({
    loadCatalog,
    validateCatalog,
    collectTestInventory,
    resolveCatalogAgainstInventory,
  });

  console.log(`Vitest: ${result.runSummary.vitest.testsPassed}/${result.runSummary.vitest.testsPassed} passed`);
  console.log(`E2E: ${result.runSummary.e2e.passed}/${result.runSummary.e2e.total} passed`);
}
