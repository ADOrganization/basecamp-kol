import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
    },
  });

  console.log("Users in database:");
  users.forEach(u => {
    console.log("- " + u.email + " (" + u.name + ")");
    console.log("  Hash starts with: " + u.passwordHash.substring(0, 20) + "...");
  });

  const orgs = await prisma.organization.findMany();
  console.log("\nOrganizations:");
  orgs.forEach(o => console.log("- " + o.name + " (" + o.type + ")"));

  const members = await prisma.organizationMember.findMany({
    include: { user: true, organization: true }
  });
  console.log("\nMemberships:");
  members.forEach(m => console.log("- " + m.user.email + " -> " + m.organization.name + " (" + m.role + ")"));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
