# CourtMastr Brand & Design System

This is the source of truth for public-facing and in-app UI branding decisions.

## 1. Typography

### Brand Stack
- Display headlines: `Barlow Condensed`
- Body/UI text: `Inter`

### Scale Rules
- Hero H1: `clamp(2rem, 4vw, 3.4rem)` with tight line-height (`~0.95`)
- Section title: `1.5rem` to `2.25rem`
- Body default: `16px` / `24px`
- Supporting text: `14px` / `20px`

## 2. Color System

Use Vuetify theme tokens, not raw hex values in component templates.

### Light Theme Tokens (from `src/plugins/vuetify.ts`)
- `primary`: `#1D4ED8`
- `secondary`: `#D97706`
- `info`: `#0EA5E9`
- `success`: `#16A34A`
- `warning`: `#F97316`
- `background`: `#F8FAFC`
- `surface`: `#FFFFFF`
- `on-surface`: `#0F172A`

### Practical Usage
- Primary actions: `primary`
- Secondary accents and highlights: `secondary`
- Positive status and completion: `success`
- Informational UI hints: `info`

## 3. Iconography

### Icon Set Standard
- Use **Material Design Icons** through Vuetify (`mdi-*`).
- Do not mix unrelated icon families in the same view.

### Colorful Themed Icons
- Use [`BrandIconBadge`](/Users/ramc/Documents/Code/courtmaster-v2/src/components/common/BrandIconBadge.vue) for colorful icon treatments.
- Approved tones: `primary`, `secondary`, `success`.
- Keep icon meaning semantic: operations/actions should not rely on color alone.

## 4. Public Page Reusability Standard

- Use [`PublicMarketingPageShell`](/Users/ramc/Documents/Code/courtmaster-v2/src/features/public/components/PublicMarketingPageShell.vue) for About/Pricing/Privacy/Terms style consistency.
- Keep card borders subtle (`rgba(--v-theme-on-surface, 0.08-0.1)`).
- Keep spacing on 8px rhythm.
- Respect reduced motion (`prefers-reduced-motion`).

## 5. App Icon Update Workflow

When updating favicon/PWA/home-screen icons:

1. Update source brand assets first:
   - [`courtmaster-mark.svg`](/Users/ramc/Documents/Code/courtmaster-v2/src/assets/brand/courtmaster-mark.svg)
   - [`courtmaster-mark-white.svg`](/Users/ramc/Documents/Code/courtmaster-v2/src/assets/brand/courtmaster-mark-white.svg)
   - [`courtmaster-lockup.svg`](/Users/ramc/Documents/Code/courtmaster-v2/src/assets/brand/courtmaster-lockup.svg)
2. Open [`public/generate-icons.html`](/Users/ramc/Documents/Code/courtmaster-v2/public/generate-icons.html) in a browser and generate the icon pack.
3. Replace these files in `public/`:
   - `favicon-16x16.png`
   - `favicon-32x32.png`
   - `favicon-192x192.png`
   - `favicon-512x512.png`
   - `apple-touch-icon.png`
   - `pwa-192x192.png`
   - `pwa-512x512.png`
4. Verify app references:
   - [`index.html`](/Users/ramc/Documents/Code/courtmaster-v2/index.html)
   - [`site.webmanifest`](/Users/ramc/Documents/Code/courtmaster-v2/public/site.webmanifest)
5. Run verification:
   - `npm run build`
   - `npm run build:log`

## 6. Quality Guardrails

- Keep one clear visual language across all public pages.
- Ensure icon-only controls always include `aria-label`.
- Keep body contrast at WCAG AA minimum (4.5:1).
- Avoid decorative-only motion or random color usage.
