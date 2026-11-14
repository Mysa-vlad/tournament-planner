import { Router } from 'express';
import { z } from 'zod';
import type { TournamentsService } from './tournaments.service.js';

const CreateTournamentBody = z.object({
  name: z.string().trim().min(1).max(100),
  startsOn: z.iso.date(),
});
const RegisterTeamBody = z.object({ teamId: z.uuid() });

export const createTournamentsRouter = (service: TournamentsService): Router => {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await service.list());
  });
  router.post('/', async (req, res) => {
    res.status(201).json(await service.create(CreateTournamentBody.parse(req.body)));
  });
  router.get('/:id', async (req, res) => {
    res.json(await service.get(req.params.id));
  });
  router.post('/:id/entries', async (req, res) => {
    const { teamId } = RegisterTeamBody.parse(req.body);
    const { entry, created } = await service.registerTeam(req.params.id, teamId);
    res.status(created ? 201 : 200).json(entry);
  });
  return router;
};
