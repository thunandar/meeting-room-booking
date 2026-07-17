'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';

export default function LoginPage() {
  const { session, loading, login } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      router.replace('/bookings');
    }
  }, [loading, session, router]);

  useEffect(() => {
    apiRequest<{ users: User[] }>('/auth/users')
      .then(({ users }) => setUsers(users))
      .catch((err: unknown) =>
        setError(err instanceof ApiRequestError ? err.message : 'Could not reach the API. Is the backend running?'),
      );
  }, []);

  async function handleLogin(userId: string) {
    setError(null);
    setPendingUserId(userId);
    try {
      await login(userId);
      router.replace('/bookings');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Login failed.');
      setPendingUserId(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <p className="eyebrow mb-2">Meeting room booking</p>
      <h1 className="font-serif text-4xl tracking-tight">Welcome back</h1>
      <p className="mt-2 mb-8 text-sm text-ink-soft">
        Choose a user to sign in as — their role decides what they can do.
      </p>

      <ErrorAlert message={error} />

      {users === null && !error && (
        <ul className="mt-4 space-y-2.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="card-clean h-16 animate-pulse bg-card" />
          ))}
        </ul>
      )}

      {users !== null && (
        <ul className="mt-4 space-y-2.5">
          {users.map((user, index) => (
            <li key={user.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
              <button
                onClick={() => handleLogin(user.id)}
                disabled={pendingUserId !== null}
                className="card-clean flex w-full items-center justify-between px-5 py-4 text-left shadow-soft transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-ink-mute disabled:opacity-50"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-accent-soft font-serif text-base text-accent-deep">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{user.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  {pendingUserId === user.id && <span className="text-xs text-ink-mute">Signing in…</span>}
                  <RoleBadge role={user.role} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-xs text-ink-mute">
        Demo login — pick any user. Permissions are enforced by the API on every request.
      </p>
    </div>
  );
}
