#!/usr/bin/env node
/**
 * run-and-log.mjs
 * 
 * Executes commands with output capture and fingerprint generation.
 * Part of the Debug Knowledge Base system.
 */

import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ARTIFACTS_DIR = join(__dirname, '..', 'docs', 'debug-kb', '_artifacts');

// Ensure artifacts directory exists
if (!existsSync(ARTIFACTS_DIR)) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function generateTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
}

function normalizeForFingerprint(text) {
  return text
    // Remove file paths (Unix and Windows)
    .replace(/[/~][\w\-./]+\.[\w]+/g, '<PATH>')
    .replace(/[a-zA-Z]:\\[\w\-.\\]+/g, '<PATH>')
    // Remove line numbers from error messages
    .replace(/:\d+:\d+/g, ':<LN>')
    .replace(/line \d+/gi, 'line <LN>')
    // Remove timestamps
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g, '<TIME>')
    // Remove memory addresses
    .replace(/0x[a-f0-9]+/gi, '<ADDR>')
    // Remove port numbers
    .replace(/:\d{4,5}/g, ':<PORT>')
    // Remove process IDs
    .replace(/\bpid:? \d+/gi, 'pid <PID>')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function generateFingerprint(normalizedOutput) {
  const hash = createHash('sha256')
    .update(normalizedOutput)
    .digest('hex')
    .slice(0, 8);
  return hash;
}

function sanitizeFilename(cmd) {
  return cmd
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

async function runCommand(command, args = [], options = {}) {
  const timestamp = generateTimestamp();
  const cmdString = options.rawCommand ?? [command, ...args].join(' ');
  const sanitizedCmd = sanitizeFilename(cmdString);
  const logFilename = `${timestamp}.${sanitizedCmd}.log`;
  const logPath = join(ARTIFACTS_DIR, logFilename);
  
  console.log(`\n🔧 Running: ${cmdString}`);
  console.log(`📝 Logging to: ${logPath}\n`);
  
  const logStream = createWriteStream(logPath);
  let combinedOutput = '';
  
  function writeToLog(data) {
    const text = data.toString();
    combinedOutput += text;
    logStream.write(text);
    process.stdout.write(text);
  }
  
  function writeErrorToLog(data) {
    const text = data.toString();
    combinedOutput += text;
    logStream.write(text);
    process.stderr.write(text);
  }
  
  return new Promise((resolve) => {
    const spawnCommand = options.rawCommand ? options.rawCommand : command;
    const spawnArgs = options.rawCommand ? [] : args;
    const child = spawn(spawnCommand, spawnArgs, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });
    
    child.stdout.on('data', writeToLog);
    child.stderr.on('data', writeErrorToLog);
    
    child.on('close', (code) => {
      logStream.end();
      
      if (code !== 0) {
        console.log(`\n❌ Command failed with exit code ${code}`);
        
        // Generate fingerprint from error output
        const normalized = normalizeForFingerprint(combinedOutput);
        const fingerprint = generateFingerprint(normalized);
        
        console.log(`\n🔍 Fingerprint: ${fingerprint}`);
        console.log(`📄 Log saved: ${logPath}`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Check KB: ls docs/debug-kb/ | grep ${fingerprint}`);
        console.log(`   2. If not found, create: cp docs/debug-kb/TEMPLATE.md docs/debug-kb/${fingerprint}.md`);
        console.log(`   3. Document your fix attempts in the KB file`);
      } else {
        console.log(`\n✅ Command completed successfully`);
        console.log(`📄 Log saved: ${logPath}`);
      }
      
      resolve(code);
    });
    
    child.on('error', (err) => {
      logStream.end();
      console.error(`\n💥 Failed to start command: ${err.message}`);
      resolve(1);
    });
  });
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node run-and-log.mjs [--shell "<command>"] | <command> [args...]');
  console.error('Example: node run-and-log.mjs npm run build');
  console.error('Example: node run-and-log.mjs --shell "npm run build && firebase deploy"');
  process.exit(1);
}

const isShellMode = args[0] === '--shell';
const command = isShellMode ? null : args[0];
const commandArgs = isShellMode ? [] : args.slice(1);
const rawCommand = isShellMode ? args.slice(1).join(' ') : null;

runCommand(command, commandArgs, { rawCommand }).then(code => {
  process.exit(code);
});
