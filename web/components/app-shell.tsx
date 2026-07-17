'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { RoleBadge } from './role-badge';

const NAV_LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: '/bookings', label: 'Bookings', roles: ['admin', 'owner', 'user'] },
  { href: '/summary', label: 'Usage summary', roles: ['admin', 'owner'] },
  { href: '/users', label: 'Users', roles: ['admin'] },
];

/**
 * Authenticated page frame: nav, current user + role, logout. Redirects to
 * the login screen when no session exists. Links are filtered by role for
 * usability only — the backend independently enforces every permission.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/');
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  }

  const links = NAV_LINKS.filter((link) => link.roles.includes(session.user.role));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <nav className="flex items-center gap-4">
          <span className="text-lg font-bold">Meeting Room</span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${pathname === link.href ? 'font-semibold text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{session.user.name}</span>
          <RoleBadge role={session.user.role} />
          <button
            onClick={() => {
              logout();
              router.replace('/');
            }}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="space-y-6">{children}</main>
    </div>
  );
}
