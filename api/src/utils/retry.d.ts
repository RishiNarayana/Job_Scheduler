export interface RetryPolicyConfig {
    type: 'fixed' | 'linear' | 'exponential';
    baseDelayMs: number;
    maxDelayMs: number;
    maxAttempts: number;
}
export declare function calculateRetryDelay(policy: RetryPolicyConfig, attemptNumber: number): number;
