import { Router } from 'express';
import { z } from 'zod';
import type { StandingsService } from './standings.service.js';

/** spec-lab2 §4: id не UUID → 400 на будь-якому джерелі. */
const IdParam = z.uuid();

export const createStandingsRouter = (service: StandingsService): Router => {
  const router = Router();
  router.get('/tournaments/:tournamentId/standings', async (req, res) => {
    res.json(await service.getStandings(IdParam.parse(req.params.tournamentId)));
  });
  return router;
};
