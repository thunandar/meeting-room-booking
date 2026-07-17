import { Router } from 'express';
import { requireActor } from '../middleware/authenticate.js';
import { ApiError } from '../errors.js';
import { canManageUsers } from '../domain/permissions.js';
import { createUserSchema, updateUserRoleSchema } from '../schemas.js';
import * as userService from '../services/user-service.js';

export const userRouter = Router();

userRouter.use((req, _res, next) => {
  const actor = requireActor(req);
  if (!canManageUsers(actor)) {
    throw ApiError.forbidden('Only admins can manage users.');
  }
  next();
});

userRouter.get('/', async (_req, res) => {
  const users = await userService.listUsers();
  res.json({ users });
});

userRouter.post('/', async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const user = await userService.createUser(input);
  res.status(201).json({ user });
});

userRouter.patch('/:id/role', async (req, res) => {
  const { role } = updateUserRoleSchema.parse(req.body);
  const user = await userService.updateUserRole(req.params.id, role);
  res.json({ user });
});

userRouter.delete('/:id', async (req, res) => {
  await userService.deleteUser(req.params.id);
  res.status(204).end();
});
