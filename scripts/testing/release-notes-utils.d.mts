export const PACKAGE_JSON_PATH: string;
export const RELEASES_DIR: string;
export const LAST_DEPLOY_PATH: string;
export const REQUIRED_RELEASE_NOTE_HEADINGS: string[];

export interface ReleaseMetadata {
  version: string;
  releaseId: string;
  releaseNotesPath: string;
}

export function readPackageVersion(packageJsonPath?: string): string;
export function getReleaseNotesPath(version: string, releasesDir?: string): string;
export function compareSemverVersions(left: string, right: string): number;
export function extractLatestDeployedPackageVersion(content: string): string | null;
export function validateReleaseNotesContent(content: string, version: string): string[];
export function verifyReleaseNotes(args?: {
  packageJsonPath?: string;
  releasesDir?: string;
  lastDeployPath?: string;
  enforceVersionBump?: boolean;
}): ReleaseMetadata;
