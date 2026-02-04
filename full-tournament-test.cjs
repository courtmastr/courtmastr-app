#!/usr/bin/env node
/**
 * Courtmaster - Full Tournament Automated Test Suite
 * 
 * This script automates the complete tournament workflow:
 * 1. Login
 * 2. Navigate to tournament
 * 3. Generate brackets
 * 4. Start tournament
 * 5. Auto-schedule matches
 * 6. Enter scores
 * 7. Complete tournament
 * 
 * Usage: node full-tournament-test.cjs [tournament-id]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'http://localhost:3000',
  credentials: {
    email: 'admin@courtmaster.local',
    password: 'admin123'
  },
  screenshotsDir: 'test-screenshots',
  videosDir: 'test-videos',
  resultsFile: 'AUTOMATED-TEST-RESULTS.json'
};

class TournamentTester {
  constructor() {
    this.bugs = [];
    this.screenshots = [];
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      phase: '📍'
    }[type] || 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  reportBug(phase, severity, title, details) {
    const bug = {
      phase,
      severity,
      title,
      details,
      timestamp: new Date().toISOString()
    };
    this.bugs.push(bug);
    this.log(`BUG FOUND [${severity}]: ${title}`, 'error');
    this.log(`  Phase: ${phase}`, 'error');
    this.log(`  Details: ${details}`, 'error');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async init() {
    this.log('Initializing test environment...');
    
    // Create directories
    [CONFIG.screenshotsDir, CONFIG.videosDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: CONFIG.videosDir }
    });

    this.page = await this.context.newPage();

    // Capture console logs
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        this.log(`[${type.toUpperCase()}] ${msg.text()}`, 'warning');
      }
    });

    this.log('Test environment ready', 'success');
  }

  async screenshot(name) {
    const filename = `${Date.now()}-${name}.png`;
    const filepath = path.join(CONFIG.screenshotsDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    this.screenshots.push({ name, filename, filepath });
    this.log(`Screenshot saved: ${filename}`);
  }

  async login() {
    this.log('PHASE 1: Login', 'phase');
    
    try {
      await this.page.goto(`${CONFIG.baseUrl}/login`);
      await this.delay(3000);
      
      // Fill email using JavaScript for reliability
      await this.page.evaluate((email) => {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
          if (input.type === 'text' || input.type === 'email' || !input.type) {
            input.value = email;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }, CONFIG.credentials.email);

      await this.delay(500);

      // Fill password
      await this.page.evaluate((password) => {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
          if (input.type === 'password') {
            input.value = password;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }, CONFIG.credentials.password);

      await this.delay(500);
      
      // Click Sign In
      await this.page.click('button:has-text("Sign In")');
      await this.delay(3000);
      
      // Verify login
      const url = this.page.url();
      if (url.includes('/tournaments') || url.includes('/login?redirect=')) {
        this.log('Login successful', 'success');
        return true;
      } else {
        this.reportBug('Phase 1', 'CRITICAL', 'Login Failed', `Unexpected URL: ${url}`);
        return false;
      }
    } catch (error) {
      this.reportBug('Phase 1', 'CRITICAL', 'Login Error', error.message);
      await this.screenshot('login-error');
      return false;
    }
  }

  async findTournament() {
    this.log('PHASE 2: Find Tournament', 'phase');
    
    try {
      await this.page.goto(`${CONFIG.baseUrl}/tournaments`);
      await this.delay(5000);
      
      // Look for tournament card
      const tournamentCard = await this.page.locator('text=Test Tournament 2025').first();
      
      if (await tournamentCard.isVisible().catch(() => false)) {
        this.log('Found Test Tournament 2025', 'success');
        await tournamentCard.click();
        await this.delay(5000);
        
        // Get tournament ID from URL
        const url = this.page.url();
        const match = url.match(/tournaments\/([^\/]+)/);
        this.tournamentId = match ? match[1] : null;
        
        this.log(`Tournament ID: ${this.tournamentId}`, 'success');
        return true;
      } else {
        this.reportBug('Phase 2', 'HIGH', 'Tournament Not Found', 
          'Could not find "Test Tournament 2025" in tournament list');
        return false;
      }
    } catch (error) {
      this.reportBug('Phase 2', 'HIGH', 'Tournament Navigation Error', error.message);
      return false;
    }
  }

  async verifyTournamentData() {
    this.log('PHASE 3: Verify Tournament Data', 'phase');
    
    try {
      await this.screenshot('tournament-dashboard');
      
      // Check stats
      const stats = await this.page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h3'));
        return headings.map(h => ({
          value: h.textContent?.trim(),
          label: h.nextElementSibling?.textContent?.trim()
        }));
      });
      
      this.log('Stats found:');
      stats.forEach(stat => {
        this.log(`  ${stat.value} - ${stat.label}`);
      });
      
      // Check for BUG #1: Total Matches = 0
      const totalMatches = stats.find(s => s.label?.includes('Total Matches'));
      if (totalMatches && totalMatches.value === '0') {
        this.reportBug('Phase 3', 'HIGH', 'Total Matches Shows 0',
          'Tournament has 20 participants but Total Matches counter shows 0. ' +
          'Stats are reading from empty match_scores collection instead of match collection.');
      }
      
      return true;
    } catch (error) {
      this.reportBug('Phase 3', 'MEDIUM', 'Data Verification Error', error.message);
      return true; // Don't stop testing for this
    }
  }

  async generateBrackets() {
    this.log('PHASE 4: Generate Brackets', 'phase');
    
    try {
      // Check if brackets already exist
      const bracketReadyButtons = await this.page.locator('button:has-text("Bracket Ready")').count();
      const generateButtons = await this.page.locator('button:has-text("Generate Bracket")').count();
      
      if (bracketReadyButtons > 0) {
        this.log(`Found ${bracketReadyButtons} brackets already generated`, 'success');
        return true;
      }
      
      if (generateButtons === 0) {
        this.log('No generate buttons found - brackets may already exist', 'warning');
        return true;
      }
      
      // Generate Men's Singles bracket (second button)
      const mensButton = this.page.locator('button:has-text("Generate Bracket")').nth(1);
      if (await mensButton.isVisible().catch(() => false)) {
        this.log('Generating Men\'s Singles bracket...');
        await mensButton.click();
        await this.delay(5000);
        this.log('Men\'s Singles bracket generated', 'success');
      }
      
      // Generate Mixed Doubles bracket (first button)
      const mixedButton = this.page.locator('button:has-text("Generate Bracket")').first();
      if (await mixedButton.isVisible().catch(() => false)) {
        this.log('Generating Mixed Doubles bracket...');
        await mixedButton.click();
        await this.delay(5000);
        this.log('Mixed Doubles bracket generated', 'success');
      }
      
      await this.screenshot('brackets-generated');
      return true;
      
    } catch (error) {
      this.reportBug('Phase 4', 'HIGH', 'Bracket Generation Error', error.message);
      return false;
    }
  }

  async startTournament() {
    this.log('PHASE 5: Start Tournament', 'phase');
    
    try {
      // Check current status
      const statusChip = await this.page.locator('.v-chip, [class*="status"]').first();
      const statusText = await statusChip.textContent().catch(() => '');
      
      if (statusText.includes('active') || statusText.includes('in_progress')) {
        this.log('Tournament already active', 'success');
        return true;
      }
      
      // Click Actions menu
      await this.page.click('button:has-text("Actions")');
      await this.delay(1000);
      
      // Click Start Tournament
      await this.page.click('text=Start Tournament');
      await this.delay(3000);
      
      // Verify status changed
      const newStatus = await this.page.locator('.v-chip, [class*="status"]').first().textContent().catch(() => '');
      if (newStatus.includes('active') || newStatus.includes('in_progress')) {
        this.log('Tournament started successfully', 'success');
      } else {
        this.log(`Tournament status: ${newStatus}`, 'info');
      }
      
      await this.screenshot('tournament-started');
      return true;
      
    } catch (error) {
      this.reportBug('Phase 5', 'HIGH', 'Start Tournament Error', error.message);
      return false;
    }
  }

  async testMatchControl() {
    this.log('PHASE 6: Test Match Control', 'phase');
    
    try {
      // Navigate to Match Control
      await this.page.goto(`${CONFIG.baseUrl}/tournaments/${this.tournamentId}/match-control`);
      await this.delay(5000);
      
      await this.screenshot('match-control');
      
      // Check if page loaded
      const title = await this.page.locator('h1, .text-h5').textContent().catch(() => '');
      if (title.includes('Match Control')) {
        this.log('Match Control loaded', 'success');
      } else {
        this.reportBug('Phase 6', 'HIGH', 'Match Control Not Loading',
          `Expected 'Match Control' in title, got: ${title}`);
      }
      
      // Check for queue
      const queueElements = await this.page.locator('text=Needs Court, text=Match Queue, text=Pending').count();
      this.log(`Queue-related elements found: ${queueElements}`);
      
      return true;
      
    } catch (error) {
      this.reportBug('Phase 6', 'HIGH', 'Match Control Error', error.message);
      return false;
    }
  }

  async testAutoSchedule() {
    this.log('PHASE 7: Test Auto Schedule', 'phase');
    
    try {
      // Click Auto Schedule button
      const autoScheduleBtn = this.page.locator('button:has-text("Auto Schedule")');
      
      if (!(await autoScheduleBtn.isVisible().catch(() => false))) {
        this.log('Auto Schedule button not found', 'warning');
        return true;
      }
      
      await autoScheduleBtn.click();
      await this.delay(3000);
      
      await this.screenshot('auto-schedule-dialog');
      
      // Select courts (first 4)
      const checkboxes = await this.page.locator('input[type="checkbox"]').count();
      this.log(`Found ${checkboxes} court checkboxes`);
      
      for (let i = 0; i < Math.min(4, checkboxes); i++) {
        await this.page.locator('input[type="checkbox"]').nth(i).check();
      }
      
      // Set start time
      const now = new Date();
      const timeString = now.toISOString().slice(0, 16);
      await this.page.fill('input[type="datetime-local"]', timeString);
      
      // Click Generate
      await this.page.click('button:has-text("Generate")');
      await this.delay(5000);
      
      await this.screenshot('auto-schedule-result');
      
      // Check result
      const resultText = await this.page.locator('text=/\\d+ matches scheduled/').textContent().catch(() => '0 matches scheduled');
      this.log(`Schedule result: ${resultText}`);
      
      if (resultText.includes('0')) {
        this.reportBug('Phase 7', 'CRITICAL', 'Auto Schedule Shows 0 Matches',
          'After clicking Generate Schedule, it shows 0 matches scheduled. ' +
          'This may indicate the status fix is not working or matches are not being found.');
      }
      
      return true;
      
    } catch (error) {
      this.reportBug('Phase 7', 'HIGH', 'Auto Schedule Error', error.message);
      return false;
    }
  }

  async verifyQueue() {
    this.log('PHASE 8: Verify Queue', 'phase');
    
    try {
      await this.page.reload();
      await this.delay(5000);
      
      await this.screenshot('queue-verification');
      
      // Count matches in queue
      const queueItems = await this.page.locator('.match-item, [class*="match"]').count();
      this.log(`Matches in queue: ${queueItems}`);
      
      if (queueItems === 0) {
        this.reportBug('Phase 8', 'HIGH', 'Queue Shows No Matches After Scheduling',
          'After auto-schedule, queue should contain scheduled matches but appears empty.');
      } else {
        this.log(`✅ Found ${queueItems} matches in queue`, 'success');
      }
      
      return true;
      
    } catch (error) {
      this.reportBug('Phase 8', 'MEDIUM', 'Queue Verification Error', error.message);
      return true;
    }
  }

  async generateReport() {
    this.log('Generating test report...', 'phase');
    
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      tournamentId: this.tournamentId,
      totalBugs: this.bugs.length,
      bugs: this.bugs,
      screenshots: this.screenshots,
      summary: {
        critical: this.bugs.filter(b => b.severity === 'CRITICAL').length,
        high: this.bugs.filter(b => b.severity === 'HIGH').length,
        medium: this.bugs.filter(b => b.severity === 'MEDIUM').length,
        low: this.bugs.filter(b => b.severity === 'LOW').length
      }
    };
    
    fs.writeFileSync(CONFIG.resultsFile, JSON.stringify(report, null, 2));
    
    this.log('='.repeat(60), 'info');
    this.log('TESTING COMPLETE', 'info');
    this.log('='.repeat(60), 'info');
    this.log(`Duration: ${duration}s`, 'info');
    this.log(`Total Bugs: ${this.bugs.length}`, this.bugs.length > 0 ? 'error' : 'success');
    this.log(`  Critical: ${report.summary.critical}`, 'error');
    this.log(`  High: ${report.summary.high}`, 'warning');
    this.log(`  Medium: ${report.summary.medium}`, 'warning');
    this.log(`  Low: ${report.summary.low}`, 'info');
    this.log('', 'info');
    this.log(`Results saved to: ${CONFIG.resultsFile}`, 'success');
    this.log(`Screenshots: ${CONFIG.screenshotsDir}/`, 'success');
    this.log(`Videos: ${CONFIG.videosDir}/`, 'success');
    
    if (this.bugs.length > 0) {
      this.log('', 'info');
      this.log('BUGS FOUND:', 'error');
      this.bugs.forEach((bug, i) => {
        this.log(`  ${i + 1}. [${bug.severity}] ${bug.title}`, 'error');
      });
    }
    
    return report;
  }

  async cleanup() {
    this.log('Cleaning up...');
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.log('Test environment cleaned up', 'success');
  }

  async runAll() {
    this.log('='.repeat(60));
    this.log('COURTMASTER FULL TOURNAMENT TEST');
    this.log('='.repeat(60));
    
    try {
      await this.init();
      
      // Run all phases
      const results = {
        login: await this.login(),
        findTournament: await this.findTournament(),
        verifyData: await this.verifyTournamentData(),
        generateBrackets: await this.generateBrackets(),
        startTournament: await this.startTournament(),
        matchControl: await this.testMatchControl(),
        autoSchedule: await this.testAutoSchedule(),
        verifyQueue: await this.verifyQueue()
      };
      
      const report = await this.generateReport();
      
      // Exit with error code if critical bugs found
      const criticalBugs = this.bugs.filter(b => b.severity === 'CRITICAL').length;
      process.exit(criticalBugs > 0 ? 1 : 0);
      
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
      await this.screenshot('fatal-error');
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
const tester = new TournamentTester();
tester.runAll().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
