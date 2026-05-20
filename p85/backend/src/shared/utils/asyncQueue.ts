import { EventEmitter } from 'events';
import logger from '../middleware/logger';

export interface QueueTask<T = any> {
  id: string;
  data: T;
  retries: number;
  maxRetries: number;
}

export interface QueueOptions {
  concurrency?: number;
  retryDelay?: number;
}

export class AsyncQueue<T = any> extends EventEmitter {
  private queue: QueueTask<T>[] = [];
  private processing = 0;
  private concurrency: number;
  private retryDelay: number;
  private processor: (data: T) => Promise<void>;

  constructor(
    processor: (data: T) => Promise<void>,
    options: QueueOptions = {}
  ) {
    super();
    this.processor = processor;
    this.concurrency = options.concurrency || 5;
    this.retryDelay = options.retryDelay || 1000;
  }

  add(data: T, maxRetries = 3): string {
    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id: taskId,
      data,
      retries: 0,
      maxRetries,
    });
    this.emit('task:added', taskId);
    logger.debug(`Task added to queue: ${taskId}, queue size: ${this.queue.length}`);
    this.processNext();
    return taskId;
  }

  addBatch(items: T[], maxRetries = 3): string[] {
    const taskIds: string[] = [];
    for (const item of items) {
      const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.queue.push({
        id: taskId,
        data: item,
        retries: 0,
        maxRetries,
      });
      taskIds.push(taskId);
    }
    this.emit('batch:added', taskIds.length);
    logger.debug(`Batch added to queue: ${items.length} tasks, queue size: ${this.queue.length}`);
    this.processNext();
    return taskIds;
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.processing++;
    this.emit('task:start', task.id);

    try {
      await this.processor(task.data);
      this.emit('task:success', task.id);
      logger.debug(`Task completed successfully: ${task.id}`);
    } catch (error) {
      task.retries++;
      this.emit('task:error', task.id, error, task.retries);

      if (task.retries < task.maxRetries) {
        logger.warn(
          `Task failed, retrying (${task.retries}/${task.maxRetries}): ${task.id}`
        );
        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, this.retryDelay * task.retries);
      } else {
        logger.error(`Task failed permanently after ${task.maxRetries} retries: ${task.id}`);
        this.emit('task:failed', task.id, error);
      }
    } finally {
      this.processing--;
      this.processNext();
    }
  }

  get size(): number {
    return this.queue.length + this.processing;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get processingCount(): number {
    return this.processing;
  }
}

export function createQueue<T>(
  processor: (data: T) => Promise<void>,
  options?: QueueOptions
): AsyncQueue<T> {
  return new AsyncQueue(processor, options);
}
