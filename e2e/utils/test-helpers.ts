import { AgentBrowser } from './agent-browser';

export interface TestHelpers {
  browser: AgentBrowser;
  log: (message: string) => void;
  screenshot: (name: string) => Promise<string>;
  snapshot: () => Promise<void>;
}

export function createTestHelpers(browser: AgentBrowser): TestHelpers {
  return {
    browser,
    log: (message: string) => {
      console.log(`[Test] ${message}`);
    },
    screenshot: async (name: string) => {
      const path = await browser.screenshot(`./.agent-browser/screenshots/${name}-${Date.now()}.png`);
      console.log(`[Screenshot] ${path}`);
      return path;
    },
    snapshot: async () => {
      const result = await browser.snapshot();
      if (result.success && result.data) {
        console.log('[Snapshot]');
        console.log(result.data.snapshot);
      }
    },
  };
}

export async function runTestFlow(
  browser: AgentBrowser,
  flowName: string,
  steps: Array<{
    name: string;
    action: (helpers: TestHelpers) => Promise<void>;
  }>
): Promise<void> {
  const helpers = createTestHelpers(browser);
  
  console.log(`\n🚀 Starting test flow: ${flowName}`);
  console.log('=' .repeat(50));
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n📍 Step ${i + 1}/${steps.length}: ${step.name}`);
    
    try {
      await step.action(helpers);
      console.log(`✅ Step ${i + 1} completed`);
    } catch (error) {
      console.error(`❌ Step ${i + 1} failed:`, error);
      await helpers.screenshot(`error-step-${i + 1}`);
      throw error;
    }
  }
  
  console.log(`\n✨ Test flow completed: ${flowName}`);
}

export const commonFlows = {
  async loginAsAdmin(browser: AgentBrowser): Promise<void> {
    await browser.loginAsAdmin();
  },
  
  async createTournament(
    browser: AgentBrowser,
    name: string,
    description: string
  ): Promise<void> {
    await browser.navigateToTournamentCreate();
    await browser.waitForTimeout(1000);
    
    const snapshot = await browser.snapshot();
    if (!snapshot.success || !snapshot.data) {
      throw new Error('Failed to get create tournament page snapshot');
    }
    
    const nameInput = Object.entries(snapshot.data.refs).find(
      ([, el]) => el.role === 'textbox' && el.name?.toLowerCase().includes('name')
    );
    const descInput = Object.entries(snapshot.data.refs).find(
      ([, el]) => el.role === 'textbox' && el.name?.toLowerCase().includes('description')
    );
    
    if (nameInput) await browser.fill(`@${nameInput[0]}`, name);
    if (descInput) await browser.fill(`@${descInput[0]}`, description);
    
    await browser.waitForTimeout(500);
  },
  
  async addPlayer(
    browser: AgentBrowser,
    firstName: string,
    lastName: string,
    email: string
  ): Promise<void> {
    const snapshot = await browser.snapshot();
    if (!snapshot.success || !snapshot.data) return;
    
    const addButton = Object.entries(snapshot.data.refs).find(
      ([, el]) => el.role === 'button' && el.name?.toLowerCase().includes('add player')
    );
    
    if (addButton) {
      await browser.click(`@${addButton[0]}`);
      await browser.waitForTimeout(500);
      
      const dialogSnapshot = await browser.snapshot();
      if (dialogSnapshot.success && dialogSnapshot.data) {
        const firstNameInput = Object.entries(dialogSnapshot.data.refs).find(
          ([, el]) => el.name?.toLowerCase().includes('first name')
        );
        const lastNameInput = Object.entries(dialogSnapshot.data.refs).find(
          ([, el]) => el.name?.toLowerCase().includes('last name')
        );
        const emailInput = Object.entries(dialogSnapshot.data.refs).find(
          ([, el]) => el.name?.toLowerCase().includes('email')
        );
        
        if (firstNameInput) await browser.fill(`@${firstNameInput[0]}`, firstName);
        if (lastNameInput) await browser.fill(`@${lastNameInput[0]}`, lastName);
        if (emailInput) await browser.fill(`@${emailInput[0]}`, email);
        
        const submitButton = Object.entries(dialogSnapshot.data.refs).find(
          ([, el]) => el.role === 'button' && el.name?.toLowerCase().includes('add')
        );
        if (submitButton) await browser.click(`@${submitButton[0]}`);
      }
    }
  },
};
