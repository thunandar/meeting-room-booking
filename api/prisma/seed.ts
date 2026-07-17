import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Seeds one user per role (plus a second regular user) and a few bookings. */
async function main(): Promise<void> {
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
