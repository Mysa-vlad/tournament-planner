# EXPLAIN (ANALYZE, BUFFERS) @ `e442976`

Відтворення: `npm run explain` · PGlite (PostgreSQL 17) · 20 турнірів × 16 команд, половина матчів завершена · після `ANALYZE`

## L1 GET /tournaments/:id/standings — 1 SQL-запитів

```sql
SELECT (SELECT coalesce(json_agg(json_build_object('id', tm.id, 'name', tm.name)), '[]'::json) FROM tournament_entries e JOIN teams tm ON tm.id = e.team_id WHERE e.tournament_id = t.id) AS teams, (SELECT coalesce(json_agg(json_build_object( 'homeTeamId', m.home_team_id, 'awayTeamId', m.away_team_id, 'homeGoals', m.home_goals, 'awayGoals', m.away_goals)), '[]'::json) FROM matches m WHERE m.tournament_id = t.id AND m.status = 'finished') AS results FROM tournaments t WHERE t.id = $1
```
```
Seq Scan on tournaments t  (cost=0.00..55.90 rows=1 width=64) (actual time=0.507..0.513 rows=1.00 loops=1)
  Filter: (id = '432fa854-23c6-4647-80ce-3cfedcdf5952'::uuid)
  Rows Removed by Filter: 19
  Buffers: shared hit=11
  SubPlan 1
    ->  Aggregate  (cost=14.33..14.34 rows=1 width=32) (actual time=0.291..0.294 rows=1.00 loops=1)
          Buffers: shared hit=6
          ->  Hash Join  (cost=7.20..14.25 rows=16 width=21) (actual time=0.082..0.259 rows=16.00 loops=1)
                Hash Cond: (tm.id = e.team_id)
                Buffers: shared hit=6
                ->  Seq Scan on teams tm  (cost=0.00..6.20 rows=320 width=21) (actual time=0.021..0.102 rows=320.00 loops=1)
                      Buffers: shared hit=3
                ->  Hash  (cost=7.00..7.00 rows=16 width=16) (actual time=0.042..0.043 rows=16.00 loops=1)
                      Buckets: 1024  Batches: 1  Memory Usage: 5kB
                      Buffers: shared hit=3
                      ->  Seq Scan on tournament_entries e  (cost=0.00..7.00 rows=16 width=16) (actual time=0.009..0.031 rows=16.00 loops=1)
                            Filter: (tournament_id = t.id)
                            Rows Removed by Filter: 304
                            Buffers: shared hit=3
  SubPlan 2
    ->  Aggregate  (cost=40.30..40.31 rows=1 width=32) (actual time=0.181..0.183 rows=1.00 loops=1)
          Buffers: shared hit=4
          ->  Bitmap Heap Scan on matches m  (cost=5.20..39.99 rows=60 width=36) (actual time=0.017..0.049 rows=60.00 loops=1)
                Recheck Cond: (tournament_id = t.id)
                Filter: (status = 'finished'::text)
                Rows Removed by Filter: 60
                Heap Blocks: exact=2
                Buffers: shared hit=4
                ->  Bitmap Index Scan on matches_tournament_idx  (cost=0.00..5.18 rows=120 width=0) (actual time=0.009..0.009 rows=123.00 loops=1)
                      Index Cond: (tournament_id = t.id)
                      Index Searches: 1
                      Buffers: shared hit=2
Planning:
  Buffers: shared hit=6
Planning Time: 0.253 ms
Execution Time: 0.606 ms
```

## L2 GET /tournaments/:id/matches — 3 SQL-запитів

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments WHERE id = $1
```
```
Seq Scan on tournaments  (cost=0.00..1.25 rows=1 width=89) (actual time=0.007..0.009 rows=1.00 loops=1)
  Filter: (id = '432fa854-23c6-4647-80ce-3cfedcdf5952'::uuid)
  Rows Removed by Filter: 19
  Buffers: shared hit=1
Planning Time: 0.029 ms
Execution Time: 0.017 ms
```

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE tournament_id = $1 ORDER BY round, id
```
```
Sort  (cost=43.85..44.15 rows=120 width=79) (actual time=0.295..0.320 rows=120.00 loops=1)
  Sort Key: round, id
  Sort Method: quicksort  Memory: 28kB
  Buffers: shared hit=4
  ->  Bitmap Heap Scan on matches  (cost=5.21..39.71 rows=120 width=79) (actual time=0.013..0.245 rows=120.00 loops=1)
        Recheck Cond: (tournament_id = '432fa854-23c6-4647-80ce-3cfedcdf5952'::uuid)
        Heap Blocks: exact=2
        Buffers: shared hit=4
        ->  Bitmap Index Scan on matches_tournament_idx  (cost=0.00..5.18 rows=120 width=0) (actual time=0.007..0.007 rows=123.00 loops=1)
              Index Cond: (tournament_id = '432fa854-23c6-4647-80ce-3cfedcdf5952'::uuid)
              Index Searches: 1
              Buffers: shared hit=2
Planning Time: 0.043 ms
Execution Time: 0.354 ms
```

```sql
SELECT id, name, city FROM teams WHERE id = ANY($1::uuid[])
```
```
Seq Scan on teams  (cost=0.04..7.84 rows=16 width=22) (actual time=0.017..0.043 rows=16.00 loops=1)
  Filter: (id = ANY ('{2f3e570a-91ca-4195-a1d1-d764b1a816be,138ea7b6-3a92-4ef7-84d7-2cb279279786,a9708549-177b-4253-9155-81635b6507e7,37e6c57e-73f7-4c80-b308-94bdd7333dae,d74ea3ff-565a-4999-944f-da2702c5f94f,b86c0d6c-7572-4653-ba5d-65b73a232c6c,fc35f896-e897-4dd0-a352-f4ea0c18dd25,936befac-e41f-4c09-8ff2-38213aafdd51,af69ed6a-7a05-4197-86c6-b4b74241c945,b136a36e-e753-42c6-827b-ab88657a8a9a,692ed85f-4c12-487f-93d7-88d8855b663f,11847304-1e1c-4edc-93db-e4d72badb910,03c75d0c-105f-4577-a423-903ce8e14f0f,179c1303-f718-4b6f-8f9b-b068a10b7838,453d3d9a-8a0a-4a1b-b423-6f23585a1c6f,e4180c04-4e9e-420b-ad75-e7e53eb6d0a6}'::uuid[]))
  Rows Removed by Filter: 304
  Buffers: shared hit=3
Planning Time: 0.032 ms
Execution Time: 0.054 ms
```

## L3 GET /tournaments — 1 SQL-запитів

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments ORDER BY starts_on DESC
```
```
Sort  (cost=1.73..1.78 rows=20 width=89) (actual time=0.026..0.032 rows=20.00 loops=1)
  Sort Key: ((starts_on)::text) DESC
  Sort Method: quicksort  Memory: 18kB
  Buffers: shared hit=1
  ->  Seq Scan on tournaments  (cost=0.00..1.30 rows=20 width=89) (actual time=0.006..0.013 rows=20.00 loops=1)
        Buffers: shared hit=1
Planning Time: 0.030 ms
Execution Time: 0.045 ms
```

## L4 PUT /matches/:id/result (повтор) — 4 SQL-запитів

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE id = $1
```
```
Index Scan using matches_pkey on matches  (cost=0.28..8.30 rows=1 width=79) (actual time=0.005..0.007 rows=1.00 loops=1)
  Index Cond: (id = 'dc40e917-e1da-4711-b787-97b0ac39cd1f'::uuid)
  Index Searches: 1
  Buffers: shared hit=3
Planning Time: 0.028 ms
Execution Time: 0.014 ms
```

```sql
SELECT id, name, status, starts_on::text AS starts_on, organizer_id FROM tournaments WHERE id = $1
```
```
Seq Scan on tournaments  (cost=0.00..1.25 rows=1 width=89) (actual time=0.007..0.008 rows=1.00 loops=1)
  Filter: (id = '271c89d5-5d28-4054-8ba5-3dc765bbf3f5'::uuid)
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
  ->  Index Scan using matches_pkey on matches  (cost=0.28..8.30 rows=1 width=42) (actual time=0.006..0.006 rows=0.00 loops=1)
        Index Cond: (id = 'dc40e917-e1da-4711-b787-97b0ac39cd1f'::uuid)
        Filter: (status = 'scheduled'::text)
        Rows Removed by Filter: 1
        Index Searches: 1
        Buffers: shared hit=3
Planning Time: 0.033 ms
Execution Time: 0.019 ms
```

```sql
SELECT id, tournament_id, round, home_team_id, away_team_id, status, home_goals, away_goals FROM matches WHERE id = $1
```
```
Index Scan using matches_pkey on matches  (cost=0.28..8.30 rows=1 width=79) (actual time=0.005..0.006 rows=1.00 loops=1)
  Index Cond: (id = 'dc40e917-e1da-4711-b787-97b0ac39cd1f'::uuid)
  Index Searches: 1
  Buffers: shared hit=3
Planning Time: 0.026 ms
Execution Time: 0.012 ms
```
