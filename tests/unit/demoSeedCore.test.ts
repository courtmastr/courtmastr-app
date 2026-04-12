import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDemoScoreGames,
  resolveDemoPaymentStatus,
  resolveDemoProdEnv,
} from '../../scripts/seed/demo-core';

const ENV_KEYS = [
  'COURTMASTR_SEED_OPERATOR_EMAIL',
  'COURTMASTR_SEED_OPERATOR_PASSWORD',
  'COURTMASTR_DEMO_ORGANIZER_PASSWORD',
  'COURTMASTR_DEMO_CHECKIN_PIN',
  'COURTMASTR_DEMO_SCOREKEEPER_PIN',
] as const;

type EnvKey = typeof ENV_KEYS[number];

describe('demo seed core', () => {
  const originalEnv = new Map<EnvKey, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const originalValue = originalEnv.get(key);
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
    originalEnv.clear();
  });

  it('uses deterministic payment statuses for demo registrations', () => {
    expect(resolveDemoPaymentStatus(null)).toBe('paid');
    expect(resolveDemoPaymentStatus(1)).toBe('paid');
    expect(resolveDemoPaymentStatus(5)).toBe('unpaid');
    expect(resolveDemoPaymentStatus(7)).toBe('partial');
    expect(resolveDemoPaymentStatus(35)).toBe('partial');
  });

  it('builds complete two-game demo scores with the requested winner', () => {
    expect(buildDemoScoreGames('reg-a', 'reg-b', true)).toEqual([
      {
        gameNumber: 1,
        score1: 21,
        score2: 17,
        winnerId: 'reg-a',
        isComplete: true,
      },
      {
        gameNumber: 2,
        score1: 21,
        score2: 19,
        winnerId: 'reg-a',
        isComplete: true,
      },
    ]);

    expect(buildDemoScoreGames('reg-a', 'reg-b', false)[0]).toMatchObject({
      score1: 17,
      score2: 21,
      winnerId: 'reg-b',
    });
  });

  it('requires production seed credentials from the environment', () => {
    expect(() => resolveDemoProdEnv()).toThrow('COURTMASTR_SEED_OPERATOR_EMAIL is required');

    process.env.COURTMASTR_SEED_OPERATOR_EMAIL = 'operator@example.com';
    process.env.COURTMASTR_SEED_OPERATOR_PASSWORD = 'operator-password';
    process.env.COURTMASTR_DEMO_ORGANIZER_PASSWORD = 'demo-password';
    process.env.COURTMASTR_DEMO_CHECKIN_PIN = '1111';

    expect(resolveDemoProdEnv()).toEqual({
      operatorEmail: 'operator@example.com',
      operatorPassword: 'operator-password',
      demoOrganizerPassword: 'demo-password',
      checkinPin: '1111',
      scorekeeperPin: undefined,
    });
  });
});
