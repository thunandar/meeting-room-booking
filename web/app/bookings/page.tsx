'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Booking } from '@/lib/types';
import { AppShell } from '@/components/app-shell';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';

const formatInstant = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function CreateBookingForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!startTime || !endTime) {
      setError('Please pick both a start and an end time.');
      return;
    }
    setSubmitting(true);
    try {
      // datetime-local values are in the browser's local timezone;
      // toISOString() converts them to the UTC instants the API expects.
      await apiRequest('/bookings', {
        method: 'POST',
        token,
        body: { startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString() },
      });
      setStartTime('');
      setEndTime('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create the booking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Book the room</h2>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Start</span>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">End</span>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
            required
          />
        </label>
      </div>
      <ErrorAlert message={error} />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Booking…' : 'Create booking'}
      </button>
    </form>
  );
}

export default function BookingsPage() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const { bookings } = await apiRequest<{ bookings: Booking[] }>('/bookings', { token: session.token });
      setBookings(bookings);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load bookings.');
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(bookingId: string) {
    if (!session) return;
    try {
      await apiRequest(`/bookings/${bookingId}`, { method: 'DELETE', token: session.token });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete the booking.');
    }
  }

  const canDelete = (booking: Booking): boolean =>
    session !== null &&
    (session.user.role === 'admin' || session.user.role === 'owner' || booking.userId === session.user.id);

  return (
    <AppShell>
      {session && <CreateBookingForm token={session.token} onCreated={refresh} />}
      <section className="space-y-3">
        <h2 className="font-semibold">All bookings</h2>
        <ErrorAlert message={error} />
        {bookings.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings yet — the room is free.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatInstant(booking.startTime)} → {formatInstant(booking.endTime)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    Booked by {booking.user.name} <RoleBadge role={booking.user.role} />
                  </p>
                </div>
                {canDelete(booking) && (
                  <button
                    onClick={() => handleDelete(booking.id)}
                    className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
