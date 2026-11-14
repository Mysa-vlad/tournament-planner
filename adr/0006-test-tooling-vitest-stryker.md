# 0006. Тести: Vitest + supertest + окремий процес для E2E + Stryker

- Status: accepted
- Date: 2026-11-14

## Context

Завдання 3 вимагає unit, інтеграційні (з підняттям БД і HTTP-сервера), E2E і мутаційне
тестування з відтворюваним звітом. До цього smoke-тести працювали на `node:test`.

## Decision Drivers

- мутаційний інструмент має працювати з раннером без «обгорток» (швидко, з per-test coverage);
- покриття гілок і пороги — частина прогону, а не окремий ручний крок;
- ESM + TypeScript без окремої збірки тестів;
- E2E має тестувати застосунок «як користувач»: окремий процес, справжні мережа й диск.

## Considered Options

1. `node:test` + c8 + Stryker `command`-runner
2. Jest (ts-jest) + Stryker jest-runner
3. Vitest + `@vitest/coverage-v8` + Stryker vitest-runner

## Decision

Обрано **Vitest** (варіант 3). Для HTTP в інтеграційних тестах використовуємо **supertest**
поверх `createApp()` на справжньому PGlite. **E2E** запускає `node dist/server.js` окремим
процесом із файловою БД у тимчасовому каталозі.

## Pros and Cons of the Options

### `node:test` + `command`-runner

- 👍 без залежностей, вбудований у Node
- 👎 Stryker `command`-runner перезапускає весь набір на кожного мутанта, без per-test
  coverage: це в десятки разів повільніше
- 👎 пороги покриття гілок по glob-шаблонах треба збирати вручну

### Jest

- 👍 найпоширеніший, зрілий Stryker-runner
- 👎 ESM + TS потребують ts-jest/babel і `--experimental-vm-modules`, тобто зайва конфігурація
  для `"type": "module"`

### Vitest

- 👍 ESM/TS «з коробки», API сумісний із Jest, а `node:assert` теж працює
- 👍 per-glob пороги покриття (T1 для модуля `standings`) у `vitest.config.ts`
- 👍 офіційний Stryker vitest-runner з per-test coverage
- 👎 ще одна dev-залежність; міграція наявних тестів (заміна імпортів `node:test`)

## Consequences

- Позитивні: `npm test` = unit + інтеграційні + пороги покриття; `npm run mutation` дає
  звіт Stryker; `npm run test:e2e` перевіряє зібраний артефакт.
- Негативні: E2E потребує збірки (`npm run build`) і триває секунди, тому мутаційний прогін
  його не включає.
- Далі: у завданні 4 ці ж команди йдуть у CI, а мутаційний звіт — артефакт CI.
