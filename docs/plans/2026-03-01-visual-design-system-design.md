# Visual Design System — Stadium Energy

**Date:** 2026-03-01
**Scope:** Icons, Color, Typography
**Approach selected:** A — Stadium Energy (Royal Blue + Amber + Barlow Condensed)

---

## Problem Statement

The current CourtMaster UI has three design inconsistencies that undermine its visual quality:

1. **Mixed icon libraries** — 594 MDI icon usages across 82 files, but Lucide icons coexist in 3 files (HomeView, AppLayout, TournamentDashboardView). Different visual weights and rendering mechanisms.
2. **Teal secondary color** — feels more tech/SaaS than sports management. Lacks the energy a live tournament platform needs.
3. **Generic typography** — Poppins is friendly but not distinctly athletic. No display font differentiated from body font.

---

## Design Decisions

### 1. Color System — Royal Blue + Amber

Replace the current indigo-teal palette with a high-energy royal blue + amber palette.

```scss
// Primary — Royal Blue
$primary-base:  #1D4ED8;   // Royal Blue 700
$primary-dark:  #1E40AF;   // Royal Blue 800
$primary-light: #3B82F6;   // Blue 500

// Secondary — Amber (brand accent)
$secondary-base:  #D97706; // Amber 600
$secondary-light: #F59E0B; // Amber 500
$secondary-dark:  #B45309; // Amber 700

// Semantic
$success: #16A34A;   // Green 600
$warning: #F97316;   // Orange 500 (shifted from amber to avoid clash with secondary)
$error:   #DC2626;   // Red 600
$info:    #0EA5E9;   // Sky 500

// Neutrals — unchanged
$background:    #F8FAFC;
$text-primary:  #0F172A;
$text-secondary: #64748B;
```

**Vuetify theme** (`src/plugins/vuetify.ts`) must be updated to match these tokens — Vuetify generates CSS custom properties from its theme object which override the SCSS variables at the component level.

---

### 2. Typography — Barlow Condensed Display

| Role | Font | Weight | Letter-spacing |
|---|---|---|---|
| Display (h1, h2) | Barlow Condensed | 700–800 | -0.02em |
| Section headings (h3, h4) | Barlow Condensed | 600 | -0.01em |
| Body text | Inter | 400–500 | normal |
| Labels, captions | Inter | 500 | +0.5–1px (uppercase) |
| Live scores & stat numbers | Barlow Condensed | 700 | normal + tabular-nums |

**Changes required:**
- `index.html`: Add `Barlow+Condensed:ital,wght@0,600;0,700;0,800` to Google Fonts URL
- `variables.scss`: Update `$font-family-display` to `'Barlow Condensed', ...`
- `style.scss`: Add `h1, h2, h3, h4 { font-family: $font-family-display; }`
- `HomeView.vue`: `.hero-title` already uses `$font-family-display` (will pick up automatically)
- `TournamentDashboardView.vue`: `.text-gradient` already uses `$font-family-display`

---

### 3. Icon Library — Standardize on MDI

Remove `lucide-vue-next` entirely. Migrate all Lucide usages in 3 files to MDI equivalents.

#### HomeView.vue — Lucide → MDI

| Lucide Import | MDI String | Usage |
|---|---|---|
| `Trophy` | `mdi-trophy` | Features card icon |
| `MonitorPlay` | `mdi-monitor-play` | Features card icon |
| `CalendarClock` | `mdi-calendar-clock` | Features card icon |
| `Users` | `mdi-account-group` | Features card icon |

Replace `<component :is="feature.icon" :size="32" />` with `<v-icon :icon="feature.icon" size="32" />` and store MDI strings in the features array.

#### AppLayout.vue — Lucide → MDI

| Lucide Import | MDI String |
|---|---|
| `LogIn` | `mdi-login` |
| `UserPlus` | `mdi-account-plus` |
| `LayoutDashboard` | `mdi-view-dashboard` |
| `Settings` | `mdi-cog` |
| `LogOut` | `mdi-logout` |
| `Bug` | `mdi-bug-outline` |
| `Bell` | `mdi-bell` |

#### TournamentDashboardView.vue — Lucide → MDI

| Lucide Import | MDI String |
|---|---|
| `ArrowLeft` | `mdi-arrow-left` |
| `Calendar` | `mdi-calendar` |
| `MapPin` | `mdi-map-marker` |
| `Settings as SettingsIcon` | `mdi-cog` |
| `ChevronDown` | `mdi-chevron-down` |
| `UserPlus` | `mdi-account-plus` |
| `Play` | `mdi-play` |
| `CalendarClock` | `mdi-calendar-clock` |
| `Check` | `mdi-check` |
| `Trash2` | `mdi-trash-can` |
| `Users` | `mdi-account-group` |
| `QrCode` | `mdi-qrcode` |
| `PlayCircle` | `mdi-play-circle` |
| `Medal` | `mdi-medal` |
| `ArrowRightCircle` | `mdi-arrow-right-circle` |
| `Megaphone` | `mdi-bullhorn` |
| `CheckCheck` | `mdi-check-all` |
| `UserCheck` | `mdi-account-check` |
| `GitFork` | `mdi-source-fork` |
| `Download` | `mdi-download` |
| `Printer` | `mdi-printer` |

After migration: `npm uninstall lucide-vue-next`

---

## Files to Change

| File | Change |
|---|---|
| `index.html` | Add Barlow Condensed to Google Fonts URL |
| `src/styles/variables.scss` | Update all color tokens + $font-family-display |
| `src/style.scss` | Add heading font-family rule |
| `src/plugins/vuetify.ts` | Update theme colors to match new tokens |
| `src/features/public/views/HomeView.vue` | Lucide → MDI, update features array |
| `src/components/layout/AppLayout.vue` | Lucide → MDI for all nav icons |
| `src/features/tournaments/views/TournamentDashboardView.vue` | Lucide → MDI for all icons |

---

## Out of Scope

- Navigation component redesign
- New component variants
- Dark mode
- Any feature changes

---

## Success Criteria

- [ ] Zero Lucide imports in the codebase
- [ ] `lucide-vue-next` removed from `package.json`
- [ ] All color tokens in `variables.scss` and Vuetify theme match the new palette
- [ ] Barlow Condensed loaded and applied to all heading elements
- [ ] No visual regressions in existing functionality
