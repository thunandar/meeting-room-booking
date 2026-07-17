'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Role, User } from '@/lib/types';
import { AppShell } from '@/components/app-shell';
import { RoleBadge } from '@/components/role-badge';
import { ErrorAlert } from '@/components/error-alert';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { TrashIcon } from '@/components/icons';
import { toast } from '@/lib/toast';

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
      toast(`${name.trim()} created`);
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
    <form onSubmit={handleSubmit} className="card-clean space-y-4 p-5 shadow-soft sm:p-6">
      <div>
        <p className="eyebrow mb-1">Administration</p>
        <h2 className="font-serif text-2xl">Create user</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" required />
        </label>
        <label className="block">
          <span className="field-label">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="field sm:w-32">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
      <ErrorAlert message={error} />
    </form>
  );
}

export default function UsersPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);

  // Admin-only page: anyone else is sent back to bookings. UI gating only —
  // the backend independently rejects non-admin requests with 403.
  const allowed = session?.user.role === 'admin';
  useEffect(() => {
    if (session && !allowed) {
      router.replace('/bookings');
    }
  }, [session, allowed, router]);

  const refresh = useCallback(async () => {
    if (!session || session.user.role !== 'admin') return;
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

  async function handleRoleChange(user: User, role: Role) {
    if (!session) return;
    setRoleSavingId(user.id);
    try {
      await apiRequest(`/users/${user.id}/role`, { method: 'PATCH', token: session.token, body: { role } });
      toast(`${user.name} is now ${role}`);
      await refresh();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : 'Could not change the role.', 'error');
      await refresh(); // revert the select to the server's value
    } finally {
      setRoleSavingId(null);
    }
  }

  async function handleDelete() {
    if (!session || !confirming) return;
    setDeleting(true);
    try {
      await apiRequest(`/users/${confirming.id}`, { method: 'DELETE', token: session.token });
      toast(`${confirming.name} deleted`);
      setConfirming(null);
      await refresh();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : 'Could not delete the user.', 'error');
      setConfirming(null);
    } finally {
      setDeleting(false);
    }
  }

  if (session && !allowed) {
    return null; // redirecting to /bookings
  }

  return (
    <AppShell>
      {session && <CreateUserForm token={session.token} onCreated={refresh} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow mb-1">Team</p>
            <h2 className="font-serif text-2xl">Users</h2>
          </div>
          {users !== null && (
            <span className="text-sm text-ink-mute">
              {users.length} user{users.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <ErrorAlert message={error} />

        {users === null && !error && (
          <ul className="space-y-2.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="card-clean h-16 animate-pulse bg-card" />
            ))}
          </ul>
        )}

        {users !== null && (
          <ul className="space-y-2.5">
            {users.map((user, index) => (
              <li
                key={user.id}
                className="card-clean animate-rise flex flex-wrap items-center justify-between gap-3 px-5 py-4 shadow-soft"
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-accent-soft font-serif text-base text-accent-deep">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{user.name}</span>
                    <RoleBadge role={user.role} />
                    {session?.user.id === user.id && <span className="text-xs text-ink-mute">(you)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                    disabled={roleSavingId === user.id}
                    aria-label={`Role for ${user.name}`}
                    className="field w-28 py-1.5 text-sm disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setConfirming(user)}
                    disabled={session?.user.id === user.id}
                    className="btn-danger-outline"
                    title={session?.user.id === user.id ? 'You cannot delete yourself' : undefined}
                  >
                    <TrashIcon size={14} /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title={`Delete ${confirming.name}?`}
          message={
            <>
              <strong>{confirming.name}</strong> will be removed permanently, along with all of their bookings. This
              cannot be undone.
            </>
          }
          confirmLabel="Delete user"
          busyLabel="Deleting…"
          busy={deleting}
          onCancel={() => setConfirming(null)}
          onConfirm={handleDelete}
        />
      )}
    </AppShell>
  );
}
