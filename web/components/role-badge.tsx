import type { Role } from '@/lib/types';

const STYLES: Record<Role, string> = {
  admin: 'bg-accent-soft text-accent-deep',
  owner: 'bg-warm-soft text-warm-deep',
  user: 'border border-line-soft bg-card text-ink-soft',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${STYLES[role]}`}
    >
      {role}
    </span>
  );
}
