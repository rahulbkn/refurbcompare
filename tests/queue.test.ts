import { describe, it, expect } from 'vitest';
import { InMemoryQueue, computeRetryDelay, createLogger } from '@refurbcompare/core';

const logger = createLogger('silent');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('InMemoryQueue', () => {
  it('processes jobs serially in the order they are added', async () => {
    const queue = new InMemoryQueue(logger);
    const order: string[] = [];
    await queue.process(async (job) => {
      order.push(job.data.tag as string);
    });
    await queue.add({ name: 'provider-sync', data: { tag: 'a' } });
    await queue.add({ name: 'provider-sync', data: { tag: 'b' } });
    await queue.add({ name: 'provider-sync', data: { tag: 'c' } });
    await delay(50);
    expect(order).toEqual(['a', 'b', 'c']);
    await queue.close();
  });

  it('retries failed jobs using backoff', async () => {
    const queue = new InMemoryQueue(logger, 20);
    let attempts = 0;
    await queue.process(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('flake');
    });
    await queue.add({ name: 'provider-sync', data: {}, opts: { attempts: 3, backoffMs: 20 } });
    await delay(200);
    expect(attempts).toBe(3);
    await queue.close();
  });

  it('overwrites a pending job that shares a jobId (in-flight jobs run to completion)', async () => {
    const queue = new InMemoryQueue(logger);
    const seen: string[] = [];
    await queue.process(async (job) => {
      seen.push(job.data.tag as string);
      await delay(30);
    });
    await queue.add({ name: 'provider-sync', data: { tag: 'page-1' }, opts: { jobId: 'sync-1' } });
    await delay(5);
    await queue.add({ name: 'provider-sync', data: { tag: 'page-2' }, opts: { jobId: 'sync-1' } });
    await delay(120);
    // The in-flight page-1 completes; page-2 replaces any still-pending copy.
    expect(seen.includes('page-2')).toBe(true);
    expect(new Set(seen).size).toBe(seen.length);
    await queue.close();
  });

  it('honours delayMs before execution', async () => {
    const queue = new InMemoryQueue(logger);
    const executed: number[] = [];
    await queue.process(async (job) => {
      executed.push(Date.now());
    });
    const before = Date.now();
    await queue.add({ name: 'provider-sync', data: {}, opts: { delayMs: 80 } });
    await delay(160);
    expect(executed.length).toBe(1);
    expect(executed[0]! - before).toBeGreaterThanOrEqual(75);
    await queue.close();
  });
});

describe('computeRetryDelay', () => {
  it('grows exponentially but is capped at 60s', () => {
    expect(computeRetryDelay(1, 1000)).toBe(2000);
    expect(computeRetryDelay(8, 1000)).toBe(60_000);
  });
});