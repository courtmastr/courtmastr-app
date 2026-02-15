import { computed } from 'vue';
import { useRegistrationStore } from '@/stores/registrations';
import type { Registration, Player } from '@/types';

export function useParticipantResolver() {
  const registrationStore = useRegistrationStore();

  const registrations = computed(() => registrationStore.registrations);
  const players = computed(() => registrationStore.players);

  function getParticipantName(registrationId: string | undefined): string {
    if (!registrationId) return 'TBD';

    const registration = registrations.value.find((r: Registration) => r.id === registrationId);
    if (!registration) return 'TBD';

    if (registration.teamName) {
      return registration.teamName;
    }

    const player = players.value.find((p: Player) => p.id === registration.playerId);
    if (player) {
      return `${player.firstName} ${player.lastName}`;
    }

    return 'Unknown';
  }

  function getParticipantDisplay(registrationId: string | undefined): {
    name: string;
    isTeam: boolean;
    playerId: string | undefined;
  } {
    if (!registrationId) {
      return { name: 'TBD', isTeam: false, playerId: undefined };
    }

    const registration = registrations.value.find((r: Registration) => r.id === registrationId);
    if (!registration) {
      return { name: 'TBD', isTeam: false, playerId: undefined };
    }

    if (registration.teamName) {
      return {
        name: registration.teamName,
        isTeam: true,
        playerId: registration.playerId,
      };
    }

    const player = players.value.find((p: Player) => p.id === registration.playerId);
    return {
      name: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
      isTeam: false,
      playerId: registration.playerId,
    };
  }

  return {
    getParticipantName,
    getParticipantDisplay,
  };
}
