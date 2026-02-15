#!/usr/bin/env node
/**
 * Courtmaster Development Launcher
 * 
 * Kills existing processes, starts emulators + dev server in separate terminals,
 * auto-seeds data, and shows full logs.
 * 
 * Usage: node start-dev.mjs
 */

import { spawn, exec } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Configuration
const PORTS = {
  vite: 3002,
  functions: 5001,
  firestore: 8080,
  auth: 9099,
  hosting: 5002,
  ui: 4000
};

const LOGS_DIR = join(__dirname, 'logs', 'dev-session-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'));

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

// Kill processes on specific ports
async function killProcessesOnPort(port) {
  try {
    // macOS specific - find and kill processes
    const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || echo ""`);
    const pids = stdout.trim().split('\n').filter(Boolean);
    
    if (pids.length > 0) {
      log(`  Found processes on port ${port}: ${pids.join(', ')}`, 'yellow');
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          log(`  ✓ Killed process ${pid}`, 'green');
        } catch (e) {
          // Process might already be dead
        }
      }
    }
  } catch (e) {
    // No processes found
  }
}

// Kill all related processes
async function cleanupExisting() {
  logSection('🧹 CLEANUP: Stopping existing processes');
  
  for (const [name, port] of Object.entries(PORTS)) {
    await killProcessesOnPort(port);
  }
  
  // Also kill common processes by name
  const processNames = ['node', 'java', 'firebase'];
  for (const name of processNames) {
    try {
      await execAsync(`pkill -f "${name}.*emulator\|${name}.*vite\|${name}.*firebase" 2>/dev/null || true`);
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Wait a moment for processes to die
  await new Promise(resolve => setTimeout(resolve, 2000));
  log('✓ Cleanup complete', 'green');
}

// Setup logging directory
function setupLogging() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
  return {
    emulators: join(LOGS_DIR, 'emulators.log'),
    site: join(LOGS_DIR, 'site.log'),
    seed: join(LOGS_DIR, 'seed.log')
  };
}

// Open Terminal.app on macOS with a command
function openTerminal(title, command, logFile) {
  const script = `
    tell application "Terminal"
      do script "cd '${__dirname}' && echo '${'='.repeat(60)}' && echo '${title}' && echo '${'='.repeat(60)}' && ${command} 2>&1 | tee '${logFile}'"
      set custom title of front window to "${title}"
    end tell
  `;
  
  const osascript = spawn('osascript', ['-e', script], {
    stdio: 'inherit'
  });
  
  return osascript;
}

// Check if emulator is ready
async function waitForEmulator(port, maxAttempts = 30) {
  log(`\n⏳ Waiting for emulator on port ${port}...`, 'cyan');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await execAsync(`curl -s http://127.0.0.1:${port} > /dev/null 2>&1`);
      log(`✓ Emulator ready on port ${port}!`, 'green');
      return true;
    } catch (e) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  log(`\n✗ Emulator failed to start on port ${port}`, 'red');
  return false;
}

// Run seed command
async function runSeed(logFile) {
  logSection('🌱 SEEDING: Running seed:simple');
  
  return new Promise((resolve, reject) => {
    const seedLog = createWriteStream(logFile, { flags: 'a' });
    
    const seed = spawn('npm', ['run', 'seed:simple'], {
      cwd: __dirname,
      shell: true
    });
    
    seed.stdout.on('data', (data) => {
      const text = data.toString();
      seedLog.write(text);
      process.stdout.write(text);
    });
    
    seed.stderr.on('data', (data) => {
      const text = data.toString();
      seedLog.write(text);
      process.stderr.write(text);
    });
    
    seed.on('close', (code) => {
      seedLog.end();
      if (code === 0) {
        log('\n✓ Seeding complete!', 'green');
        resolve();
      } else {
        log(`\n✗ Seeding failed with code ${code}`, 'red');
        reject(new Error(`Seed failed with code ${code}`));
      }
    });
  });
}

// Create tmux session (alternative to Terminal.app)
function createTmuxSession(logFiles) {
  const sessionName = `courtmaster-${Date.now()}`;
  
  // Create new tmux session
  exec(`tmux new-session -d -s ${sessionName} -n emulators`, (err) => {
    if (err) {
      log('tmux not available, falling back to single terminal mode', 'yellow');
      return runWithoutTmux(logFiles);
    }
    
    // Split window and start emulators
    exec(`tmux send-keys -t ${sessionName}:0 "cd ${__dirname} && npm run emulators 2>&1 | tee ${logFiles.emulators}" C-m`);
    
    // Split for site
    exec(`tmux split-window -h -t ${sessionName}:0`);
    exec(`tmux send-keys -t ${sessionName}:0.right "cd ${__dirname} && npm run dev 2>&1 | tee ${logFiles.site}" C-m`);
    
    // Attach to session
    spawn('tmux', ['attach', '-t', sessionName], {
      stdio: 'inherit'
    });
  });
}

// Run without tmux - single terminal with background processes
async function runWithoutTmux(logFiles) {
  logSection('🚀 STARTING: Emulators and Dev Server');
  
  // Start emulators
  log('📦 Starting Firebase Emulators...', 'cyan');
  const emulatorsLog = createWriteStream(logFiles.emulators, { flags: 'a' });
  const emulators = spawn('npm', ['run', 'emulators'], {
    cwd: __dirname,
    shell: true,
    detached: true
  });
  
  emulators.stdout.on('data', (data) => {
    emulatorsLog.write(data);
  });
  emulators.stderr.on('data', (data) => {
    emulatorsLog.write(data);
  });
  
  // Wait for emulators to be ready
  const emulatorsReady = await waitForEmulator(PORTS.functions, 60);
  if (!emulatorsReady) {
    log('✗ Failed to start emulators', 'red');
    process.exit(1);
  }
  
  // Start dev server
  log('\n🌐 Starting Vite Dev Server...', 'cyan');
  const siteLog = createWriteStream(logFiles.site, { flags: 'a' });
  const site = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    shell: true,
    detached: true
  });
  
  site.stdout.on('data', (data) => {
    siteLog.write(data);
  });
  site.stderr.on('data', (data) => {
    siteLog.write(data);
  });
  
  // Wait for site to be ready
  const siteReady = await waitForEmulator(PORTS.vite, 30);
  if (!siteReady) {
    log('✗ Failed to start dev server', 'red');
    process.exit(1);
  }
  
  // Run seed
  await runSeed(logFiles.seed);
  
  // Show summary
  logSection('✅ ALL SYSTEMS RUNNING');
  log(`📦 Emulators: http://127.0.0.1:${PORTS.ui} (Firebase UI)`, 'cyan');
  log(`🌐 Dev Site:   http://127.0.0.1:${PORTS.vite}`, 'cyan');
  log(`📊 Firestore:  http://127.0.0.1:${PORTS.firestore}`, 'cyan');
  log(`🔑 Auth:       http://127.0.0.1:${PORTS.auth}`, 'cyan');
  log(`\n📁 Logs saved to: ${LOGS_DIR}`, 'magenta');
  log(`   - Emulators: ${logFiles.emulators}`, 'reset');
  log(`   - Site:      ${logFiles.site}`, 'reset');
  log(`   - Seed:      ${logFiles.seed}`, 'reset');
  
  logSection('📋 AVAILABLE COMMANDS');
  log('View emulator logs:  tail -f logs/dev-session-*/emulators.log', 'yellow');
  log('View site logs:      tail -f logs/dev-session-*/site.log', 'yellow');
  log('View all logs:       tail -f logs/dev-session-*/*.log', 'yellow');
  log('Stop everything:     pkill -f "firebase\|vite"', 'yellow');
  
  // Keep script running
  log('\n💡 Press Ctrl+C to stop all processes\n', 'bright');
  
  // Handle shutdown
  process.on('SIGINT', () => {
    log('\n\n🛑 Shutting down...', 'yellow');
    try {
      process.kill(-emulators.pid, 'SIGTERM');
    } catch (e) {}
    try {
      process.kill(-site.pid, 'SIGTERM');
    } catch (e) {}
    emulatorsLog.end();
    siteLog.end();
    log('✓ All processes stopped', 'green');
    process.exit(0);
  });
  
  // Keep alive
  setInterval(() => {}, 1000);
}

// Main execution
async function main() {
  logSection('🏸 COURTMASTER DEVELOPMENT LAUNCHER');
  
  // Step 1: Cleanup
  await cleanupExisting();
  
  // Step 2: Setup logging
  const logFiles = setupLogging();
  log(`\n📁 Logs will be saved to: ${LOGS_DIR}`, 'magenta');
  
  // Step 3: Start everything
  // Check if tmux is available
  try {
    await execAsync('which tmux');
    log('✓ tmux detected - using split terminal mode', 'green');
    createTmuxSession(logFiles);
  } catch (e) {
    log('ℹ tmux not available - using background processes mode', 'yellow');
    await runWithoutTmux(logFiles);
  }
}

// Run main
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
