import fs from 'fs';
import sharp from 'sharp';

async function generateFavicons() {
    const markSvg = fs.readFileSync('./src/assets/brand/courtmaster-mark.svg');

    const sizes = [16, 32, 192, 512];

    for (const size of sizes) {
        await sharp(markSvg)
            .resize(size, size)
            .png()
            .toFile(`./public/favicon-${size}x${size}.png`);
        console.log(`Generated favicon-${size}x${size}.png`);
    }

    // Apple touch icon
    await sharp(markSvg)
        .resize(180, 180)
        .flatten({ background: '#ffffff' })
        .png()
        .toFile('./public/apple-touch-icon.png');
    console.log('Generated apple-touch-icon.png');

    // Convert 32x32 to ico (Sharp doesn't natively do ICO well without extra libs, 
    // but a simple 32x32 png renamed or used directly is actually sufficient for modern browsers)
    // We'll just generate the 32x32 as favicon.ico for basic compat if the user opens the URL,
    // but we also have the pngs. Actually sharp can't output ico. We'll just copy the 32x32 png to favicon.ico.
    fs.copyFileSync('./public/favicon-32x32.png', './public/favicon.ico');
    console.log('Copied favicon.ico');

    const manifest = {
        name: 'CourtMastr',
        short_name: 'CourtMastr',
        start_url: '/',
        display: 'standalone',
        background_color: '#F8FAFC',
        theme_color: '#4F46E5',
        icons: [
            {
                src: '/favicon-192x192.png',
                sizes: '192x192',
                type: 'image/png'
            },
            {
                src: '/favicon-512x512.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ]
    };

    fs.writeFileSync('./public/site.webmanifest', JSON.stringify(manifest, null, 2));
    console.log('Generated site.webmanifest');
}

generateFavicons().catch(console.error);
