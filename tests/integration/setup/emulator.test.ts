import { describe, it, expect } from 'vitest';
import { getEmulatorApp } from './emulator';

describe('emulator harness', () => {
  it('returns initialized app/services', () => {
    const ctx = getEmulatorApp();
    expect(ctx.db).toBeDefined();
    expect(ctx.auth).toBeDefined();
  });
});
