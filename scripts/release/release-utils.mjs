import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { compareSemverVersions } from '../testing/release-notes-utils.mjs';

export const LAST_DEPLOY_RECORD_PATH = path.resolve(process.cwd(), 'docs/deployment/LAST_DEPLOY.md');
export const RELEASES_DIR = path.resolve(process.cwd(), 'docs/releases');
const DIRTY_STATUS_LINE_PATTERN = /^(..)\s(.+)$/;
export const PRE_RELEASE_AUTORESTORE_PATHS = [
  'e2e/.auth/admin.json',
  'e2e/.auth/scorekeeper.json',
  'e2e/.test-data.json',
  'docs/testing/TEST_CATALOG.md',
  'docs/testing/TEST_CATALOG.html',
  'docs/testing/test-run-summary.json',
];

export const parseLatestProductionDeploy = (content) => {
  const sectionMatch = content.match(/## Latest Production Deploy\s+([\s\S]*?)\n## /);
  const section = sectionMatch?.[1] ?? '';

  const commitMatch = section.match(/- Deployed commit: `([0-9a-f]+)`/i);

  return {
    date: section.match(/- Date: (.+)/)?.[1] ?? null,
    releaseId: section.match(/- Release ID: `([^`]+)`/)?.[1] ?? null,
    packageVersion: section.match(/- Package version: `([^`]+)`/)?.[1] ?? null,
    branch: section.match(/- Deployed branch: `([^`]+)`/)?.[1] ?? null,
    commit: commitMatch?.[1] ?? null,
    commitShort: commitMatch?.[1]?.slice(0, 7) ?? null,
    releaseNotesPath: section.match(/- \[docs\/releases\/[^\]]+\]\(([^)]+)\)/)?.[1] ?? null,
  };
};

export const normalizeRepoArtifactPath = (artifactPath) => {
  if (!artifactPath) {
    return null;
  }

  const normalized = artifactPath.replace(/\\/g, '/');
  const cwdPrefix = `${process.cwd().replace(/\\/g, '/')}/`;

  if (normalized.startsWith(cwdPrefix)) {
    return normalized.slice(cwdPrefix.length);
  }

  const docsMatch = normalized.match(/(?:^|\/)(docs\/.+)$/);
  if (docsMatch?.[1]) {
    return docsMatch[1];
  }

  return normalized;
};

export const incrementVersion = (version, releaseType) => {
  const [major, minor, patch] = version.split('.').map(Number);

  if (releaseType === 'major') {
    return `${major + 1}.0.0`;
  }

  if (releaseType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
};

export const getChangedFiles = (fromCommit, toCommit = 'HEAD') => {
  const output = execSync(`git diff --name-only ${fromCommit}..${toCommit}`, {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();

  return output ? output.split('\n').filter(Boolean) : [];
};

export const getCommitSubjects = (fromCommit, toCommit = 'HEAD') => {
  const output = execSync(`git log --format=%s ${fromCommit}..${toCommit}`, {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();

  return output ? output.split('\n').filter(Boolean) : [];
};

export const detectTouchedAreas = (changedFiles) => {
  const areas = new Set();

  for (const file of changedFiles) {
    if (file.startsWith('src/features/public/') || file.startsWith('src/components/common/') || file.startsWith('src/features/reviews/')) {
      areas.add('public experience');
    }
    if (file.startsWith('src/features/tournaments/') || file.startsWith('src/features/scoring/') || file.startsWith('src/features/brackets/')) {
      areas.add('tournament operations');
    }
    if (file.startsWith('src/features/players/') || file.startsWith('src/features/org/') || file.startsWith('src/stores/players.ts') || file.startsWith('src/stores/organizations.ts')) {
      areas.add('players and organizations');
    }
    if (file.startsWith('src/features/super/') || file.startsWith('src/stores/superAdmin.ts')) {
      areas.add('platform administration');
    }
    if (file.startsWith('functions/') || file === 'firestore.rules' || file === 'firestore.indexes.json' || file === 'storage.rules') {
      areas.add('firebase backend');
    }
    if (file.startsWith('tests/') || file.startsWith('e2e/') || file.startsWith('docs/testing/') || file.startsWith('scripts/testing/')) {
      areas.add('release verification');
    }
    if (file.startsWith('docs/')) {
      areas.add('documentation');
    }
  }

  return [...areas];
};

export const classifyRelease = ({ changedFiles, commitSubjects }) => {
  const nonDocFiles = changedFiles.filter((file) => !file.startsWith('docs/'));
  const touchedAreas = detectTouchedAreas(changedFiles).filter((area) => area !== 'documentation');
  const featureCommitCount = commitSubjects.filter((subject) => /^(feat|refactor|merge):/i.test(subject)).length;
  const hasBreakingKeyword = commitSubjects.some((subject) => /\bbreaking\b|!:|major/i.test(subject));
  const touchesInfra = changedFiles.some((file) =>
    file.startsWith('functions/')
    || file === 'firestore.rules'
    || file === 'firestore.indexes.json'
    || file === 'storage.rules',
  );

  if (hasBreakingKeyword || (nonDocFiles.length >= 180 && (touchedAreas.length >= 4 || featureCommitCount >= 8))) {
    return {
      releaseType: 'major',
      reasons: [
        hasBreakingKeyword
          ? 'commit history contains breaking-change markers'
          : `release spans ${nonDocFiles.length} non-doc files across ${touchedAreas.length} product areas`,
      ],
      touchedAreas,
    };
  }

  if (
    nonDocFiles.length >= 40
    || touchedAreas.length >= 2
    || featureCommitCount >= 3
    || touchesInfra
  ) {
    return {
      releaseType: 'minor',
      reasons: [
        nonDocFiles.length >= 40 ? `release touches ${nonDocFiles.length} non-doc files` : null,
        touchedAreas.length >= 2 ? `release spans ${touchedAreas.length} product areas` : null,
        featureCommitCount >= 3 ? `commit range contains ${featureCommitCount} feature/refactor commits` : null,
        touchesInfra ? 'release includes Firebase/backend changes' : null,
      ].filter(Boolean),
      touchedAreas,
    };
  }

  return {
    releaseType: 'patch',
    reasons: ['release scope is narrow and does not cross major product boundaries'],
    touchedAreas,
  };
};

export const normalizeCommitSubject = (subject) =>
  subject
    .replace(/^(feat|fix|refactor|docs|chore|test)(\([^)]+\))?:\s*/i, '')
    .replace(/^merge:\s*/i, '')
    .trim();

export const selectHighlights = (commitSubjects) => {
  const preferred = commitSubjects.filter((subject) => !/^(docs|chore|test):/i.test(subject));
  const source = preferred.length > 0 ? preferred : commitSubjects;

  return source.slice(0, 6).map(normalizeCommitSubject);
};

export const buildReleaseSummary = ({ releaseType, changedFiles, previousCommit, headCommit, touchedAreas }) => {
  const areaSummary = touchedAreas.length > 0 ? touchedAreas.join(', ') : 'application plumbing';
  return `Automated ${releaseType} release draft covering ${changedFiles.length} changed files from \`${previousCommit.slice(0, 7)}\` to \`${headCommit.slice(0, 7)}\` across ${areaSummary}.`;
};

export const collectRiskNotes = (changedFiles, releaseType) => {
  const risks = [];

  if (changedFiles.some((file) => file.startsWith('functions/') || file === 'firestore.rules' || file === 'firestore.indexes.json')) {
    risks.push('Includes Firebase/backend changes; verify functions, rules, and indexes after deploy.');
  }

  if (changedFiles.some((file) => file.startsWith('src/router/') || file.startsWith('src/guards/'))) {
    risks.push('Routing or auth guard changes detected; smoke-test post-login and public navigation paths.');
  }

  if (releaseType === 'major') {
    risks.push('Classifier marked this as a major release; stage broad smoke coverage before and after deploy.');
  } else if (releaseType === 'minor') {
    risks.push('Classifier marked this as a minor release; validate the primary touched workflows before announcing availability.');
  } else {
    risks.push('Patch release flow detected; confirm the specific changed screens or workflows after deploy.');
  }

  return risks;
};

export const buildReleaseNotes = ({
  version,
  releaseType,
  status,
  branch,
  headCommit,
  previousCommit,
  commitSubjects,
  changedFiles,
  touchedAreas,
  generatedAt,
}) => {
  const highlights = selectHighlights(commitSubjects);
  const risks = collectRiskNotes(changedFiles, releaseType);
  const noteDate = generatedAt ?? 'pending';
  const noteCommit = headCommit.slice(0, 7);
  const summary = buildReleaseSummary({
    releaseType,
    changedFiles,
    previousCommit,
    headCommit,
    touchedAreas,
  });

  return `# Release v${version}

- Status: ${status}
- Package version: \`${version}\`
- Release type: \`${releaseType}\`
- Release date: ${noteDate}
- Release branch: \`${branch}\`
- Release commit: \`${noteCommit}\`
- Commit range: \`${previousCommit.slice(0, 7)}..${noteCommit}\`

## Summary

${summary}

## Highlights

${highlights.map((highlight) => `- ${highlight}`).join('\n')}

## Verification

- Release guardrails:
  - \`npm run verify:release\`
  - \`npm run build\`
  - \`npm run build:log\`
  - \`npm run deploy\`
  - \`npm run deploy:log\`
- Touched areas:
${(touchedAreas.length > 0 ? touchedAreas : ['release orchestration']).map((area) => `  - ${area}`).join('\n')}

## Deployment

- Status: ${status === 'deployed' ? 'deployed' : 'planned'}
- Firebase project: \`courtmaster-v2\`
- Target branch: \`${branch}\`
- Release commit at generation: \`${noteCommit}\`

## Risks / Follow-Ups

${risks.map((risk) => `- ${risk}`).join('\n')}
`;
};

export const formatCentralDateTime = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
};

export const formatCentralDate = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const parseDirtyWorktreeEntries = (statusOutput) =>
  statusOutput
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(DIRTY_STATUS_LINE_PATTERN);

      if (!match) {
        return {
          code: '??',
          path: line.trim(),
        };
      }

      return {
        code: match[1],
        path: match[2],
      };
    });

export const splitRollbackPaths = (dirtyEntries) => dirtyEntries.reduce((accumulator, entry) => {
  if (entry.code === '??') {
    accumulator.untrackedPaths.push(entry.path);
  } else {
    accumulator.trackedPaths.push(entry.path);
  }

  return accumulator;
}, {
  trackedPaths: [],
  untrackedPaths: [],
});

export const rollbackReleaseWorktree = ({
  cwd = process.cwd(),
  headCommit,
  dirtyEntries,
  execGitRestore = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }),
  removePath = (targetPath) => fs.rmSync(targetPath, { recursive: true, force: true }),
}) => {
  const { trackedPaths, untrackedPaths } = splitRollbackPaths(dirtyEntries);

  if (trackedPaths.length > 0) {
    execGitRestore(['restore', '--source', headCommit, '--staged', '--worktree', '--', ...trackedPaths]);
  }

  for (const relativePath of untrackedPaths) {
    removePath(path.resolve(cwd, relativePath));
  }

  return {
    trackedPaths,
    untrackedPaths,
  };
};

export const restorePreReleaseGeneratedFiles = ({
  cwd = process.cwd(),
  execGitRestore = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }),
  paths = PRE_RELEASE_AUTORESTORE_PATHS,
} = {}) => {
  execGitRestore(['restore', '--worktree', '--staged', '--', ...paths]);
  return paths;
};

export const formatDirtyWorktreeMessage = (commandName, dirtyEntries) => {
  const preview = dirtyEntries
    .slice(0, 10)
    .map((entry) => `- ${entry.code} ${entry.path}`)
    .join('\n');
  const remainingCount = dirtyEntries.length - Math.min(dirtyEntries.length, 10);
  const remainderLine = remainingCount > 0 ? `\n- ... and ${remainingCount} more` : '';

  return [
    `${commandName} requires a clean git worktree before starting.`,
    '',
    'Blocking files:',
    preview || '- none reported',
    `${remainderLine}`.trimEnd(),
    '',
    'Next step:',
    `- Commit the changes you want included in the release workflow, then rerun \`npm run ${commandName}\`.`,
    '- Or temporarily stash them with `git stash push -u -m "pre-release-deploy"` and rerun.',
  ]
    .filter((line, index, lines) => !(line === '' && lines[index - 1] === ''))
    .join('\n');
};

export const assertCleanGitState = (commandName, gitState) => {
  if (!gitState.isClean) {
    throw new Error(formatDirtyWorktreeMessage(commandName, gitState.dirtyEntries));
  }
};

export const buildPreviousReleaseBullet = (deploy) => `- \`${deploy.releaseId}\`
  - Date: ${deploy.date}
  - Package version: \`${deploy.packageVersion}\`
  - Deployed commit: \`${deploy.commitShort}\`
  - Release notes:
    - [docs/releases/${path.basename(deploy.releaseNotesPath)}](${normalizeRepoArtifactPath(deploy.releaseNotesPath)})`;

export const updateLastDeployRecord = (content, newDeploy) => {
  const previousLatest = parseLatestProductionDeploy(content);
  const normalizedReleaseNotesPath = normalizeRepoArtifactPath(newDeploy.releaseNotesPath);
  const normalizedDeployLogPath = normalizeRepoArtifactPath(newDeploy.deployLogPath);
  const latestSection = `## Latest Production Deploy

- Date: ${newDeploy.date}
- Release ID: \`${newDeploy.releaseId}\`
- Package version: \`${newDeploy.packageVersion}\`
- Deployed branch: \`${newDeploy.branch}\`
- Deployed commit: \`${newDeploy.commitShort}\` (\`${newDeploy.commitMessage}\`)
- Release notes:
  - [docs/releases/${path.basename(newDeploy.releaseNotesPath)}](${normalizedReleaseNotesPath})
- Commands:
  - \`npm run release:deploy\`
  - \`npm run deploy\`
  - \`npm run deploy:log\`
- Firebase project: \`courtmaster-v2\`
- Hosting URL: \`https://courtmaster-v2.web.app\`
- Deploy result:
  - Release automation completed all guardrails before Firebase deploy
  - See deploy-log artifact for full Firebase output
- Deploy log artifact from deploy-log run:
  - \`${normalizedDeployLogPath ?? 'not captured'}\``;

  let updated = content.replace(/^Updated: .*$/m, `Updated: ${formatCentralDate(new Date())} (America/Chicago)`);
  updated = updated.replace(/## Latest Production Deploy[\s\S]*?\n## Last Confirmed Firebase Deploy/, `${latestSection}

## Last Confirmed Firebase Deploy`);

  if (
    previousLatest.releaseId
    && previousLatest.packageVersion
    && previousLatest.commitShort
    && previousLatest.releaseNotesPath
    && !updated.includes(`- \`${previousLatest.releaseId}\``)
  ) {
    updated = updated.replace(
      /## Previous Versioned Production Releases\n\n/,
      `## Previous Versioned Production Releases\n\n${buildPreviousReleaseBullet(previousLatest)}\n`,
    );
  }

  const mergeSection = `## Latest Production Merge Milestone

- Date: ${newDeploy.date}
- Commit: \`${newDeploy.commit}\`
- Message: \`${newDeploy.commitMessage}\`
- Note: deployed via \`npm run release:deploy\` on ${formatCentralDate(new Date())}.`;

  updated = updated.replace(/## Latest Production Merge Milestone[\s\S]*$/m, mergeSection);
  return updated;
};

export const readCurrentVersion = () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  return packageJson.version;
};

export const getCurrentGitState = () => {
  const statusOutput = execSync('git status --porcelain', { cwd: process.cwd(), encoding: 'utf8' });
  const dirtyEntries = parseDirtyWorktreeEntries(statusOutput);

  return {
    branch: execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), encoding: 'utf8' }).trim(),
    headCommit: execSync('git rev-parse HEAD', { cwd: process.cwd(), encoding: 'utf8' }).trim(),
    headCommitShort: execSync('git rev-parse --short HEAD', { cwd: process.cwd(), encoding: 'utf8' }).trim(),
    headMessage: execSync('git log -1 --format=%s', { cwd: process.cwd(), encoding: 'utf8' }).trim(),
    isClean: statusOutput.trim() === '',
    dirtyEntries,
  };
};

export const resolveTargetVersion = ({ currentVersion, latestDeployedVersion, releaseType }) => {
  if (compareSemverVersions(currentVersion, latestDeployedVersion) > 0) {
    return currentVersion;
  }

  return incrementVersion(latestDeployedVersion, releaseType);
};

export const buildReleasePlan = ({ lastDeploy, currentVersion, gitState }) => {
  const changedFiles = getChangedFiles(lastDeploy.commit, gitState.headCommit);
  const commitSubjects = getCommitSubjects(lastDeploy.commit, gitState.headCommit);

  if (changedFiles.length === 0) {
    throw new Error(`No unreleased changes found after ${lastDeploy.commitShort}.`);
  }

  const classification = classifyRelease({ changedFiles, commitSubjects });
  const targetVersion = resolveTargetVersion({
    currentVersion,
    latestDeployedVersion: lastDeploy.packageVersion,
    releaseType: classification.releaseType,
  });
  const releaseNotesPath = path.resolve(RELEASES_DIR, `v${targetVersion}.md`);

  return {
    currentVersion,
    previousCommit: lastDeploy.commit,
    previousVersion: lastDeploy.packageVersion,
    changedFiles,
    commitSubjects,
    releaseType: classification.releaseType,
    reasons: classification.reasons,
    touchedAreas: classification.touchedAreas,
    targetVersion,
    releaseNotesPath,
    gitState,
  };
};

export const markReleaseNotesDeployed = (content, deployedAt) =>
  content
    .replace(/^- Status: .*/gm, '- Status: deployed')
    .replace(/^- Release date: .*/m, `- Release date: ${deployedAt}`);
