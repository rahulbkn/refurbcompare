import type { AppConfig, AppLogger, Queue, QueueJob, QueueJobName, QueueJobResult, QueueWorkerOptions } from '@refurbcompare/core';
import { InMemoryQueue } from '@refurbcompare/core';
import { Queue as BullQueue, Worker, type Job } from 'bullmq';

/** Production queue adapter backed by BullMQ/Redis. */
export class BullMqQueue implements Queue {
  readonly driver = 'bullmq' as const;
  private readonly pub: BullQueue;
  private worker: Worker | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: AppLogger,
    private readonly queueName = 'refurbcompare',
  ) {
    this.pub = new BullQueue(this.queueName, { connection: { url: redisUrl } });
  }

  async add(job: QueueJob): Promise<void> {
    await this.pub.add(job.name, job.data, {
      jobId: job.opts?.jobId,
      attempts: job.opts?.attempts ?? 1,
      backoff: job.opts?.backoffMs ? { type: 'exponential', delay: job.opts.backoffMs } : undefined,
      delay: job.opts?.delayMs ?? 0,
      removeOnComplete: { age: 60 * 60 * 24 * 7 },
    });
    this.logger.debug({ job: job.name, jobId: job.opts?.jobId }, 'bullmq: job enqueued');
  }

  async process(handler: (job: QueueJob) => Promise<void>, opts?: QueueWorkerOptions): Promise<() => Promise<void>> {
    const worker = new Worker(
      this.queueName,
      async (raw: Job) => {
        const job: QueueJob = {
          name: raw.name as QueueJobName,
          data: (raw.data ?? {}) as Record<string, unknown>,
          opts: { attempts: raw.opts?.attempts, backoffMs: 1000 },
        };
        await handler(job);
      },
      { concurrency: opts?.concurrency ?? 2, connection: { url: this.redisUrl } },
    );
    this.worker = worker;
    await worker.waitUntilReady();
    const stop = async () => {
      this.logger.info('bullmq: worker stopping');
      await worker.close();
    };
    return stop;
  }

  async ping(): Promise<boolean> {
    try {
      const client = (await this.pub.client) as unknown as { ping(): Promise<unknown> };
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.logger.info('bullmq: closing');
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.pub.close();
  }
}

export function createIngestionQueue(config: AppConfig, logger: AppLogger): Queue {
  if (config.queueDriver === 'bullmq') {
    logger.info({ redisUrl: config.redisUrl }, 'QUEUE: PRODUCTION mode (BullMQ over Redis)');
    return new BullMqQueue(config.redisUrl, logger);
  }
  logger.info('QUEUE: DEV FALLBACK mode (in-memory queue, single-process)');
  return new InMemoryQueue(logger);
}

export type { Queue, QueueJob, QueueJobName, QueueJobResult, QueueWorkerOptions };