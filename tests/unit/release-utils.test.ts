import { describe, expect, it } from 'vitest';

describe('release utilities', () => {
  it('parses the latest production deploy metadata', async () => {
    const { parseLatestProductionDeploy } = await import('../../scripts/release/release-utils.mjs');

    const deploy = parseLatestProductionDeploy(`
# Last Deploy Record

Updated: 2026-03-28 (America/Chicago)

## Latest Production Deploy

- Date: 2026-03-15 08:33 CDT
- Release ID: \`v1.1.0+deploy.2\`
- Package version: \`1.1.0\`
- Deployed branch: \`master\`
- Deployed commit: \`96ead60\` (\`merge: finalize horizon 2 foundation polish\`)
- Release notes:
  - [docs/releases/v1.1.0+deploy.2.md](/tmp/docs/releases/v1.1.0+deploy.2.md)

## Last Confirmed Firebase Deploy
`);

    expect(deploy.releaseId).toBe('v1.1.0+deploy.2');
    expect(deploy.packageVersion).toBe('1.1.0');
    expect(deploy.commitShort).toBe('96ead60');
  });

  it('classifies patch, minor, and major releases', async () => {
    const { classifyRelease } = await import('../../scripts/release/release-utils.mjs');

    expect(classifyRelease({
      changedFiles: [
        'src/features/public/views/HomeView.vue',
      ],
      commitSubjects: ['fix(home): tighten hero spacing'],
    }).releaseType).toBe('patch');

    expect(classifyRelease({
      changedFiles: [
        'src/features/players/views/PlayersListView.vue',
        'src/stores/players.ts',
        'src/router/index.ts',
        'tests/unit/PlayersListView.test.ts',
        'docs/plans/players.md',
      ],
      commitSubjects: [
        'feat(players): add player directory',
        'feat(players): add player profile route',
        'refactor(players): share directory filters',
      ],
    }).releaseType).toBe('minor');

    expect(classifyRelease({
      changedFiles: [
        'src/features/tournaments/views/MatchControlView.vue',
      ],
      commitSubjects: [
        'feat(core)!: break release compatibility',
      ],
    }).releaseType).toBe('major');
  });

  it('increments semantic versions correctly', async () => {
    const { incrementVersion } = await import('../../scripts/release/release-utils.mjs');

    expect(incrementVersion('1.1.0', 'patch')).toBe('1.1.1');
    expect(incrementVersion('1.1.0', 'minor')).toBe('1.2.0');
    expect(incrementVersion('1.1.0', 'major')).toBe('2.0.0');
  });

  it('builds release note markdown with required sections', async () => {
    const { buildReleaseNotes } = await import('../../scripts/release/release-utils.mjs');

    const markdown = buildReleaseNotes({
      version: '1.2.0',
      releaseType: 'minor',
      status: 'planned',
      branch: 'master',
      headCommit: 'abcdef1234567890',
      previousCommit: '1234567890abcdef',
      commitSubjects: ['feat(players): add player directory'],
      changedFiles: ['src/features/players/views/PlayersListView.vue'],
      touchedAreas: ['players and organizations'],
      generatedAt: 'pending',
    });

    expect(markdown).toContain('# Release v1.2.0');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Highlights');
    expect(markdown).toContain('## Verification');
    expect(markdown).toContain('## Deployment');
    expect(markdown).toContain('## Risks / Follow-Ups');
    expect(markdown).toContain('Commit range: `1234567..abcdef1`');
  });

  it('normalizes release artifact paths and marks deployed notes consistently', async () => {
    const {
      markReleaseNotesDeployed,
      normalizeRepoArtifactPath,
      updateLastDeployRecord,
    } = await import('../../scripts/release/release-utils.mjs');

    const repoPath = process.cwd().replace(/\\/g, '/');

    expect(normalizeRepoArtifactPath('/home/runner/work/courtmaster-v2/courtmaster-v2/docs/releases/v2.0.0.md')).toBe('docs/releases/v2.0.0.md');
    expect(normalizeRepoArtifactPath(`${repoPath}/docs/debug-kb/_artifacts/deploy.log`)).toBe('docs/debug-kb/_artifacts/deploy.log');

    const deployedMarkdown = markReleaseNotesDeployed(`# Release v2.0.0

- Status: planned
- Release date: pending

## Deployment

- Status: planned
- Firebase project: \`courtmaster-v2\`
`, '2026-04-02 01:03 CDT');

    expect(deployedMarkdown.match(/- Status: deployed/g)).toHaveLength(2);
    expect(deployedMarkdown).toContain('- Release date: 2026-04-02 01:03 CDT');

    const updatedRecord = updateLastDeployRecord(`# Last Deploy Record

Updated: 2026-03-28 (America/Chicago)

## Latest Production Deploy

- Date: 2026-03-15 08:33 CDT
- Release ID: \`v1.1.0+deploy.2\`
- Package version: \`1.1.0\`
- Deployed branch: \`master\`
- Deployed commit: \`96ead60\` (\`merge: finalize horizon 2 foundation polish\`)
- Release notes:
  - [docs/releases/v1.1.0+deploy.2.md](/Users/ramc/Documents/Code/courtmaster-v2/docs/releases/v1.1.0+deploy.2.md)

## Last Confirmed Firebase Deploy

placeholder

## Previous Versioned Production Releases

## Latest Production Merge Milestone

placeholder
`, {
      date: '2026-04-02 01:03 CDT',
      releaseId: 'v2.0.0',
      packageVersion: '2.0.0',
      branch: 'master',
      commit: '835f65204cbd8f2c25c1842565b37bdb3da8eada',
      commitShort: '835f652',
      commitMessage: 'hotfix: unblock compute default function deploys',
      releaseNotesPath: '/home/runner/work/courtmaster-v2/courtmaster-v2/docs/releases/v2.0.0.md',
      deployLogPath: '/home/runner/work/courtmaster-v2/courtmaster-v2/docs/debug-kb/_artifacts/deploy.log',
    });

    expect(updatedRecord).toContain('[docs/releases/v2.0.0.md](docs/releases/v2.0.0.md)');
    expect(updatedRecord).toContain('`docs/debug-kb/_artifacts/deploy.log`');
    expect(updatedRecord).not.toContain('/home/runner/work/courtmaster-v2/courtmaster-v2');
  });

  it('formats dirty worktree guidance for release deploy failures', async () => {
    const {
      formatDirtyWorktreeMessage,
      parseDirtyWorktreeEntries,
    } = await import('../../scripts/release/release-utils.mjs');

    const dirtyEntries = parseDirtyWorktreeEntries(` M package.json
?? docs/releases/v2.0.0.md
M  scripts/release/release-cli.mjs`);
    const message = formatDirtyWorktreeMessage('release:deploy', dirtyEntries);

    expect(dirtyEntries).toEqual([
      { code: ' M', path: 'package.json' },
      { code: '??', path: 'docs/releases/v2.0.0.md' },
      { code: 'M ', path: 'scripts/release/release-cli.mjs' },
    ]);
    expect(message).toContain('release:deploy requires a clean git worktree before starting.');
    expect(message).toContain('-  M package.json');
    expect(message).toContain('- ?? docs/releases/v2.0.0.md');
    expect(message).toContain('git stash push -u -m "pre-release-deploy"');
  });

  it('throws the command-specific dirty worktree error for plan and deploy', async () => {
    const {
      assertCleanGitState,
      parseDirtyWorktreeEntries,
    } = await import('../../scripts/release/release-utils.mjs');

    const dirtyEntries = parseDirtyWorktreeEntries(' M package.json');
    const dirtyGitState = {
      branch: 'master',
      headCommit: 'abcdef1234567890',
      headCommitShort: 'abcdef1',
      headMessage: 'feat: release automation',
      isClean: false,
      dirtyEntries,
    };

    expect(() => assertCleanGitState('release:plan', dirtyGitState)).toThrowError(
      'release:plan requires a clean git worktree before starting.',
    );
    expect(() => assertCleanGitState('release:deploy', dirtyGitState)).toThrowError(
      'release:deploy requires a clean git worktree before starting.',
    );
  });

  it('restores tracked files and removes untracked files after a failed release', async () => {
    const {
      rollbackReleaseWorktree,
      splitRollbackPaths,
    } = await import('../../scripts/release/release-utils.mjs');

    const dirtyEntries = [
      { code: ' M', path: 'package.json' },
      { code: 'M ', path: 'docs/testing/test-run-summary.json' },
      { code: '??', path: 'docs/releases/v2.0.0.md' },
    ];

    expect(splitRollbackPaths(dirtyEntries)).toEqual({
      trackedPaths: ['package.json', 'docs/testing/test-run-summary.json'],
      untrackedPaths: ['docs/releases/v2.0.0.md'],
    });

    const restoredCommands: string[][] = [];
    const removedPaths: string[] = [];

    const result = rollbackReleaseWorktree({
      cwd: '/tmp/courtmastr-release',
      headCommit: 'abcdef1234567890',
      dirtyEntries,
      execGitRestore: (args) => {
        restoredCommands.push(args);
      },
      removePath: (targetPath) => {
        removedPaths.push(targetPath);
      },
    });

    expect(result).toEqual({
      trackedPaths: ['package.json', 'docs/testing/test-run-summary.json'],
      untrackedPaths: ['docs/releases/v2.0.0.md'],
    });
    expect(restoredCommands).toEqual([
      ['restore', '--source', 'abcdef1234567890', '--staged', '--worktree', '--', 'package.json', 'docs/testing/test-run-summary.json'],
    ]);
    expect(removedPaths).toEqual([
      '/tmp/courtmastr-release/docs/releases/v2.0.0.md',
    ]);
  });

  it('auto-restores generated release artifacts before checking worktree cleanliness', async () => {
    const {
      PRE_RELEASE_AUTORESTORE_PATHS,
      restorePreReleaseGeneratedFiles,
    } = await import('../../scripts/release/release-utils.mjs');

    const restoredCommands: string[][] = [];

    const result = restorePreReleaseGeneratedFiles({
      cwd: '/tmp/courtmastr-release',
      execGitRestore: (args) => {
        restoredCommands.push(args);
      },
    });

    expect(result).toEqual(PRE_RELEASE_AUTORESTORE_PATHS);
    expect(restoredCommands).toEqual([
      ['restore', '--worktree', '--staged', '--', ...PRE_RELEASE_AUTORESTORE_PATHS],
    ]);
  });
});
