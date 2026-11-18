# Навантаження: staging-baseline @ `65b30f3`

Ціль: https://tournament-planner-staging.onrender.com · версія 0.1.0 · SHA `65b30f3dd7e0ef412e9d0b087e52bc2114f8fd14`
autocannon: 10 з'єднань × 20 с × 3 повтори · дані: 20 турнірів × 16 команд
Відтворення: `npm run load -- https://tournament-planner-staging.onrender.com --label=staging-baseline`

Медіана за повторами; латентність у мс (з часу кожного запиту); розкид — min–max p99 між повторами.

| Сценарій | p50 | p95 | p99 | розкид p99 | RPS | помилки | event loop p99 | RSS, МБ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | 117.2 | 285.6 | 398 | 387.9–579.1 | 66 | 0 | n/a | n/a |
| L2 | 120.3 | 315.4 | 425.8 | 409.8–514.5 | 62 | 0 | n/a | n/a |
| L3 | 71.3 | 101.5 | 179.6 | 158.7–191.3 | 132 | 0 | n/a | n/a |
| LMIX | 109.2 | 216.8 | 388.9 | 386–399.6 | 75 | 0 | n/a | n/a |
