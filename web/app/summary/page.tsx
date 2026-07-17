'use client';

import { useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { UserUsageSummary } from '@/lib/types';
import { AppShell } from '@/components/app-shell';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';

const formatInstant = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function SummaryPage() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<UserUsageSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    apiRequest<{ summary: UserUsageSummary[] }>('/summary', { token: session.token })
      .then(({ summary }) => setSummary(summary))
      .catch((err: unknown) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load the summary.'),
      );
  }, [session]);

  return (
    <AppShell>
      <section className="space-y-3">
        <h2 className="font-semibold">Usage by user</h2>
        <ErrorAlert message={error} />
        <div className="space-y-3">
          {summary.map((entry) => (
            <details key={entry.user.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{entry.user.name}</span>
                  <RoleBadge role={entry.user.role} />
                </span>
                <span className="text-sm text-slate-600">
                  {entry.totalBookings} booking{entry.totalBookings === 1 ? '' : 's'} · {entry.totalMinutes} min total
                </span>
              </summary>
              <div className="border-t border-slate-100 px-4 py-3">
                {entry.bookings.length === 0 ? (
                  <p className="text-sm text-slate-500">No bookings.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {entry.bookings.map((booking) => (
                      <li key={booking.id}>
                        {formatInstant(booking.startTime)} → {formatInstant(booking.endTime)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
