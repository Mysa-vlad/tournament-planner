import { mkdir, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { join } from 'node:path';
import { logger } from './shared/index.js';

/**
 * spec-lab5 AC24: CPU-профіль процесу під навантаженням (npm run profile).
 * Вмикається лише змінною CPU_PROFILE_DIR. Зупинка йде IPC-повідомленням 'stop-profile',
 * а не сигналом, бо на Windows SIGINT від батьківського процесу не доходить до обробника.
 */
export const startProfilingIfRequested = async (): Promise<void> => {
  const dir = process.env.CPU_PROFILE_DIR;
  if (!dir || !process.send) return;

  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: 500 }); // мкс
  await session.post('Profiler.start');
  logger.info({ dir }, 'cpu profiling started');

  process.on('message', (msg: unknown) => {
    if (msg !== 'stop-profile') return;
    void (async () => {
      const { profile } = await session.post('Profiler.stop');
      await mkdir(dir, { recursive: true });
      const file = join(dir, `cpu-${String(Date.now())}.cpuprofile`);
      await writeFile(file, JSON.stringify(profile));
      session.disconnect();
      process.send?.({ type: 'profile-written', file });
    })();
  });
};
