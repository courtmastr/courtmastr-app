import { describe, expect, it } from 'vitest';

describe('test catalog html report', () => {
  it('renders visual summary and workflow tables', async () => {
    const { buildHtmlReport } = await import('../../scripts/testing/generate-test-catalog-report.mjs');

    const html = buildHtmlReport({
      catalog: { workflows: ['auth-roles'] },
      resolvedCases: [
        {
          id: 'auth.guard.route',
          title: 'redirects unauthenticated users to login',
          workflow: 'auth-roles',
          feature: 'auth guards',
          layer: 'e2e',
          risk: 'critical',
          automation_status: 'active',
          required_for_release: true,
          test_file: 'e2e/p0-auth-and-role-guards.spec.ts',
          test_name_pattern: 'redirects unauthenticated users to login',
          matchedTitles: ['redirects unauthenticated users to login'],
          hasFile: true,
          hasMatch: true,
          validationErrors: [],
        },
      ],
      inventory: [
        {
          layer: 'e2e',
          test_file: 'e2e/p0-auth-and-role-guards.spec.ts',
          matchedTitles: ['redirects unauthenticated users to login'],
        },
      ],
      runSummary: {
        generatedAt: '2026-03-20T11:45:00.000Z',
        scope: 'custom',
        vitest: { filesPassed: 7, testsPassed: 11 },
        e2e: { total: 1, passed: 1, failed: 0, skipped: 0 },
      },
    });

    expect(html).toContain('<title>CourtMastr Test Catalog</title>');
    expect(html).toContain('E2E latest run (custom): 1/1 passed.');
    expect(html).toContain('Discovered E2E Inventory');
    expect(html).toContain('Discovered Test Library');
    expect(html).toContain('workflow-card');
    expect(html).toContain('auth.guard.route');
    expect(html).toContain('covered');
  });
});
