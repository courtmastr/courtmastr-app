import { describe, expect, it } from 'vitest';
import {
  BRANDING_MAX_FILE_SIZE_BYTES,
  buildSponsorLogoPath,
  buildTournamentLogoPath,
  validateBrandingFile,
} from '@/services/tournamentBrandingStorage';

describe('tournamentBrandingStorage helpers', () => {
  it('builds deterministic storage paths', () => {
    expect(buildTournamentLogoPath('t1', 'logo.png')).toBe(
      'tournaments/t1/branding/logo/logo.png'
    );
    expect(buildSponsorLogoPath('t1', 's1', 'sponsor.png')).toBe(
      'tournaments/t1/branding/sponsors/s1/sponsor.png'
    );
  });

  it('rejects oversize files', () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: BRANDING_MAX_FILE_SIZE_BYTES + 1 });

    expect(validateBrandingFile(file)).toMatch(/2 MB/i);
  });
});
