import { Router } from 'express';
import type { TournamentsService } from './tournaments.service.js';

export const createTournamentsRouter = (service: TournamentsService): Router => {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await service.list());
  });
  router.post('/', async (req, res) => {
    const body = req.body as { name?: string; startsOn?: string };
    res
      .status(201)
      .json(await service.create({ name: body.name ?? '', startsOn: body.startsOn ?? '' }));
  });
  router.get('/:id', async (req, res) => {
    res.json(await service.get(req.params.id));
  });
  router.post('/:id/entries', async (req, res) => {
    const body = req.body as { teamId?: string };
    res.status(201).json(await service.registerTeam(req.params.id, body.teamId ?? ''));
  });
  return router;
};
