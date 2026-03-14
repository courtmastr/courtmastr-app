/**
 * Generate placeholder PWA icons for CourtMastr v2
 * This creates simple placeholder icons with "CM" branding
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * Generate a PNG icon with "CM" text
 */
function generatePNG(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#1976D2'); // Blue
  gradient.addColorStop(1, '#1565C0'); // Darker blue
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add "CM" text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CM', size / 2, size / 2);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  const filepath = path.join(publicDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`✓ Created ${filename} (${size}x${size})`);
}

/**
 * Generate favicon.ico (using 32x32 PNG)
 */
function generateFavicon() {
  const canvas = createCanvas(32, 32);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1976D2';
  ctx.fillRect(0, 0, 32, 32);

  // Add "CM" text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CM', 16, 16);

  // Save as ICO (simplified - saving as PNG with .ico extension)
  const buffer = canvas.toBuffer('image/png');
  const filepath = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(filepath, buffer);
  console.log('✓ Created favicon.ico (32x32)');
}

/**
 * Generate SVG mask icon for Safari
 */
function generateMaskIcon() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="black"/>
  <text x="50" y="50" font-size="40" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="white">CM</text>
</svg>`;

  const filepath = path.join(publicDir, 'mask-icon.svg');
  fs.writeFileSync(filepath, svg);
  console.log('✓ Created mask-icon.svg');
}

// Generate all icons
console.log('Generating PWA icons for CourtMastr v2...\n');

try {
  generateFavicon();
  generatePNG(180, 'apple-touch-icon.png');
  generatePNG(192, 'pwa-192x192.png');
  generatePNG(512, 'pwa-512x512.png');
  generateMaskIcon();

  console.log('\n✅ All PWA icons generated successfully!');
  console.log('\nGenerated files:');
  console.log('  • public/favicon.ico');
  console.log('  • public/apple-touch-icon.png');
  console.log('  • public/pwa-192x192.png');
  console.log('  • public/pwa-512x512.png');
  console.log('  • public/mask-icon.svg');
  console.log('\n💡 These are placeholder icons. Replace with branded icons before final deployment.');
} catch (error) {
  console.error('❌ Error generating icons:', error.message);
  console.log('\n📝 Manual alternative:');
  console.log('   Visit https://favicon.io/ or https://realfavicongenerator.net/');
  console.log('   Generate icons and place them in the public/ directory');
  process.exit(1);
}
