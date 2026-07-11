import { z } from 'zod';

const processImagesSchema = z.object({
  task: z.literal('process_images'),
  images: z.array(z.string(), {
    required_error: 'images array is required',
    invalid_type_error: 'images must be an array of strings'
  }).min(1, 'images array must not be empty')
});

const sendEmailSchema = z.object({
  task: z.literal('send_email'),
  to: z.string({
    required_error: 'to is required'
  }).email('to must be a valid email address')
});

const processTransactionSchema = z.object({
  task: z.literal('process_transaction'),
  amount: z.number({
    required_error: 'amount is required',
    invalid_type_error: 'amount must be a number'
  }).nonnegative('amount must be non-negative')
});

const generateReportSchema = z.object({
  task: z.literal('generate_report'),
  format: z.string().optional()
});

const defaultTaskSchema = z.object({
  task: z.literal('default').optional()
}).catchall(z.any());

export function validatePayload(payload: any): { success: true; data: any } | { success: false; error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: 'Payload must be a valid JSON object' };
  }

  const task = payload.task;

  if (task === undefined || task === null || task === 'default') {
    const res = defaultTaskSchema.safeParse(payload);
    if (!res.success) {
      return { success: false, error: res.error.errors[0].message };
    }
    return { success: true, data: res.data };
  }

  if (task === 'process_images') {
    const res = processImagesSchema.safeParse(payload);
    if (!res.success) {
      // Return a descriptive error message
      const err = res.error.errors[0];
      const message = err.path.join('.') + ': ' + err.message;
      return { success: false, error: message };
    }
    return { success: true, data: res.data };
  }

  if (task === 'send_email') {
    const res = sendEmailSchema.safeParse(payload);
    if (!res.success) {
      const err = res.error.errors[0];
      const message = err.path.join('.') + ': ' + err.message;
      return { success: false, error: message };
    }
    return { success: true, data: res.data };
  }

  if (task === 'process_transaction') {
    const res = processTransactionSchema.safeParse(payload);
    if (!res.success) {
      const err = res.error.errors[0];
      const message = err.path.join('.') + ': ' + err.message;
      return { success: false, error: message };
    }
    return { success: true, data: res.data };
  }

  if (task === 'generate_report') {
    const res = generateReportSchema.safeParse(payload);
    if (!res.success) {
      const err = res.error.errors[0];
      const message = err.path.join('.') + ': ' + err.message;
      return { success: false, error: message };
    }
    return { success: true, data: res.data };
  }

  return { success: false, error: `Unknown task type: "${task}"` };
}
