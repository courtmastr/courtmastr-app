import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { resolveCatalogAgainstInventory } from './catalog-utils.mjs';

const TEST_FILE_PATTERN = /\.(test|spec)\.ts$/;

const classifyLayer = (relativePath) => {
  const normalizedPath = relativePath.split(path.sep).join('/');

  if (normalizedPath.startsWith('e2e/')) {
    return 'e2e';
  }

  if (normalizedPath.startsWith('tests/unit/')) {
    return 'unit';
  }

  if (normalizedPath.startsWith('tests/integration/')) {
    return 'integration';
  }

  return 'unknown';
};

const walkFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
};

const extractMatchedTitles = (content) => {
  const titles = [];
  const patterns = [
    /(?:^|\s)(?:test|it)\(\s*(['"`])((?:\\.|(?!\1).)+)\1/g,
    /test\.describe\(\s*(['"`])((?:\\.|(?!\1).)+)\1/g,
    /describe\(\s*(['"`])((?:\\.|(?!\1).)+)\1/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      titles.push(match[2].replaceAll(/\\(['"`])/g, '$1'));
    }
  }

  return [...new Set(titles)];
};

export const collectTestInventory = async (rootDir = process.cwd()) => {
  const searchRoots = ['tests', 'e2e'];
  const files = [];

  for (const relativeRoot of searchRoots) {
    const absoluteRoot = path.resolve(rootDir, relativeRoot);
    try {
      const rootStats = await stat(absoluteRoot);
      if (rootStats.isDirectory()) {
        files.push(...await walkFiles(absoluteRoot));
      }
    } catch {
      continue;
    }
  }

  const inventory = [];
  for (const absoluteFilePath of files) {
    const content = await readFile(absoluteFilePath, 'utf8');
    const testFile = path.relative(rootDir, absoluteFilePath);
    inventory.push({
      test_file: testFile,
      absoluteFilePath,
      layer: classifyLayer(testFile),
      hasFile: true,
      matchedTitles: extractMatchedTitles(content),
    });
  }

  return inventory;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const inventory = await collectTestInventory(process.cwd());
  console.log(JSON.stringify(inventory, null, 2));
}

export { resolveCatalogAgainstInventory };
