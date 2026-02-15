#!/usr/bin/env node
/**
 * Continuous Cloud Functions Logger
 * Captures ALL emulator logs including console.log() from functions
 */

import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const LOGS_DIR = join(__dirname, 'logs');

// Ensure logs directory exists
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_FILE = join(LOGS_DIR, `emulators-${timestamp}.log`);

console.log('📝 Starting emulator log capture...');
console.log(`📄 Logs will be saved to: ${LOG_FILE}`);
console.log('💡 Press Ctrl+C to stop');
console.log('');

const logStream = createWriteStream(LOG_FILE, { flags: 'a' });

// Helper to write with timestamp
function writeLog(data, isError = false) {
  const now = new Date().toISOString();
  const lines = data.toString().split('\n');
  
  lines.forEach(line => {
    if (line.trim()) {
      const logLine = `[${now}] ${line}\n`;
      logStream.write(logLine);
      
      // Also output to console
      if (isError) {
        process.stderr.write(line + '\n');
      } else {
        process.stdout.write(line + '\n');
      }
    }
  });
}

// Start emulators
const emulators = spawn('npm', ['run', 'emulators'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

// Capture stdout (info logs)
emulators.stdout.on('data', (data) => {
  writeLog(data, false);
});

// Capture stderr (error logs + Cloud Functions console.log)
emulators.stderr.on('data', (data) => {
  writeLog(data, true);
});

// Handle process exit
emulators.on('close', (code) => {
  const exitMsg = `\n[${new Date().toISOString()}] Emulators exited with code ${code}\n`;
  logStream.write(exitMsg);
  logStream.end();
  console.log(`\n✅ Logs saved to: ${LOG_FILE}`);
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping emulators...');
  emulators.kill('SIGINT');
});

process.on('SIGTERM', () => {
  emulators.kill('SIGTERM');
});
