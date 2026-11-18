# CPU-профіль під L-MIX @ `e442976` (локально, PGlite у процесі)

Відтворення: `npm run profile -- --label=profile-after` · тривалість профілю 28 с (засів даних + 20 с L-MIX) · сирий профіль: `reports/profile/cpu-1795008652139.cpuprofile` (відкривається в Chrome DevTools → Performance)

Увага: PGlite працює в тому самому процесі, тож час БД тут — це CPU, а не очікування.
На стейджі (PostgreSQL по мережі) цей час перетворюється на очікування I/O.

## Частки за категоріями (self-time)

| Категорія | Частка |
| --- | --- |
| БД (PGlite, WASM) | 50.7 % |
| Node.js (ядро) | 23.6 % |
| простій (очікування I/O) | 12.4 % |
| express | 6.3 % |
| інші залежності | 2.1 % |
| код застосунку | 2 % |
| GC | 1.4 % |
| рушій V8 / native | 1.2 % |
| інше | 0.2 % |
| логер | 0 % |

## Топ-15 функцій (self-time)

| # | Функція — файл:рядок | Частка |
| --- | --- | --- |
| 1 | `(idle) — (native)` | 12.4 % |
| 2 | `bytes — chunk-Y6PULSM7.js:1` | 11.4 % |
| 3 | `writev — (native)` | 3.9 % |
| 4 | `fstat — (native)` | 3.2 % |
| 5 | `(anonymous) — chunk-Y6PULSM7.js:1` | 2.8 % |
| 6 | `stringify — response.js:1026` | 1.8 % |
| 7 | `parse — chunk-Y6PULSM7.js:1` | 1.7 % |
| 8 | `h — chunk-ZSOCVAT7.js:1` | 1.5 % |
| 9 | `n — chunk-ZSOCVAT7.js:1` | 1.5 % |
| 10 | `(garbage collector) — (native)` | 1.4 % |
| 11 | `(program) — (native)` | 1.2 % |
| 12 | `decodeUTF8 — (native)` | 1.2 % |
| 13 | `(anonymous) — chunk-XZUEO4BZ.js:1` | 1.1 % |
| 14 | `pt — chunk-Y6PULSM7.js:1` | 1.1 % |
| 15 | `open — (native)` | 1 % |
