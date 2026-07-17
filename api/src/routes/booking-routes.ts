import { Router } from 'express';
import { requireActor } from '../middleware/authenticate.js';
import { createBookingSchema } from '../schemas.js';
import * as bookingService from '../services/booking-service.js';

export const bookingRouter = Router();

bookingRouter.get('/', async (_req, res) => {
  const bookings = await bookingService.listBookings();
  res.json({ bookings });
});

bookingRouter.post('/', async (req, res) => {
  const actor = requireActor(req);
  const range = createBookingSchema.parse(req.body);
  const booking = await bookingService.createBooking(actor, range);
  res.status(201).json({ booking });
});

bookingRouter.delete('/:id', async (req, res) => {
  const actor = requireActor(req);
  await bookingService.deleteBooking(actor, req.params.id);
  res.status(204).end();
});
