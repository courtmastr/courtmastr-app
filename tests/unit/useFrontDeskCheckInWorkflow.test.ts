import { describe, expect, it } from 'vitest';
import {
  assignSmallestAvailableBib,
  createUndoState,
  computeFrontDeskStats,
  makeBatchRunner,
  parseScanInput
} from '@/features/checkin/composables/useFrontDeskCheckInWorkflow';

describe('parseScanInput', () => {
  it('parses explicit registration token payload', () => {
    expect(parseScanInput('reg:abc123')).toEqual({ kind: 'registration', value: 'abc123' });
  });

  it('parses bib payload', () => {
    expect(parseScanInput('102')).toEqual({ kind: 'bib', value: 102 });
  });

  it('rejects empty input', () => {
    expect(parseScanInput('   ')).toBeNull();
  });
});

describe('assignSmallestAvailableBib', () => {
  it('assigns the smallest available bib from start', () => {
    expect(assignSmallestAvailableBib([101, 103, 104], 101)).toBe(102);
  });

  it('returns start when no bibs are used', () => {
    expect(assignSmallestAvailableBib([], 200)).toBe(200);
  });
});

describe('computeFrontDeskStats', () => {
  it('uses approved_total semantics for rate', () => {
    expect(computeFrontDeskStats({ approved: 5, checkedIn: 10, noShow: 2 })).toEqual({
      approvedTotal: 17,
      checkedIn: 10,
      noShow: 2,
      ratePercent: 59,
    });
  });

  it('handles zero denominator', () => {
    expect(computeFrontDeskStats({ approved: 0, checkedIn: 0, noShow: 0 })).toEqual({
      approvedTotal: 0,
      checkedIn: 0,
      noShow: 0,
      ratePercent: 0,
    });
  });
});

describe('makeBatchRunner', () => {
  it('returns partial success summary when one mutation fails', async () => {
    const runBatch = makeBatchRunner(async (id: string) => {
      if (id === 'r2') {
        throw new Error('network');
      }
    });

    await expect(runBatch(['r1', 'r2', 'r3'])).resolves.toEqual({
      successIds: ['r1', 'r3'],
      failed: [{ id: 'r2', reason: 'network' }],
    });
  });
});

describe('createUndoState', () => {
  it('creates item and bulk undo tokens with expected windows', () => {
    const undo = createUndoState();
    const itemToken = undo.startItemUndo('r1', 5000);
    const bulkToken = undo.startBulkUndo(['r1', 'r2'], 10000);

    expect(itemToken.registrationId).toBe('r1');
    expect(itemToken.expiresInMs).toBe(5000);
    expect(bulkToken.registrationIds).toEqual(['r1', 'r2']);
    expect(bulkToken.expiresInMs).toBe(10000);
  });
});
