# EXPLAIN (ANALYZE, BUFFERS) @ `bf49300`

Відтворення: `npm run explain` · PGlite (PostgreSQL 17) · 20 турнірів × 16 команд, половина матчів завершена · після `ANALYZE`

## L1 GET /tournaments/:id/standings — 4 SQL-запитів

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments WHERE id = $1
```
```
Seq Scan on tournaments  (cost=0.00..1.25 rows=1 width=89) (actual time=0.027..0.039 rows=1.00 loops=1)
  Filter: (id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
  Rows Removed by Filter: 19
  Buffers: shared hit=1
Planning Time: 0.067 ms
Execution Time: 0.105 ms
```

```sql
SELECT tournament_id, team_id, registered_at FROM tournament_entries WHERE tournament_id = $1 ORDER BY registered_at, team_id
```
```
Sort  (cost=7.32..7.36 rows=16 width=40) (actual time=0.036..0.040 rows=16.00 loops=1)
  Sort Key: registered_at, team_id
  Sort Method: quicksort  Memory: 17kB
  Buffers: shared hit=3
  ->  Seq Scan on tournament_entries  (cost=0.00..7.00 rows=16 width=40) (actual time=0.006..0.027 rows=16.00 loops=1)
        Filter: (tournament_id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
        Rows Removed by Filter: 304
        Buffers: shared hit=3
Planning Time: 0.042 ms
Execution Time: 0.053 ms
```

```sql
SELECT id, name, city FROM teams WHERE id = ANY($1::uuid[])
```
```
Seq Scan on teams  (cost=0.04..7.84 rows=16 width=22) (actual time=0.007..0.033 rows=16.00 loops=1)
  Filter: (id = ANY ('{d9aa4257-f56e-4ad0-be1e-40dc60447b99,88230a08-626a-4989-97f4-227cf0747433,e64824b5-3c85-4c76-9d28-7b3080bfdee8,27792043-4db2-47a4-91d2-05bf3cb706b8,c682c70d-3d29-4446-a438-5fe90eaecf63,af2792d8-93cc-4265-aa5c-90b7e238a3e1,8317928a-cd22-42af-b4ff-9883677aa3f3,23ed16fa-d184-4fc0-933f-a8fdf7c1a1ab,c5851f9f-5bf8-4422-82db-3e49fd31ad93,e688048a-fc76-46f0-baf6-d4dd11cf2522,e3ac8267-9f81-4fcc-842a-8a8b8d07ffa3,1147eefd-abb9-448d-85a3-b6f5dfa1691d,10a4ec8a-b1d7-424a-b731-a824b75d541b,8d43dfb9-0d48-4755-8207-d58ed8de2aff,30ad0b51-2710-4835-b01a-a35616146e5a,44618565-5da2-4e6e-9542-cd7cf35fcf65}'::uuid[]))
  Rows Removed by Filter: 304
  Buffers: shared hit=3
Planning Time: 0.031 ms
Execution Time: 0.044 ms
```

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE tournament_id = $1 ORDER BY round, id
```
```
Sort  (cost=43.85..44.15 rows=120 width=79) (actual time=0.097..0.126 rows=120.00 loops=1)
  Sort Key: round, id
  Sort Method: quicksort  Memory: 28kB
  Buffers: shared hit=4
  ->  Bitmap Heap Scan on matches  (cost=5.21..39.71 rows=120 width=79) (actual time=0.016..0.048 rows=120.00 loops=1)
        Recheck Cond: (tournament_id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
        Heap Blocks: exact=2
        Buffers: shared hit=4
        ->  Bitmap Index Scan on matches_tournament_idx  (cost=0.00..5.18 rows=120 width=0) (actual time=0.009..0.009 rows=123.00 loops=1)
              Index Cond: (tournament_id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
              Index Searches: 1
              Buffers: shared hit=2
Planning Time: 0.048 ms
Execution Time: 0.164 ms
```

## L2 GET /tournaments/:id/matches — 3 SQL-запитів

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments WHERE id = $1
```
```
Seq Scan on tournaments  (cost=0.00..1.25 rows=1 width=89) (actual time=0.006..0.008 rows=1.00 loops=1)
  Filter: (id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
  Rows Removed by Filter: 19
  Buffers: shared hit=1
Planning Time: 0.026 ms
Execution Time: 0.015 ms
```

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE tournament_id = $1 ORDER BY round, id
```
```
Sort  (cost=43.85..44.15 rows=120 width=79) (actual time=0.091..0.124 rows=120.00 loops=1)
  Sort Key: round, id
  Sort Method: quicksort  Memory: 28kB
  Buffers: shared hit=4
  ->  Bitmap Heap Scan on matches  (cost=5.21..39.71 rows=120 width=79) (actual time=0.011..0.045 rows=120.00 loops=1)
        Recheck Cond: (tournament_id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
        Heap Blocks: exact=2
        Buffers: shared hit=4
        ->  Bitmap Index Scan on matches_tournament_idx  (cost=0.00..5.18 rows=120 width=0) (actual time=0.006..0.006 rows=123.00 loops=1)
              Index Cond: (tournament_id = '6effe7f8-8bb7-4bda-91d3-a86dcb268cf4'::uuid)
              Index Searches: 1
              Buffers: shared hit=2
Planning Time: 0.039 ms
Execution Time: 0.387 ms
```

```sql
SELECT id, name, city FROM teams WHERE id = ANY($1::uuid[])
```
```
Seq Scan on teams  (cost=0.04..7.84 rows=16 width=22) (actual time=0.006..0.031 rows=16.00 loops=1)
  Filter: (id = ANY ('{8317928a-cd22-42af-b4ff-9883677aa3f3,e688048a-fc76-46f0-baf6-d4dd11cf2522,88230a08-626a-4989-97f4-227cf0747433,30ad0b51-2710-4835-b01a-a35616146e5a,27792043-4db2-47a4-91d2-05bf3cb706b8,10a4ec8a-b1d7-424a-b731-a824b75d541b,af2792d8-93cc-4265-aa5c-90b7e238a3e1,e3ac8267-9f81-4fcc-842a-8a8b8d07ffa3,c682c70d-3d29-4446-a438-5fe90eaecf63,1147eefd-abb9-448d-85a3-b6f5dfa1691d,e64824b5-3c85-4c76-9d28-7b3080bfdee8,8d43dfb9-0d48-4755-8207-d58ed8de2aff,d9aa4257-f56e-4ad0-be1e-40dc60447b99,44618565-5da2-4e6e-9542-cd7cf35fcf65,23ed16fa-d184-4fc0-933f-a8fdf7c1a1ab,c5851f9f-5bf8-4422-82db-3e49fd31ad93}'::uuid[]))
  Rows Removed by Filter: 304
  Buffers: shared hit=3
Planning Time: 0.029 ms
Execution Time: 0.041 ms
```

## L3 GET /tournaments — 1 SQL-запитів

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments ORDER BY starts_on DESC
```
```
Sort  (cost=1.73..1.78 rows=20 width=89) (actual time=0.025..0.030 rows=20.00 loops=1)
  Sort Key: ((starts_on)::text) DESC
  Sort Method: quicksort  Memory: 18kB
  Buffers: shared hit=1
  ->  Seq Scan on tournaments  (cost=0.00..1.30 rows=20 width=89) (actual time=0.005..0.013 rows=20.00 loops=1)
        Buffers: shared hit=1
Planning Time: 0.025 ms
Execution Time: 0.043 ms
```

## L4 PUT /matches/:id/result (повтор) — 4 SQL-запитів

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE id = $1
```
```
Index Scan using matches_pkey on matches  (cost=0.28..8.30 rows=1 width=79) (actual time=0.005..0.006 rows=1.00 loops=1)
  Index Cond: (id = '2988ec11-55c0-4944-97cc-15f379412def'::uuid)
  Index Searches: 1
  Buffers: shared hit=3
Planning Time: 0.026 ms
Execution Time: 0.013 ms
```

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments WHERE id = $1
```
```
Seq Scan on tournaments  (cost=0.00..1.25 rows=1 width=89) (actual time=0.007..0.008 rows=1.00 loops=1)
  Filter: (id = '1f847d73-be69-4a4e-aa29-5aff0465a7a7'::uuid)
  Rows Removed by Filter: 19
  Buffers: shared hit=1
Planning Time: 0.025 ms
Execution Time: 0.015 ms
```

```sql
UPDATE matches SET status = 'finished', home_goals = $2, away_goals = $3 WHERE id = $1 AND status = 'scheduled' RETURNING id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals
```
```
Update on matches  (cost=0.28..8.30 rows=1 width=42) (actual time=0.007..0.008 rows=0.00 loops=1)
  Buffers: shared hit=3
  ->  Index Scan using matches_pkey on matches  (cost=0.28..8.30 rows=1 width=42) (actual time=0.006..0.007 rows=0.00 loops=1)
        Index Cond: (id = '2988ec11-55c0-4944-97cc-15f379412def'::uuid)
        Filter: (status = 'scheduled'::text)
        Rows Removed by Filter: 1
        Index Searches: 1
        Buffers: shared hit=3
Planning Time: 0.034 ms
Execution Time: 0.020 ms
```

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE id = $1
```
```
Index Scan using matches_pkey on matches  (cost=0.28..8.30 rows=1 width=79) (actual time=0.005..0.006 rows=1.00 loops=1)
  Index Cond: (id = '2988ec11-55c0-4944-97cc-15f379412def'::uuid)
  Index Searches: 1
  Buffers: shared hit=3
Planning Time: 0.026 ms
Execution Time: 0.013 ms
```
