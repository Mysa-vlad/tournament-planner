import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

/**
 * spec-lab5 AC24: RAM і затримка event loop.
 * Висока затримка циклу під навантаженням означає, що процес зайнятий CPU (синхронна робота);
 * низька при високій латентності означає, що запити чекають I/O (БД, мережа).
 */
const loopDelay = monitorEventLoopDelay({ resolution: 10 });
loopDelay.enable();

const mb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10;
const ms = (ns: number): number => Math.round((ns / 1e6) * 100) / 100;

export interface MetricsSnapshot {
  readonly rssMb: number;
  readonly heapUsedMb: number;
  readonly eventLoopDelayMs: { readonly p50: number; readonly p99: number; readonly max: number };
  readonly uptimeS: number;
}

export const snapshot = (): MetricsSnapshot => {
  const mem = process.memoryUsage();
  return {
    rssMb: mb(mem.rss),
    heapUsedMb: mb(mem.heapUsed),
    eventLoopDelayMs: {
      p50: ms(loopDelay.percentile(50)),
      p99: ms(loopDelay.percentile(99)),
      max: ms(loopDelay.max),
    },
    uptimeS: Math.round(process.uptime()),
  };
};

/** GET /metrics; ?reset=1 обнуляє гістограму (щоб міряти саме вікно навантаження). */
export const metricsHandler: RequestHandler = (req, res) => {
  const body = snapshot();
  if (req.query.reset === '1') loopDelay.reset();
  res.json(body);
};
