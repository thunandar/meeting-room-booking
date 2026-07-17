'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Role, User } from '@/lib/types';
import { AppShell } from '@/components/app-shell';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';

const ROLES: Role[] = ['user', 'owner', 'admin'];

function CreateUserForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/users', { method: 'POST', token, body: { name, role } });
      setName('');
      setRole('user');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create the user.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Create user</h2>
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
      <ErrorAlert message={error} />
    </form>
  );
}

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const { users } = await apiRequest<{ users: User[] }>('/users', { token: session.token });
      setUsers(users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load users.');
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRoleChange(userId: string, role: Role) {
    if (!session) return;
    try {
      await apiRequest(`/users/${userId}/role`, { method: 'PATCH', token: session.token, body: { role } });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not change the role.');
    }
  }

  async function handleDelete(user: User) {
    if (!session) return;
    if (!window.confirm(`Delete ${user.name}? Their bookings will be deleted too.`)) {
      return;
    }
    try {
      await apiRequest(`/users/${user.id}`, { method: 'DELETE', token: session.token });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete the user.');
    }
  }

  if (session && session.user.role !== 'admin') {
    return (
      <AppShell>
        <ErrorAlert message="Only admins can manage users." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {session && <CreateUserForm token={session.token} onCreated={refresh} />}
      <section className="space-y-3">
        <h2 className="font-semibold">Users</h2>
        <ErrorAlert message={error} />
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.name}</span>
                <RoleBadge role={user.role} />
                {session?.user.id === user.id && <span className="text-xs text-slate-500">(you)</span>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(user)}
                  disabled={session?.user.id === user.id}
                  className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
