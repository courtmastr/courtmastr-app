#!/usr/bin/env node
/**
 * Comprehensive Automated Tournament Testing
 * Uses Playwright with headless mode and direct JS injection
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';
const TOURNAMENT_ID = 'K9ZDFjTn91krb85nGTO4';

const CREDENTIALS = {
  email: 'admin@courtmaster.local',
  password: 'admin123'
};

const BUGS = [];

function reportBug(phase, severity, title, details) {
  const bug = {
    phase,
    severity,
    title,
    details,
    timestamp: new Date().toISOString()
  };
  BUGS.push(bug);
  console.error(`\n❌ BUG FOUND [${severity}]: ${title}`);
  console.error(`   Phase: ${phase}`);
  console.error(`   Details: ${details}\n`);
}

async function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullTournamentTest() {
  console.log('🚀 Starting Comprehensive Tournament Test\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: 'test-videos/' }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  try {
    // ============================================
    // PHASE 1: LOGIN
    // ============================================
    console.log('📍 Phase 1: Login');
    await page.goto(`${BASE_URL}/login`);
    await waitFor(3000);
    
    // Use JavaScript to fill inputs directly
    await page.evaluate(({ email, password }) => {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        if (input.type === 'text' || input.type === 'email' || !input.type) {
          input.value = email;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (input.type === 'password') {
          input.value = password;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }, { email: CREDENTIALS.email, password: CREDENTIALS.password });
    
    await waitFor(500);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForNavigation({ timeout: 10000 });
    
    if (page.url().includes('/tournaments')) {
      console.log('✅ Login successful\n');
    } else {
      reportBug('Phase 1', 'CRITICAL', 'Login Failed', `URL: ${page.url()}`);
      throw new Error('Login failed');
    }

    // ============================================
    // PHASE 2: TOURNAMENT DASHBOARD
    // ============================================
    console.log('📍 Phase 2: Tournament Dashboard');
    await page.goto(`${BASE_URL}/tournaments/${TOURNAMENT_ID}`);
    await waitFor(5000);
    
    const title = await page.locator('h1').textContent();
    if (title.includes('Test Tournament 2025')) {
      console.log('✅ Tournament dashboard loaded\n');
    } else {
      reportBug('Phase 2', 'HIGH', 'Tournament Dashboard Not Loading', `Title: ${title}`);
    }

    // Check stats
    const stats = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h3'));
      return headings.map(h => ({
        text: h.textContent,
        nextSibling: h.nextElementSibling?.textContent
      }));
    });
    
    console.log('📊 Stats found:', stats);
    
    // Check if Total Matches shows 0 (BUG #1)
    const totalMatchesStat = stats.find(s => s.nextSibling?.includes('Total Matches'));
    if (totalMatchesStat && totalMatchesStat.text === '0') {
      reportBug('Phase 2', 'HIGH', 'Total Matches Shows 0', 
        'After bracket generation, Total Matches counter shows 0 instead of actual match count');
    }

    // ============================================
    // PHASE 3: GENERATE BRACKETS (if needed)
    // ============================================
    console.log('📍 Phase 3: Verify Brackets');
    
    // Check if brackets are already generated
    const bracketButtons = await page.locator('button:has-text("Generate Bracket")').count();
    console.log(`   Found ${bracketButtons} 'Generate Bracket' buttons`);
    
    if (bracketButtons > 0) {
      console.log('   Generating brackets...');
      
      // Generate Men's Singles bracket
      const mensButton = page.locator('button:has-text("Generate Bracket")').nth(1);
      if (await mensButton.isVisible()) {
        await mensButton.click();
        await waitFor(3000);
        console.log('   ✅ Men\'s Singles bracket generated');
      }
      
      // Generate Mixed Doubles bracket
      const mixedButton = page.locator('button:has-text("Generate Bracket")').first();
      if (await mixedButton.isVisible()) {
        await mixedButton.click();
        await waitFor(3000);
        console.log('   ✅ Mixed Doubles bracket generated');
      }
    } else {
      console.log('   ✅ Brackets already generated');
    }

    // ============================================
    // PHASE 4: START TOURNAMENT
    // ============================================
    console.log('📍 Phase 4: Start Tournament');
    
    // Check current status
    const statusChip = await page.locator('.v-chip, [class*="status"]').first();
    const statusText = await statusChip.textContent().catch(() => 'unknown');
    console.log(`   Current status: ${statusText}`);
    
    if (statusText.includes('registration') || statusText.includes('setup')) {
      // Click Actions menu
      await page.click('button:has-text("Actions")');
      await waitFor(500);
      
      // Click Start Tournament
      await page.click('text=Start Tournament');
      await waitFor(2000);
      
      console.log('   ✅ Tournament started\n');
    } else if (statusText.includes('active') || statusText.includes('in_progress')) {
      console.log('   ✅ Tournament already active\n');
    }

    // ============================================
    // PHASE 5: MATCH CONTROL - QUEUE VIEW
    // ============================================
    console.log('📍 Phase 5: Match Control - Queue View');
    
    // Navigate to Match Control
    await page.goto(`${BASE_URL}/tournaments/${TOURNAMENT_ID}/match-control`);
    await waitFor(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/match-control-initial.png', fullPage: true });
    
    // Check if Match Control loaded
    const matchControlTitle = await page.locator('h1, .text-h5').textContent().catch(() => '');
    if (matchControlTitle.includes('Match Control')) {
      console.log('   ✅ Match Control loaded');
    } else {
      reportBug('Phase 5', 'CRITICAL', 'Match Control Not Loading', 
        `Expected 'Match Control' title, got: ${matchControlTitle}`);
    }

    // Check for queue
    const queueExists = await page.locator('text=Match Queue, text=Needs Court, text=Pending').count() > 0;
    console.log(`   Queue elements found: ${queueExists}`);

    // ============================================
    // PHASE 6: AUTO SCHEDULE
    // ============================================
    console.log('📍 Phase 6: Auto Schedule');
    
    // Click Auto Schedule button
    const autoScheduleBtn = page.locator('button:has-text("Auto Schedule")');
    if (await autoScheduleBtn.isVisible().catch(() => false)) {
      await autoScheduleBtn.click();
      await waitFor(2000);
      
      // Select all courts
      const courtCheckboxes = await page.locator('input[type="checkbox"]').count();
      console.log(`   Found ${courtCheckboxes} court checkboxes`);
      
      // Select first 4 courts (if available)
      for (let i = 0; i < Math.min(4, courtCheckboxes); i++) {
        await page.locator('input[type="checkbox"]').nth(i).check();
      }
      
      // Set start time
      const now = new Date();
      const timeString = now.toISOString().slice(0, 16);
      await page.fill('input[type="datetime-local"]', timeString);
      
      // Click Generate
      await page.click('button:has-text("Generate")');
      await waitFor(5000);
      
      // Check result
      const scheduledCount = await page.locator('text=/\\d+ matches scheduled/').textContent().catch(() => '0 matches scheduled');
      console.log(`   Result: ${scheduledCount}`);
      
      if (scheduledCount.includes('0')) {
        reportBug('Phase 6', 'CRITICAL', 'Auto Schedule Shows 0 Matches', 
          'After clicking Generate Schedule, it shows 0 matches scheduled instead of actual matches');
      } else {
        console.log('   ✅ Auto schedule worked');
      }
      
      await page.screenshot({ path: 'test-screenshots/auto-schedule-result.png', fullPage: true });
    } else {
      console.log('   ⚠️ Auto Schedule button not found');
    }

    // ============================================
    // PHASE 7: VERIFY QUEUE
    // ============================================
    console.log('📍 Phase 7: Verify Queue');
    
    await page.reload();
    await waitFor(3000);
    
    // Check queue for scheduled matches
    const queueItems = await page.locator('.match-item, [class*="match"]').count();
    console.log(`   Queue items found: ${queueItems}`);
    
    if (queueItems === 0) {
      reportBug('Phase 7', 'HIGH', 'Queue Shows No Matches After Scheduling',
        'After auto-schedule, queue should show matches but is empty');
    } else {
      console.log(`   ✅ Found ${queueItems} matches in queue`);
    }

    // ============================================
    // PHASE 8: MANUAL COURT ASSIGNMENT
    // ============================================
    console.log('📍 Phase 8: Manual Court Assignment');
    
    // Try to assign first match to a court
    const assignDropdown = page.locator('select, .v-select').first();
    if (await assignDropdown.isVisible().catch(() => false)) {
      await assignDropdown.click();
      await waitFor(500);
      
      // Select first court option
      await page.locator('.v-list-item, option').first().click();
      await waitFor(2000);
      
      console.log('   ✅ Assigned match to court');
      
      // Check if match moved to "Ready"
      const readyCount = await page.locator('text=Ready, .status-ready').count();
      console.log(`   Ready matches: ${readyCount}`);
    } else {
      console.log('   ⚠️ No assign dropdown found');
    }

    // ============================================
    // PHASE 9: BRACKET VERIFICATION
    // ============================================
    console.log('📍 Phase 9: Bracket Verification');
    
    await page.goto(`${BASE_URL}/tournaments/${TOURNAMENT_ID}/brackets`);
    await waitFor(5000);
    
    await page.screenshot({ path: 'test-screenshots/brackets-view.png', fullPage: true });
    
    // Check if bracket rendered
    const bracketElements = await page.locator('.bracket, [class*="bracket"], svg').count();
    console.log(`   Bracket elements: ${bracketElements}`);
    
    if (bracketElements === 0) {
      reportBug('Phase 9', 'HIGH', 'Brackets Not Displaying',
        'Brackets tab shows no bracket visualization');
    }

    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('TESTING COMPLETE');
    console.log('='.repeat(60));
    
    if (BUGS.length === 0) {
      console.log('\n✅ NO BUGS FOUND! All phases passed.\n');
    } else {
      console.log(`\n⚠️  FOUND ${BUGS.length} BUGS:\n`);
      BUGS.forEach((bug, i) => {
        console.log(`${i + 1}. [${bug.severity}] ${bug.title}`);
        console.log(`   Phase: ${bug.phase}`);
        console.log(`   ${bug.details}\n`);
      });
    }

    await page.screenshot({ path: 'test-screenshots/final-state.png', fullPage: true });

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-screenshots/error-state.png', fullPage: true });
  } finally {
    await context.close();
    await browser.close();
    
    // Write bug report
    const fs = require('fs');
    fs.writeFileSync('AUTOMATED-TEST-RESULTS.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      bugs: BUGS,
      totalBugs: BUGS.length
    }, null, 2));
    
    console.log('\n📄 Results saved to: AUTOMATED-TEST-RESULTS.json');
    console.log('📹 Video saved to: test-videos/');
    console.log('📸 Screenshots saved to: test-screenshots/\n');
  }
}

// Run the test
runFullTournamentTest().catch(console.error);
