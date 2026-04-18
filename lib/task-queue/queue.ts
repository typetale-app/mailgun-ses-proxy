import logger from "../../lib/core/logger";

/** Types & Interfaces */
export type ItemFn<T = any> = () => Promise<T>;

interface ItemWrapper {
  fn: ItemFn;
  id?: string;
}

interface StatsEntry {
  item: ItemWrapper | null;
  time: number;
}

export type QueueStats = {
  min: StatsEntry;
  max: StatsEntry;
  avg: number;
  settledCount: number;
  totalDuration: number;
  realRate: number;
  failedItems: (string | undefined)[];
  failedCount: number;
};

export type OnFinishListener = (stats: QueueStats) => void;

export interface QueueOptions {
  rateLimit?: number;
  maxConcurrent?: number;
}

export class TaskQueue {
  private readonly log = logger.child({ service: "queue" });
  private readonly rateLimitDelay: number;
  private readonly maxConcurrent: number;

  private startTime: number | null = null;
  private settledCount = 0;
  private averageSum = 0;
  private failedCount = 0;
  private failedItems: (string | undefined)[] = [];

  private min: StatsEntry = { item: null, time: Infinity };
  private max: StatsEntry = { item: null, time: -Infinity };

  // Optimization: Pointer-based queue avoids O(n) array re-indexing
  private queue: ItemWrapper[] = [];
  private head = 0;

  private runningCount = 0;
  private isProcessing = false;

  private onFinishListeners: OnFinishListener[] = [];
  private waitPromises: Array<(stats: QueueStats) => void> = [];

  constructor({ rateLimit = 25, maxConcurrent = 100 }: QueueOptions = {}) {
    this.rateLimitDelay = 1000 / rateLimit;
    this.maxConcurrent = maxConcurrent;
  }

  public enqueue<T = any>(fn: ItemFn<T>, id?: string): Promise<T> {
    if (this.startTime === null) {
      this.startTime = performance.now();
      this.settledCount = 0;
      this.averageSum = 0;
      this.failedCount = 0;
      this.failedItems = [];
      this.min = { item: null, time: Infinity };
      this.max = { item: null, time: -Infinity };
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        fn: async () => {
          try {
            const result = await fn();
            resolve(result);
            return result;
          } catch (err) {
            reject(err);
            throw err;
          }
        },
      });

      this.process();
    });
  }

  public getStats(): QueueStats {
    const totalDuration = this.startTime ? performance.now() - this.startTime : 0;
    return {
      min: this.min.item ? { ...this.min } : { item: null, time: 0 },
      max: this.max.item ? { ...this.max } : { item: null, time: 0 },
      avg: this.settledCount === 0 ? 0 : this.averageSum / this.settledCount,
      settledCount: this.settledCount,
      totalDuration,
      realRate: totalDuration === 0 ? 0 : (this.settledCount / totalDuration) * 1000,
      failedItems: this.failedItems.slice(),
      failedCount: this.failedCount,
    };
  }

  // Restored: Public listener registration
  public onFinish(fn: OnFinishListener): void {
    this.onFinishListeners.push(fn);
  }

  public waitUntilFinished(): Promise<QueueStats> {
    if (this.head >= this.queue.length && this.runningCount === 0) {
      return Promise.resolve(this.getStats());
    }
    return new Promise((resolve) => this.waitPromises.push(resolve));
  }

  public clear(): void {
    this.queue = [];
    this.head = 0;
    if (this.runningCount === 0) this.triggerFinish();
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.head >= this.queue.length) return;
    this.isProcessing = true;

    while (this.head < this.queue.length) {
      if (this.runningCount >= this.maxConcurrent) {
        this.isProcessing = false;
        return;
      }

      const item = this.queue[this.head++];
      this.runningCount++;

      this.executeTask(item);

      if (this.rateLimitDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }

      // Periodic memory cleanup for very large queues
      if (this.head > 1000) {
        this.queue = this.queue.slice(this.head);
        this.head = 0;
      }
    }

    this.isProcessing = false;
  }

  private async executeTask(item: ItemWrapper): Promise<void> {
    const start = performance.now();
    try {
      await item.fn();
    } catch (error) {
      this.log.warn({ err: error, itemId: item.id }, "Queue item failed");
      this.failedCount++;
      if (this.failedItems.length < 500) this.failedItems.push(item.id);
    } finally {
      this.updateMetrics(item, performance.now() - start);
      this.runningCount--;

      if (this.head >= this.queue.length && this.runningCount === 0) {
        this.triggerFinish();
      } else {
        this.process();
      }
    }
  }

  private updateMetrics(item: ItemWrapper, duration: number): void {
    if (duration < this.min.time) this.min = { item, time: duration };
    if (duration > this.max.time) this.max = { item, time: duration };
    this.averageSum += duration;
    this.settledCount++;
  }

  private triggerFinish(): void {
    if (!this.startTime) return;
    const stats = this.getStats();

    // Clear start time to allow the queue to "restart" if new items are added later
    this.startTime = null;

    // Execute all registered onFinish callbacks
    this.onFinishListeners.forEach(fn => fn(stats));

    // Resolve all promises waiting for completion
    while (this.waitPromises.length > 0) {
      this.waitPromises.shift()!(stats);
    }
  }
}