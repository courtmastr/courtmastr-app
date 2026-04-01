import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const writePackageJson = (directory: string, version = '1.2.0'): string => {
  const packageJsonPath = path.join(directory, 'package.json');
  fs.writeFileSync(packageJsonPath, `${JSON.stringify({ version }, null, 2)}\n`, 'utf8');
  return packageJsonPath;
};

describe('release notes utilities', () => {
  it('reports missing release notes', async () => {
    const { verifyReleaseNotes } = await import('../../scripts/testing/release-notes-utils.mjs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'courtmastr-release-notes-missing-'));
    const packageJsonPath = writePackageJson(tempDir);
    const releasesDir = path.join(tempDir, 'docs/releases');
    fs.mkdirSync(releasesDir, { recursive: true });

    expect(() => verifyReleaseNotes({
      packageJsonPath,
      releasesDir,
    })).toThrow(/Missing release notes/i);
  });

  it('validates required release note sections', async () => {
    const { validateReleaseNotesContent } = await import('../../scripts/testing/release-notes-utils.mjs');

    const errors = validateReleaseNotesContent('# Release v1.2.0\n\n## Summary\n', '1.2.0');

    expect(errors.some((error) => error.includes('## Highlights'))).toBe(true);
    expect(errors.some((error) => error.includes('## Verification'))).toBe(true);
  });

  it('extracts and compares deployed semantic versions', async () => {
    const { compareSemverVersions, extractLatestDeployedPackageVersion } = await import('../../scripts/testing/release-notes-utils.mjs');

    expect(extractLatestDeployedPackageVersion(`
## Latest Production Deploy

- Date: 2026-03-15 08:33 CDT
- Package version: \`1.1.0\`
`)).toBe('1.1.0');

    expect(compareSemverVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareSemverVersions('1.1.0', '1.1.0')).toBe(0);
    expect(compareSemverVersions('1.0.9', '1.1.0')).toBe(-1);
  });

  it('accepts the current release notes file for the package version', async () => {
    const { verifyReleaseNotes } = await import('../../scripts/testing/release-notes-utils.mjs');

    const metadata = verifyReleaseNotes({ enforceVersionBump: false });

    expect(metadata.version).toBe('1.1.0');
    expect(metadata.releaseId).toBe('v1.1.0');
    expect(metadata.releaseNotesPath.endsWith('/docs/releases/v1.1.0.md')).toBe(true);
  });
});
