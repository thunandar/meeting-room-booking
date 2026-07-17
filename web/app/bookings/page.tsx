'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Booking } from '@/lib/types';
import { AppShell } from '@/components/app-shell';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CalendarIcon, TrashIcon } from '@/components/icons';
import { toast } from '@/lib/toast';

const formatInstant = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatDuration = (startIso: string, endIso: string): string => {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

interface ConflictDetails {
  conflictingBooking?: { startTime: string; endTime: string; bookedBy: string };
}

/** Turns a 409 overlap into a message naming the exact conflicting booking. */
function describeBookingError(err: ApiRequestError, currentUserName: string): string {
  const conflict = (err.details as ConflictDetails | undefined)?.conflictingBooking;
  if (err.code === 'BOOKING_OVERLAP' && conflict) {
    const whose = conflict.bookedBy === currentUserName ? 'your' : `${conflict.bookedBy}'s`;
    return `${err.message} Conflicts with ${whose} booking, ${formatInstant(conflict.startTime)} → ${formatInstant(conflict.endTime)}.`;
  }
  return err.message;
}

function CreateBookingForm({
  token,
  userName,
  onCreated,
}: {
  token: string;
  userName: string;
  onCreated: () => void;
}) {
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
      toast(`Room booked · ${formatInstant(new Date(startTime).toISOString())}`);
      setStartTime('');
      setEndTime('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? describeBookingError(err, userName) : 'Could not create the booking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-clean space-y-4 p-5 shadow-soft sm:p-6">
      <div>
        <p className="eyebrow mb-1">New booking</p>
        <h2 className="font-serif text-2xl">Book the room</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Start</span>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="field"
            required
          />
        </label>
        <label className="block">
          <span className="field-label">End</span>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="field"
            required
          />
        </label>
      </div>
      <ErrorAlert message={error} />
      <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
        {submitting ? 'Booking…' : 'Create booking'}
      </button>
    </form>
  );
}

export default function BookingsPage() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!session || !confirming) return;
    setDeleting(true);
    try {
      await apiRequest(`/bookings/${confirming.id}`, { method: 'DELETE', token: session.token });
      toast('Booking deleted');
      setConfirming(null);
      await refresh();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : 'Could not delete the booking.', 'error');
      setConfirming(null);
    } finally {
      setDeleting(false);
    }
  }

  const canDelete = (booking: Booking): boolean =>
    session !== null &&
    (session.user.role === 'admin' || session.user.role === 'owner' || booking.userId === session.user.id);

  const now = Date.now();

  return (
    <AppShell>
      {session && <CreateBookingForm token={session.token} userName={session.user.name} onCreated={refresh} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow mb-1">Schedule</p>
            <h2 className="font-serif text-2xl">All bookings</h2>
          </div>
          {bookings !== null && bookings.length > 0 && (
            <span className="text-sm text-ink-mute">
              {bookings.length} booking{bookings.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <ErrorAlert message={error} />

        {bookings === null && !error && (
          <ul className="space-y-2.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="card-clean h-18 animate-pulse bg-card" />
            ))}
          </ul>
        )}

        {bookings !== null && bookings.length === 0 && (
          <div className="card-clean flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent-deep">
              <CalendarIcon size={20} />
            </span>
            <p className="text-sm text-ink-mute">No bookings yet — the room is all yours.</p>
          </div>
        )}

        {bookings !== null && bookings.length > 0 && (
          <ul className="space-y-2.5">
            {bookings.map((booking, index) => {
              const past = new Date(booking.endTime).getTime() < now;
              return (
                <li
                  key={booking.id}
                  className={`card-clean animate-rise flex flex-wrap items-center justify-between gap-3 px-5 py-4 shadow-soft ${past ? 'opacity-60' : ''}`}
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatInstant(booking.startTime)} <span className="text-ink-mute">→</span>{' '}
                      {formatInstant(booking.endTime)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
                      <span className="rounded-full border border-line-soft bg-card px-2 py-0.5">
                        {formatDuration(booking.startTime, booking.endTime)}
                      </span>
                      {past && <span className="rounded-full bg-warm-soft px-2 py-0.5 text-warm-deep">Past</span>}
                      <span>Booked by {booking.userId === session?.user.id ? 'you' : booking.user.name}</span>
                      <RoleBadge role={booking.user.role} />
                    </p>
                  </div>
                  {canDelete(booking) && (
                    <button onClick={() => setConfirming(booking)} className="btn-danger-outline">
                      <TrashIcon size={14} /> Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title="Delete this booking?"
          message={
            <>
              <strong>{formatInstant(confirming.startTime)}</strong> → <strong>{formatInstant(confirming.endTime)}</strong>
              , booked by {confirming.userId === session?.user.id ? 'you' : confirming.user.name}. This cannot be
              undone.
            </>
          }
          confirmLabel="Delete booking"
          busyLabel="Deleting…"
          busy={deleting}
          onCancel={() => setConfirming(null)}
          onConfirm={handleDelete}
        />
      )}
    </AppShell>
  );
}
