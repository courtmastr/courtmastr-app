import type { Registration } from '@/types';
import type { RegistrationId } from '@/types/advanced';

export type CheckInStatus = Extract<Registration['status'], 'approved' | 'checked_in' | 'no_show'>;

export interface CheckInSearchRow {
  id: RegistrationId | string;
  name: string;
  category: string;
  bibNumber?: number | null;
  partnerName?: string | null;
  status: CheckInStatus;
}

export const isCheckInSearchableStatus = (status: Registration['status']): status is CheckInStatus =>
  status === 'approved' || status === 'checked_in' || status === 'no_show';

export const toCheckInStatus = (status: Registration['status']): CheckInStatus | null =>
  isCheckInSearchableStatus(status) ? status : null;
