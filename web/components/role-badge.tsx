import type { Role } from '@/lib/types';

const STYLES: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-800',
  owner: 'bg-amber-100 text-amber-800',
  user: 'bg-blue-100 text-blue-800',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLES[role]}`}>
      {role}
    </span>
  );
}
