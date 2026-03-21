import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { waitForPostLoginLanding } from './utils/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const authDir = join(__dirname, '.auth');
const testDataFile = join(process.cwd(), 'e2e', '.test-data.json');
const isVerboseSetupLog = process.env.PW_SEED_VERBOSE === '1';
const SEED_TIMEOUT_MS = 180_000;

interface ProcessOutputError {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

const normalizeProcessOutput = (value: string | Buffer | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Buffer) {
    return value.toString('utf-8');
  }

  return '';
};

const getProcessErrorOutput = (error: unknown): string => {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const processError = error as ProcessOutputError;
  const stdout = normalizeProcessOutput(processError.stdout).trim();
  const stderr = normalizeProcessOutput(processError.stderr).trim();

  return [stdout, stderr].filter(Boolean).join('\n');
};

setup.describe.configure({ mode: 'serial' });

setup('seed test tournament', async () => {
  console.log('Seeding test tournament data...');
  
  try {
    const result = execSync('npx tsx scripts/seed/local.ts', {
      encoding: 'utf-8',
      timeout: SEED_TIMEOUT_MS,
      cwd: process.cwd(),
    });

    const tournamentIdMatch = result.match(/Tournament ID:\s*([a-zA-Z0-9]+)/);
    if (!tournamentIdMatch) {
      throw new Error('Could not extract tournament ID from seed script output');
    }
    
    const tournamentId = tournamentIdMatch[1];
    console.log(`Seeded tournament: ${tournamentId}`);

    if (isVerboseSetupLog) {
      console.log('Seed output:');
      console.log(result.trim());
    }
    
    const testData = {
      tournamentId,
      createdAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(testDataFile, JSON.stringify(testData, null, 2));
    console.log(`Saved test data: ${testDataFile}`);
  } catch (error) {
    const processErrorOutput = getProcessErrorOutput(error);
    if (processErrorOutput) {
      console.error('Seed command output:');
      console.error(processErrorOutput);
    }
    console.error('Failed to seed test tournament:', error);
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
  
  await waitForPostLoginLanding(page, 10000);

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

  await waitForPostLoginLanding(page, 10000);

  await page.context().storageState({ path: join(authDir, 'scorekeeper.json') });
});
