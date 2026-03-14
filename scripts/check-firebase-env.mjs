import { loadEnv } from 'vite';

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const modeArgIndex = process.argv.indexOf('--mode');
const modeFromArg = modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : undefined;
const mode = modeFromArg || process.env.MODE || process.env.NODE_ENV || 'production';
const root = process.cwd();

const viteEnv = loadEnv(mode, root, '');
const env = {
  ...viteEnv,
  ...process.env,
};

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '' || String(value).trim() === 'undefined';
const isPlaceholderValue = (value) => {
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'demo-api-key' || normalized.includes('replace-me');
};

const missingKeys = REQUIRED_KEYS.filter((key) => isBlank(env[key]));
const placeholderKeys = REQUIRED_KEYS.filter((key) => !isBlank(env[key]) && isPlaceholderValue(env[key]));

const apiKey = env.VITE_FIREBASE_API_KEY;
const invalidApiKey = !isBlank(apiKey) && !String(apiKey).startsWith('AIza');

if (missingKeys.length > 0 || placeholderKeys.length > 0 || invalidApiKey) {
  console.error(`\n[check-firebase-env] Firebase web config validation failed for mode "${mode}".`);

  if (missingKeys.length > 0) {
    console.error(`- Missing keys: ${missingKeys.join(', ')}`);
  }

  if (placeholderKeys.length > 0) {
    console.error(`- Placeholder values detected: ${placeholderKeys.join(', ')}`);
  }

  if (invalidApiKey) {
    console.error('- VITE_FIREBASE_API_KEY does not look like a valid Firebase Web API key (expected prefix "AIza").');
  }

  console.error('- Ensure .env.production (or environment variables) is present in this checkout/worktree before build/deploy.\n');
  process.exit(1);
}

console.log(`[check-firebase-env] Firebase web config looks valid for mode "${mode}".`);
