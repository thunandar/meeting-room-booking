import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * The seed WIPES all users and bookings before inserting fixtures. Against a
 * local database that is exactly what you want; against a remote (production)
 * database it is destructive, so it refuses unless SEED_FORCE=1 is set.
 */
function assertSafeTarget(): void {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!LOCAL_HOSTS.includes(host) && process.env.SEED_FORCE !== '1') {
    console.error(
      `Refusing to seed non-local database host "${host}" — this DELETES all users and bookings.\n` +
        'If you really mean to reseed a remote/production database, rerun with SEED_FORCE=1.',
    );
    process.exit(1);
  }
}

/** Seeds one user per role (plus a second regular user) and a few bookings. */
async function main(): Promise<void> {
  assertSafeTarget();
  await prisma.booking.deleteMany();
  await prisma.user.deleteMany();

  const [alice, oliver, uma, ben] = await Promise.all([
    prisma.user.create({ data: { name: 'Alice (Admin)', role: 'admin' } }),
    prisma.user.create({ data: { name: 'Oliver (Owner)', role: 'owner' } }),
    prisma.user.create({ data: { name: 'Uma', role: 'user' } }),
    prisma.user.create({ data: { name: 'Ben', role: 'user' } }),
  ]);

  const tomorrowAt = (hour: number): Date => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };

  await prisma.booking.createMany({
    data: [
      { userId: uma.id, startTime: tomorrowAt(9), endTime: tomorrowAt(10) },
      { userId: ben.id, startTime: tomorrowAt(10), endTime: tomorrowAt(11) },
      { userId: oliver.id, startTime: tomorrowAt(14), endTime: tomorrowAt(15) },
    ],
  });

  console.log('Seeded users:', { alice: alice.id, oliver: oliver.id, uma: uma.id, ben: ben.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
