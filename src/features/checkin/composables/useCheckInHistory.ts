import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { formatCheckInDateKey } from '@/features/checkin/utils/checkInDateKey';

export interface CheckInHistoryRow {
  registrationId: string;
  playerId: string;         // individual player who physically checked in
  displayName: string;      // player's full name
  categoryName: string;
  checkedInAt: Date | null; // null = partial (partner not yet arrived)
  source: 'admin' | 'kiosk' | 'partial';
  isPartial: boolean;       // true when doubles partner hasn't checked in yet
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

function toDate(ts: Date | { toDate(): Date } | undefined): Date | null {
  if (ts == null) return null;
  return ts instanceof Date ? ts : ts.toDate();
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

        const category = categoryList.find(c => c.id === reg.categoryId);
        const categoryName = category?.name ?? 'Unknown Category';
        // Firestore Timestamps survive the shallow convertTimestamps — normalise here
        const checkedInAt = toDate(daily.checkedInAt as Date | { toDate(): Date } | undefined);
        const isDoubles = !!reg.partnerPlayerId;

        if (!isDoubles) {
          // Singles: one row for the player
          const player = playerList.find(p => p.id === reg.playerId);
          result.push({
            registrationId: reg.id,
            playerId: reg.playerId ?? '',
            displayName: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
            categoryName,
            checkedInAt,
            source: daily.source,
            isPartial: false,
          });
        } else {
          // Doubles: one row per player who is physically present
          const presence = daily.presence ?? {};
          const participantIds = [reg.playerId, reg.partnerPlayerId].filter(
            (id): id is string => Boolean(id),
          );
          for (const pid of participantIds) {
            if (!presence[pid]) continue; // skip partner who hasn't arrived yet
            const player = playerList.find(p => p.id === pid);
            // isPartial = this player is here but the registration isn't fully done yet
            const isPartial = checkedInAt === null;
            result.push({
              registrationId: reg.id,
              playerId: pid,
              displayName: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
              categoryName,
              checkedInAt,
              source: isPartial ? 'partial' : daily.source,
              isPartial,
            });
          }
        }
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
