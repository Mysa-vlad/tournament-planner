# @tournament-planner/standings

Турнірна таблиця (S4: перемога 3, нічия 1, поразка 0; сортування очки → різниця → забиті →
назва). Чистий TypeScript без runtime-залежностей. Усе зовнішнє передається при
ініціалізації (DI). Рішення: [ADR 0009](../../adr/0009-standings-package-di-boundary.md).

```ts
import { createMemoryCache, createStandings } from '@tournament-planner/standings';

const standings = createStandings({
  source: { loadSnapshot: async (id) => ({ teams: [...], results: [...] }) }, // або undefined
  cache: createMemoryCache(), // необов'язково
  ttlMs: 5000, // 0 — без кешу
  // rules: { win: 3, draw: 1, loss: 0 }, clock: { now: () => Date.now() } — за замовчуванням
});

await standings.get(tournamentId); // StandingRow[] | undefined (турніру немає)
standings.invalidate(tournamentId); // після запису, що змінює таблицю
```

| Порт              | Що робить                           | Реалізації в застосунку                          |
| ----------------- | ----------------------------------- | ------------------------------------------------ |
| `StandingsSource` | знімок `{ teams, results }` турніру | один SQL (PostgreSQL / PGlite), сервіси (static) |
| `StandingsCache`  | `get / set / delete / clear`        | `createMemoryCache()` з пакета                   |
| `Clock`           | `now()` у мс — для TTL              | `systemClock`; у тестах — керований              |
| `PointsRules`     | очки за перемогу / нічию / поразку  | `DEFAULT_POINTS`                                 |

Межі перевіряє dependency-cruiser: **D10** (пакет не імпортує застосунок, npm-пакети й
модулі Node) і **D11** (застосунок імпортує лише цю точку входу).

Збірка: `npm run build -w @tournament-planner/standings` → `dist/`. Тести: `npm test` у корені.
