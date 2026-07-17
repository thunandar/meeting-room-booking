'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { UserUsageSummary } from '@/lib/types';
import { AppShell } from '@/components/app-shell';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';
import { CalendarIcon, ClockIcon, UsersIcon } from '@/components/icons';

const formatInstant = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-clean flex items-center gap-4 p-5 shadow-soft">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-deep">
        {icon}
      </span>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="font-serif text-3xl leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function SummaryPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<UserUsageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Owner/admin page: regular users are sent back to bookings. UI gating
  // only — the backend independently rejects them with 403.
  const allowed = session?.user.role === 'admin' || session?.user.role === 'owner';
  useEffect(() => {
    if (session && !allowed) {
      router.replace('/bookings');
    }
  }, [session, allowed, router]);

  useEffect(() => {
    if (!session || !(session.user.role === 'admin' || session.user.role === 'owner')) return;
    apiRequest<{ summary: UserUsageSummary[] }>('/summary', { token: session.token })
      .then(({ summary }) => setSummary(summary))
      .catch((err: unknown) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not load the summary.'),
      );
  }, [session]);

  if (session && !allowed) {
    return null; // redirecting to /bookings
  }

  const totalBookings = summary?.reduce((sum, entry) => sum + entry.totalBookings, 0) ?? 0;
  const totalMinutes = summary?.reduce((sum, entry) => sum + entry.totalMinutes, 0) ?? 0;

  return (
    <AppShell>
      <section className="space-y-4">
        <div>
          <p className="eyebrow mb-1">Insights</p>
          <h2 className="font-serif text-2xl">Usage summary</h2>
        </div>

        <ErrorAlert message={error} />

        {summary === null && !error && (
          <div className="space-y-3" aria-hidden>
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card-clean h-20 animate-pulse bg-card" />
              ))}
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="card-clean h-16 animate-pulse bg-card" />
            ))}
          </div>
        )}

        {summary !== null && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi icon={<CalendarIcon size={18} />} label="Bookings" value={String(totalBookings)} />
              <Kpi icon={<ClockIcon size={18} />} label="Room time" value={formatMinutes(totalMinutes)} />
              <Kpi icon={<UsersIcon size={18} />} label="Users" value={String(summary.length)} />
            </div>

            <div className="space-y-2.5">
              {summary.map((entry, index) => (
                <details
                  key={entry.user.id}
                  className="card-clean group animate-rise shadow-soft"
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                >
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-accent-soft font-serif text-base text-accent-deep">
                        {entry.user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium">{entry.user.name}</span>
                      <RoleBadge role={entry.user.role} />
                    </span>
                    <span className="text-sm text-ink-mute">
                      {entry.totalBookings} booking{entry.totalBookings === 1 ? '' : 's'} ·{' '}
                      {formatMinutes(entry.totalMinutes)}
                      <span className="ml-2 inline-block transition-transform group-open:rotate-180">⌄</span>
                    </span>
                  </summary>
                  <div className="border-t border-line-soft px-5 py-4">
                    {entry.bookings.length === 0 ? (
                      <p className="text-sm text-ink-mute">No bookings.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {entry.bookings.map((booking) => (
                          <li key={booking.id} className="flex flex-wrap items-center gap-2 text-ink-soft">
                            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                            {formatInstant(booking.startTime)} <span className="text-ink-mute">→</span>{' '}
                            {formatInstant(booking.endTime)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
