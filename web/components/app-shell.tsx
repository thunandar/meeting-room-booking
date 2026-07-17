'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { RoleBadge } from './role-badge';
import { CloseIcon, MenuIcon } from './icons';

const NAV_LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: '/bookings', label: 'Bookings', roles: ['admin', 'owner', 'user'] },
  { href: '/summary', label: 'Usage summary', roles: ['admin', 'owner'] },
  { href: '/users', label: 'Users', roles: ['admin'] },
];

/**
 * Authenticated page frame: sticky glassy header, role-aware nav (inline on
 * desktop, drawer on mobile), current user + role, logout. Redirects to the
 * login screen when no session exists. Links are filtered by role for
 * usability only — the backend independently enforces every permission.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/');
    }
  }, [loading, session, router]);

  // Close the drawer on navigation and lock body scroll while it is open.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="text-sm text-ink-mute">Loading…</p>
      </div>
    );
  }

  const links = NAV_LINKS.filter((link) => link.roles.includes(session.user.role));

  function handleLogout() {
    logout();
    router.replace('/');
  }

  const navLink = (link: (typeof NAV_LINKS)[number], mobile = false) => {
    const active = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={
          mobile
            ? `rounded-xl px-4 py-3 text-[15px] ${active ? 'bg-accent-soft font-medium text-accent-deep' : 'text-ink-soft hover:bg-card'}`
            : `border-b-2 pb-0.5 text-sm transition-colors ${active ? 'border-accent font-medium text-accent-deep' : 'border-transparent text-ink-soft hover:text-ink'}`
        }
      >
        {link.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line-soft bg-white/85 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/bookings" className="font-serif text-xl tracking-tight">
              Meeting Room
            </Link>
            <nav className="hidden items-center gap-6 sm:flex">{links.map((link) => navLink(link))}</nav>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-sm font-medium">{session.user.name}</span>
            <RoleBadge role={session.user.role} />
            <button onClick={handleLogout} className="btn-outline px-4 py-1.5">
              Log out
            </button>
          </div>

          <button
            className="btn-ghost sm:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon size={20} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="animate-fade fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px] sm:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <aside
            className="animate-slide-in ml-auto flex h-full w-72 flex-col bg-white p-5 shadow-float"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-serif text-lg">Meeting Room</span>
              <button className="btn-ghost" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <CloseIcon size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">{links.map((link) => navLink(link, true))}</nav>
            <div className="mt-auto border-t border-line-soft pt-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium">{session.user.name}</span>
                <RoleBadge role={session.user.role} />
              </div>
              <button onClick={handleLogout} className="btn-outline w-full">
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="animate-rise mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
