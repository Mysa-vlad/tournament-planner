# Навантаження: staging-after-rerun @ `195cda8`

Ціль: https://tournament-planner-staging.onrender.com · версія 0.1.0 · SHA `195cda8b2da776fa8e7402a52d7262551c1acef4`
autocannon: 10 з'єднань × 20 с × 3 повтори · дані: 20 турнірів × 16 команд
Відтворення: `npm run load -- https://tournament-planner-staging.onrender.com --label=staging-after-rerun`

Медіана за повторами; латентність у мс (з часу кожного запиту); розкид — min–max p99 між повторами.

| Сценарій | p50 | p95 | p99 | розкид p99 | RPS | помилки | event loop p99 | RSS, МБ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L2 | 181.1 | 311.7 | 405 | 400.2–603 | 58 | 0 | 101.8 | 86.7 |
| L3 | 66.7 | 104.6 | 235.8 | 202–270.5 | 134 | 0 | 40.2 | 86.2 |
