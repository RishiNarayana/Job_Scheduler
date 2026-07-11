export interface RetryPolicyConfig {
  type: 'fixed' | 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export function calculateRetryDelay(policy: RetryPolicyConfig, attemptNumber: number): number {
  let delayMs = policy.baseDelayMs;

  if (policy.type === 'linear') {
    delayMs = policy.baseDelayMs * attemptNumber;
  } else if (policy.type === 'exponential') {
    delayMs = policy.baseDelayMs * Math.pow(2, attemptNumber - 1);
  }

  if (policy.maxDelayMs && delayMs > policy.maxDelayMs) {
    return policy.maxDelayMs;
  }

  return delayMs;
}
