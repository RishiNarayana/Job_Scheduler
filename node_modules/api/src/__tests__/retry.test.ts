import { describe, expect, it } from 'vitest';
import { calculateRetryDelay } from '../utils/retry.js';

describe('calculateRetryDelay', () => {
  it('returns the fixed delay for fixed policies', () => {
    expect(calculateRetryDelay({ type: 'fixed', baseDelayMs: 1000, maxDelayMs: 5000, maxAttempts: 3 }, 1)).toBe(1000);
  });

  it('grows linearly for linear policies', () => {
    expect(calculateRetryDelay({ type: 'linear', baseDelayMs: 1000, maxDelayMs: 5000, maxAttempts: 3 }, 2)).toBe(2000);
  });

  it('caps exponential backoff', () => {
    expect(calculateRetryDelay({ type: 'exponential', baseDelayMs: 1000, maxDelayMs: 2500, maxAttempts: 5 }, 4)).toBe(2500);
  });
});
