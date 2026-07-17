import { describe, expect, it } from 'vitest';
import { canDeleteBooking, canManageUsers, canViewSummary, wouldRemoveLastAdmin, type Actor } from '../src/domain/permissions.js';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const owner: Actor = { id: 'owner-1', role: 'owner' };
const user: Actor = { id: 'user-1', role: 'user' };

describe('canDeleteBooking', () => {
  it('lets a user delete their own booking', () => {
    expect(canDeleteBooking(user, { userId: 'user-1' })).toBe(true);
  });

  it("forbids a user deleting someone else's booking", () => {
    expect(canDeleteBooking(user, { userId: 'user-2' })).toBe(false);
  });

  it('lets an owner delete any booking', () => {
    expect(canDeleteBooking(owner, { userId: 'user-2' })).toBe(true);
  });

  it('lets an admin delete any booking', () => {
    expect(canDeleteBooking(admin, { userId: 'user-2' })).toBe(true);
  });
});

describe('canManageUsers', () => {
  it('allows only admins', () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(owner)).toBe(false);
    expect(canManageUsers(user)).toBe(false);
  });
});

describe('canViewSummary', () => {
  it('allows owners and admins but not users', () => {
    expect(canViewSummary(admin)).toBe(true);
    expect(canViewSummary(owner)).toBe(true);
    expect(canViewSummary(user)).toBe(false);
  });
});

describe('wouldRemoveLastAdmin', () => {
  it('blocks deleting the only admin', () => {
    expect(wouldRemoveLastAdmin({ role: 'admin' }, 1)).toBe(true);
  });

  it('allows deleting an admin when another admin remains', () => {
    expect(wouldRemoveLastAdmin({ role: 'admin' }, 2)).toBe(false);
  });

  it('blocks demoting the only admin to owner or user', () => {
    expect(wouldRemoveLastAdmin({ role: 'admin' }, 1, 'owner')).toBe(true);
    expect(wouldRemoveLastAdmin({ role: 'admin' }, 1, 'user')).toBe(true);
  });

  it('allows a no-op role change that keeps the only admin an admin', () => {
    expect(wouldRemoveLastAdmin({ role: 'admin' }, 1, 'admin')).toBe(false);
  });

  it('never blocks actions on non-admin targets', () => {
    expect(wouldRemoveLastAdmin({ role: 'owner' }, 1)).toBe(false);
    expect(wouldRemoveLastAdmin({ role: 'user' }, 1, 'admin')).toBe(false);
  });
});
