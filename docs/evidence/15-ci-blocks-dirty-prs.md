# Доказ AC18: CI червоний на навмисно зламаних PR, merge у main заблоковано

Правило гілки `main` (ruleset «main: green CI required»): лише через PR, обов'язкові статуси
`commits`, `quality`, `test`, `test-postgres`, `build-e2e`, гілка актуальна, без force-push
і видалення. Обхід дозволено лише адміністратору і лише через PR, бо PR #1–#3 створено до появи CI.
Цей обхід треба прибрати після їх merge.

Коміти аудиту зроблено з `--no-verify`, тобто в обхід локальних hooks. Саме тому потрібен CI.

| PR                                                           | Що зламано                                | Червоні job (Required)  | Прогін                                                                          |
| ------------------------------------------------------------ | ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| [#5](https://github.com/Mysa-vlad/tournament-planner/pull/5) | стиль: неформатований `src/shared/ids.ts` | `quality`               | [run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592596162) |
| [#6](https://github.com/Mysa-vlad/tournament-planner/pull/6) | логіка: перемога = 2 очки                 | `test`, `test-postgres` | [run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592643982) |
| [#7](https://github.com/Mysa-vlad/tournament-planner/pull/7) | повідомлення коміту `updated readme`      | `commits`               | [run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592698740) |

На кожному PR GitHub показує «Some checks were not successful». Звичайна кнопка merge
заблокована, доступна лише «Merge without waiting for requirements (bypass rules)».

Спостереження: на #6 `build-e2e` зелений, бо E2E перевіряє кількість зіграних матчів, а не
очки. Неправильне правило ловлять unit- та інтеграційні тести.

Контроль: на PR [#4](https://github.com/Mysa-vlad/tournament-planner/pull/4) з коректним кодом усі 5 job зелені ([run](https://github.com/Mysa-vlad/tournament-planner/actions/runs/43592116718)).
