import { computed, unref, type MaybeRef } from 'vue';

export type TournamentLandingThemeKey = 'classic' | 'event-night' | 'minimal';

interface TournamentLandingThemePreset {
  key: TournamentLandingThemeKey;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accentIcon: string;
}

const THEME_PRESETS: Record<TournamentLandingThemeKey, TournamentLandingThemePreset> = {
  classic: {
    key: 'classic',
    label: 'Classic',
    eyebrow: 'Tournament Day',
    title: 'Official Event Landing',
    subtitle: 'Quick links for players, families, and spectators during tournament day.',
    accentIcon: 'mdi-trophy-outline',
  },
  'event-night': {
    key: 'event-night',
    label: 'Event Night',
    eyebrow: 'Prime-Time Showcase',
    title: 'Tonight’s Tournament Hub',
    subtitle: 'A high-contrast presentation ideal for stream links, venue displays, and finals sessions.',
    accentIcon: 'mdi-flare',
  },
  minimal: {
    key: 'minimal',
    label: 'Minimal',
    eyebrow: 'Essentials',
    title: 'Simple Tournament Access',
    subtitle: 'Clean and focused links for schedule, bracket, and scoring without extra noise.',
    accentIcon: 'mdi-lightning-bolt-outline',
  },
};

const normalizeThemeKey = (value: string | null | undefined): TournamentLandingThemeKey => {
  if (!value) return 'classic';
  const normalized = value.trim().toLowerCase();
  if (normalized in THEME_PRESETS) {
    return normalized as TournamentLandingThemeKey;
  }
  return 'classic';
};

export const useTournamentLandingTheme = (themeInput: MaybeRef<string | null | undefined>) => {
  const resolvedThemeKey = computed<TournamentLandingThemeKey>(() =>
    normalizeThemeKey(unref(themeInput))
  );

  const themePreset = computed<TournamentLandingThemePreset>(() => THEME_PRESETS[resolvedThemeKey.value]);

  const availableThemePresets = computed<TournamentLandingThemePreset[]>(() => Object.values(THEME_PRESETS));

  return {
    resolvedThemeKey,
    themePreset,
    availableThemePresets,
  };
};

