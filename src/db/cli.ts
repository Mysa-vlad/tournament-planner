// Окремі кроки розгортання БД (spec-lab4 §4, AC21):
//   npm run db:migrate              — усі кроки: schema → data → indexes
//   npm run db:migrate -- schema    — лише блокуючі зміни структури
//   npm run db:migrate -- indexes   — лише індекси (CONCURRENTLY)
//   npm run db:seed                 — демо-дані (не міграція)
import { loadConfig } from '../config/env.js';
import { logger } from '../shared/index.js';
import { createDatabase } from './database.js';
import { migrate, MIGRATION_STEPS, type MigrationStep } from './migrate.js';
import { seed } from './seed.js';

const isStep = (s: string): s is MigrationStep =>
  (MIGRATION_STEPS as readonly string[]).includes(s);

const main = async (): Promise<void> => {
  const [command, ...args] = process.argv.slice(2);
  const db = await createDatabase(loadConfig().databaseUrl);
  try {
    if (command === 'migrate') {
      const unknown = args.filter((a) => !isStep(a));
      if (unknown.length > 0) throw new Error(`Unknown migration step(s): ${unknown.join(', ')}`);
      const steps = args.filter(isStep);
      const applied = await migrate(db, steps.length > 0 ? steps : MIGRATION_STEPS);
      logger.info({ applied }, applied.length ? 'migrations done' : 'nothing to migrate');
    } else if (command === 'seed') {
      await seed(db);
    } else {
      throw new Error('Usage: cli.ts migrate [schema|data|indexes...] | seed');
    }
  } finally {
    await db.close();
  }
};

main().catch((err: unknown) => {
  logger.fatal({ err }, 'db command failed');
  process.exit(1);
});
