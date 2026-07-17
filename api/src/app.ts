import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth-routes.js';
import { bookingRouter } from './routes/booking-routes.js';
import { userRouter } from './routes/user-routes.js';
import { summaryRouter } from './routes/summary-routes.js';

export function createApp(): express.Express {
  const app = express();

  // In production the allowed origins must be explicit; reflecting any origin
  // is only acceptable for local development.
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim());
  if (!corsOrigins && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGIN must be set in production (comma-separated list of allowed origins).');
  }
  app.use(cors({ origin: corsOrigins ?? true }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/bookings', authenticate, bookingRouter);
  app.use('/users', authenticate, userRouter);
  app.use('/summary', authenticate, summaryRouter);

  app.use(errorHandler);
  return app;
}
