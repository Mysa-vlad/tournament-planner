import { Router } from 'express';
import { z } from 'zod';

import type { MatchesService } from './matches.service.js';

/** spec-lab2 §4: id не UUID → 400 на будь-якому джерелі (а не 500 від Postgres). */
const IdParam = z.uuid();

const Goals = z.number().int().min(0).max(99);
const ResultBody = z.object({ homeGoals: Goals, awayGoals: Goals });

export const createMatchesRouter = (service: MatchesService): Router => {
  const router = Router();
  router.post('/tournaments/:tournamentId/start', async (req, res) => {
    const { matches, created } = await service.startTournament(
      IdParam.parse(req.params.tournamentId),
    );
    res.status(created ? 201 : 200).json(matches);
  });
  router.get('/tournaments/:tournamentId/matches', async (req, res) => {
    res.json(await service.getSchedule(IdParam.parse(req.params.tournamentId)));
  });
  router.put('/matches/:id/result', async (req, res) => {
    const { homeGoals, awayGoals } = ResultBody.parse(req.body);
    res.json(await service.recordResult(IdParam.parse(req.params.id), homeGoals, awayGoals));
  });
  return router;
};
