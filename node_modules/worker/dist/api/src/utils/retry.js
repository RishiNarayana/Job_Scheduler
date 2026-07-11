"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRetryDelay = calculateRetryDelay;
function calculateRetryDelay(policy, attemptNumber) {
    let delayMs = policy.baseDelayMs;
    if (policy.type === 'linear') {
        delayMs = policy.baseDelayMs * attemptNumber;
    }
    else if (policy.type === 'exponential') {
        delayMs = policy.baseDelayMs * Math.pow(2, attemptNumber - 1);
    }
    if (policy.maxDelayMs && delayMs > policy.maxDelayMs) {
        return policy.maxDelayMs;
    }
    return delayMs;
}
