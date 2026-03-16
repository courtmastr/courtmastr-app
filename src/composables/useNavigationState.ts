import { ref, watch } from 'vue';

const RAIL_KEY = 'courtmaster_sidebar_rail';
const SECTIONS_KEY = 'courtmaster_nav_sections';

// ── Singleton state (shared across all component instances) ──────────────────

const rail = ref(localStorage.getItem(RAIL_KEY) === 'true');

const DEFAULT_SECTIONS: Record<string, boolean> = {
  dayOf: true,        // expanded — used during event
  results: true,      // expanded — brackets/leaderboard
  prepare: true,      // expanded — categories/courts/registrations
  shareStream: false, // collapsed — public links, less frequent
};

const storedSections = localStorage.getItem(SECTIONS_KEY);
let parsedSections: Record<string, boolean>;
try {
  parsedSections = storedSections ? JSON.parse(storedSections) : { ...DEFAULT_SECTIONS };
} catch {
  parsedSections = { ...DEFAULT_SECTIONS };
}
const sections = ref<Record<string, boolean>>(parsedSections);

// Persist changes
watch(rail, (val) => localStorage.setItem(RAIL_KEY, String(val)));
watch(sections, (val) => localStorage.setItem(SECTIONS_KEY, JSON.stringify(val)), { deep: true });

// ── Composable ───────────────────────────────────────────────────────────────

export function useNavigationState() {
  function collapseToRail(): void {
    rail.value = true;
  }

  function expandFromRail(): void {
    rail.value = false;
  }

  function toggleSection(name: string): void {
    sections.value[name] = !sections.value[name];
  }

  return {
    rail,
    sections,
    collapseToRail,
    expandFromRail,
    toggleSection,
  };
}
