<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import { functions, httpsCallable } from '@/services/firebase';
import type {
  Category,
  RankingPresetId,
  RankingProgressionMode,
  ScoringConfig,
  TournamentLogo,
  TournamentSponsor,
  TournamentVolunteerAccessEntry,
  User,
  VolunteerRole,
} from '@/types';
import { SCORING_PRESETS } from '@/types';
import {
  getTournamentStateLabel,
  normalizeTournamentState,
  assertCanEditScoring,
  isScoringLocked,
} from '@/guards/tournamentState';
import { useTournamentStateAdvance } from '@/composables/useTournamentStateAdvance';
import {
  deleteBrandingAsset,
  uploadSponsorLogo,
  uploadTournamentLogo,
} from '@/services/tournamentBrandingStorage';
import { sanitizeScoringConfig } from '@/features/scoring/utils/validation';
import StateBanner from '@/features/tournaments/components/StateBanner.vue';
import TournamentBrandingCard from '@/features/tournaments/components/TournamentBrandingCard.vue';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/users';
import {
  DEFAULT_RANKING_PRESET,
  DEFAULT_RANKING_PROGRESSION,
  RANKING_PRESETS,
} from '@/features/leaderboard/rankingPresets';
import { NAVIGATION_ICONS } from '@/constants/navigationIcons';
import { logger } from '@/utils/logger';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();
const authStore = useAuthStore();
const userStore = useUserStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const isAdmin = computed(() => authStore.isAdmin);
const showUnlockDialog = ref(false);

const { advanceState, getNextState, transitionTo } = useTournamentStateAdvance(tournamentId);

const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const {
  normalizedSponsors,
  tournamentLogo: normalizedTournamentLogo,
} = useTournamentBranding(tournament);

interface CategoryScoringOverrideForm {
  enabled: boolean;
  preset: string;
  config: ScoringConfig;
}

interface CategoryRankingOverrideForm {
  enabled: boolean;
  rankingPreset: RankingPresetId;
  progressionMode: RankingProgressionMode;
}

interface TournamentBrandingDraft {
  tournamentLogo: TournamentLogo | null;
  tournamentLogoFile: File | null;
  removeTournamentLogo: boolean;
  sponsors: TournamentSponsor[];
  sponsorLogoFiles: Record<string, File | null>;
}

interface VolunteerAccessForm {
  enabled: boolean;
  pin: string;
  maskedPin: string;
  revealedPin: string;
  showRevealedPin: boolean;
  pinRevision: number;
  saving: boolean;
  revealing: boolean;
}

interface BasicInfoForm {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
}

interface SchedulingSettingsForm {
  minRestTimeMinutes: number;
  matchDurationMinutes: number;
}

interface RegistrationSettingsForm {
  allowSelfRegistration: boolean;
  requireApproval: boolean;
}

const cloneScoringConfig = (config: ScoringConfig): ScoringConfig => ({
  gamesPerMatch: config.gamesPerMatch,
  pointsToWin: config.pointsToWin,
  mustWinBy: config.mustWinBy,
  maxPoints: config.maxPoints,
});

const cloneTournamentLogo = (logo: TournamentLogo | null | undefined): TournamentLogo | null =>
  logo ? { ...logo } : null;

const cloneTournamentSponsor = (sponsor: TournamentSponsor): TournamentSponsor => ({
  ...sponsor,
});

const cloneSponsorLogoFiles = (
  files: Record<string, File | null>
): Record<string, File | null> => ({ ...files });

const buildBrandingDraft = (
  logo: TournamentLogo | null,
  sponsors: TournamentSponsor[]
): TournamentBrandingDraft => ({
  tournamentLogo: cloneTournamentLogo(logo),
  tournamentLogoFile: null,
  removeTournamentLogo: false,
  sponsors: sponsors.map(cloneTournamentSponsor),
  sponsorLogoFiles: {},
});

const normalizeSponsorsForSave = (
  sponsors: TournamentSponsor[]
): TournamentSponsor[] => sponsors.map((sponsor, index) => ({
  ...sponsor,
  name: sponsor.name.trim(),
  website: sponsor.website?.trim() ? sponsor.website.trim() : undefined,
  displayOrder: index,
}));

const isValidWebsite = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

const validateBrandingDraft = (draft: TournamentBrandingDraft): string | null => {
  if (draft.sponsors.length > 20) {
    return 'You can add up to 20 sponsors per tournament.';
  }

  for (const sponsor of draft.sponsors) {
    if (!sponsor.name.trim()) {
      return 'Every sponsor needs a name before saving.';
    }

    const selectedLogoFile = draft.sponsorLogoFiles[sponsor.id];
    if (!sponsor.logoUrl && !selectedLogoFile) {
      return `Sponsor "${sponsor.name.trim()}" needs a logo before saving.`;
    }

    if (sponsor.website?.trim() && !isValidWebsite(sponsor.website.trim())) {
      return `Sponsor "${sponsor.name.trim()}" needs a valid website URL.`;
    }
  }

  return null;
};

// Form state
const name = ref('');
const description = ref('');
const location = ref('');
const startDate = ref('');
const endDate = ref('');
const registrationDeadline = ref('');
const settings = ref({
  minRestTimeMinutes: 15,
  matchDurationMinutes: 30,
  allowSelfRegistration: true,
  requireApproval: true,
  // Scoring settings with defaults
  gamesPerMatch: 3,
  pointsToWin: 21,
  mustWinBy: 2,
  maxPoints: 30 as number | null,
  rankingPresetDefault: DEFAULT_RANKING_PRESET as RankingPresetId,
  progressionModeDefault: DEFAULT_RANKING_PROGRESSION as RankingProgressionMode,
});
const brandingSponsors = ref<TournamentSponsor[]>([]);
const brandingTournamentLogo = ref<TournamentLogo | null>(null);
const brandingDraft = ref<TournamentBrandingDraft>(buildBrandingDraft(null, []));
const volunteerRoles: VolunteerRole[] = ['checkin', 'scorekeeper'];
const volunteerRoleLabels: Record<VolunteerRole, string> = {
  checkin: 'Check-in',
  scorekeeper: 'Scorekeeper',
};
const volunteerAccessForms = ref<Record<VolunteerRole, VolunteerAccessForm>>({
  checkin: {
    enabled: false,
    pin: '',
    maskedPin: '',
    revealedPin: '',
    showRevealedPin: false,
    pinRevision: 0,
    saving: false,
    revealing: false,
  },
  scorekeeper: {
    enabled: false,
    pin: '',
    maskedPin: '',
    revealedPin: '',
    showRevealedPin: false,
    pinRevision: 0,
    saving: false,
    revealing: false,
  },
});
const sectionSaving = reactive({
  basicInfo: false,
  scheduling: false,
  scoring: false,
  ranking: false,
  registration: false,
  branding: false,
});
const deletingTournament = ref(false);
const initialBasicInfo = ref<BasicInfoForm | null>(null);
const initialSchedulingSettings = ref<SchedulingSettingsForm | null>(null);
const initialRegistrationSettings = ref<RegistrationSettingsForm | null>(null);

const initialScoringConfig = ref<ScoringConfig>(sanitizeScoringConfig(settings.value));
const initialRankingDefaults = ref<{
  rankingPresetDefault: RankingPresetId;
  progressionModeDefault: RankingProgressionMode;
}>({
  rankingPresetDefault: DEFAULT_RANKING_PRESET,
  progressionModeDefault: DEFAULT_RANKING_PROGRESSION,
});
const categoryScoringOverrides = ref<Record<string, CategoryScoringOverrideForm>>({});
const initialCategoryScoringOverrides = ref<Record<string, CategoryScoringOverrideForm>>({});
const categoryEliminationScoringOverrides = ref<Record<string, CategoryScoringOverrideForm>>({});
const initialCategoryEliminationScoringOverrides = ref<Record<string, CategoryScoringOverrideForm>>({});
const categoryRankingOverrides = ref<Record<string, CategoryRankingOverrideForm>>({});
const initialCategoryRankingOverrides = ref<Record<string, CategoryRankingOverrideForm>>({});

// Scoring preset options
const scoringPresets = [
  { title: '21x3 (Best of 3, first to 21)', value: 'badminton_standard' },
  { title: '21x1 (Single game, first to 21)', value: 'badminton_single_game' },
  { title: '15x3 (Best of 3, first to 15)', value: 'badminton_short' },
  { title: 'Custom', value: 'custom' },
];

const rankingPresetOptions = Object.values(RANKING_PRESETS).map((preset) => ({
  title: preset.label,
  value: preset.id,
  subtitle: preset.description,
}));

const progressionModeOptions: Array<{ title: string; value: RankingProgressionMode }> = [
  {
    title: 'Carry Forward (Pool + Elimination)',
    value: 'carry_forward',
  },
  {
    title: 'Phase Reset (Elimination Only)',
    value: 'phase_reset',
  },
];

const selectedPreset = ref('badminton_standard');

// Games per match options
const gamesOptions = [
  { title: 'Single Game', value: 1 },
  { title: 'Best of 3', value: 3 },
  { title: 'Best of 5', value: 5 },
];

const maxPointsInput = computed({
  get: () => settings.value.maxPoints == null ? '' : String(settings.value.maxPoints),
  set: (value: string | number | null) => {
    if (value == null || value === '') {
      settings.value.maxPoints = null;
      selectedPreset.value = 'custom';
      return;
    }

    const parsed = Number(value);
    settings.value.maxPoints = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
    selectedPreset.value = 'custom';
  },
});

function applyPreset(presetKey: string) {
  if (presetKey === 'custom') return;

  const preset = SCORING_PRESETS[presetKey];
  if (preset) {
    settings.value.gamesPerMatch = preset.gamesPerMatch;
    settings.value.pointsToWin = preset.pointsToWin;
    settings.value.mustWinBy = preset.mustWinBy;
    settings.value.maxPoints = preset.maxPoints;
  }
}

// Detect which preset matches current settings
function detectPreset(config: ScoringConfig): string {
  const presetKeys = ['badminton_standard', 'badminton_single_game', 'badminton_short'];
  for (const key of presetKeys) {
    const preset = SCORING_PRESETS[key];
    if (
      config.gamesPerMatch === preset.gamesPerMatch &&
      config.pointsToWin === preset.pointsToWin &&
      config.mustWinBy === preset.mustWinBy &&
      config.maxPoints === preset.maxPoints
    ) {
      return key;
    }
  }
  return 'custom';
}

const tournamentState = computed(() => normalizeTournamentState(tournament.value));
const scoringLocked = computed(() => tournament.value ? isScoringLocked(tournamentState.value) : false);
const scoringLockLabel = computed(() => getTournamentStateLabel(tournamentState.value));
const hasCategories = computed(() => categories.value.length > 0);

const cloneOverrideRecord = (
  source: Record<string, CategoryScoringOverrideForm>
): Record<string, CategoryScoringOverrideForm> => {
  const cloned: Record<string, CategoryScoringOverrideForm> = {};
  Object.entries(source).forEach(([categoryId, override]) => {
    cloned[categoryId] = {
      enabled: override.enabled,
      preset: override.preset,
      config: cloneScoringConfig(override.config),
    };
  });
  return cloned;
};

const cloneCategoryRankingOverrides = (
  source: Record<string, CategoryRankingOverrideForm>
): Record<string, CategoryRankingOverrideForm> => {
  const cloned: Record<string, CategoryRankingOverrideForm> = {};
  Object.entries(source).forEach(([categoryId, override]) => {
    cloned[categoryId] = {
      enabled: override.enabled,
      rankingPreset: override.rankingPreset,
      progressionMode: override.progressionMode,
    };
  });
  return cloned;
};

const buildVolunteerAccessForm = (
  entry?: TournamentVolunteerAccessEntry | null,
): VolunteerAccessForm => ({
  enabled: entry?.enabled ?? false,
  pin: '',
  maskedPin: entry?.maskedPin ?? '',
  revealedPin: '',
  showRevealedPin: false,
  pinRevision: entry?.pinRevision ?? 0,
  saving: false,
  revealing: false,
});

const buildCategoryScoringForm = (category: Category, fallbackConfig: ScoringConfig): CategoryScoringOverrideForm => {
  const effectiveConfig = category.scoringOverrideEnabled
    ? sanitizeScoringConfig(
      category.scoringConfig ?? {
        gamesPerMatch: category.gamesPerMatch,
        pointsToWin: category.pointsToWin,
        mustWinBy: category.mustWinBy,
        maxPoints: category.maxPoints,
      },
      fallbackConfig
    )
    : fallbackConfig;

  return {
    enabled: Boolean(category.scoringOverrideEnabled),
    preset: detectPreset(effectiveConfig),
    config: cloneScoringConfig(effectiveConfig),
  };
};

const buildCategoryEliminationScoringForm = (category: Category, fallbackConfig: ScoringConfig): CategoryScoringOverrideForm => {
  const effectiveConfig = category.eliminationScoringEnabled
    ? sanitizeScoringConfig(category.eliminationScoringConfig ?? {}, fallbackConfig)
    : fallbackConfig;

  return {
    enabled: Boolean(category.eliminationScoringEnabled),
    preset: detectPreset(effectiveConfig),
    config: cloneScoringConfig(effectiveConfig),
  };
};

const buildCategoryRankingForm = (
  category: Category,
  fallbackPreset: RankingPresetId,
  fallbackProgressionMode: RankingProgressionMode
): CategoryRankingOverrideForm => {
  const rankingPreset = category.rankingPresetOverride ?? fallbackPreset;
  const progressionMode = category.progressionModeOverride ?? fallbackProgressionMode;

  return {
    enabled: Boolean(category.rankingPresetOverride || category.progressionModeOverride),
    rankingPreset,
    progressionMode,
  };
};

function applyCategoryPreset(categoryId: string, presetKey: string): void {
  if (presetKey === 'custom') return;

  const preset = SCORING_PRESETS[presetKey];
  const form = categoryScoringOverrides.value[categoryId];
  if (!preset || !form) return;

  form.config = sanitizeScoringConfig(preset, sanitizeScoringConfig(settings.value));
}

function updateCategoryMaxPoints(categoryId: string, value: string | number | null): void {
  const override = categoryScoringOverrides.value[categoryId];
  if (!override) return;

  override.config.maxPoints = value === '' || value == null ? null : Number(value);
  override.preset = 'custom';
}

function applyCategoryEliminationPreset(categoryId: string, presetKey: string): void {
  if (presetKey === 'custom') return;
  const preset = SCORING_PRESETS[presetKey];
  const form = categoryEliminationScoringOverrides.value[categoryId];
  if (!preset || !form) return;
  form.config = sanitizeScoringConfig(preset, sanitizeScoringConfig(settings.value));
}

function updateCategoryEliminationMaxPoints(categoryId: string, value: string | number | null): void {
  const override = categoryEliminationScoringOverrides.value[categoryId];
  if (!override) return;
  override.config.maxPoints = value === '' || value == null ? null : Number(value);
  override.preset = 'custom';
}

const hasTournamentScoringChanged = (): boolean => {
  const current = sanitizeScoringConfig(settings.value);
  const baseline = initialScoringConfig.value;

  return (
    current.gamesPerMatch !== baseline.gamesPerMatch
    || current.pointsToWin !== baseline.pointsToWin
    || current.mustWinBy !== baseline.mustWinBy
    || current.maxPoints !== baseline.maxPoints
  );
};

const getBasicInfoForm = (): BasicInfoForm => ({
  name: name.value,
  description: description.value,
  location: location.value,
  startDate: startDate.value,
  endDate: endDate.value,
  registrationDeadline: registrationDeadline.value,
});

const getSchedulingSettingsForm = (): SchedulingSettingsForm => ({
  minRestTimeMinutes: settings.value.minRestTimeMinutes,
  matchDurationMinutes: settings.value.matchDurationMinutes,
});

const getRegistrationSettingsForm = (): RegistrationSettingsForm => ({
  allowSelfRegistration: settings.value.allowSelfRegistration,
  requireApproval: settings.value.requireApproval,
});

const isBasicInfoEqual = (left: BasicInfoForm | null, right: BasicInfoForm | null): boolean => (
  left?.name === right?.name &&
  left?.description === right?.description &&
  left?.location === right?.location &&
  left?.startDate === right?.startDate &&
  left?.endDate === right?.endDate &&
  left?.registrationDeadline === right?.registrationDeadline
);

const isSchedulingSettingsEqual = (
  left: SchedulingSettingsForm | null,
  right: SchedulingSettingsForm | null
): boolean => (
  left?.minRestTimeMinutes === right?.minRestTimeMinutes &&
  left?.matchDurationMinutes === right?.matchDurationMinutes
);

const isRegistrationSettingsEqual = (
  left: RegistrationSettingsForm | null,
  right: RegistrationSettingsForm | null
): boolean => (
  left?.allowSelfRegistration === right?.allowSelfRegistration &&
  left?.requireApproval === right?.requireApproval
);

const areScoringOverrideRecordsEqual = (
  left: Record<string, CategoryScoringOverrideForm>,
  right: Record<string, CategoryScoringOverrideForm>
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const current = left[key];
    const baseline = right[key];
    if (!current || !baseline) return false;

    return (
      current.enabled === baseline.enabled &&
      current.preset === baseline.preset &&
      current.config.gamesPerMatch === baseline.config.gamesPerMatch &&
      current.config.pointsToWin === baseline.config.pointsToWin &&
      current.config.mustWinBy === baseline.config.mustWinBy &&
      current.config.maxPoints === baseline.config.maxPoints
    );
  });
};

const areRankingOverrideRecordsEqual = (
  left: Record<string, CategoryRankingOverrideForm>,
  right: Record<string, CategoryRankingOverrideForm>
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const current = left[key];
    const baseline = right[key];
    if (!current || !baseline) return false;

    return (
      current.enabled === baseline.enabled &&
      current.rankingPreset === baseline.rankingPreset &&
      current.progressionMode === baseline.progressionMode
    );
  });
};

const getBrandingLogoSignature = (logo: TournamentLogo | null): string => JSON.stringify({
  url: logo?.url ?? null,
  storagePath: logo?.storagePath ?? null,
});

const getBrandingSponsorsSignature = (sponsors: TournamentSponsor[]): string => JSON.stringify(
  normalizeSponsorsForSave(sponsors).map((sponsor) => ({
    id: sponsor.id,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl,
    logoPath: sponsor.logoPath,
    website: sponsor.website ?? null,
    displayOrder: sponsor.displayOrder,
  }))
);

const buildTournamentSettingsUpdate = (
  updates: Partial<typeof settings.value>
): typeof settings.value & Record<string, unknown> => {
  const currentSettings = (tournament.value?.settings ?? {}) as Partial<typeof settings.value>;
  const normalizedScoringConfig = sanitizeScoringConfig(currentSettings);
  const rankingPresetDefault = currentSettings.rankingPresetDefault && currentSettings.rankingPresetDefault in RANKING_PRESETS
    ? currentSettings.rankingPresetDefault
    : DEFAULT_RANKING_PRESET;
  const progressionModeDefault = currentSettings.progressionModeDefault === 'phase_reset'
    ? 'phase_reset'
    : DEFAULT_RANKING_PROGRESSION;

  return {
    ...currentSettings,
    minRestTimeMinutes: currentSettings.minRestTimeMinutes || 15,
    matchDurationMinutes: currentSettings.matchDurationMinutes || 30,
    allowSelfRegistration: currentSettings.allowSelfRegistration ?? true,
    requireApproval: currentSettings.requireApproval ?? true,
    gamesPerMatch: normalizedScoringConfig.gamesPerMatch,
    pointsToWin: normalizedScoringConfig.pointsToWin,
    mustWinBy: normalizedScoringConfig.mustWinBy,
    maxPoints: normalizedScoringConfig.maxPoints,
    rankingPresetDefault,
    progressionModeDefault,
    ...updates,
  };
};

const hydrateFormState = (): void => {
  if (!tournament.value) return;

  name.value = tournament.value.name;
  description.value = tournament.value.description || '';
  location.value = tournament.value.location || '';
  startDate.value = tournament.value.startDate.toISOString().split('T')[0];
  endDate.value = tournament.value.endDate.toISOString().split('T')[0];
  registrationDeadline.value = tournament.value.registrationDeadline
    ? tournament.value.registrationDeadline.toISOString().split('T')[0]
    : '';

  const normalizedScoringConfig = sanitizeScoringConfig(tournament.value.settings);
  const rankingPresetDefault = tournament.value.settings.rankingPresetDefault && tournament.value.settings.rankingPresetDefault in RANKING_PRESETS
    ? tournament.value.settings.rankingPresetDefault
    : DEFAULT_RANKING_PRESET;
  const progressionModeDefault = tournament.value.settings.progressionModeDefault === 'phase_reset'
    ? 'phase_reset'
    : DEFAULT_RANKING_PROGRESSION;

  settings.value = {
    minRestTimeMinutes: tournament.value.settings.minRestTimeMinutes || 15,
    matchDurationMinutes: tournament.value.settings.matchDurationMinutes || 30,
    allowSelfRegistration: tournament.value.settings.allowSelfRegistration ?? true,
    requireApproval: tournament.value.settings.requireApproval ?? true,
    gamesPerMatch: normalizedScoringConfig.gamesPerMatch,
    pointsToWin: normalizedScoringConfig.pointsToWin,
    mustWinBy: normalizedScoringConfig.mustWinBy,
    maxPoints: normalizedScoringConfig.maxPoints,
    rankingPresetDefault,
    progressionModeDefault,
  };

  initialBasicInfo.value = getBasicInfoForm();
  initialSchedulingSettings.value = getSchedulingSettingsForm();
  initialRegistrationSettings.value = getRegistrationSettingsForm();
  selectedPreset.value = detectPreset(normalizedScoringConfig);
  initialScoringConfig.value = cloneScoringConfig(normalizedScoringConfig);
  initialRankingDefaults.value = {
    rankingPresetDefault,
    progressionModeDefault,
  };

  const nextCategoryScoringOverrides: Record<string, CategoryScoringOverrideForm> = {};
  const nextCategoryEliminationOverrides: Record<string, CategoryScoringOverrideForm> = {};
  const nextCategoryRankingOverrides: Record<string, CategoryRankingOverrideForm> = {};

  categories.value.forEach((category) => {
    nextCategoryScoringOverrides[category.id] = buildCategoryScoringForm(category, normalizedScoringConfig);
    nextCategoryEliminationOverrides[category.id] = buildCategoryEliminationScoringForm(category, normalizedScoringConfig);
    nextCategoryRankingOverrides[category.id] = buildCategoryRankingForm(
      category,
      rankingPresetDefault,
      progressionModeDefault
    );
  });

  categoryScoringOverrides.value = nextCategoryScoringOverrides;
  initialCategoryScoringOverrides.value = cloneOverrideRecord(nextCategoryScoringOverrides);
  categoryEliminationScoringOverrides.value = nextCategoryEliminationOverrides;
  initialCategoryEliminationScoringOverrides.value = cloneOverrideRecord(nextCategoryEliminationOverrides);
  categoryRankingOverrides.value = nextCategoryRankingOverrides;
  initialCategoryRankingOverrides.value = cloneCategoryRankingOverrides(nextCategoryRankingOverrides);
  brandingSponsors.value = normalizedSponsors.value.map(cloneTournamentSponsor);
  brandingTournamentLogo.value = cloneTournamentLogo(normalizedTournamentLogo.value);
  brandingDraft.value = buildBrandingDraft(
    brandingTournamentLogo.value,
    brandingSponsors.value
  );
  volunteerAccessForms.value = {
    checkin: buildVolunteerAccessForm(tournament.value.volunteerAccess?.checkin),
    scorekeeper: buildVolunteerAccessForm(tournament.value.volunteerAccess?.scorekeeper),
  };
};

const basicInfoDirty = computed(() => !isBasicInfoEqual(getBasicInfoForm(), initialBasicInfo.value));
const schedulingDirty = computed(() => !isSchedulingSettingsEqual(
  getSchedulingSettingsForm(),
  initialSchedulingSettings.value
));
const registrationDirty = computed(() => !isRegistrationSettingsEqual(
  getRegistrationSettingsForm(),
  initialRegistrationSettings.value
));
const scoringDirty = computed(() => (
  hasTournamentScoringChanged()
  || !areScoringOverrideRecordsEqual(categoryScoringOverrides.value, initialCategoryScoringOverrides.value)
  || !areScoringOverrideRecordsEqual(
    categoryEliminationScoringOverrides.value,
    initialCategoryEliminationScoringOverrides.value
  )
));
const rankingDirty = computed(() => (
  settings.value.rankingPresetDefault !== initialRankingDefaults.value.rankingPresetDefault
  || settings.value.progressionModeDefault !== initialRankingDefaults.value.progressionModeDefault
  || !areRankingOverrideRecordsEqual(categoryRankingOverrides.value, initialCategoryRankingOverrides.value)
));
const brandingDirty = computed(() => (
  Boolean(brandingDraft.value.tournamentLogoFile)
  || brandingDraft.value.removeTournamentLogo
  || Object.values(brandingDraft.value.sponsorLogoFiles).some((file) => file != null)
  || getBrandingLogoSignature(brandingDraft.value.tournamentLogo) !== getBrandingLogoSignature(brandingTournamentLogo.value)
  || getBrandingSponsorsSignature(brandingDraft.value.sponsors) !== getBrandingSponsorsSignature(brandingSponsors.value)
));

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  hydrateFormState();
  if (canManageOrganizers.value) {
    await userStore.fetchUsers();
  }
});

async function saveBasicInfoSection(): Promise<void> {
  if (!tournament.value || !basicInfoDirty.value) return;

  sectionSaving.basicInfo = true;
  try {
    await tournamentStore.updateTournament(tournamentId.value, {
      name: name.value,
      description: description.value,
      location: location.value,
      startDate: new Date(startDate.value + 'T00:00:00'),
      endDate: new Date(endDate.value + 'T23:59:59'),
      registrationDeadline: registrationDeadline.value
        ? new Date(registrationDeadline.value)
        : undefined,
    });
    initialBasicInfo.value = getBasicInfoForm();
    notificationStore.showToast('success', 'Basic information saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save basic information';
    notificationStore.showToast('error', message);
  } finally {
    sectionSaving.basicInfo = false;
  }
}

async function saveSchedulingSection(): Promise<void> {
  if (!tournament.value || !schedulingDirty.value) return;

  sectionSaving.scheduling = true;
  try {
    await tournamentStore.updateTournament(tournamentId.value, {
      settings: buildTournamentSettingsUpdate({
        minRestTimeMinutes: settings.value.minRestTimeMinutes,
        matchDurationMinutes: settings.value.matchDurationMinutes,
      }),
    });
    initialSchedulingSettings.value = getSchedulingSettingsForm();
    notificationStore.showToast('success', 'Scheduling settings saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save scheduling settings';
    notificationStore.showToast('error', message);
  } finally {
    sectionSaving.scheduling = false;
  }
}

async function saveScoringSection(): Promise<void> {
  if (!tournament.value || !scoringDirty.value) return;

  sectionSaving.scoring = true;
  try {
    if (hasTournamentScoringChanged()) {
      assertCanEditScoring(tournamentState.value);
      await tournamentStore.updateTournament(tournamentId.value, {
        settings: buildTournamentSettingsUpdate({
          gamesPerMatch: settings.value.gamesPerMatch,
          pointsToWin: settings.value.pointsToWin,
          mustWinBy: settings.value.mustWinBy,
          maxPoints: settings.value.maxPoints,
        }),
      });
    }

    const tournamentScoringConfig = sanitizeScoringConfig(settings.value);
    await Promise.all(
      categories.value.map(async (category) => {
        const scoringOverride = categoryScoringOverrides.value[category.id];
        const eliminationOverride = categoryEliminationScoringOverrides.value[category.id];
        if (!scoringOverride || !eliminationOverride) return;

        const overrideConfig = sanitizeScoringConfig(
          scoringOverride.config,
          tournamentScoringConfig
        );
        const eliminationConfig = sanitizeScoringConfig(
          eliminationOverride.config,
          tournamentScoringConfig
        );

        await tournamentStore.updateCategory(tournamentId.value, category.id, {
          scoringOverrideEnabled: scoringOverride.enabled,
          scoringConfig: scoringOverride.enabled ? overrideConfig : null,
          eliminationScoringEnabled: eliminationOverride.enabled,
          eliminationScoringConfig: eliminationOverride.enabled ? eliminationConfig : null,
        });
      })
    );

    initialScoringConfig.value = sanitizeScoringConfig(settings.value);
    initialCategoryScoringOverrides.value = cloneOverrideRecord(categoryScoringOverrides.value);
    initialCategoryEliminationScoringOverrides.value = cloneOverrideRecord(
      categoryEliminationScoringOverrides.value
    );
    notificationStore.showToast('success', 'Scoring settings saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save scoring settings';
    notificationStore.showToast('error', message);
  } finally {
    sectionSaving.scoring = false;
  }
}

async function saveRankingSection(): Promise<void> {
  if (!tournament.value || !rankingDirty.value) return;

  sectionSaving.ranking = true;
  try {
    if (
      settings.value.rankingPresetDefault !== initialRankingDefaults.value.rankingPresetDefault
      || settings.value.progressionModeDefault !== initialRankingDefaults.value.progressionModeDefault
    ) {
      await tournamentStore.updateTournament(tournamentId.value, {
        settings: buildTournamentSettingsUpdate({
          rankingPresetDefault: settings.value.rankingPresetDefault,
          progressionModeDefault: settings.value.progressionModeDefault,
        }),
      });
    }

    await Promise.all(
      categories.value.map(async (category) => {
        const rankingOverride = categoryRankingOverrides.value[category.id];
        if (!rankingOverride) return;

        await tournamentStore.updateCategory(tournamentId.value, category.id, {
          rankingPresetOverride: rankingOverride.enabled ? rankingOverride.rankingPreset : null,
          progressionModeOverride: rankingOverride.enabled ? rankingOverride.progressionMode : null,
        });
      })
    );

    initialRankingDefaults.value = {
      rankingPresetDefault: settings.value.rankingPresetDefault,
      progressionModeDefault: settings.value.progressionModeDefault,
    };
    initialCategoryRankingOverrides.value = cloneCategoryRankingOverrides(categoryRankingOverrides.value);
    notificationStore.showToast('success', 'Leaderboard ranking settings saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save leaderboard ranking settings';
    notificationStore.showToast('error', message);
  } finally {
    sectionSaving.ranking = false;
  }
}

async function saveRegistrationSection(): Promise<void> {
  if (!tournament.value || !registrationDirty.value) return;

  sectionSaving.registration = true;
  try {
    await tournamentStore.updateTournament(tournamentId.value, {
      settings: buildTournamentSettingsUpdate({
        allowSelfRegistration: settings.value.allowSelfRegistration,
        requireApproval: settings.value.requireApproval,
      }),
    });
    initialRegistrationSettings.value = getRegistrationSettingsForm();
    notificationStore.showToast('success', 'Registration settings saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save registration settings';
    notificationStore.showToast('error', message);
  } finally {
    sectionSaving.registration = false;
  }
}

async function saveBrandingSection(): Promise<void> {
  if (!tournament.value || !brandingDirty.value) return;

  sectionSaving.branding = true;
  try {
    const brandingError = validateBrandingDraft(brandingDraft.value);
    if (brandingError) {
      notificationStore.showToast('error', brandingError);
      return;
    }

    const nextSponsorsBase = normalizeSponsorsForSave(brandingDraft.value.sponsors);
    const sponsorLogoFiles = cloneSponsorLogoFiles(brandingDraft.value.sponsorLogoFiles);
    const originalSponsorsById = new Map(
      brandingSponsors.value.map((sponsor) => [sponsor.id, sponsor] as const)
    );
    const logoPathsToDelete = new Set<string>();

    let nextTournamentLogo = brandingDraft.value.removeTournamentLogo
      ? null
      : cloneTournamentLogo(brandingDraft.value.tournamentLogo);

    if (brandingDraft.value.tournamentLogoFile) {
      const uploadedTournamentLogo = await uploadTournamentLogo(
        tournamentId.value,
        brandingDraft.value.tournamentLogoFile
      );
      nextTournamentLogo = {
        url: uploadedTournamentLogo.downloadUrl,
        storagePath: uploadedTournamentLogo.storagePath,
        uploadedAt: new Date(),
      };
      if (brandingTournamentLogo.value?.storagePath) {
        logoPathsToDelete.add(brandingTournamentLogo.value.storagePath);
      }
    } else if (brandingDraft.value.removeTournamentLogo && brandingTournamentLogo.value?.storagePath) {
      logoPathsToDelete.add(brandingTournamentLogo.value.storagePath);
    }

    const nextSponsors = await Promise.all(
      nextSponsorsBase.map(async (sponsor) => {
        const selectedLogoFile = sponsorLogoFiles[sponsor.id];

        if (!selectedLogoFile) {
          return sponsor;
        }

        const uploadedSponsorLogo = await uploadSponsorLogo(
          tournamentId.value,
          sponsor.id,
          selectedLogoFile
        );
        const originalSponsor = originalSponsorsById.get(sponsor.id);

        if (originalSponsor?.logoPath) {
          logoPathsToDelete.add(originalSponsor.logoPath);
        }

        return {
          ...sponsor,
          logoUrl: uploadedSponsorLogo.downloadUrl,
          logoPath: uploadedSponsorLogo.storagePath,
        };
      })
    );

    brandingSponsors.value.forEach((sponsor) => {
      if (!nextSponsors.some((item) => item.id === sponsor.id) && sponsor.logoPath) {
        logoPathsToDelete.add(sponsor.logoPath);
      }
    });

    await tournamentStore.updateTournament(tournamentId.value, {
      tournamentLogo: nextTournamentLogo,
      sponsors: nextSponsors,
    });

    brandingSponsors.value = nextSponsors.map(cloneTournamentSponsor);
    brandingTournamentLogo.value = cloneTournamentLogo(nextTournamentLogo);
    brandingDraft.value = buildBrandingDraft(
      brandingTournamentLogo.value,
      brandingSponsors.value
    );

    const deleteTargets = [...logoPathsToDelete].filter((path) => {
      if (!path) return false;
      if (nextTournamentLogo?.storagePath === path) return false;
      return !nextSponsors.some((sponsor) => sponsor.logoPath === path);
    });

    const deleteResults = await Promise.allSettled(
      deleteTargets.map((storagePath) => deleteBrandingAsset(storagePath))
    );
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Error deleting old branding asset:', deleteTargets[index], result.reason);
      }
    });

    notificationStore.showToast('success', 'Branding saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save branding';
    notificationStore.showToast('error', message);
  } finally {
    sectionSaving.branding = false;
  }
}

function handleBrandingUpdate(payload: TournamentBrandingDraft): void {
  brandingDraft.value = {
    tournamentLogo: cloneTournamentLogo(payload.tournamentLogo),
    tournamentLogoFile: payload.tournamentLogoFile,
    removeTournamentLogo: payload.removeTournamentLogo,
    sponsors: payload.sponsors.map(cloneTournamentSponsor),
    sponsorLogoFiles: cloneSponsorLogoFiles(payload.sponsorLogoFiles),
  };
}

// Co-organizer management
const canManageOrganizers = computed(() => {
  if (!tournament.value) return false;
  if (authStore.userRole === 'admin') return true;
  const uid = authStore.currentUser?.id;
  if (!uid) return false;
  const ids = tournament.value.organizerIds ?? [];
  return ids.includes(uid) || tournament.value.createdBy === uid;
});

const organizerUsers = computed(() => {
  const ids = tournament.value?.organizerIds ?? [];
  return userStore.users.filter((u) => ids.includes(u.id));
});

const addableOrganizers = computed(() => {
  const ids = tournament.value?.organizerIds ?? [];
  return userStore.users.filter(
    (u) => (u.role === 'organizer' || u.role === 'admin') && !ids.includes(u.id)
  );
});

const selectedOrganizerToAdd = ref<string | null>(null);
const organizerLoading = ref(false);
const organizerAutocompleteItemProps = (user: User): { subtitle: string } => ({
  subtitle: user.email ?? '',
});

async function addOrganizerToTournament(): Promise<void> {
  if (!selectedOrganizerToAdd.value) return;
  organizerLoading.value = true;
  try {
    await tournamentStore.addOrganizer(tournamentId.value, selectedOrganizerToAdd.value);
    selectedOrganizerToAdd.value = null;
    notificationStore.showToast('success', 'Organizer added');
  } catch {
    notificationStore.showToast('error', 'Failed to add organizer');
  } finally {
    organizerLoading.value = false;
  }
}

async function removeOrganizerFromTournament(userId: string): Promise<void> {
  const ids = tournament.value?.organizerIds ?? [];
  if (ids.length <= 1) {
    notificationStore.showToast('error', 'Cannot remove the last organizer');
    return;
  }
  organizerLoading.value = true;
  try {
    await tournamentStore.removeOrganizer(tournamentId.value, userId);
    notificationStore.showToast('success', 'Organizer removed');
  } catch {
    notificationStore.showToast('error', 'Failed to remove organizer');
  } finally {
    organizerLoading.value = false;
  }
}
const getVolunteerDisplayPin = (role: VolunteerRole): string => {
  const form = volunteerAccessForms.value[role];
  if (form.showRevealedPin && form.revealedPin) {
    return form.revealedPin;
  }

  if (form.maskedPin) {
    return form.maskedPin;
  }

  return form.pinRevision > 0 ? 'Configured' : 'Not set';
};

const hasVolunteerPinConfigured = (role: VolunteerRole): boolean =>
  volunteerAccessForms.value[role].pinRevision > 0;

const getVolunteerAccessUrl = (role: VolunteerRole): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const suffix = role === 'scorekeeper' ? 'scoring-access' : 'checkin-access';
  return `${origin}/tournaments/${tournamentId.value}/${suffix}`;
};

async function copyVolunteerAccessValue(value: string, successMessage: string): Promise<void> {
  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard is not available');
    }

    await navigator.clipboard.writeText(value);
    notificationStore.showToast('success', successMessage);
  } catch (error) {
    notificationStore.showToast('error', error instanceof Error ? error.message : 'Failed to copy value');
  }
}

async function saveVolunteerPin(role: VolunteerRole): Promise<void> {
  const form = volunteerAccessForms.value[role];
  const nextPin = form.pin.trim();

  if (!nextPin && form.pinRevision === 0) {
    notificationStore.showToast('error', `Enter a PIN before enabling ${volunteerRoleLabels[role]} access`);
    return;
  }

  form.saving = true;
  try {
    const setVolunteerPinFn = httpsCallable(functions, 'setVolunteerPin');
    const response = await setVolunteerPinFn({
      tournamentId: tournamentId.value,
      role,
      pin: nextPin || undefined,
      enabled: form.enabled,
    });
    const data = (response as {
      data?: {
        enabled?: boolean;
        pinRevision?: number;
        maskedPin?: string;
      };
    }).data;

    form.enabled = data?.enabled ?? form.enabled;
    form.pinRevision = Number(data?.pinRevision ?? form.pinRevision);
    form.maskedPin = data?.maskedPin ?? form.maskedPin;
    form.pin = '';
    form.revealedPin = '';
    form.showRevealedPin = false;

    await tournamentStore.fetchTournament(tournamentId.value);
    notificationStore.showToast('success', `${volunteerRoleLabels[role]} PIN saved`);
  } catch (error) {
    notificationStore.showToast(
      'error',
      error instanceof Error ? error.message : `Failed to save ${volunteerRoleLabels[role]} PIN`,
    );
  } finally {
    form.saving = false;
  }
}

async function revealVolunteerPin(role: VolunteerRole): Promise<void> {
  const form = volunteerAccessForms.value[role];
  form.revealing = true;
  try {
    const revealVolunteerPinFn = httpsCallable(functions, 'revealVolunteerPin');
    const response = await revealVolunteerPinFn({
      tournamentId: tournamentId.value,
      role,
    });
    const data = (response as {
      data?: {
        pin?: string;
        enabled?: boolean;
        pinRevision?: number;
      };
    }).data;

    form.revealedPin = data?.pin ?? '';
    form.showRevealedPin = Boolean(data?.pin);
    form.enabled = data?.enabled ?? form.enabled;
    form.pinRevision = Number(data?.pinRevision ?? form.pinRevision);
    notificationStore.showToast('success', `${volunteerRoleLabels[role]} PIN revealed`);
  } catch (error) {
    notificationStore.showToast(
      'error',
      error instanceof Error ? error.message : `Failed to reveal ${volunteerRoleLabels[role]} PIN`,
    );
  } finally {
    form.revealing = false;
  }
}

const showDeleteDialog = ref(false);
const typedDeleteName = ref('');
const deleteConfirmEnabled = computed(
  () => typedDeleteName.value === tournament.value?.name
);

function deleteTournament() {
  typedDeleteName.value = '';
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  deletingTournament.value = true;
  try {
    await tournamentStore.deleteTournament(tournamentId.value);
    showDeleteDialog.value = false;
    notificationStore.showToast('success', 'Tournament deleted');
    router.push('/tournaments');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete tournament');
  } finally {
    deletingTournament.value = false;
  }
}
</script>

<template>
  <v-container v-if="tournament">
    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
      >
        <!-- Header -->
        <div class="d-flex align-center mb-6">
          <v-btn
            icon="mdi-arrow-left"
            variant="text"
            aria-label="Go back"
            @click="router.back()"
          />
          <div class="ml-2">
            <h1 class="text-h5 font-weight-bold d-flex align-center ga-2">
              <v-icon
                :icon="NAVIGATION_ICONS.settings"
                size="22"
              />
              Tournament Settings
            </h1>
            <p class="text-body-2 text-grey">
              {{ tournament.name }}
            </p>
          </div>
        </div>

        <!-- State Banner -->
        <StateBanner
          v-if="tournament"
          :state="tournament.state || 'DRAFT'"
          :next-state="getNextState(tournament.state || 'DRAFT')"
          :is-admin="isAdmin"
          @advance="advanceState"
          @unlock="showUnlockDialog = true"
          @revert="transitionTo('LIVE')"
        />

        <!-- Basic Info -->
        <v-card class="mb-4">
          <v-card-title>Basic Information</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="name"
              label="Tournament Name"
              data-testid="tournament-name"
              required
            />
            <v-textarea
              v-model="description"
              label="Description"
              data-testid="tournament-description"
              rows="3"
            />
            <v-text-field
              v-model="location"
              label="Location"
              data-testid="tournament-location"
              prepend-inner-icon="mdi-map-marker"
            />
            <v-row>
              <v-col
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model="startDate"
                  label="Start Date"
                  data-testid="tournament-start-date"
                  type="date"
                  required
                />
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model="endDate"
                  label="End Date"
                  data-testid="tournament-end-date"
                  type="date"
                  required
                />
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model="registrationDeadline"
                  label="Registration Deadline"
                  type="date"
                />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!basicInfoDirty"
              :loading="sectionSaving.basicInfo"
              @click="saveBasicInfoSection"
            >
              Save Basic Information
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Scheduling Settings -->
        <v-card class="mb-4">
          <v-card-title>Scheduling Settings</v-card-title>
          <v-card-text>
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="settings.minRestTimeMinutes"
                  label="Minimum Rest Time (minutes)"
                  type="number"
                  min="5"
                  max="60"
                  hint="Time between matches for the same player"
                  persistent-hint
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="settings.matchDurationMinutes"
                  label="Estimated Match Duration (minutes)"
                  type="number"
                  min="15"
                  max="90"
                  hint="Used for scheduling"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!schedulingDirty"
              :loading="sectionSaving.scheduling"
              @click="saveSchedulingSection"
            >
              Save Scheduling
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Scoring Settings -->
        <v-card class="mb-4">
          <v-card-title>
            <v-icon start>
              mdi-scoreboard
            </v-icon>
            Scoring Settings
          </v-card-title>
          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              These settings apply to all matches in this tournament.
            </v-alert>
            <v-alert
              v-if="scoringLocked"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              Scoring format is locked while tournament state is <strong>{{ scoringLockLabel }}</strong>.
            </v-alert>

            <v-select
              v-model="selectedPreset"
              :items="scoringPresets"
              item-title="title"
              item-value="value"
              label="Scoring Preset"
              variant="outlined"
              :disabled="scoringLocked"
              @update:model-value="applyPreset"
            />

            <v-divider class="my-4" />

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="settings.gamesPerMatch"
                  :items="gamesOptions"
                  item-title="title"
                  item-value="value"
                  label="Games Per Match"
                  variant="outlined"
                  :disabled="scoringLocked"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="settings.pointsToWin"
                  label="Points to Win Game"
                  type="number"
                  min="5"
                  max="30"
                  variant="outlined"
                  hint="e.g., 21 for badminton, 11 for pickleball"
                  persistent-hint
                  :disabled="scoringLocked"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="settings.mustWinBy"
                  label="Win By Margin"
                  type="number"
                  min="1"
                  max="5"
                  variant="outlined"
                  hint="Must win by this many points (typically 2)"
                  persistent-hint
                  :disabled="scoringLocked"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="maxPointsInput"
                  label="Max Points Cap"
                  type="number"
                  max="50"
                  variant="outlined"
                  hint="Optional. Leave blank to disable cap."
                  persistent-hint
                  clearable
                  :disabled="scoringLocked"
                />
              </v-col>
            </v-row>

            <!-- Preview -->
            <v-card
              variant="outlined"
              class="mt-4 pa-3 bg-grey-lighten-5"
            >
              <div class="text-subtitle-2 mb-2">
                Match Format Preview
              </div>
              <div class="text-body-2">
                <v-icon
                  size="small"
                  class="mr-1"
                >
                  mdi-information
                </v-icon>
                {{ settings.gamesPerMatch === 1 ? 'Single game' : `Best of ${settings.gamesPerMatch} games` }},
                first to <strong>{{ settings.pointsToWin }}</strong> points,
                win by <strong>{{ settings.mustWinBy }}</strong>,
                <template v-if="settings.maxPoints == null">
                  with <strong>no points cap</strong>.
                </template>
                <template v-else>
                  max <strong>{{ settings.maxPoints }}</strong> points.
                </template>
              </div>
              <div class="text-caption text-grey mt-1">
                Example: At {{ settings.pointsToWin - 1 }}-{{ settings.pointsToWin - 1 }},
                <template v-if="settings.maxPoints == null">
                  play continues until someone leads by {{ settings.mustWinBy }}.
                </template>
                <template v-else>
                  play continues until someone leads by {{ settings.mustWinBy }} or reaches {{ settings.maxPoints }}.
                </template>
              </div>
            </v-card>

            <v-divider class="my-4" />

            <div class="d-flex align-center justify-space-between mb-3">
              <div class="text-subtitle-2">
                Category Overrides (Optional)
              </div>
              <v-chip
                size="small"
                color="info"
                variant="tonal"
              >
                Uses tournament defaults when disabled
              </v-chip>
            </div>

            <v-alert
              v-if="!hasCategories"
              type="info"
              variant="tonal"
              density="compact"
            >
              No categories found for this tournament.
            </v-alert>

            <v-expansion-panels
              v-else
              variant="accordion"
            >
              <v-expansion-panel
                v-for="category in categories"
                :key="category.id"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center w-100">
                    <span>{{ category.name }}</span>
                    <v-chip
                      class="ml-3"
                      size="x-small"
                      :color="categoryScoringOverrides[category.id]?.enabled ? 'info' : 'grey'"
                      variant="tonal"
                    >
                      {{ categoryScoringOverrides[category.id]?.enabled ? 'Override enabled' : 'Tournament default' }}
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text v-if="categoryScoringOverrides[category.id]">
                  <v-switch
                    v-model="categoryScoringOverrides[category.id].enabled"
                    label="Use category-specific scoring"
                    color="primary"
                  />

                  <template v-if="categoryScoringOverrides[category.id].enabled">
                    <v-select
                      v-model="categoryScoringOverrides[category.id].preset"
                      :items="scoringPresets"
                      item-title="title"
                      item-value="value"
                      label="Category Scoring Preset"
                      variant="outlined"
                      density="compact"
                      @update:model-value="applyCategoryPreset(category.id, String($event))"
                    />

                    <v-row>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-select
                          v-model="categoryScoringOverrides[category.id].config.gamesPerMatch"
                          :items="gamesOptions"
                          item-title="title"
                          item-value="value"
                          label="Games Per Match"
                          variant="outlined"
                          density="compact"
                          @update:model-value="categoryScoringOverrides[category.id].preset = 'custom'"
                        />
                      </v-col>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          v-model.number="categoryScoringOverrides[category.id].config.pointsToWin"
                          label="Points to Win"
                          type="number"
                          min="1"
                          variant="outlined"
                          density="compact"
                          @update:model-value="categoryScoringOverrides[category.id].preset = 'custom'"
                        />
                      </v-col>
                    </v-row>

                    <v-row>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          v-model.number="categoryScoringOverrides[category.id].config.mustWinBy"
                          label="Win By"
                          type="number"
                          min="1"
                          variant="outlined"
                          density="compact"
                          @update:model-value="categoryScoringOverrides[category.id].preset = 'custom'"
                        />
                      </v-col>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          :model-value="categoryScoringOverrides[category.id].config.maxPoints ?? ''"
                          label="Max Points Cap"
                          type="number"
                          variant="outlined"
                          density="compact"
                          clearable
                          @update:model-value="updateCategoryMaxPoints(category.id, $event)"
                        />
                      </v-col>
                    </v-row>
                  </template>

                  <template v-if="category.format === 'pool_to_elimination' && categoryEliminationScoringOverrides[category.id]">
                    <v-divider class="my-4" />

                    <div class="d-flex align-center mb-2">
                      <span class="text-body-2 font-weight-medium">Elimination / Playoff Scoring</span>
                      <v-chip
                        class="ml-2"
                        size="x-small"
                        color="success"
                        variant="tonal"
                      >
                        Always editable
                      </v-chip>
                    </div>

                    <v-switch
                      v-model="categoryEliminationScoringOverrides[category.id].enabled"
                      label="Use different scoring for elimination matches"
                      color="primary"
                    />

                    <template v-if="categoryEliminationScoringOverrides[category.id].enabled">
                      <v-select
                        v-model="categoryEliminationScoringOverrides[category.id].preset"
                        :items="scoringPresets"
                        item-title="title"
                        item-value="value"
                        label="Elimination Scoring Preset"
                        variant="outlined"
                        density="compact"
                        @update:model-value="applyCategoryEliminationPreset(category.id, String($event))"
                      />

                      <v-row>
                        <v-col
                          cols="12"
                          md="6"
                        >
                          <v-select
                            v-model="categoryEliminationScoringOverrides[category.id].config.gamesPerMatch"
                            :items="gamesOptions"
                            item-title="title"
                            item-value="value"
                            label="Games Per Match"
                            variant="outlined"
                            density="compact"
                            @update:model-value="categoryEliminationScoringOverrides[category.id].preset = 'custom'"
                          />
                        </v-col>
                        <v-col
                          cols="12"
                          md="6"
                        >
                          <v-text-field
                            v-model.number="categoryEliminationScoringOverrides[category.id].config.pointsToWin"
                            label="Points to Win"
                            type="number"
                            min="1"
                            variant="outlined"
                            density="compact"
                            @update:model-value="categoryEliminationScoringOverrides[category.id].preset = 'custom'"
                          />
                        </v-col>
                      </v-row>

                      <v-row>
                        <v-col
                          cols="12"
                          md="6"
                        >
                          <v-text-field
                            v-model.number="categoryEliminationScoringOverrides[category.id].config.mustWinBy"
                            label="Win By"
                            type="number"
                            min="1"
                            variant="outlined"
                            density="compact"
                            @update:model-value="categoryEliminationScoringOverrides[category.id].preset = 'custom'"
                          />
                        </v-col>
                        <v-col
                          cols="12"
                          md="6"
                        >
                          <v-text-field
                            :model-value="categoryEliminationScoringOverrides[category.id].config.maxPoints ?? ''"
                            label="Max Points Cap"
                            type="number"
                            variant="outlined"
                            density="compact"
                            clearable
                            @update:model-value="updateCategoryEliminationMaxPoints(category.id, $event)"
                          />
                        </v-col>
                      </v-row>
                    </template>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!scoringDirty"
              :loading="sectionSaving.scoring"
              @click="saveScoringSection"
            >
              Save Scoring
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Leaderboard Ranking Settings -->
        <v-card class="mb-4">
          <v-card-title>
            <v-icon start>
              mdi-trophy-outline
            </v-icon>
            Leaderboard Ranking Settings
          </v-card-title>
          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              Tournament defaults apply to all categories unless a category override is enabled.
            </v-alert>

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="settings.rankingPresetDefault"
                  :items="rankingPresetOptions"
                  item-title="title"
                  item-value="value"
                  label="Default Ranking Preset"
                  variant="outlined"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="settings.progressionModeDefault"
                  :items="progressionModeOptions"
                  item-title="title"
                  item-value="value"
                  label="Default Progression Mode"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <v-divider class="my-4" />

            <div class="d-flex align-center justify-space-between mb-3">
              <div class="text-subtitle-2">
                Category Ranking Overrides
              </div>
              <v-chip
                size="small"
                color="info"
                variant="tonal"
              >
                Saved as history per category
              </v-chip>
            </div>

            <v-alert
              v-if="!hasCategories"
              type="info"
              variant="tonal"
              density="compact"
            >
              No categories found for this tournament.
            </v-alert>

            <v-expansion-panels
              v-else
              variant="accordion"
            >
              <v-expansion-panel
                v-for="category in categories"
                :key="`ranking-${category.id}`"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center w-100">
                    <span>{{ category.name }}</span>
                    <v-chip
                      class="ml-3"
                      size="x-small"
                      :color="categoryRankingOverrides[category.id]?.enabled ? 'info' : 'grey'"
                      variant="tonal"
                    >
                      {{ categoryRankingOverrides[category.id]?.enabled ? 'Override enabled' : 'Tournament default' }}
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text v-if="categoryRankingOverrides[category.id]">
                  <v-switch
                    v-model="categoryRankingOverrides[category.id].enabled"
                    label="Use category-specific ranking"
                    color="primary"
                  />

                  <template v-if="categoryRankingOverrides[category.id].enabled">
                    <v-row>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-select
                          v-model="categoryRankingOverrides[category.id].rankingPreset"
                          :items="rankingPresetOptions"
                          item-title="title"
                          item-value="value"
                          label="Category Ranking Preset"
                          variant="outlined"
                          density="compact"
                        />
                      </v-col>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-select
                          v-model="categoryRankingOverrides[category.id].progressionMode"
                          :items="progressionModeOptions"
                          item-title="title"
                          item-value="value"
                          label="Category Progression Mode"
                          variant="outlined"
                          density="compact"
                        />
                      </v-col>
                    </v-row>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!rankingDirty"
              :loading="sectionSaving.ranking"
              @click="saveRankingSection"
            >
              Save Leaderboard Ranking
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Registration Settings -->
        <v-card class="mb-4">
          <v-card-title>Registration Settings</v-card-title>
          <v-card-text>
            <v-switch
              v-model="settings.allowSelfRegistration"
              label="Allow Self-Registration"
              hint="Players can register themselves for the tournament"
              persistent-hint
              color="primary"
            />
            <v-switch
              v-model="settings.requireApproval"
              label="Require Admin Approval"
              hint="Registrations must be approved before being confirmed"
              persistent-hint
              color="primary"
              :disabled="!settings.allowSelfRegistration"
            />
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!registrationDirty"
              :loading="sectionSaving.registration"
              @click="saveRegistrationSection"
            >
              Save Registration
            </v-btn>
          </v-card-actions>
        </v-card>
        <TournamentBrandingCard
          :tournament-id="tournamentId"
          :sponsors="brandingSponsors"
          :tournament-logo="brandingTournamentLogo"
          @update-branding="handleBrandingUpdate"
        />
        <div class="d-flex justify-end mb-4">
          <v-btn
            color="primary"
            :disabled="!brandingDirty"
            :loading="sectionSaving.branding"
            @click="saveBrandingSection"
          >
            Save Branding
          </v-btn>
        </div>

        <v-card class="mb-4">
          <v-card-title>
            <v-icon start>
              mdi-lock-outline
            </v-icon>
            Volunteer Access
          </v-card-title>
          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              Create restricted PIN access for front-desk check-in and scorekeeper stations. These links open volunteer mode without the full staff navigation.
            </v-alert>

            <v-row>
              <v-col
                v-for="role in volunteerRoles"
                :key="role"
                cols="12"
                md="6"
              >
                <v-card
                  variant="outlined"
                  class="h-100"
                >
                  <v-card-title class="text-subtitle-1">
                    {{ volunteerRoleLabels[role] }}
                  </v-card-title>
                  <v-card-text>
                    <v-switch
                      v-model="volunteerAccessForms[role].enabled"
                      :label="`Enable ${volunteerRoleLabels[role]} access`"
                      color="primary"
                    />

                    <v-text-field
                      :model-value="getVolunteerDisplayPin(role)"
                      label="Current PIN"
                      readonly
                      variant="outlined"
                      density="compact"
                      :append-inner-icon="hasVolunteerPinConfigured(role) ? 'mdi-eye' : undefined"
                      @click:append-inner="revealVolunteerPin(role)"
                    />

                    <div class="text-caption text-medium-emphasis mb-3">
                      Revision {{ volunteerAccessForms[role].pinRevision || 0 }}
                    </div>

                    <v-text-field
                      v-model="volunteerAccessForms[role].pin"
                      label="Set or Reset PIN"
                      type="password"
                      variant="outlined"
                      density="compact"
                      hint="Use a 4 to 8 digit PIN"
                      persistent-hint
                    />

                    <v-text-field
                      :model-value="getVolunteerAccessUrl(role)"
                      label="Direct Access Link"
                      readonly
                      variant="outlined"
                      density="compact"
                      class="mt-3"
                    />

                    <div class="d-flex flex-wrap gap-2 mt-3">
                      <v-btn
                        variant="tonal"
                        @click="copyVolunteerAccessValue(getVolunteerAccessUrl(role), `${volunteerRoleLabels[role]} access link copied`)"
                      >
                        Copy Link
                      </v-btn>
                      <v-btn
                        variant="tonal"
                        :disabled="!volunteerAccessForms[role].showRevealedPin"
                        @click="copyVolunteerAccessValue(getVolunteerDisplayPin(role), `${volunteerRoleLabels[role]} PIN copied`)"
                      >
                        Copy PIN
                      </v-btn>
                      <v-btn
                        variant="tonal"
                        :disabled="!hasVolunteerPinConfigured(role)"
                        :loading="volunteerAccessForms[role].revealing"
                        @click="revealVolunteerPin(role)"
                      >
                        Reveal PIN
                      </v-btn>
                      <v-btn
                        color="primary"
                        :loading="volunteerAccessForms[role].saving"
                        @click="saveVolunteerPin(role)"
                      >
                        Save PIN
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>


        <!-- Co-Organizers -->
        <v-card
          v-if="canManageOrganizers"
          class="mt-6"
          variant="outlined"
        >
          <v-card-title class="d-flex align-center pa-4 pb-2">
            <v-icon
              start
              icon="mdi-account-multiple"
            />
            Co-Organizers
          </v-card-title>
          <v-card-text>
            <!-- Current organizers list -->
            <v-list
              v-if="organizerUsers.length > 0"
              lines="one"
              class="mb-4"
            >
              <v-list-item
                v-for="user in organizerUsers"
                :key="user.id"
                :title="user.displayName"
                :subtitle="user.email"
                prepend-icon="mdi-account"
              >
                <template #append>
                  <v-btn
                    icon="mdi-close"
                    variant="text"
                    size="small"
                    color="error"
                    :disabled="organizerLoading || (tournament?.organizerIds?.length ?? 0) <= 1"
                    :title="(tournament?.organizerIds?.length ?? 0) <= 1 ? 'Cannot remove the last organizer' : 'Remove organizer'"
                    :aria-label="`Remove organizer ${user.displayName}`"
                    @click="removeOrganizerFromTournament(user.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
            <p
              v-else
              class="text-medium-emphasis text-body-2 mb-4"
            >
              No organizers assigned yet.
            </p>

            <!-- Add organizer -->
            <div class="d-flex align-center gap-2">
              <v-autocomplete
                v-model="selectedOrganizerToAdd"
                :items="addableOrganizers"
                item-title="displayName"
                item-value="id"
                label="Add organizer"
                placeholder="Search by name..."
                variant="outlined"
                density="compact"
                clearable
                hide-details
                :item-props="organizerAutocompleteItemProps"
              />
              <v-btn
                color="primary"
                variant="elevated"
                :disabled="!selectedOrganizerToAdd || organizerLoading"
                :loading="organizerLoading"
                @click="addOrganizerToTournament"
              >
                Add
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Danger Zone -->
        <v-card
          class="mt-6"
          variant="outlined"
          color="error"
        >
          <v-card-title class="d-flex align-center text-error pa-4 pb-2">
            <v-icon
              start
              icon="mdi-alert"
              color="error"
            />
            Danger Zone
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between gap-3">
              <div>
                <div class="text-subtitle-2 font-weight-medium">
                  Delete this tournament
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Permanently remove this tournament and all its data. This cannot be undone.
                </div>
              </div>
              <v-btn
                color="error"
                variant="elevated"
                prepend-icon="mdi-delete"
                data-testid="delete-tournament-btn"
                :loading="deletingTournament"
                @click="deleteTournament"
              >
                Delete Tournament
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Delete Confirmation Dialog -->
    <v-dialog
      v-model="showDeleteDialog"
      data-testid="delete-tournament-dialog"
      max-width="500"
    >
      <v-card>
        <v-card-title class="text-h5 text-error">
          <v-icon
            start
            icon="mdi-alert"
            color="error"
          />
          Delete Tournament?
        </v-card-title>
        
        <v-card-text>
          <v-alert
            type="error"
            variant="tonal"
            border="start"
            class="mb-4"
          >
            <strong>Warning:</strong> This action cannot be undone. All matches, players, and data associated with this tournament will be permanently removed.
          </v-alert>
          <p class="text-body-2 mb-2">
            Type <strong>{{ tournament.name }}</strong> to confirm:
          </p>
          <v-text-field
            v-model="typedDeleteName"
            variant="outlined"
            density="compact"
            placeholder="Tournament name"
            :error="typedDeleteName.length > 0 && !deleteConfirmEnabled"
            hide-details
            autofocus
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="deletingTournament"
            @click="showDeleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deletingTournament"
            :disabled="!deleteConfirmEnabled || deletingTournament"
            @click="confirmDelete"
          >
            Delete Permanently
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
