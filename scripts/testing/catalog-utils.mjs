import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const WORKFLOWS = [
  'organization',
  'registration',
  'check-in',
  'scheduling',
  'publish',
  'match-control',
  'scoring',
  'public-views',
  'tournament-lifecycle',
  'post-completion',
  'auth-roles',
  'leaderboard',
];

export const LAYERS = ['unit', 'integration', 'e2e'];
export const RISKS = ['critical', 'high', 'medium', 'low'];
export const AUTOMATION_STATUSES = ['active', 'retired'];
export const CATALOG_PATH = path.resolve(process.cwd(), 'docs/testing/test-catalog.json');

export const loadCatalog = async (catalogPath = CATALOG_PATH) => {
  const raw = await readFile(catalogPath, 'utf8');
  return JSON.parse(raw);
};

const validateCase = (entry, index, seenIds) => {
  const errors = [];
  const prefix = `cases[${index}]`;

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return [`${prefix} must be an object.`];
  }

  const requiredStringFields = ['id', 'title', 'workflow', 'feature', 'risk', 'layer', 'automation_status', 'test_file', 'test_name_pattern'];
  for (const field of requiredStringFields) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      errors.push(`${prefix}.${field} must be a non-empty string.`);
    }
  }

  if (typeof entry.required_for_release !== 'boolean') {
    errors.push(`${prefix}.required_for_release must be a boolean.`);
  }

  if (entry.id) {
    if (seenIds.has(entry.id)) {
      errors.push(`${prefix}.id must be unique.`);
    }
    seenIds.add(entry.id);
  }

  if (entry.workflow && !WORKFLOWS.includes(entry.workflow)) {
    errors.push(`${prefix}.workflow must be one of: ${WORKFLOWS.join(', ')}`);
  }
  if (entry.layer && !LAYERS.includes(entry.layer)) {
    errors.push(`${prefix}.layer must be one of: ${LAYERS.join(', ')}`);
  }
  if (entry.risk && !RISKS.includes(entry.risk)) {
    errors.push(`${prefix}.risk must be one of: ${RISKS.join(', ')}`);
  }
  if (entry.automation_status && !AUTOMATION_STATUSES.includes(entry.automation_status)) {
    errors.push(`${prefix}.automation_status must be one of: ${AUTOMATION_STATUSES.join(', ')}`);
  }

  return errors;
};

export const validateCatalog = (catalog) => {
  const errors = [];

  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return ['Catalog must be an object.'];
  }

  if (catalog.version !== 1) {
    errors.push('Catalog version must be 1.');
  }

  if (!Array.isArray(catalog.workflows)) {
    errors.push('Catalog workflows must be an array.');
  } else {
    const invalidWorkflow = catalog.workflows.find((workflow) => typeof workflow !== 'string' || workflow.trim().length === 0);
    if (invalidWorkflow !== undefined) {
      errors.push('Catalog workflows must contain non-empty strings.');
    }
    const unknownWorkflow = catalog.workflows.find((workflow) => !WORKFLOWS.includes(workflow));
    if (unknownWorkflow !== undefined) {
      errors.push(`Catalog workflows must be limited to: ${WORKFLOWS.join(', ')}`);
    }
  }

  if (!Array.isArray(catalog.cases)) {
    errors.push('Catalog cases must be an array.');
    return errors;
  }

  const seenIds = new Set();
  for (const [index, entry] of catalog.cases.entries()) {
    errors.push(...validateCase(entry, index, seenIds));
  }

  return errors;
};

export const resolveCatalogAgainstInventory = (catalog, inventory) => {
  const inventoryByFile = new Map((inventory ?? []).map((entry) => [entry.test_file, entry]));
  const seenIds = new Set();
  return (catalog?.cases ?? []).map((entry, index) => {
    const validationErrors = validateCase(entry, index, seenIds);
    const fileInventory = inventoryByFile.get(entry.test_file);
    const matchedTitles = fileInventory?.matchedTitles ?? [];
    const hasFile = fileInventory?.hasFile ?? existsSync(path.resolve(process.cwd(), entry.test_file));
    const hasMatch = matchedTitles.some((title) => title.includes(entry.test_name_pattern));

    return {
      ...entry,
      matchedTitles,
      hasFile,
      hasMatch,
      validationErrors,
    };
  });
};
