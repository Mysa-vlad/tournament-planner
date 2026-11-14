import { Router } from 'express';
import { z } from 'zod';
import type { MatchesService } from './matches.service.js';

const Goals = z.number().int().min(0).max(99);
const ResultBody = z.object({ homeGoals: Goals, awayGoals: Goals });

export const createMatchesRouter = (service: MatchesService): Router => {
  const router = Router();
  router.post('/tournaments/:tournamentId/start', async (req, res) => {
    const { matches, created } = await service.startTournament(req.params.tournamentId);
    res.status(created ? 201 : 200).json(matches);
  });
  router.get('/tournaments/:tournamentId/matches', async (req, res) => {
    res.json(await service.getSchedule(req.params.tournamentId));
  });
  router.put('/matches/:id/result', async (req, res) => {
    const { homeGoals, awayGoals } = ResultBody.parse(req.body);
    res.json(await service.recordResult(req.params.id, homeGoals, awayGoals));
  });
  return router;
};
