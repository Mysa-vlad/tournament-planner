# 0002. Конвеєр якості: husky + lint-staged, розподіл pre-commit / pre-push

- Status: accepted
- Date: 2026-11-14

## Context

Завдання вимагає git-hook на commit/push: формат, лінтер, мінімальний smoke-тест, збірка.
Hook має реально блокувати брудний коміт. Водночас повільний pre-commit привчає
обходити його через `--no-verify`.

## Decision Drivers

- брудний код не має потрапити навіть у локальну історію;
- коміт має займати секунди;
- hooks мають ставитися автоматично після `npm install`, бо це Windows і без bash-залежностей
  поза Git Bash.

## Considered Options

1. husky + lint-staged (pre-commit: швидке; pre-push: повне)
2. lefthook
3. Усе (`npm run check`) у pre-commit

## Decision

Обрано **husky + lint-staged** з розподілом:

- `pre-commit`: lint-staged (Prettier `--check` + ESLint на staged-файлах) і `typecheck`;
- `pre-push`: `audit:deps`, `test:smoke`, `build`;
- `commit-msg`: Conventional Commits (власний скрипт без додаткових залежностей).

## Pros and Cons of the Options

### husky + lint-staged

- 👍 стандарт екосистеми npm, ставиться через `prepare`
- 👍 lint-staged перевіряє лише змінене, тому коміт швидкий
- 👎 дві залежності; на Windows hooks виконуються через Git Bash

### lefthook

- 👍 один бінарник, паралельний запуск, YAML-конфіг
- 👎 бінарна залежність через postinstall, яка гірше працює за корпоративних проксі
- 👎 менш знайомий, тож налаштування коштуватиме часу

### Усе в pre-commit

- 👍 максимальна суворість
- 👎 build + smoke на кожен коміт — це десятки секунд, а отже мотивація для `--no-verify`

## Consequences

- Позитивні: брудний коміт блокується (див. «Перевірка» в DEFENSE), а push не пропускає
  незібраний код.
- Негативні: порушення меж модулів видно лише на push, а не на коміті.
- Далі: у завданні 4 ті ж команди йдуть у CI (GitHub Actions), бо `--no-verify` обходить
  локальні hooks.
