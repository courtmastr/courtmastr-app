# CourtMastr Brand & Design System

This document outlines the core platform-level visual system for CourtMastr. All UI development must strictly adhere to these tokens to ensure a clean, operational, and stable aesthetic.

## 1. Typography

**Inter** is the exclusive typeface for the platform, conveying a modern and functional feel.

### Type Scale
*   **H1 (Hero):** 48px size / 56px line-height, Semibold (`600`) or Bold (`700`)
*   **H2 (Section):** 32px size / 40px line-height, Semibold (`600`)
*   **H3 (Card Title):** 24px size / 32px line-height, Semibold (`600`)
*   **Body (Default):** 16px size / 24px line-height, Regular (`400`)

*Rule: Avoid "extra bold" weights except for hero headlines.*

---

## 2. Core Colors

### Brand Primitives
*   **Primary (Indigo):** `#4F46E5` - Used for primary actions, buttons, and active states.
*   **Accent (Sky):** `#0EA5E9` - Used for secondary highlights and the brand mark structure.
*   **Dark Surface:** `#0F172A` - Used for dark mode backgrounds and strong high-contrast text.
*   **Light Background:** `#F8FAFC` - The global app background.
*   **Borders:** `#E5E7EB` - Standard layout and card borders.

### Text
*   **Text Primary:** `#0F172A`
*   **Text Secondary:** `#64748B`

*Rule: No gradients are permitted across the internal app UI. Gradients are restricted exclusively to the marketing hero or public live views if strictly necessary.*

---

## 3. Structural Forms (Radii & Shadows)

### Border Radii
*   **Buttons:** `8px`
*   **Cards:** `12px`
*   **Modals/Dialogs:** `16px`

### Shadows
*   **Rule:** Use clean borders (`#E5E7EB`) rather than heavy shadow depth.
*   **Shadows:** Minimal, subtle drops only to indicate elevation above the base plane (e.g. modals, active draggable states). No neon glows or heavy 3D depth.

---

## 4. Spacing System (8px Grid)

All margins, paddings, and gaps must align to the 8-point pixel grid.

### Approved Values:
`4px`, `8px`, `16px`, `24px`, `32px`, `48px`, `64px`, `96px`

### Layout Rules:
*   **Card Padding:** `24px` standard inner padding.
*   **Page Padding:** `24px` to `32px` around the main viewport.
*   **Section Spacing:** `48px` or `64px` between major UI zones.

---

## 5. Iconography

**Lucide Icons** are the standard for all operational UI actions.

### Implementation Rules:
1.  **Stroke-Based:** Use stroke outlines only. Never mix filled Material icons with stroke icons.
2.  **Size:** Default size is `18px` or `20px` for standard UI interaction.
3.  **Color:** Icons inherit the text color (`currentColor`) or the theme color (e.g., `text-primary`).
4.  **Brand Icon:** Do NOT use the trophy icon as the brand. Instead, use the custom Bracket Structure Mark located at `src/assets/brand/courtmaster-mark.svg`.

---

## 6. App Style Directives

### Must-Follow Checklist:
- [x] **Form Readability:** Form labels must always be visible.
- [x] **Hierarchy:** Maintain strong contrast between titles, subtitles, and actions.
- [x] **Clean Edges:** Emphasize clean borders over heavy shadows.

### Strictly Prohibited Elements:
- [ ] NO Glassmorphism.
- [ ] NO Animated glowing blobs.
- [ ] NO Tilt or 3D rotation effects.
- [ ] NO Overdone hover scaling (simple `1.05` scale or translateY of `2px` max).
- [ ] NO Fake or exaggerated "counting stats" - operational numbers only.

**Design Philosophy:** The internal app must feel conservative, functional, and deeply stable for tournament organizers operating under pressure.
