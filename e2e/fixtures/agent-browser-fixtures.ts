import { test as base, expect, Page } from '@playwright/test';
import { AgentBrowser } from '../utils/agent-browser';

export interface TestFixtures {
  agentBrowser: AgentBrowser;
  usingAgentBrowser: boolean;
}

export const test = base.extend<TestFixtures>({
  agentBrowser: async (_context: object, use) => {
    const browser = new AgentBrowser({
      session: 'playwright-test',
      profile: process.env.AGENT_BROWSER_PROFILE,
    });
    await use(browser);
    await browser.close();
  },
  
  usingAgentBrowser: [false, { option: true }],
});

export { expect };

export async function withAgentBrowser<T>(
  page: Page,
  agentBrowser: AgentBrowser,
  action: () => Promise<T>
): Promise<T> {
  const url = page.url();
  await agentBrowser.open(url);
  return action();
}

export async function debugWithAgentBrowser(
  page: Page,
  agentBrowser: AgentBrowser,
  description: string
): Promise<void> {
  console.log(`🔍 Debugging: ${description}`);
  
  const url = page.url();
  await agentBrowser.open(url);
  await agentBrowser.waitForTimeout(500);
  
  const snapshot = await agentBrowser.snapshot();
  if (snapshot.success && snapshot.data) {
    console.log('📸 Page Snapshot:');
    console.log(snapshot.data.snapshot);
  }
  
  const screenshotPath = await agentBrowser.screenshot();
  console.log(`📷 Screenshot saved: ${screenshotPath}`);
}
