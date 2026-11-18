import { Router } from 'express';
import type { TeamsService } from './teams.service.js';

export const createTeamsRouter = (service: TeamsService): Router => {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await service.listTeams());
  });
  router.post('/', async (req, res) => {
    const body = req.body as { name?: string; city?: string };
    res
      .status(201)
      .json(await service.createTeam({ name: body.name ?? '', city: body.city ?? '' }));
  });
  router.get('/:id', async (req, res) => {
    res.json(await service.getTeam(req.params.id));
  });
  router.post('/:id/players', async (req, res) => {
    const body = req.body as { fullName?: string; number?: number };
    res.status(201).json(
      await service.addPlayer(req.params.id, {
        fullName: body.fullName ?? '',
        number: body.number ?? 0,
      }),
    );
  });
  return router;
};
