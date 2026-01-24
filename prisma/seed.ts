import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed script executed.");
  console.log("\nNo seed data is created by default.");
  console.log("Register a new account at /register to get started.");
  console.log("\nTo create test data, you can use the Prisma Studio:");
  console.log("  npx prisma studio");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
