import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../errors.js';
import { loginSchema } from '../schemas.js';

/**
 * Pre-auth endpoints for the "log in as a user" flow the assignment requires.
 * Exposing the user list here (id/name/role only) is a deliberate exception
 * to the admin-only user listing rule — the login picker needs it before a
 * session exists. Everything else in the API sits behind authenticate().
 */
export const authRouter = Router();

authRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});

authRouter.post('/login', async (req, res) => {
  const { userId } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    throw ApiError.unauthorized('Unknown user.');
  }
  res.json({ token: user.id, user });
});
