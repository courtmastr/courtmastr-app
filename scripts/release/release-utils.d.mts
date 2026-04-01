export interface LatestProductionDeploy {
  date: string | null;
  releaseId: string | null;
  packageVersion: string | null;
  branch: string | null;
  commit: string | null;
  commitShort: string | null;
  releaseNotesPath: string | null;
}

export interface ReleaseClassification {
  releaseType: 'patch' | 'minor' | 'major';
  reasons: string[];
  touchedAreas: string[];
}

export interface GitState {
  branch: string;
  headCommit: string;
  headCommitShort: string;
  headMessage: string;
  isClean: boolean;
  dirtyEntries: {
    code: string;
    path: string;
  }[];
}

export interface ReleasePlan {
  currentVersion: string;
  previousCommit: string;
  previousVersion: string;
  changedFiles: string[];
  commitSubjects: string[];
  releaseType: 'patch' | 'minor' | 'major';
  reasons: string[];
  touchedAreas: string[];
  targetVersion: string;
  releaseNotesPath: string;
  gitState: GitState;
}

export const LAST_DEPLOY_RECORD_PATH: string;
export const RELEASES_DIR: string;

export function parseLatestProductionDeploy(content: string): LatestProductionDeploy;
export function incrementVersion(version: string, releaseType: 'patch' | 'minor' | 'major'): string;
export function getChangedFiles(fromCommit: string, toCommit?: string): string[];
export function getCommitSubjects(fromCommit: string, toCommit?: string): string[];
export function detectTouchedAreas(changedFiles: string[]): string[];
export function classifyRelease(args: {
  changedFiles: string[];
  commitSubjects: string[];
}): ReleaseClassification;
export function normalizeCommitSubject(subject: string): string;
export function selectHighlights(commitSubjects: string[]): string[];
export function buildReleaseSummary(args: {
  releaseType: 'patch' | 'minor' | 'major';
  changedFiles: string[];
  previousCommit: string;
  headCommit: string;
  touchedAreas: string[];
}): string;
export function collectRiskNotes(changedFiles: string[], releaseType: 'patch' | 'minor' | 'major'): string[];
export function buildReleaseNotes(args: {
  version: string;
  releaseType: 'patch' | 'minor' | 'major';
  status: string;
  branch: string;
  headCommit: string;
  previousCommit: string;
  commitSubjects: string[];
  changedFiles: string[];
  touchedAreas: string[];
  generatedAt?: string;
}): string;
export function formatCentralDateTime(date?: Date): string;
export function formatCentralDate(date?: Date): string;
export function parseDirtyWorktreeEntries(statusOutput: string): {
  code: string;
  path: string;
}[];
export function formatDirtyWorktreeMessage(commandName: string, dirtyEntries: {
  code: string;
  path: string;
}[]): string;
export function assertCleanGitState(commandName: string, gitState: GitState): void;
export function buildPreviousReleaseBullet(deploy: LatestProductionDeploy): string;
export function updateLastDeployRecord(content: string, newDeploy: {
  date: string;
  releaseId: string;
  packageVersion: string;
  branch: string;
  commit: string;
  commitShort: string;
  commitMessage: string;
  releaseNotesPath: string;
  deployLogPath?: string;
}): string;
export function readCurrentVersion(): string;
export function getCurrentGitState(): GitState;
export function resolveTargetVersion(args: {
  currentVersion: string;
  latestDeployedVersion: string;
  releaseType: 'patch' | 'minor' | 'major';
}): string;
export function buildReleasePlan(args: {
  lastDeploy: LatestProductionDeploy;
  currentVersion: string;
  gitState: GitState;
}): ReleasePlan;
