import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const authDir = join(__dirname, '.auth');
const testDataFile = join(process.cwd(), 'e2e', '.test-data.json');

setup.describe.configure({ mode: 'serial' });

setup('seed test tournament', async () => {
  console.log('🌱 Seeding test tournament data via local seed script...');
  
  try {
    const result = execSync('npx tsx scripts/seed/local.ts', {
      encoding: 'utf-8',
      timeout: 60000,
      cwd: process.cwd(),
    });
    
    console.log(result);
    
    const tournamentIdMatch = result.match(/Tournament ID:\s*([a-zA-Z0-9]+)/);
    if (!tournamentIdMatch) {
      throw new Error('Could not extract tournament ID from seed script output');
    }
    
    const tournamentId = tournamentIdMatch[1];
    console.log(`✓ Extracted tournament ID: ${tournamentId}`);
    
    const testData = {
      tournamentId,
      createdAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(testDataFile, JSON.stringify(testData, null, 2));
    console.log(`✓ Test data saved to ${testDataFile}`);
  } catch (error) {
    console.error('❌ Failed to seed test tournament:', error);
    throw error;
  }
});

setup('authenticate as admin', async ({ page }) => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/login');
  
  await page.getByLabel('Email').fill('admin@courtmastr.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  
  await page.waitForURL('/tournaments', { timeout: 10000 });

  await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();

  await page.context().storageState({ path: join(authDir, 'admin.json') });
});

setup('authenticate as scorekeeper', async ({ page }) => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/login');

  await page.getByLabel('Email').fill('scorekeeper@courtmastr.com');
  await page.locator('input[type="password"]').fill('score123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/tournaments', { timeout: 10000 });

  await expect(page.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();

  await page.context().storageState({ path: join(authDir, 'scorekeeper.json') });
});
