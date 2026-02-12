import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface AgentBrowserOptions {
  session?: string;
  profile?: string;
  headed?: boolean;
  timeout?: number;
}

export interface SnapshotElement {
  ref: string;
  role: string;
  name?: string;
  level?: number;
}

export interface SnapshotResult {
  success: boolean;
  data?: {
    snapshot: string;
    refs: Record<string, SnapshotElement>;
  };
  error?: string;
}

export class AgentBrowser {
  private session: string;
  private profile: string;
  private headed: boolean;
  private timeout: number;
  private baseUrl: string;

  constructor(options: AgentBrowserOptions = {}) {
    this.session = options.session || 'opencode';
    this.profile = options.profile || this.getDefaultProfilePath();
    this.headed = options.headed || false;
    this.timeout = options.timeout || 30000;
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    
    this.ensureProfileDirectory();
  }

  private getDefaultProfilePath(): string {
    return join(process.cwd(), '.agent-browser', 'profiles', 'default');
  }

  private ensureProfileDirectory(): void {
    if (!existsSync(this.profile)) {
      mkdirSync(this.profile, { recursive: true });
    }
  }

  private exec(command: string): string {
    const fullCommand = `agent-browser --session ${this.session} ${command}`;
    try {
      return execSync(fullCommand, {
        encoding: 'utf-8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error: any) {
      throw new Error(`Agent-browser command failed: ${error.message}`);
    }
  }

  async open(url?: string): Promise<void> {
    const targetUrl = url || this.baseUrl;
    this.exec(`open ${targetUrl}`);
  }

  async snapshot(interactiveOnly: boolean = true): Promise<SnapshotResult> {
    const flags = interactiveOnly ? '-i -c' : '';
    const output = this.exec(`snapshot ${flags} --json`);
    
    try {
      return JSON.parse(output);
    } catch {
      return {
        success: false,
        error: 'Failed to parse snapshot output',
      };
    }
  }

  async click(ref: string): Promise<void> {
    this.exec(`click ${ref}`);
  }

  async fill(ref: string, text: string): Promise<void> {
    this.exec(`fill ${ref} "${text}"`);
  }

  async type(ref: string, text: string): Promise<void> {
    this.exec(`type ${ref} "${text}"`);
  }

  async press(key: string): Promise<void> {
    this.exec(`press ${key}`);
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    const waitTime = timeout || this.timeout;
    this.exec(`wait ${selector} --timeout ${waitTime}`);
  }

  async waitForText(text: string, timeout?: number): Promise<void> {
    const waitTime = timeout || this.timeout;
    this.exec(`wait --text "${text}" --timeout ${waitTime}`);
  }

  async getText(ref: string): Promise<string> {
    return this.exec(`get text ${ref}`).trim();
  }

  async screenshot(path?: string): Promise<string> {
    const screenshotPath = path || join(process.cwd(), '.agent-browser', 'screenshots', `screenshot-${Date.now()}.png`);
    this.exec(`screenshot ${screenshotPath}`);
    return screenshotPath;
  }

  async close(): Promise<void> {
    try {
      this.exec('close');
    } catch {
      // Ignore errors when closing
    }
  }

  async navigateToTournamentList(): Promise<void> {
    await this.open(`${this.baseUrl}/tournaments`);
  }

  async navigateToTournamentCreate(): Promise<void> {
    await this.open(`${this.baseUrl}/tournaments/create`);
  }

  async navigateToTournament(tournamentId: string): Promise<void> {
    await this.open(`${this.baseUrl}/tournaments/${tournamentId}`);
  }

  async navigateToRegistrations(tournamentId: string): Promise<void> {
    await this.open(`${this.baseUrl}/tournaments/${tournamentId}/registrations`);
  }

  async navigateToMatchControl(tournamentId: string): Promise<void> {
    await this.open(`${this.baseUrl}/tournaments/${tournamentId}/match-control`);
  }

  async loginAsAdmin(): Promise<void> {
    await this.open(`${this.baseUrl}/login`);
    await this.waitForTimeout(1000);
    
    const snapshot = await this.snapshot();
    if (!snapshot.success || !snapshot.data) {
      throw new Error('Failed to get login page snapshot');
    }

    const emailInput = this.findElementByRole(snapshot.data.refs, 'textbox', 'email');
    const passwordInput = this.findElementByRole(snapshot.data.refs, 'textbox', 'password');
    const submitButton = this.findElementByRole(snapshot.data.refs, 'button', 'sign in');

    if (emailInput) await this.fill(`@${emailInput.ref}`, 'admin@courtmaster.local');
    if (passwordInput) await this.fill(`@${passwordInput.ref}`, 'admin123');
    if (submitButton) await this.click(`@${submitButton.ref}`);
    
    await this.waitForTimeout(2000);
  }

  async waitForTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private findElementByRole(
    refs: Record<string, SnapshotElement>,
    role: string,
    name?: string
  ): SnapshotElement | null {
    for (const [key, element] of Object.entries(refs)) {
      if (element.role === role) {
        if (!name || (element.name && element.name.toLowerCase().includes(name.toLowerCase()))) {
          return { ...element, ref: key };
        }
      }
    }
    return null;
  }
}

export function createAgentBrowser(options?: AgentBrowserOptions): AgentBrowser {
  return new AgentBrowser(options);
}
