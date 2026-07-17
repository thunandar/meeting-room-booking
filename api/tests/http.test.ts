/**
 * HTTP integration tests: the full Express stack (routes → services → domain)
 * with the Prisma client replaced by a deterministic in-memory fake that
 * implements exactly the query shapes the services use. No database needed,
 * so these run fast and identically everywhere (locally and in CI).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { db } = vi.hoisted(() => {
  interface FakeUser {
    id: string;
    name: string;
    role: 'admin' | 'owner' | 'user';
    createdAt: Date;
  }
  interface FakeBooking {
    id: string;
    userId: string;
    startTime: Date;
    endTime: Date;
    createdAt: Date;
  }

  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  const state = {
    users: [] as FakeUser[],
    bookings: [] as FakeBooking[],
  };

  const publicUser = (u: FakeUser) => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt });
  const withUser = (b: FakeBooking) => {
    const user = state.users.find((u) => u.id === b.userId);
    if (!user) throw new Error(`fake db: booking ${b.id} has no user`);
    return { ...b, user: { id: user.id, name: user.name, role: user.role } };
  };

  const userModel = {
    findMany: async (args?: { select?: { bookings?: unknown } }) => {
      const sorted = [...state.users].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      if (args?.select && 'bookings' in args.select) {
        return sorted.map((u) => ({
          ...publicUser(u),
          bookings: state.bookings
            .filter((b) => b.userId === u.id)
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
        }));
      }
      return sorted.map(publicUser);
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      state.users.find((u) => u.id === where.id) ?? null,
    create: async ({ data }: { data: { name: string; role: FakeUser['role'] } }) => {
      const user: FakeUser = { id: nextId('user'), createdAt: new Date(2026, 0, 1, 0, 0, seq), ...data };
      state.users.push(user);
      return publicUser(user);
    },
    update: async ({ where, data }: { where: { id: string }; data: { role: FakeUser['role'] } }) => {
      const user = state.users.find((u) => u.id === where.id);
      if (!user) throw new Error('fake db: update on missing user');
      user.role = data.role;
      return publicUser(user);
    },
    count: async ({ where }: { where: { role: FakeUser['role'] } }) =>
      state.users.filter((u) => u.role === where.role).length,
    delete: async ({ where }: { where: { id: string } }) => {
      state.users = state.users.filter((u) => u.id !== where.id);
      // onDelete: Cascade in the real schema
      state.bookings = state.bookings.filter((b) => b.userId !== where.id);
    },
  };

  const bookingModel = {
    findMany: async (args?: { where?: { startTime?: { lt: Date }; endTime?: { gt: Date } } }) => {
      let rows = [...state.bookings];
      if (args?.where?.startTime?.lt) rows = rows.filter((b) => b.startTime < args.where!.startTime!.lt);
      if (args?.where?.endTime?.gt) rows = rows.filter((b) => b.endTime > args.where!.endTime!.gt);
      return rows.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()).map(withUser);
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      state.bookings.find((b) => b.id === where.id) ?? null,
    create: async ({ data }: { data: { userId: string; startTime: Date; endTime: Date } }) => {
      const booking: FakeBooking = { id: nextId('booking'), createdAt: new Date(), ...data };
      state.bookings.push(booking);
      return withUser(booking);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      state.bookings = state.bookings.filter((b) => b.id !== where.id);
    },
  };

  const prisma = {
    user: userModel,
    booking: bookingModel,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
  };

  return {
    db: {
      prisma,
      reset: () => {
        state.users = [];
        state.bookings = [];
      },
      addUser: (name: string, role: FakeUser['role']) => {
        const user: FakeUser = { id: nextId('user'), name, role, createdAt: new Date(2026, 0, 1, 0, 0, seq) };
        state.users.push(user);
        return user;
      },
      addBooking: (userId: string, startTime: Date, endTime: Date) => {
        const booking: FakeBooking = { id: nextId('booking'), userId, startTime, endTime, createdAt: new Date() };
        state.bookings.push(booking);
        return booking;
      },
      bookings: () => state.bookings,
    },
  };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: db.prisma }));

const { createApp } = await import('../src/app.js');
const app = createApp();

const asUser = (id: string) => ({ Authorization: `Bearer ${id}` });
const at = (hour: number) => new Date(Date.UTC(2026, 7, 20, hour, 0, 0));

let admin: { id: string };
let owner: { id: string };
let uma: { id: string };
let ben: { id: string };

beforeEach(() => {
  db.reset();
  admin = db.addUser('Alice (Admin)', 'admin');
  owner = db.addUser('Oliver (Owner)', 'owner');
  uma = db.addUser('Uma', 'user');
  ben = db.addUser('Ben', 'user');
});

describe('authentication', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/bookings');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a token whose user no longer exists', async () => {
    const res = await request(app).get('/bookings').set(asUser('user_deleted'));
    expect(res.status).toBe(401);
  });
});

describe('booking permissions', () => {
  it("returns 403 when a user deletes someone else's booking, and keeps it", async () => {
    const booking = db.addBooking(ben.id, at(10), at(11));
    const res = await request(app).delete(`/bookings/${booking.id}`).set(asUser(uma.id));
    expect(res.status).toBe(403);
    expect(db.bookings()).toHaveLength(1);
  });

  it('returns 204 when a user deletes their own booking', async () => {
    const booking = db.addBooking(uma.id, at(10), at(11));
    const res = await request(app).delete(`/bookings/${booking.id}`).set(asUser(uma.id));
    expect(res.status).toBe(204);
    expect(db.bookings()).toHaveLength(0);
  });

  it('returns 404 for a missing booking', async () => {
    const res = await request(app).delete('/bookings/nope').set(asUser(admin.id));
    expect(res.status).toBe(404);
  });
});

describe('booking creation', () => {
  it('creates a booking and returns 201', async () => {
    const res = await request(app)
      .post('/bookings')
      .set(asUser(uma.id))
      .send({ startTime: at(9).toISOString(), endTime: at(10).toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.booking.user.name).toBe('Uma');
  });

  it('returns 409 with conflict details on overlap', async () => {
    db.addBooking(ben.id, at(10), at(11));
    const res = await request(app)
      .post('/bookings')
      .set(asUser(uma.id))
      .send({ startTime: at(10).toISOString(), endTime: at(11).toISOString() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_OVERLAP');
    expect(res.body.error.details.conflictingBooking.bookedBy).toBe('Ben');
  });

  it('allows a back-to-back booking', async () => {
    db.addBooking(ben.id, at(10), at(11));
    const res = await request(app)
      .post('/bookings')
      .set(asUser(uma.id))
      .send({ startTime: at(11).toISOString(), endTime: at(12).toISOString() });
    expect(res.status).toBe(201);
  });

  it('rejects an inverted range with 400', async () => {
    const res = await request(app)
      .post('/bookings')
      .set(asUser(uma.id))
      .send({ startTime: at(11).toISOString(), endTime: at(10).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIME_RANGE');
  });
});

describe('user management', () => {
  it('returns 403 when a non-admin lists users', async () => {
    for (const actor of [owner, uma]) {
      const res = await request(app).get('/users').set(asUser(actor.id));
      expect(res.status).toBe(403);
    }
  });

  it('deletes a user with 204 and cascades their bookings', async () => {
    db.addBooking(ben.id, at(10), at(11));
    db.addBooking(uma.id, at(12), at(13));
    const res = await request(app).delete(`/users/${ben.id}`).set(asUser(admin.id));
    expect(res.status).toBe(204);
    expect(db.bookings()).toHaveLength(1);
    expect(db.bookings()[0]!.userId).toBe(uma.id);
  });

  it('blocks deleting the last admin with LAST_ADMIN', async () => {
    const res = await request(app).delete(`/users/${admin.id}`).set(asUser(admin.id));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('blocks demoting the last admin with LAST_ADMIN', async () => {
    const res = await request(app)
      .patch(`/users/${admin.id}/role`)
      .set(asUser(admin.id))
      .send({ role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });

  it('allows deleting an admin when another admin remains', async () => {
    const second = db.addUser('Second Admin', 'admin');
    const res = await request(app).delete(`/users/${second.id}`).set(asUser(admin.id));
    expect(res.status).toBe(204);
  });

  it('allows an admin to delete their own account when another admin remains', async () => {
    const second = db.addUser('Second Admin', 'admin');
    const res = await request(app).delete(`/users/${second.id}`).set(asUser(second.id));
    expect(res.status).toBe(204);
  });
});

describe('session revalidation', () => {
  it('GET /auth/me reflects a role changed after login', async () => {
    await request(app).patch(`/users/${uma.id}/role`).set(asUser(admin.id)).send({ role: 'owner' });
    const res = await request(app).get('/auth/me').set(asUser(uma.id));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: uma.id, name: 'Uma', role: 'owner' });
  });
});

describe('summary', () => {
  it('returns 403 for a regular user and 200 for owner', async () => {
    expect((await request(app).get('/summary').set(asUser(uma.id))).status).toBe(403);
    const res = await request(app).get('/summary').set(asUser(owner.id));
    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveLength(4);
  });
});
