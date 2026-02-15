import * as fs from 'fs';
import { join } from 'path';

const testDataFile = join(process.cwd(), 'e2e', '.test-data.json');

export interface TestData {
  tournamentId: string;
  createdAt: string;
}

function waitForFile(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getTestData(maxWaitMs: number = 10000): Promise<TestData> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    if (fs.existsSync(testDataFile)) {
      try {
        const content = fs.readFileSync(testDataFile, 'utf-8');
        return JSON.parse(content) as TestData;
      } catch (e) {
        console.log('File exists but could not be read, retrying...');
      }
    }
    await waitForFile(100);
  }
  
  throw new Error(
    `Test data file not found after ${maxWaitMs}ms. Make sure to run auth.setup.ts first to seed the test tournament.`
  );
}

export async function getTournamentId(maxWaitMs?: number): Promise<string> {
  const data = await getTestData(maxWaitMs);
  return data.tournamentId;
}
