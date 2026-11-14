import { Router } from 'express';
import { z } from 'zod';
import type { TeamsService } from './teams.service.js';

// HTTP-рівень: лише форма запиту/відповіді; бізнес-правила — у сервісі (spec-lab2 D6).
const CreateTeamBody = z.object({
  name: z.string().trim().min(1).max(100),
  city: z.string().trim().max(100).default(''),
});
const AddPlayerBody = z.object({
  fullName: z.string().trim().min(1).max(100),
  number: z.number().int().min(1).max(99),
});

export const createTeamsRouter = (service: TeamsService): Router => {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await service.listTeams());
  });
  router.post('/', async (req, res) => {
    res.status(201).json(await service.createTeam(CreateTeamBody.parse(req.body)));
  });
  router.get('/:id', async (req, res) => {
    res.json(await service.getTeam(req.params.id));
  });
  router.get('/:id/players', async (req, res) => {
    res.json(await service.listPlayers(req.params.id));
  });
  router.post('/:id/players', async (req, res) => {
    res.status(201).json(await service.addPlayer(req.params.id, AddPlayerBody.parse(req.body)));
  });
  return router;
};
