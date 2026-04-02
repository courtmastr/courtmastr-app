#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  LAST_DEPLOY_RECORD_PATH,
  assertCleanGitState,
  buildReleaseNotes,
  buildReleasePlan,
  formatCentralDateTime,
  getCurrentGitState,
  markReleaseNotesDeployed,
  parseLatestProductionDeploy,
  readCurrentVersion,
  restorePreReleaseGeneratedFiles,
  rollbackReleaseWorktree,
  updateLastDeployRecord,
} from './release-utils.mjs';

const runCommand = (command) => {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 20 * 1024 * 1024,
    });

    process.stdout.write(output);
    return output;
  } catch (error) {
    if (error.stdout) {
      process.stdout.write(error.stdout);
    }
    if (error.stderr) {
      process.stderr.write(error.stderr);
    }
    throw error;
  }
};

const readLastDeploy = () => {
  const content = fs.readFileSync(LAST_DEPLOY_RECORD_PATH, 'utf8');
  const metadata = parseLatestProductionDeploy(content);

  if (!metadata.packageVersion || !metadata.commit || !metadata.releaseId) {
    throw new Error(`Unable to parse latest deploy metadata from ${LAST_DEPLOY_RECORD_PATH}.`);
  }

  return {
    content,
    metadata,
  };
};

const updateReleaseNoteForDeploy = (releaseNotesPath, deployedAt) => {
  const content = fs.readFileSync(releaseNotesPath, 'utf8');
  const updated = markReleaseNotesDeployed(content, deployedAt);

  fs.writeFileSync(releaseNotesPath, updated, 'utf8');
};

const printPlan = (plan, latestDeploy) => {
  console.log(`Latest deployed release: ${latestDeploy.releaseId} (${latestDeploy.packageVersion})`);
  console.log(`Unreleased range: ${latestDeploy.commitShort}..${plan.gitState.headCommitShort}`);
  console.log(`Current package version: ${plan.currentVersion}`);
  console.log(`Recommended release type: ${plan.releaseType}`);
  console.log(`Recommended next version: ${plan.targetVersion}`);
  console.log(`Draft release note: ${plan.releaseNotesPath}`);
  console.log(`Changed files: ${plan.changedFiles.length}`);
  console.log(`Touched areas: ${plan.touchedAreas.join(', ') || 'release orchestration'}`);
  console.log('Reasons:');
  for (const reason of plan.reasons) {
    console.log(`- ${reason}`);
  }
};

const runPlanMode = () => {
  const { metadata } = readLastDeploy();
  restorePreReleaseGeneratedFiles();
  const gitState = getCurrentGitState();
  assertCleanGitState('release:plan', gitState);
  const currentVersion = readCurrentVersion();
  const plan = buildReleasePlan({
    lastDeploy: metadata,
    currentVersion,
    gitState,
  });

  printPlan(plan, metadata);
};

const runDeployMode = () => {
  const { metadata, content: lastDeployContent } = readLastDeploy();
  restorePreReleaseGeneratedFiles();
  const gitState = getCurrentGitState();
  assertCleanGitState('release:deploy', gitState);

  const currentVersion = readCurrentVersion();
  const plan = buildReleasePlan({
    lastDeploy: metadata,
    currentVersion,
    gitState,
  });

  const releaseNotesPath = plan.releaseNotesPath;

  const rollback = () => {
    const rollbackGitState = getCurrentGitState();
    rollbackReleaseWorktree({
      cwd: process.cwd(),
      headCommit: gitState.headCommit,
      dirtyEntries: rollbackGitState.dirtyEntries,
    });
  };

  try {
    if (plan.targetVersion !== currentVersion) {
      runCommand(`npm version ${plan.targetVersion} --no-git-tag-version`);
    }

    fs.mkdirSync(path.dirname(releaseNotesPath), { recursive: true });
    const releaseNotes = buildReleaseNotes({
      version: plan.targetVersion,
      releaseType: plan.releaseType,
      status: 'planned',
      branch: plan.gitState.branch,
      headCommit: plan.gitState.headCommit,
      previousCommit: plan.previousCommit,
      commitSubjects: plan.commitSubjects,
      changedFiles: plan.changedFiles,
      touchedAreas: plan.touchedAreas,
      generatedAt: 'pending',
    });
    fs.writeFileSync(releaseNotesPath, releaseNotes, 'utf8');

    const deployLogOutput = runCommand('npm run deploy:log');
    const deployLogPath = deployLogOutput.match(/📄 Log saved: (.+)/)?.[1]?.trim();

    const deployedAt = formatCentralDateTime(new Date());
    updateReleaseNoteForDeploy(releaseNotesPath, deployedAt);

    const updatedLastDeploy = updateLastDeployRecord(lastDeployContent, {
      date: deployedAt,
      releaseId: `v${plan.targetVersion}`,
      packageVersion: plan.targetVersion,
      branch: plan.gitState.branch,
      commit: plan.gitState.headCommit,
      commitShort: plan.gitState.headCommitShort,
      commitMessage: plan.gitState.headMessage,
      releaseNotesPath,
      deployLogPath,
    });
    fs.writeFileSync(LAST_DEPLOY_RECORD_PATH, updatedLastDeploy, 'utf8');

    console.log(`Release deploy complete: v${plan.targetVersion}`);
    console.log(`Release notes: ${releaseNotesPath}`);
  } catch (error) {
    rollback();
    throw error;
  }
};

const mode = process.argv[2];

if (mode === 'plan') {
  runPlanMode();
} else if (mode === 'deploy') {
  runDeployMode();
} else {
  console.error('Usage: node scripts/release/release-cli.mjs <plan|deploy>');
  process.exit(1);
}
