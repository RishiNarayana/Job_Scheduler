import { describe, expect, it } from 'vitest';
import cronParser from 'cron-parser';

describe('Cron Expansion Logic', () => {
  it('correctly produces the next N scheduled instances without duplicates', () => {
    const cronExpression = '*/5 * * * *'; // every 5 minutes
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: new Date('2026-07-11T12:00:00.000Z')
    });

    const instances: string[] = [];
    for (let i = 0; i < 5; i++) {
      instances.push(interval.next().toDate().toISOString());
    }

    expect(instances).toHaveLength(5);
    expect(instances[0]).toBe('2026-07-11T12:05:00.000Z');
    expect(instances[1]).toBe('2026-07-11T12:10:00.000Z');
    expect(instances[2]).toBe('2026-07-11T12:15:00.000Z');
    expect(instances[3]).toBe('2026-07-11T12:20:00.000Z');
    expect(instances[4]).toBe('2026-07-11T12:25:00.000Z');

    // Ensure all instances are unique (no duplicates)
    const uniqueInstances = new Set(instances);
    expect(uniqueInstances.size).toBe(5);
  });
});
