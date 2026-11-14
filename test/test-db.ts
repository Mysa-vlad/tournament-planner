/**
 * spec-lab4 AC22: ті самі інтеграційні тести — і на PGlite (memory://, локально й у job `test`),
 * і на справжньому PostgreSQL (TEST_DATABASE_URL у job `test-postgres`).
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? 'memory://';
