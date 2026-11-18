# Доказ AC19–AC21: CD на стейдж, міграції кроками, /version

Стейдж: https://tournament-planner-staging.onrender.com (Render Free, Docker, Frankfurt) +
Neon PostgreSQL (Frankfurt). CD запускається після зеленого CI на `main` (`workflow_run`).

| Прогін CD                                                                      | Коміт                                                                             | Результат              | Що сталося                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/Mysa-vlad/tournament-planner/actions/runs/44299727039) | `822a2da` (merge PR #4)                                                           | ❌ failure (18 хв)     | міграції `schema` → `data` → `indexes` застосовано, деплой пройшов, але крок 5 не дочекався свого SHA: `/version` → `"sha":"unknown","version":"0.0.0"` |
| [#2](https://github.com/Mysa-vlad/tournament-planner/actions/runs/44301921882) | `87fcc48` (merge PR [#8](https://github.com/Mysa-vlad/tournament-planner/pull/8)) | ✅ success (5 хв 15 с) | міграцій нових немає (ідемпотентно), деплой → `/version` повертає SHA коміту                                                                            |

## Що впіймав крок «перевірка /version»

Перший CD довів цінність кроку 5: деплой «пройшов», але відповідь стейджу брехала про
версію. Dockerfile мав `ARG GIT_SHA=unknown` і `ENV GIT_SHA=${GIT_SHA}`, а конфіг віддавав
перевагу `GIT_SHA` над `RENDER_GIT_COMMIT`. Виправлення: spec AC19 уточнено (`0c4860c`),
код ігнорує порожні значення й заглушку `unknown`, версія береться з `package.json`,
регресійний тест у `test/unit/config-context.test.ts`.

## Відповідь стейджу після прогону #2

```
$ curl https://tournament-planner-staging.onrender.com/version
{"sha":"87fcc486a39efc9992a1adad19faf89ac2f68013","version":"0.1.0","startedAt":"2026-11-18T12:18:52.952Z"}

$ curl https://tournament-planner-staging.onrender.com/health/ready
{"status":"ready","checks":{"database":"ok","schema":"ok (schema/001_init.sql)"}}
```

## Лог міграцій у CD #1 (крок 3, індекси)

```
> tsx src/db/cli.ts migrate indexes
{"level":30,"url":"postgresql://ep-tiny-sky-ba2fv4de.c-8.eu-central-1.aws.neon.tech/neondb","msg":"database ready"}
{"level":30,"migration":"indexes/001_matches_tournament_idx.sql","msg":"migration applied"}
{"level":30,"applied":["indexes/001_matches_tournament_idx.sql"],"msg":"migrations done"}
```

Пароль БД у лог не потрапляє (`describeUrl`), секрети лише в GitHub Secrets і Render Environment.

Примітка: застосунок на PostgreSQL під час старту не мігрує (AC21). Схему створив CD-крок
`schema` до деплою, тому `/health/ready` новий інстанс одразу повернув `ready`.
