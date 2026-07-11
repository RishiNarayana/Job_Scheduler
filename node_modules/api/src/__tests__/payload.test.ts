import { describe, expect, it } from 'vitest';
import { validatePayload } from '../utils/payloadValidator.js';

describe('validatePayload', () => {
  it('allows valid default tasks', () => {
    const res = validatePayload({ task: 'default', extra: 123 });
    expect(res.success).toBe(true);
  });

  it('allows empty task (defaults to default task)', () => {
    const res = validatePayload({ extra: 123 });
    expect(res.success).toBe(true);
  });

  it('requires images for process_images task', () => {
    const res1 = validatePayload({ task: 'process_images' });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('images');

    const res2 = validatePayload({ task: 'process_images', images: [] });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('empty');

    const res3 = validatePayload({ task: 'process_images', images: ['img.png'] });
    expect(res3.success).toBe(true);
  });

  it('requires a valid email for send_email task', () => {
    const res1 = validatePayload({ task: 'send_email' });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('to');

    const res2 = validatePayload({ task: 'send_email', to: 'not-an-email' });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('email');

    const res3 = validatePayload({ task: 'send_email', to: 'user@example.com' });
    expect(res3.success).toBe(true);
  });

  it('requires a positive amount for process_transaction task', () => {
    const res1 = validatePayload({ task: 'process_transaction' });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('amount');

    const res2 = validatePayload({ task: 'process_transaction', amount: -10 });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('non-negative');

    const res3 = validatePayload({ task: 'process_transaction', amount: 10.5 });
    expect(res3.success).toBe(true);
  });

  it('allows valid generate_report task', () => {
    const res1 = validatePayload({ task: 'generate_report' });
    expect(res1.success).toBe(true);

    const res2 = validatePayload({ task: 'generate_report', format: 'pdf' });
    expect(res2.success).toBe(true);
  });

  it('rejects unknown task types with a clear error', () => {
    const res = validatePayload({ task: 'unknown_task_123' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unknown task type: "unknown_task_123"');
  });

  it('rejects invalid payload types', () => {
    const res1 = validatePayload(null);
    expect(res1.success).toBe(false);

    const res2 = validatePayload([]);
    expect(res2.success).toBe(false);
  });
});
