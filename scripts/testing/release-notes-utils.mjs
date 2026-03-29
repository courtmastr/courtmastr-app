import fs from 'node:fs';
import path from 'node:path';

export const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
export const RELEASES_DIR = path.resolve(process.cwd(), 'docs/releases');
export const LAST_DEPLOY_PATH = path.resolve(process.cwd(), 'docs/deployment/LAST_DEPLOY.md');

export const REQUIRED_RELEASE_NOTE_HEADINGS = [
  '## Summary',
  '## Highlights',
  '## Verification',
  '## Deployment',
  '## Risks / Follow-Ups',
];

export const readPackageVersion = (packageJsonPath = PACKAGE_JSON_PATH) => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid package.json version: ${String(version)}`);
  }

  return version;
};

export const getReleaseNotesPath = (version, releasesDir = RELEASES_DIR) =>
  path.resolve(releasesDir, `v${version}.md`);

export const compareSemverVersions = (left, right) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }

  return 0;
};

export const extractLatestDeployedPackageVersion = (content) =>
  content.match(/## Latest Production Deploy[\s\S]*?- Package version: `(\d+\.\d+\.\d+)`/)?.[1] ?? null;

export const validateReleaseNotesContent = (content, version) => {
  const errors = [];

  if (!content.includes(`# Release v${version}`)) {
    errors.push(`Release notes must start with "# Release v${version}".`);
  }

  for (const heading of REQUIRED_RELEASE_NOTE_HEADINGS) {
    if (!content.includes(heading)) {
      errors.push(`Release notes missing required section: ${heading}`);
    }
  }

  return errors;
};

export const verifyReleaseNotes = ({
  packageJsonPath = PACKAGE_JSON_PATH,
  releasesDir = RELEASES_DIR,
  lastDeployPath = LAST_DEPLOY_PATH,
  enforceVersionBump = true,
} = {}) => {
  const version = readPackageVersion(packageJsonPath);
  const releaseNotesPath = getReleaseNotesPath(version, releasesDir);

  if (!fs.existsSync(releaseNotesPath)) {
    throw new Error(`Missing release notes for v${version}: ${releaseNotesPath}`);
  }

  const content = fs.readFileSync(releaseNotesPath, 'utf8');
  const validationErrors = validateReleaseNotesContent(content, version);

  if (validationErrors.length > 0) {
    throw new Error(`Invalid release notes for v${version}: ${validationErrors.join(' ')}`);
  }

  if (enforceVersionBump && fs.existsSync(lastDeployPath)) {
    const lastDeployContent = fs.readFileSync(lastDeployPath, 'utf8');
    const latestDeployedVersion = extractLatestDeployedPackageVersion(lastDeployContent);

    if (latestDeployedVersion && compareSemverVersions(version, latestDeployedVersion) <= 0) {
      throw new Error(`Package version ${version} must be greater than latest deployed version ${latestDeployedVersion} before the next production release.`);
    }
  }

  return {
    version,
    releaseId: `v${version}`,
    releaseNotesPath,
  };
};
