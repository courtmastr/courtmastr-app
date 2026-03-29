import { describe, expect, it } from 'vitest';

describe('test run summary utilities', () => {
  it('builds a normalized run summary', async () => {
    const { buildRunSummary } = await import('../../scripts/testing/write-test-run-summary.mjs');

    const summary = buildRunSummary({
      release: {
        version: '1.1.0',
        releaseId: 'v1.1.0',
        releaseNotesPath: '/tmp/docs/releases/v1.1.0.md',
      },
      vitest: { filesPassed: 130, testsPassed: 580 },
      e2e: { total: 76, passed: 76, failed: 0, skipped: 0 },
      scope: 'custom',
      generatedAt: '2026-03-20T12:00:00.000Z',
    });

    expect(summary.generatedAt).toBe('2026-03-20T12:00:00.000Z');
    expect(summary.scope).toBe('custom');
    expect(summary.release.releaseId).toBe('v1.1.0');
    expect(summary.vitest.testsPassed).toBe(580);
    expect(summary.e2e.total).toBe(76);
  });

  it('parses vitest and playwright output counts', async () => {
    const { parseVitestOutput, parsePlaywrightOutput } = await import('../../scripts/testing/write-test-run-summary.mjs');

    expect(parseVitestOutput('Test Files  130 passed (130)\n      Tests  580 passed (580)')).toEqual({
      filesPassed: 130,
      testsPassed: 580,
    });

    expect(parsePlaywrightOutput('76 passed (5.2m)')).toEqual({
      total: 76,
      passed: 76,
      failed: 0,
      skipped: 0,
    });
  });
});
