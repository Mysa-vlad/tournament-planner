<!-- ЧЕРНЕТКА: її підготував AI-агент. За DoD курсу (§4) DEFENSE пишеться власноруч: перепиши своїми словами, звір кожне посилання, потім видали цей коментар. -->

# DEFENSE — Завдання 4: CI/CD і розгортання

**PR:** [Mysa-vlad/tournament-planner#4](https://github.com/Mysa-vlad/tournament-planner/pull/4)
· Spec: [spec-lab4.md](spec-lab4.md) · Стейдж: [tournament-planner-staging.onrender.com/version](https://tournament-planner-staging.onrender.com/version)

**1. Що я просив у AI.** Налаштувати CI, що блокує merge, CD `main` → публічний стейдж з
`/version`, міграції без простою, і довести аудитом, що CI справді падає. Хостинг і захист
гілки обирав я. Промпт і відповіді на уточнення: [`ai/07-lab4-prompt.md`](ai/07-lab4-prompt.md).

**2. Топ-3: CI справді падає на порушеннях (аудит AC18):**

| #   | Що зламано навмисно (`--no-verify`, в обхід локальних hooks) | Червоний job (Required) | PR / прогін                                                                                                                                    |
| --- | ------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | стиль: неформатований `src/shared/ids.ts`                    | `quality`               | [#5](https://github.com/Mysa-vlad/tournament-planner/pull/5) · [run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592596162) |
| 2   | логіка: перемога = 2 очки                                    | `test`, `test-postgres` | [#6](https://github.com/Mysa-vlad/tournament-planner/pull/6) · [run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592643982) |
| 3   | повідомлення коміту `updated readme`                         | `commits`               | [#7](https://github.com/Mysa-vlad/tournament-planner/pull/7) · [run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592698740) |

На кожному PR GitHub показує «Some checks were not successful», а звичайний merge
заблоковано. Знахідка аудиту: на #6 `build-e2e` лишився зеленим, бо E2E перевіряє
кількість матчів, а не очки. Правило очок ловлять unit- та інтеграційні тести. Докази:
[`docs/evidence/15`](docs/evidence/15-ci-blocks-dirty-prs.md).

**3. Ключові рішення:**

- GitHub Actions + Render (Docker) + Neon. Деплой через deploy hook **після** зеленого CI
  і міграцій, а не autoDeploy, бо той деплоїть до міграцій і навіть при червоному CI
  ([`adr/0007`](adr/0007-ci-cd-github-actions-render-neon.md)).
- Міграції без простою: окремі кроки `schema → data → indexes (CONCURRENTLY)`, seed
  окремо. На PostgreSQL-сервері застосунок під час старту не мігрує, а `/health/ready`
  пускає трафік лише на готовий інстанс (blue-green)
  ([`adr/0008`](adr/0008-zero-downtime-migrations.md)).
- Чесне обмеження Render Free: zero-downtime доступний лише в платних планах. Readiness і
  міграції до деплою реалізовано, але на Free перемикання може мати коротку паузу.
- Тимчасовий обхід правила для адміністратора (лише через PR) був потрібен тільки для PR
  #1–#3, відкритих до появи CI. Після їх merge (18.11) обхід прибрано: список обходу порожній,
  і merge у `main` без 5 зелених перевірок неможливий нікому, зокрема власнику.

**4. Перевірка:**

- CI на PR #4: 5/5 зелених job, зокрема інтеграційні тести на **PostgreSQL 16** і
  збірка Docker-образу ([run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592116718)).
- Правило `main`: PR-only, 5 обов'язкових статусів, гілка актуальна, без force-push і видалення.
- CD: [прогін #1](https://github.com/Mysa-vlad/tournament-planner/actions/runs/44299727039)
  (коміт `822a2da`) застосував міграції в Neon і задеплоїв, але **впав на кроці 5**:
  `/version` віддавав `sha: "unknown"`. Причина — заглушка `GIT_SHA=unknown` у Dockerfile
  перекривала `RENDER_GIT_COMMIT`. Виправлено в PR
  [#8](https://github.com/Mysa-vlad/tournament-planner/pull/8) (spec `0c4860c` → код і
  регресійний тест). [Прогін #2](https://github.com/Mysa-vlad/tournament-planner/actions/runs/44301921882)
  (`87fcc48`) зелений, і `curl https://tournament-planner-staging.onrender.com/version`
  повертає `87fcc486a39efc9992a1adad19faf89ac2f68013` (AC19). Докази:
  [`docs/evidence/16`](docs/evidence/16-cd-staging-deploy.md).
- Merge PR #4 — без обходу: гілку оновлено від `main`, 5/5 перевірок зелені, звичайний merge.
- Відтворення локально: `npm run db:migrate -- schema` (окремі кроки), `npm run db:seed`,
  `npm run check`.
