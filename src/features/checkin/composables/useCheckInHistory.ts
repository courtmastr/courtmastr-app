import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { formatCheckInDateKey } from '@/features/checkin/utils/checkInDateKey';

export interface CheckInHistoryRow {
  registrationId: string;
  displayName: string;
  categoryName: string;
  checkedInAt: Date | null;
  source: 'admin' | 'kiosk' | 'partial';
  isPartial: boolean;
}

export interface UseCheckInHistoryReturn {
  rows: Ref<CheckInHistoryRow[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  selectedDate: Ref<Date>;
  dateKey: ComputedRef<string>;
  canGoForward: ComputedRef<boolean>;
  goBack(): void;
  goForward(): void;
  refresh(): Promise<void>;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return formatCheckInDateKey(a) === formatCheckInDateKey(b);
}

export function useCheckInHistory(): UseCheckInHistoryReturn {
  const registrationStore = useRegistrationStore();
  const tournamentStore = useTournamentStore();

  const rows = ref<CheckInHistoryRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedDate = ref<Date>(new Date());

  const dateKey = computed(() => formatCheckInDateKey(selectedDate.value));

  const canGoForward = computed(() => !isSameCalendarDay(selectedDate.value, new Date()));

  function goBack(): void {
    const d = new Date(selectedDate.value);
    d.setDate(d.getDate() - 1);
    selectedDate.value = d;
  }

  function goForward(): void {
    if (!canGoForward.value) return;
    const d = new Date(selectedDate.value);
    d.setDate(d.getDate() + 1);
    selectedDate.value = d;
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const key = dateKey.value;
      const regs = registrationStore.registrations;
      const playerList = registrationStore.players;
      const categoryList = tournamentStore.categories;

      const result: CheckInHistoryRow[] = [];

      for (const reg of regs) {
        const daily = reg.dailyCheckIns?.[key];
        if (!daily) continue;

        const isDoubles = !!reg.partnerPlayerId;

        let displayName: string;
        if (reg.teamName) {
          displayName = reg.teamName;
        } else if (isDoubles) {
          if (daily.checkedInAt) {
            const p1 = playerList.find(p => p.id === reg.playerId);
            const p2 = playerList.find(p => p.id === reg.partnerPlayerId);
            const n1 = p1 ? `${p1.firstName} ${p1.lastName}` : 'Unknown';
            const n2 = p2 ? `${p2.firstName} ${p2.lastName}` : 'Unknown';
            displayName = `${n1} / ${n2}`;
          } else {
            // partial — show only the player(s) who are present
            const presence = daily.presence ?? {};
            const presentIds = Object.entries(presence)
              .filter(([, present]) => present)
              .map(([id]) => id);
            const names = presentIds
              .map(id => playerList.find(p => p.id === id))
              .filter((p): p is NonNullable<typeof p> => p != null)
              .map(p => `${p.firstName} ${p.lastName}`);
            displayName = names.length > 0 ? names.join(' / ') : 'Unknown';
          }
        } else {
          const player = playerList.find(p => p.id === reg.playerId);
          displayName = player ? `${player.firstName} ${player.lastName}` : 'Unknown';
        }

        const category = categoryList.find(c => c.id === reg.categoryId);
        const categoryName = category?.name ?? 'Unknown Category';

        const isPartial = isDoubles && !daily.checkedInAt;

        // Firestore Timestamps are not converted by the shallow convertTimestamps utility —
        // call toDate() if needed so checkedInAt is always a real Date or null.
        const rawTs = daily.checkedInAt as Date | { toDate(): Date } | undefined;
        const checkedInAt: Date | null =
          rawTs == null
            ? null
            : rawTs instanceof Date
              ? rawTs
              : rawTs.toDate();

        result.push({
          registrationId: reg.id,
          displayName,
          categoryName,
          checkedInAt,
          source: isPartial ? 'partial' : daily.source,
          isPartial,
        });
      }

      // Fully checked-in rows sorted by checkedInAt descending; partial rows at bottom
      const fullRows = result
        .filter(r => !r.isPartial)
        .sort((a, b) => (b.checkedInAt?.getTime() ?? 0) - (a.checkedInAt?.getTime() ?? 0));
      const partialRows = result.filter(r => r.isPartial);

      rows.value = [...fullRows, ...partialRows];
    } catch {
      error.value = 'Failed to load check-in history';
    } finally {
      loading.value = false;
    }
  }

  return {
    rows,
    loading,
    error,
    selectedDate,
    dateKey,
    canGoForward,
    goBack,
    goForward,
    refresh,
  };
}
