import { test as teardown } from '@playwright/test';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const authDir = join(__dirname, '.auth');

teardown('cleanup auth states', async () => {
  const files = ['admin.json', 'scorekeeper.json'];
  for (const file of files) {
    const filePath = join(authDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});
