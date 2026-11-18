# CPU-профіль під L-MIX @ `bf49300` (локально, PGlite у процесі)

Відтворення: `npm run profile -- --label=profile-baseline` · тривалість профілю 28 с (засів даних + 20 с L-MIX) · сирий профіль: `reports/profile/cpu-1795006498385.cpuprofile` (відкривається в Chrome DevTools → Performance)

Увага: PGlite працює в тому самому процесі, тож час БД тут — це CPU, а не очікування.
На стейджі (PostgreSQL по мережі) цей час перетворюється на очікування I/O.

## Частки за категоріями (self-time)

| Категорія | Частка |
| --- | --- |
| БД (PGlite, WASM) | 58.5 % |
| Node.js (ядро) | 20.2 % |
| простій (очікування I/O) | 11.1 % |
| express | 3.8 % |
| код застосунку | 2.3 % |
| інші залежності | 1.4 % |
| GC | 1.4 % |
| рушій V8 / native | 1.3 % |

## Топ-15 функцій (self-time)

| # | Функція — файл:рядок | Частка |
| --- | --- | --- |
| 1 | `bytes — chunk-Y6PULSM7.js:1` | 14 % |
| 2 | `(idle) — (native)` | 11.1 % |
| 3 | `(anonymous) — chunk-Y6PULSM7.js:1` | 3.6 % |
| 4 | `fstat — (native)` | 3.4 % |
| 5 | `writev — (native)` | 2.5 % |
| 6 | `n — chunk-ZSOCVAT7.js:1` | 1.8 % |
| 7 | `h — chunk-ZSOCVAT7.js:1` | 1.8 % |
| 8 | `parse — chunk-Y6PULSM7.js:1` | 1.7 % |
| 9 | `decodeUTF8 — (native)` | 1.6 % |
| 10 | `pt — chunk-Y6PULSM7.js:1` | 1.5 % |
| 11 | `(garbage collector) — (native)` | 1.4 % |
| 12 | `(program) — (native)` | 1.3 % |
| 13 | `(anonymous) — chunk-XZUEO4BZ.js:1` | 1.2 % |
| 14 | `open — (native)` | 1.2 % |
| 15 | `string — chunk-Y6PULSM7.js:1` | 1.1 % |
