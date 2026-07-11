"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const retry_js_1 = require("../utils/retry.js");
(0, vitest_1.describe)('calculateRetryDelay', () => {
    (0, vitest_1.it)('returns the fixed delay for fixed policies', () => {
        (0, vitest_1.expect)((0, retry_js_1.calculateRetryDelay)({ type: 'fixed', baseDelayMs: 1000, maxDelayMs: 5000, maxAttempts: 3 }, 1)).toBe(1000);
    });
    (0, vitest_1.it)('grows linearly for linear policies', () => {
        (0, vitest_1.expect)((0, retry_js_1.calculateRetryDelay)({ type: 'linear', baseDelayMs: 1000, maxDelayMs: 5000, maxAttempts: 3 }, 2)).toBe(2000);
    });
    (0, vitest_1.it)('caps exponential backoff', () => {
        (0, vitest_1.expect)((0, retry_js_1.calculateRetryDelay)({ type: 'exponential', baseDelayMs: 1000, maxDelayMs: 2500, maxAttempts: 5 }, 4)).toBe(2500);
    });
});
