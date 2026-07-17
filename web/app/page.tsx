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
  const [users, setUsers] = useState<User[]>([]);
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
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold">Meeting Room Booking</h1>
      <p className="mb-6 text-sm text-slate-600">Choose a user to log in as. Their role decides what they can do.</p>
      <ErrorAlert message={error} />
      <ul className="mt-4 space-y-2">
        {users.map((user) => (
          <li key={user.id}>
            <button
              onClick={() => handleLogin(user.id)}
              disabled={pendingUserId !== null}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-blue-400 disabled:opacity-50"
            >
              <span className="font-medium">{user.name}</span>
              <span className="flex items-center gap-2">
                {pendingUserId === user.id && <span className="text-xs text-slate-500">Signing in…</span>}
                <RoleBadge role={user.role} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
