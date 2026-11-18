import { Router } from 'express';
import type { StandingsService } from './standings.service.js';

export const createStandingsRouter = (service: StandingsService): Router => {
  const router = Router();
  router.get('/tournaments/:tournamentId/standings', async (req, res) => {
    res.json(await service.getStandings(req.params.tournamentId));
  });
  return router;
};
