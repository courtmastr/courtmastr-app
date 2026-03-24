import { describe, expect, it } from 'vitest';

describe('test catalog markdown report', () => {
  it('includes summary, workflow coverage, and release-required cases', async () => {
    const { buildMarkdownReport } = await import('../../scripts/testing/generate-test-catalog-report.mjs');

    const markdown = buildMarkdownReport({
      catalog: {
        workflows: ['publish', 'scoring'],
      },
      resolvedCases: [
        {
          id: 'publish.schedule.level',
          title: 'publishes a level schedule',
          workflow: 'publish',
          feature: 'public schedule',
          layer: 'e2e',
          risk: 'high',
          automation_status: 'active',
          required_for_release: true,
          test_file: 'e2e/p0-public-views.spec.ts',
          test_name_pattern: 'publishes a level schedule',
          matchedTitles: ['publishes a level schedule'],
          hasFile: true,
          hasMatch: true,
          validationErrors: [],
        },
        {
          id: 'scoring.correct_score',
          title: 'shows correct-score action',
          workflow: 'scoring',
          feature: 'score correction',
          layer: 'e2e',
          risk: 'high',
          automation_status: 'active',
          required_for_release: true,
          test_file: 'e2e/p0-score-correction.spec.ts',
          test_name_pattern: 'shows correct-score action',
          matchedTitles: ['shows correct-score action'],
          hasFile: true,
          hasMatch: true,
          validationErrors: [],
        },
      ],
      inventory: [
        {
          layer: 'e2e',
          test_file: 'e2e/p0-public-views.spec.ts',
          matchedTitles: ['publishes a level schedule'],
        },
        {
          layer: 'unit',
          test_file: 'tests/unit/CategoryRegistrationStats.test.ts',
          matchedTitles: ['shows publish CTA'],
        },
      ],
      runSummary: {
        generatedAt: '2026-03-20T11:45:00.000Z',
        scope: 'custom',
        vitest: { filesPassed: 7, testsPassed: 11 },
        e2e: { total: 2, passed: 2, failed: 0, skipped: 0 },
      },
      generatedAt: '2026-03-20T12:00:00.000Z',
    });

    expect(markdown).toContain('# CourtMastr Automated Test Catalog');
    expect(markdown).toContain('Active automated test cases: 2');
    expect(markdown).toContain('E2E latest run (custom): 2/2 passed.');
    expect(markdown).toContain('## Discovered Automated Library');
    expect(markdown).toContain('Discovered E2E files/tests: 1/1');
    expect(markdown).toContain('## Discovered E2E Inventory');
    expect(markdown).toContain('## Discovered Test Library');
    expect(markdown).toContain('## publish');
    expect(markdown).toContain('## scoring');
    expect(markdown).toContain('## Release-Required Cases');
  });
});
