# 0007. CI/CD: GitHub Actions + Render (Docker) + Neon PostgreSQL, деплой через hook після міграцій

- Status: accepted
- Date: 2026-11-14

## Context

Завдання 4 вимагає CI, що блокує merge (стиль, лінт, білд, тести, conventional commits), і CD:
коміт у `main` автоматично потрапляє на публічний стейдж з `/version`. Міграції мають бути
без простою (структура, дані, індекси й seed окремо; blue-green). До цього БД була лише
вбудованою (PGlite, ADR 0004), а blue-green з двома інстансами вимагає спільної БД.

## Decision Drivers

- репозиторій на GitHub і публічний, тож CI має бути безкоштовним і поруч із PR;
- безкоштовний публічний стейдж без власного сервера;
- міграції до перемикання трафіку, а не на старті застосунку (spec-lab4 §4);
- спільна PostgreSQL, яка не зникне до перевірки курсу.

## Considered Options

**CI:** 1) GitHub Actions; 2) GitLab CI (дзеркало); 3) лише локальні hooks.
**Хостинг:** A) Render (Docker, free); B) Fly.io; C) Railway.
**БД:** X) Neon (free, без терміну); Y) Render Postgres (free, видаляється через 30 днів);
Z) PGlite на диску інстансу.
**Запуск деплою:** I) autoDeploy Render на push; II) deploy hook із CD-job після міграцій.

## Decision

**GitHub Actions + Render (Docker) + Neon, деплой через deploy hook (II).**
Адаптер `pg.Pool` реалізує той самий контракт `Database`. Локально й у тестах лишається
PGlite, у CI-job `test-postgres` і на стейджі використовується справжній PostgreSQL.

## Pros and Cons of the Options

### CI

- **GitHub Actions** 👍 статуси прямо в PR, і саме їх вимагає правило гілки; безкоштовно
  для публічних репозиторіїв; service container PostgreSQL. 👎 YAML без локального запуску.
- **GitLab CI** 👍 потужні пайплайни. 👎 потрібне дзеркало, а статуси до GitHub PR —
  через інтеграцію.
- **Лише hooks** 👍 вже є. 👎 `--no-verify` обходить їх, і merge вони не блокують.

### Хостинг

- **Render** 👍 Docker, health check на кожен деплой (blue-green «з коробки»), deploy hook
  з `?ref=<sha>`, змінна `RENDER_GIT_COMMIT`. 👎 free-інстанс засинає (перший запит ~30 с);
  pre-deploy command лише в платних планах, тому міграції запускає CD-job.
- **Fly.io** 👍 `release_command` для міграцій. 👎 потрібна платіжна картка навіть для
  free-рівня.
- **Railway** 👍 зручний UI. 👎 пробний кредит закінчується.

### БД

- **Neon** 👍 керований PostgreSQL 16, безкоштовно без терміну. 👎 ще один акаунт;
  холодний старт обчислень.
- **Render Postgres** 👍 той самий акаунт. 👎 безкоштовна БД видаляється через 30 днів,
  тобто до перевірки курсу.
- **PGlite на диску** 👍 без сервісів. 👎 у кожного інстансу своя БД, тож blue-green
  неможливий; на free Render немає постійного диска.

### Запуск деплою

- **autoDeploy** 👍 простіше. 👎 Render деплоїть одразу на push, ще до міграцій і навіть
  при червоному CI.
- **deploy hook із CD** 👍 гарантований порядок: зелений CI → міграції → деплой →
  перевірка `/version`. 👎 два секрети в GitHub (`STAGING_DATABASE_URL`,
  `RENDER_DEPLOY_HOOK_URL`).

## Consequences

- Позитивні: merge у `main` неможливий без 5 зелених job. Кожен деплой доводиться
  `/version`, а інтеграційні тести перевіряють обидві реалізації `Database`.
- Негативні: стейдж «засинає» на free-плані. **Zero-downtime деплой Render дає лише в
  платних планах.** На Free нова версія так само проходить health check `/health/ready`, перш
  ніж стати live, але переривання при перемиканні можливе. Механізм blue-green (readiness,
  міграції до деплою) реалізовано в коді, а повну гарантію дає платна платформа. У правилі гілки поки є обхід для власника
  репозиторію, бо PR #1–#3 відкрито до появи CI (див. DEFENSE-lab4).
- Далі: у завданні 5 `/version` використовується для прив'язки профілювання до SHA.
