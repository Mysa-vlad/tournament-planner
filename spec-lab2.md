# Spec — Завдання 2: робочий застосунок (прототип → БД)

Доповнює [spec.md](spec.md) (модулі, ER, правила D1–D5). Тут описано поведінку API, схему БД
і сценарії помилок.

## 1. Намір і обсяг

Усі сценарії S1–S5 мають працювати через HTTP API: спершу на статичних даних, потім на
PostgreSQL. **Поза обсягом:** справжня автентифікація (ініціатор береться з заголовка
`X-User-Id`, бо реальну автентифікацію курс не вимагає), пагінація, видалення сутностей.

## 2. API та очікувана поведінка

Запис (`POST`/`PUT`) без `X-User-Id` → `401`. Кожна відповідь має `X-Request-Id`
(business-process ID, приймається від клієнта або генерується).

| Сценарій                      | Запит                                            | Успіх                                     | Ідемпотентність / доступ                                   |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| Команда, гравець              | `POST /teams`, `POST /teams/:id/players`         | `201`                                     | номер гравця унікальний → `409`                            |
| Турнір                        | `POST /tournaments`                              | `201`, `organizerId` = ініціатор          | —                                                          |
| S1 заявка                     | `POST /tournaments/:id/entries {teamId}`         | `201`; повтор → `200` з тією ж заявкою    | лише в `registration`, інакше `409`                        |
| S2 старт                      | `POST /tournaments/:id/start`                    | `201` + розклад; повтор → `200` той самий | лише організатор → `403`; < 2 команд → `409`; атомарно     |
| S3 результат (+S5 завершення) | `PUT /matches/:id/result {homeGoals, awayGoals}` | `200`                                     | лише організатор; той самий рахунок → `200`, інший → `409` |
| Розклад, S4 таблиця           | `GET /tournaments/:id/matches`, `/standings`     | `200`                                     | без N+1: кількість SQL-запитів не залежить від N команд    |

## 3. Схема БД (PostgreSQL)

`teams(id pk, name, city)` · `players(id pk, team_id fk, full_name, number, unique(team_id, number))` ·
`tournaments(id pk, name, starts_on, status check(registration|in_progress|finished), organizer_id)` ·
`tournament_entries(tournament_id fk, team_id fk, registered_at, pk(tournament_id, team_id))` ·
`matches(id pk, tournament_id fk, round, home_team_id fk, away_team_id fk, status check, home_goals, away_goals,
check(home≠away), check(goals ≥ 0), unique(tournament_id, home_team_id, away_team_id))`, індекс `matches(tournament_id)`.

**Ключові запити.** S1: `INSERT … ON CONFLICT DO NOTHING`. S2 (одна транзакція):
`UPDATE tournaments SET status='in_progress' WHERE id=$1 AND status='registration'`, потім
`INSERT` N·(N−1)/2 матчів. S3: `UPDATE matches … WHERE id=$1 AND status='scheduled'`. S4: одна
вибірка завершених матчів + одна вибірка команд за `id = ANY($1)`.

## 4. Сценарії помилок

| Ситуація                                       | Відповідь                                |
| ---------------------------------------------- | ---------------------------------------- |
| невалідне тіло / параметри                     | `400 VALIDATION` + список полів          |
| немає `X-User-Id` / не організатор             | `401 UNAUTHENTICATED` / `403 FORBIDDEN`  |
| сутності немає                                 | `404 NOT_FOUND`                          |
| порушення інваріанта, гонка, дубль             | `409 CONFLICT`                           |
| БД недоступна / збій з'єднання                 | `503 SOURCE_UNAVAILABLE` + `Retry-After` |
| транзієнтний конфлікт транзакції (40001/40P01) | до 3 повторів з backoff, далі `503`      |
| будь-що інше                                   | `500 INTERNAL`, деталі лише в лозі       |

Тіло помилки: `{ error, message, requestId }`.

## 5. Правила (доповнення до D1–D5)

- **D6.** SQL і транзакції (`BEGIN/COMMIT`) пишуться лише в `src/db/` і `*.repository.ts`.
  Роути знають лише про HTTP, сервіси — про бізнес-операції й доступ. Атомарність сервіс
  оголошує через порт `UnitOfWork` без SQL.
- **D7.** Request-контекст (ініціатор, `requestId`) не передається параметрами: його дає
  `AsyncLocalStorage`, а логер додає його в кожен запис автоматично.
- **D8.** Помилки обробляє один глобальний обробник. `try/catch` лише там, де помилку
  перетворюють (repository → `DomainError`) або повторюють (retry).
- **D9.** Зв'язані сутності читаються батчем, а не в циклі: модуль дає метод «за списком id»
  (`TeamsService.getTeamsByIds` → один `WHERE id = ANY($1)`). Виклик `get*` поштучно в
  циклі чи `Promise.all(ids.map(get))` — це N+1, тобто порушення.

## 6. Критерії прийняття

- **AC7.** Smoke-сценарій S1–S5 проходить і на статичних даних (`DATA_SOURCE=static`), і на БД.
- **AC8.** Під час старту застосунок падає одразу, якщо БД недоступна (`SELECT now()`).
- **AC9.** Повтор S1/S2/S3 не створює дублів; паралельний подвійний S2 дає один розклад.
- **AC10.** У кожному лозі запиту є `requestId` і `userId`, зокрема в логах шару БД.
- **AC11.** Розклад і таблиця виконуються за сталу кількість SQL-запитів для будь-якого N:
  розклад ≤ 3 (турнір, матчі, команди), таблиця ≤ 4 (+ заявки). Перевіряє
  `npm run probe:queries` і тест `test/smoke/queries.test.ts`.
- **AC12.** Збій БД під час запиту дає `503`, а не `500`, і процес не падає.
