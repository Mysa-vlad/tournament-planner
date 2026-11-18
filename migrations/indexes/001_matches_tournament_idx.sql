-- Крок "indexes" (spec-lab4 §4): окремо від структури, без транзакції.
-- CONCURRENTLY не блокує записи в matches під час побудови (на великій таблиці — довго),
-- тому цей крок не можна виконувати на старті застосунку з таймаутом.
CREATE INDEX CONCURRENTLY IF NOT EXISTS matches_tournament_idx ON matches (tournament_id, round);
