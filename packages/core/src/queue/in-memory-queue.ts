import type { AppLogger } from '../logging/logger.js';
import {
  computeRetryDelay,
  type Queue,
  type QueueJob,
  type QueueJobResult,
  type QueueWorkerOptions,
} from './queue.js';

interface PendingJob {
  job: QueueJob;
  attemptsLeft: number;
  runAt: number;
  next: PendingJob | null;
}

/**
 * Development-only in-memory implementation of the Queue contract.
 * Used only when QUEUE_DRIVER=memory (never in production). Provides
 * best-effort single-process serial processing with retries and backoff.
 */
export class InMemoryQueue implements Queue {
  readonly driver = 'memory' as const;
  private head: PendingJob | null = null;
  private tail: PendingJob | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly logger: AppLogger,
    private readonly defaultBackoffMs = 1000,
  ) {}

  async add(job: QueueJob): Promise<void> {
    const attempts = job.opts?.attempts ?? 1;
    const entry: PendingJob = {
      job,
      attemptsLeft: attempts,
      runAt: Date.now() + (job.opts?.delayMs ?? 0),
      next: null,
    };
    if (job.opts?.jobId) {
      this.dedupe(job.opts.jobId);
    }
    if (!this.head) {
      this.head = entry;
      this.tail = entry;
    } else {
      this.tail!.next = entry;
      this.tail = entry;
    }
    this.logger.debug({ job: job.name, attempts }, 'in-memory queue: job queued');
    void this.pump();
  }

  private dedupe(jobId: string): void {
    let prev: PendingJob | null = null;
    let cur: PendingJob | null = this.head;
    while (cur) {
      if (cur.job.opts?.jobId === jobId) {
        if (prev) prev.next = cur.next;
        else this.head = cur.next;
        if (this.tail === cur) this.tail = prev;
      }
      prev = cur;
      cur = cur.next;
    }
  }

  private dequeue(): PendingJob | null {
    if (!this.head) return null;
    if (this.head.runAt > Date.now()) return null;
    const entry = this.head;
    this.head = entry.next;
    if (!this.head) this.tail = null;
    return entry;
  }

  private shift(): void {
    if (this.head && this.head.runAt > Date.now()) {
      const delay = this.head.runAt - Date.now();
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.pump(), Math.min(delay, 2_147_000_000));
    }
  }

  private async pump(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const entry = this.dequeue();
      if (entry) {
        const handler = this.handler;
        if (handler) {
          const result = await this.dispatch(handler, entry);
          if (!result.success && entry.attemptsLeft > 1) {
            entry.attemptsLeft -= 1;
            entry.runAt = Date.now() + computeRetryDelay(entry.attemptsLeft, this.defaultBackoffMs);
            this.reinsert(entry);
          }
        }
      }
    } finally {
      this.running = false;
      if (this.head) {
        this.shift();
        if (this.head.runAt <= Date.now()) queueMicrotask(() => void this.pump());
      }
    }
  }

  private reinsert(entry: PendingJob): void {
    if (!this.head) {
      this.head = entry;
      this.tail = entry;
      return;
    }
    this.tail!.next = entry;
    this.tail = entry;
  }

  private async dispatch(
    handler: (job: QueueJob) => Promise<void>,
    entry: PendingJob,
  ): Promise<QueueJobResult> {
    const start = Date.now();
    try {
      await handler(entry.job);
      this.logger.info({ job: entry.job.name }, 'in-memory queue: job completed');
      return { success: true, tookMs: Date.now() - start };
    } catch (err) {
      this.logger.error({ err, job: entry.job.name }, 'in-memory queue: job failed');
      return { success: false, error: err, tookMs: Date.now() - start };
    }
  }

  private handler: ((job: QueueJob) => Promise<void>) | null = null;

  async process(
    handler: (job: QueueJob) => Promise<void>,
    _opts?: QueueWorkerOptions,
  ): Promise<() => Promise<void>> {
    this.handler = handler;
    void this.pump();
    return async () => {
      this.stopped = true;
      if (this.timer) clearTimeout(this.timer);
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}