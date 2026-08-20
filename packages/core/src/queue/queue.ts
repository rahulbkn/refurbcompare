export type QueueJobName =
  | 'provider-sync'
  | 'provider-health-check'
  | 'price-history'
  | 'stale-listing-cleanup'
  | 'search-index-update'
  | 'price-alert-check';

export interface QueueJob {
  name: QueueJobName;
  data: Record<string, unknown>;
  opts?: {
    delayMs?: number;
    attempts?: number;
    backoffMs?: number;
    jobId?: string;
  };
}

export interface QueueWorkerOptions {
  concurrency?: number;
}

export interface QueueJobResult {
  success: boolean;
  error?: unknown;
  tookMs: number;
}

export interface Queue {
  readonly driver: 'bullmq' | 'memory';
  add(job: QueueJob): Promise<void>;
  /** Process jobs forever; returns a function that stops processing. */
  process(handler: (job: QueueJob) => Promise<void>, opts?: QueueWorkerOptions): Promise<() => Promise<void>>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/** Exponential-ish backoff helper for the in-memory queue. */
export function computeRetryDelay(attempt: number, baseMs: number): number {
  return Math.min(60_000, baseMs * 2 ** Math.min(attempt, 8));
}