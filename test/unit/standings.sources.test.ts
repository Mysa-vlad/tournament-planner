import { describe, expect, test } from 'vitest';
import { createServicesStandingsSource } from '../../src/modules/standings/index.js';
import { SourceUnavailableError } from '../../src/shared/index.js';
import { makeServices } from './fixtures.js';

describe('createServicesStandingsSource (DATA_SOURCE=static)', () => {
  test('NOT_FOUND турніру → undefined; інші помилки джерела не ковтаються', async () => {
    const s = makeServices();
    const source = createServicesStandingsSource(s.tournaments, s.teams, s.matches);
    expect(await source.loadSnapshot('missing')).toBeUndefined();

    const broken = createServicesStandingsSource(
      { ...s.tournaments, get: () => Promise.reject(new SourceUnavailableError('db down')) },
      s.teams,
      s.matches,
    );
    await expect(broken.loadSnapshot('any')).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});
