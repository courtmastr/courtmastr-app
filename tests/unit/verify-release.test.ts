import { describe, expect, it, vi } from 'vitest';

describe('verify release', () => {
  it('fails when a release-required case is unresolved', async () => {
    const { runReleaseVerification } = await import('../../scripts/testing/verify-release.mjs');

    await expect(runReleaseVerification({
      loadCatalog: () => ({ version: 1, workflows: ['auth-roles'], cases: [] }),
      validateCatalog: vi.fn(),
      collectTestInventory: () => [],
      resolveCatalogAgainstInventory: () => [{
        id: 'auth.guard',
        title: 'auth guard',
        workflow: 'auth-roles',
        feature: 'auth',
        risk: 'critical',
        layer: 'e2e',
        automation_status: 'active',
        required_for_release: true,
        test_file: 'e2e/p0-auth-and-role-guards.spec.ts',
        test_name_pattern: 'auth guard',
        matchedTitles: [],
        hasFile: true,
        hasMatch: false,
        validationErrors: [],
      }],
      verifyReleaseMetadata: vi.fn(() => ({
        version: '1.1.0',
        releaseId: 'v1.1.0',
        releaseNotesPath: '/tmp/docs/releases/v1.1.0.md',
      })),
      runCommand: vi.fn(),
    })).rejects.toThrow(/missing coverage/i);
  });

  it('runs commands, writes summary, and returns results when coverage is valid', async () => {
    const { runReleaseVerification } = await import('../../scripts/testing/verify-release.mjs');
    const runCommand = vi
      .fn()
      .mockReturnValueOnce('Test Files  130 passed (130)\n      Tests  580 passed (580)')
      .mockReturnValueOnce('76 passed (5.2m)');

    const result = await runReleaseVerification({
      loadCatalog: () => ({ version: 1, workflows: ['scoring'], cases: [] }),
      validateCatalog: vi.fn(),
      collectTestInventory: () => [],
      resolveCatalogAgainstInventory: () => [{
        id: 'scoring.ready.dialog',
        title: 'ready scoring dialog',
        workflow: 'scoring',
        layer: 'e2e',
        risk: 'high',
        feature: 'scoring',
        test_file: 'e2e/p0-match-control-scoring.spec.ts',
        test_name_pattern: 'ready scoring dialog',
        automation_status: 'active',
        required_for_release: true,
        matchedTitles: ['ready scoring dialog'],
        hasFile: true,
        hasMatch: true,
        validationErrors: [],
      }],
      runCommand,
      verifyReleaseMetadata: vi.fn(() => ({
        version: '1.1.0',
        releaseId: 'v1.1.0',
        releaseNotesPath: '/tmp/docs/releases/v1.1.0.md',
      })),
      generateReports: vi.fn(),
      summaryPath: '/tmp/courtmastr-test-run-summary.json',
    });

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(result.runSummary.release.releaseId).toBe('v1.1.0');
    expect(result.runSummary.vitest.testsPassed).toBe(580);
    expect(result.runSummary.e2e.passed).toBe(76);
  });
});
