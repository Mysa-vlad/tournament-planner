# Tournament Planner

REST API для організації аматорських футбольних турнірів (шкільні, дворові, факультетські ліги).

## Ідея

Організатор аматорського турніру зазвичай веде все в таблиці: які команди заявилися, хто з ким
і коли грає, який рахунок, хто лідирує. Таблиця ламається на кожному перенесеному матчі, а
турнірну таблицю доводиться перераховувати вручну.

Tournament Planner вирішує це так:

- **Турніри й команди.** Організатор створює турнір і реєструє команди з їхніми гравцями.
- **Розклад.** Сервіс генерує розклад за круговою системою (кожен з кожним).
- **Результати.** Після матчу організатор вносить рахунок.
- **Турнірна таблиця.** Таблиця (очки, різниця м'ячів) рахується автоматично з результатів.

Проєкт розвивається впродовж курсу «Розробка ПЗ на платформі Node.JS» (РПЗнП):

| Завдання | Що додається                                         |
| -------- | ---------------------------------------------------- |
| 1        | фундамент: стандарти, spec, структура модулів, hooks |
| 2        | робочий застосунок: прототип → інтеграція з БД       |
| 3        | тестування                                           |
| 4        | CI/CD і розгортання                                  |
| 5        | перформанс і винесення бібліотеки                    |

## Документи

- [spec.md](spec.md): специфікація (модулі, дані, сценарії, критерії прийняття)
- [standards/](standards/): інженерні стандарти проєкту
- [adr/](adr/): архітектурні рішення (MADR)
- [DEFENSE.md](DEFENSE.md) (завдання 1), [DEFENSE-lab2.md](DEFENSE-lab2.md) (завдання 2), [DEFENSE-lab3.md](DEFENSE-lab3.md) (завдання 3), [DEFENSE-lab4.md](DEFENSE-lab4.md) (завдання 4), [DEFENSE-lab5.md](DEFENSE-lab5.md) (завдання 5): захист
- [ai/](ai/): слід промптів до AI

## Запуск

Потрібен Node.js 22. Окремий сервер БД не потрібен: PostgreSQL працює в процесі
(PGlite, [ADR 0004](adr/0004-postgres-pglite-raw-sql.md)).

```bash
npm ci
npm run dev           # PostgreSQL (PGlite), дані в ./.data/pg
npm run dev:static    # прототип на статичних даних (.env.static)
npm run check         # формат, лінт, типи, межі модулів, smoke (static + pg), збірка
```

Змінні середовища: `PORT` (3000), `DATA_SOURCE` (`pg` | `static`), `DATABASE_URL`
(`./.data/pg` або `memory://`), `LOG_LEVEL`, `STANDINGS_CACHE_TTL_MS` (5000; `0` вимикає
кеш таблиці).

## API (Завдання 2)

Операції запису потребують заголовка `X-User-Id` (ініціатор). Кожна відповідь має
`X-Request-Id`. Повна поведінка й помилки описані в [spec-lab2.md](spec-lab2.md).

| Метод  | Шлях                           | Що робить                              |
| ------ | ------------------------------ | -------------------------------------- |
| `POST` | `/teams`, `/teams/:id/players` | команда, гравець                       |
| `POST` | `/tournaments`                 | турнір (організатор = `X-User-Id`)     |
| `POST` | `/tournaments/:id/entries`     | S1 заявка (ідемпотентно)               |
| `POST` | `/tournaments/:id/start`       | S2 розклад «кожен з кожним» (атомарно) |
| `PUT`  | `/matches/:id/result`          | S3 результат, S5 автозавершення        |
| `GET`  | `/tournaments/:id/matches`     | розклад                                |
| `GET`  | `/tournaments/:id/standings`   | S4 турнірна таблиця                    |
| `GET`  | `/health`                      | перевірка стану                        |

## Тести (Завдання 3)

Стратегія, пороги й критерії описані в [spec-lab3.md](spec-lab3.md).

```bash
npm test             # unit + інтеграційні (справжній PostgreSQL + HTTP) з порогами покриття
npm run test:e2e     # збирає застосунок і проганяє S1–S5 через окремий процес з перезапуском
npm run mutation     # Stryker → reports/mutation/index.html
```

| Рівень       | Тека                | Що піднімається                                     |
| ------------ | ------------------- | --------------------------------------------------- |
| Unit         | `test/unit/`        | нічого (чисті функції, in-memory репозиторії)       |
| Інтеграційні | `test/integration/` | PGlite `memory://` + express через supertest        |
| E2E          | `test/e2e/`         | `node dist/server.js`, файлова БД у тимчасовій теці |

## Перформанс (Завдання 5)

Сценарії, метрики й критерії описані в [spec-lab5.md](spec-lab5.md), звіти лежать у [docs/perf/](docs/perf/).

```bash
npm run load -- https://tournament-planner-staging.onrender.com --label=staging   # L1–L3, L-MIX × 3 повтори
npm run load -- http://localhost:3000 --label=local
npm run profile -- --label=profile   # збірка + CPU-профіль під L-MIX → docs/perf/<label>-cpu-<sha>.md
npm run explain                      # EXPLAIN (ANALYZE, BUFFERS) запитів L1–L4
```

- `GET /metrics` віддає RSS, heap, затримку event loop (p50/p99/max) і uptime; `?reset=1` скидає гістограму.
- `GET /version` віддає SHA, до якого прив'язано кожен звіт.
- Таблицю винесено в пакет [`packages/standings`](packages/standings/) з DI
  ([ADR 0009](adr/0009-standings-package-di-boundary.md)).
