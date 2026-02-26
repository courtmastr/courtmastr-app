import type { Registration, RegistrationStatus } from '@/types';

type PresenceRegistration = Pick<Registration, 'playerId' | 'partnerPlayerId' | 'status'>;

export const normalizeSelfCheckInQuery = (value: string): string => value.trim().toLowerCase();

export const getRequiredParticipantIds = (
  registration: Pick<Registration, 'playerId' | 'partnerPlayerId'>
): string[] => {
  const ids = [registration.playerId, registration.partnerPlayerId].filter(
    (id): id is string => Boolean(id)
  );

  return Array.from(new Set(ids));
};

export const deriveRegistrationStatusFromPresence = (
  registration: PresenceRegistration,
  participantPresence: Record<string, boolean>
): RegistrationStatus => {
  if (registration.status !== 'approved' && registration.status !== 'checked_in') {
    return registration.status;
  }

  const requiredParticipantIds = getRequiredParticipantIds(registration);
  if (requiredParticipantIds.length === 0) return registration.status;

  const allParticipantsPresent = requiredParticipantIds.every((id) => participantPresence[id] === true);
  return allParticipantsPresent ? 'checked_in' : 'approved';
};
