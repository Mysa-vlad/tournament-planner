# Перелік перевірок

Одна команда для всього: `npm run check`. Hooks запускають підмножини, щоб коміт був швидким.

| Перевірка               | Інструмент                                     | Команда                | Коли                | DoD |
| ----------------------- | ---------------------------------------------- | ---------------------- | ------------------- | --- |
| Формат                  | Prettier                                       | `npm run format:check` | pre-commit (staged) | A1  |
| Лінт / статичний аналіз | ESLint + typescript-eslint (strictTypeChecked) | `npm run lint`         | pre-commit (staged) | A2  |
| Типи                    | TypeScript (strict)                            | `npm run typecheck`    | pre-commit          | A3  |
| Межі модулів            | dependency-cruiser (правила D* зі spec)        | `npm run audit:deps`   | pre-push            | A4  |
| Smoke-тест              | `node:test` + tsx                              | `npm run test:smoke`   | pre-push            | A5  |
| Збірка                  | `tsc -p tsconfig.build.json`                   | `npm run build`        | pre-push            | A6  |
| Формат коміту           | власний скрипт `scripts/check-commit-msg.mjs`  | —                      | commit-msg          | A7  |

## Чому так розподілено

- **pre-commit** — тільки швидке (секунди): формат і лінт лише staged-файлів + typecheck.
  Брудний код не потрапляє навіть у локальну історію.
- **pre-push** — повніше: межі модулів, smoke, збірка. До віддаленого репозиторію не йде
  те, що не збирається.
- Обхід через `--no-verify` заборонено (DoD R-пункти); у завданні 4 ці ж перевірки
  дублюються в CI, щоб обхід був неможливий.
