import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

export const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};

// Lazy-initialized queue — only connects to Redis when actually used.
// This prevents the app from crashing on import when Redis is unavailable
// (e.g. on Vercel serverless where Redis isn't needed yet).
let _queue: Queue | null = null;

export function getQueue(): Queue {
    if (!_queue) {
        _queue = new Queue('mail_queue', { connection });
    }
    return _queue;
}

// Keep backward-compatible export (used by mail.controller.ts)
// This creates a proxy that lazily initializes on first method call.
export const myQueue = new Proxy({} as Queue, {
    get(_target, prop, receiver) {
        const queue = getQueue();
        const value = (queue as any)[prop];
        return typeof value === 'function' ? value.bind(queue) : value;
    }
});

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Wrap Bull Board setup — if Redis isn't available, the dashboard
// will just show an empty state instead of crashing the app.
try {
    createBullBoard({
      queues: [ new BullMQAdapter(getQueue()) ],
      serverAdapter: serverAdapter,
    });
} catch (err) {
    console.warn('Bull Board setup skipped (Redis may be unavailable):', (err as Error).message);
}
