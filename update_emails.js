require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany();
  for (const user of users) {
    if (user.email !== user.email.toLowerCase()) {
      console.log(`Updating ${user.email} to ${user.email.toLowerCase()}`);
      await prisma.user.update({
        where: { id: user.id },
        data: { email: user.email.toLowerCase() }
      });
    }
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
