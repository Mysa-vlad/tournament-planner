import { Router } from 'express';
import type { MatchesService } from './matches.service.js';

export const createMatchesRouter = (service: MatchesService): Router => {
  const router = Router();
  router.post('/tournaments/:tournamentId/start', async (req, res) => {
    res.status(201).json(await service.startTournament(req.params.tournamentId));
  });
  router.get('/tournaments/:tournamentId/matches', async (req, res) => {
    res.json(await service.getSchedule(req.params.tournamentId));
  });
  router.put('/matches/:id/result', async (req, res) => {
    const body = req.body as { homeGoals?: number; awayGoals?: number };
    res.json(await service.recordResult(req.params.id, body.homeGoals ?? -1, body.awayGoals ?? -1));
  });
  return router;
};
