import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TESTING_DOCS_DIR = path.resolve(process.cwd(), 'docs/testing');
export const MARKDOWN_REPORT_PATH = path.join(TESTING_DOCS_DIR, 'TEST_CATALOG.md');
export const HTML_REPORT_PATH = path.join(TESTING_DOCS_DIR, 'TEST_CATALOG.html');
export const RUN_SUMMARY_PATH = path.join(TESTING_DOCS_DIR, 'test-run-summary.json');

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toPosix = (value) => value.split(path.sep).join('/');

const countBy = (items, key) => {
  const counts = new Map();
  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

export const summarizeCatalog = ({ catalog, resolvedCases, runSummary = null }) => {
  const activeCases = resolvedCases.filter((entry) => entry.automation_status === 'active');
  const releaseCases = activeCases.filter((entry) => entry.required_for_release);
  const layerCounts = countBy(activeCases, 'layer');
  const workflowCounts = new Map();

  for (const workflow of catalog.workflows) {
    const cases = activeCases.filter((entry) => entry.workflow === workflow);
    const coveredLayers = new Set(cases.filter((entry) => entry.hasMatch).map((entry) => entry.layer));

    workflowCounts.set(workflow, {
      total: cases.length,
      releaseRequired: cases.filter((entry) => entry.required_for_release).length,
      coveredLayers,
      cases,
    });
  }

  return {
    totalAutomated: activeCases.length,
    totalE2E: layerCounts.get('e2e') ?? 0,
    totalUnit: layerCounts.get('unit') ?? 0,
    totalIntegration: layerCounts.get('integration') ?? 0,
    totalReleaseRequired: releaseCases.length,
    releaseCovered: releaseCases.filter((entry) => entry.hasMatch).length,
    workflows: workflowCounts,
    runSummary,
  };
};

export const summarizeInventory = (inventory = []) => {
  const layerCounts = countBy(inventory, 'layer');
  const discoveredTestsByLayer = new Map();

  for (const entry of inventory) {
    const titleCount = entry.matchedTitles?.length ?? 0;
    discoveredTestsByLayer.set(entry.layer, (discoveredTestsByLayer.get(entry.layer) ?? 0) + titleCount);
  }

  return {
    filesTotal: inventory.length,
    testsTotal: inventory.reduce((total, entry) => total + (entry.matchedTitles?.length ?? 0), 0),
    e2eFiles: layerCounts.get('e2e') ?? 0,
    unitFiles: layerCounts.get('unit') ?? 0,
    integrationFiles: layerCounts.get('integration') ?? 0,
    e2eTests: discoveredTestsByLayer.get('e2e') ?? 0,
    unitTests: discoveredTestsByLayer.get('unit') ?? 0,
    integrationTests: discoveredTestsByLayer.get('integration') ?? 0,
  };
};

const formatRunSummaryLine = (summary) => {
  if (!summary?.e2e || !summary.generatedAt || summary.e2e.total === 0) {
    return 'No run summary recorded yet.';
  }

  const scopeLabel = summary.scope && summary.scope !== 'full-release'
    ? ` (${summary.scope})`
    : '';

  return `E2E latest run${scopeLabel}: ${summary.e2e.passed}/${summary.e2e.total} passed${summary.e2e.failed ? `, ${summary.e2e.failed} failed` : ''}.`;
};

export const buildMarkdownReport = ({
  catalog,
  resolvedCases,
  inventory = [],
  runSummary = null,
  generatedAt = new Date().toISOString(),
}) => {
  const summary = summarizeCatalog({ catalog, resolvedCases, runSummary });
  const inventorySummary = summarizeInventory(inventory);
  const workflowSections = catalog.workflows.map((workflow) => {
    const workflowSummary = summary.workflows.get(workflow);
    const rows = workflowSummary.cases
      .map((entry) => `| \`${entry.id}\` | ${entry.title} | ${entry.layer} | ${entry.risk} | ${entry.required_for_release ? 'yes' : 'no'} | ${entry.hasMatch ? 'covered' : 'missing'} | [${toPosix(entry.test_file)}](/Users/ramc/Documents/Code/courtmaster-v2/${toPosix(entry.test_file)}) |`)
      .join('\n') || '| _none_ |  |  |  |  |  |  |';

    return `## ${workflow}

| ID | Title | Layer | Risk | Release | Status | File |
|---|---|---|---|---|---|---|
${rows}`;
  }).join('\n\n');

  const discoveredInventoryRows = inventory
    .slice()
    .sort((left, right) => left.test_file.localeCompare(right.test_file))
    .map((entry) => `| ${entry.layer} | [${toPosix(entry.test_file)}](/Users/ramc/Documents/Code/courtmaster-v2/${toPosix(entry.test_file)}) | ${entry.matchedTitles?.length ?? 0} | ${(entry.matchedTitles ?? []).map((title) => `\`${title}\``).join('<br>')} |`)
    .join('\n') || '| _none_ |  |  |  |';

  const discoveredE2ERows = inventory
    .filter((entry) => entry.layer === 'e2e')
    .sort((left, right) => left.test_file.localeCompare(right.test_file))
    .map((entry) => `| [${toPosix(entry.test_file)}](/Users/ramc/Documents/Code/courtmaster-v2/${toPosix(entry.test_file)}) | ${entry.matchedTitles?.length ?? 0} | ${(entry.matchedTitles ?? []).map((title) => `\`${title}\``).join('<br>')} |`)
    .join('\n') || '| _none_ |  |  |';

  return `# CourtMastr Automated Test Catalog

Generated: ${generatedAt}

## Summary

- Active automated test cases: ${summary.totalAutomated}
- Unit cases: ${summary.totalUnit}
- Integration cases: ${summary.totalIntegration}
- E2E cases: ${summary.totalE2E}
- Release-required cases covered: ${summary.releaseCovered}/${summary.totalReleaseRequired}
- ${formatRunSummaryLine(runSummary)}

## Discovered Automated Library

- Discovered test files: ${inventorySummary.filesTotal}
- Discovered test titles: ${inventorySummary.testsTotal}
- Discovered E2E files/tests: ${inventorySummary.e2eFiles}/${inventorySummary.e2eTests}
- Discovered unit files/tests: ${inventorySummary.unitFiles}/${inventorySummary.unitTests}
- Discovered integration files/tests: ${inventorySummary.integrationFiles}/${inventorySummary.integrationTests}

## Workflow Coverage

| Workflow | Total Cases | Release Required | Layers Covered |
|---|---:|---:|---|
${catalog.workflows.map((workflow) => {
    const workflowSummary = summary.workflows.get(workflow);
    const layers = [...workflowSummary.coveredLayers].sort().join(', ') || 'none';
    return `| ${workflow} | ${workflowSummary.total} | ${workflowSummary.releaseRequired} | ${layers} |`;
  }).join('\n')}

## Release-Required Cases

| ID | Workflow | Layer | Status |
|---|---|---|---|
${resolvedCases
    .filter((entry) => entry.automation_status === 'active' && entry.required_for_release)
    .map((entry) => `| \`${entry.id}\` | ${entry.workflow} | ${entry.layer} | ${entry.hasMatch ? 'covered' : 'missing'} |`)
    .join('\n')}

## Discovered E2E Inventory

| File | Titles | Test Names |
|---|---:|---|
${discoveredE2ERows}

## Discovered Test Library

| Layer | File | Titles | Test Names |
|---|---|---:|---|
${discoveredInventoryRows}

${workflowSections}
`;
};

export const buildHtmlReport = ({
  catalog,
  resolvedCases,
  inventory = [],
  runSummary = null,
  generatedAt = new Date().toISOString(),
}) => {
  const summary = summarizeCatalog({ catalog, resolvedCases, runSummary });
  const inventorySummary = summarizeInventory(inventory);
  const workflowCards = catalog.workflows.map((workflow) => {
    const workflowSummary = summary.workflows.get(workflow);
    const caseList = workflowSummary.cases.map((entry) => {
      const statusClass = entry.hasMatch ? 'covered' : 'missing';
      return `<tr class="${statusClass}">
  <td><code>${escapeHtml(entry.id)}</code></td>
  <td>${escapeHtml(entry.title)}</td>
  <td>${escapeHtml(entry.layer)}</td>
  <td>${escapeHtml(entry.risk)}</td>
  <td>${entry.required_for_release ? 'yes' : 'no'}</td>
  <td>${entry.hasMatch ? 'covered' : 'missing'}</td>
  <td><a href="${escapeHtml(toPosix(entry.test_file))}">${escapeHtml(toPosix(entry.test_file))}</a></td>
</tr>`;
    }).join('');

    return `<section class="workflow-card">
  <h2>${escapeHtml(workflow)}</h2>
  <p class="workflow-meta">Cases: ${workflowSummary.total} · Release required: ${workflowSummary.releaseRequired} · Layers: ${[...workflowSummary.coveredLayers].sort().join(', ') || 'none'}</p>
  <table>
    <thead>
      <tr><th>ID</th><th>Title</th><th>Layer</th><th>Risk</th><th>Release</th><th>Status</th><th>File</th></tr>
    </thead>
    <tbody>${caseList}</tbody>
  </table>
</section>`;
  }).join('\n');

  const discoveredInventoryRows = inventory
    .slice()
    .sort((left, right) => left.test_file.localeCompare(right.test_file))
    .map((entry) => `<tr>
  <td>${escapeHtml(entry.layer)}</td>
  <td><a href="${escapeHtml(toPosix(entry.test_file))}">${escapeHtml(toPosix(entry.test_file))}</a></td>
  <td>${entry.matchedTitles?.length ?? 0}</td>
  <td>${escapeHtml((entry.matchedTitles ?? []).join(' • '))}</td>
</tr>`)
    .join('');

  const discoveredE2ERows = inventory
    .filter((entry) => entry.layer === 'e2e')
    .sort((left, right) => left.test_file.localeCompare(right.test_file))
    .map((entry) => `<tr>
  <td><a href="${escapeHtml(toPosix(entry.test_file))}">${escapeHtml(toPosix(entry.test_file))}</a></td>
  <td>${entry.matchedTitles?.length ?? 0}</td>
  <td>${escapeHtml((entry.matchedTitles ?? []).join(' • '))}</td>
</tr>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CourtMastr Test Catalog</title>
  <style>
    :root {
      --bg: #f6f4ef;
      --panel: #ffffff;
      --ink: #1d2433;
      --muted: #5b6474;
      --line: #d9d8d2;
      --covered: #1f7a4d;
      --missing: #b33a3a;
      --accent: #c97a19;
    }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: var(--bg); color: var(--ink); }
    main { max-width: 1200px; margin: 0 auto; padding: 32px 24px 48px; }
    h1, h2 { margin: 0 0 12px; }
    .hero, .workflow-card, .inventory-card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.05); }
    .hero { margin-bottom: 24px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .summary-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: #fcfbf8; }
    .summary-card strong { display: block; font-size: 1.6rem; }
    .run-status { margin-top: 16px; padding: 12px; border-radius: 12px; background: #fff7ea; border: 1px solid #eed3aa; }
    .workflow-card { margin-bottom: 20px; }
    .inventory-card { margin-bottom: 20px; }
    .workflow-meta { color: var(--muted); margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.94rem; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
    tr.covered td:nth-child(6) { color: var(--covered); font-weight: 700; }
    tr.missing td:nth-child(6) { color: var(--missing); font-weight: 700; }
    code { background: #f1eee7; padding: 2px 6px; border-radius: 6px; }
    a { color: #124f84; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>CourtMastr Automated Test Catalog</h1>
      <p>Generated ${escapeHtml(generatedAt)}</p>
      <div class="summary-grid">
        <div class="summary-card"><span>Automated Cases</span><strong>${summary.totalAutomated}</strong></div>
        <div class="summary-card"><span>Unit</span><strong>${summary.totalUnit}</strong></div>
        <div class="summary-card"><span>Integration</span><strong>${summary.totalIntegration}</strong></div>
        <div class="summary-card"><span>E2E</span><strong>${summary.totalE2E}</strong></div>
        <div class="summary-card"><span>Release Coverage</span><strong>${summary.releaseCovered}/${summary.totalReleaseRequired}</strong></div>
        <div class="summary-card"><span>Discovered E2E Tests</span><strong>${inventorySummary.e2eTests}</strong></div>
      </div>
      <div class="run-status">${escapeHtml(formatRunSummaryLine(runSummary))}</div>
    </section>
    <section class="inventory-card">
      <h2>Discovered E2E Inventory</h2>
      <p class="workflow-meta">Files: ${inventorySummary.e2eFiles} · Titles: ${inventorySummary.e2eTests}</p>
      <table>
        <thead>
          <tr><th>File</th><th>Titles</th><th>Test Names</th></tr>
        </thead>
        <tbody>${discoveredE2ERows || '<tr><td colspan="3">No E2E tests discovered.</td></tr>'}</tbody>
      </table>
    </section>
    <section class="inventory-card">
      <h2>Discovered Test Library</h2>
      <p class="workflow-meta">Files: ${inventorySummary.filesTotal} · Titles: ${inventorySummary.testsTotal}</p>
      <table>
        <thead>
          <tr><th>Layer</th><th>File</th><th>Titles</th><th>Test Names</th></tr>
        </thead>
        <tbody>${discoveredInventoryRows || '<tr><td colspan="4">No tests discovered.</td></tr>'}</tbody>
      </table>
    </section>
    ${workflowCards}
  </main>
</body>
</html>`;
};

export const writeReports = ({ markdown, html, markdownPath = MARKDOWN_REPORT_PATH, htmlPath = HTML_REPORT_PATH }) => {
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  fs.writeFileSync(htmlPath, html, 'utf8');
};

export const loadRunSummary = (summaryPath = RUN_SUMMARY_PATH) => {
  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
};

export const generateAndWriteReports = async ({
  catalog,
  resolvedCases,
  inventory = [],
  runSummary = null,
  generatedAt = new Date().toISOString(),
  markdownPath = MARKDOWN_REPORT_PATH,
  htmlPath = HTML_REPORT_PATH,
}) => {
  const markdown = buildMarkdownReport({ catalog, resolvedCases, inventory, runSummary, generatedAt });
  const html = buildHtmlReport({ catalog, resolvedCases, inventory, runSummary, generatedAt });
  writeReports({ markdown, html, markdownPath, htmlPath });
  return { markdown, html };
};

const isDirectExecution = () => {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
};

if (isDirectExecution()) {
  const { loadCatalog, validateCatalog } = await import('./catalog-utils.mjs');
  const { collectTestInventory, resolveCatalogAgainstInventory } = await import('./resolve-test-inventory.mjs');
  const catalog = await loadCatalog();
  const validationErrors = validateCatalog(catalog);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid test catalog: ${validationErrors.join(' | ')}`);
  }
  const inventory = await collectTestInventory();
  const resolvedCases = resolveCatalogAgainstInventory(catalog, inventory);
  const runSummary = loadRunSummary();
  await generateAndWriteReports({ catalog, resolvedCases, inventory, runSummary });
  console.log(`Wrote ${MARKDOWN_REPORT_PATH}`);
  console.log(`Wrote ${HTML_REPORT_PATH}`);
}
