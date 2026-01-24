import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "testuser@basecamp.test";
  const password = "testpassword123";
  const name = "Test User";
  const organizationName = "Test Agency";

  console.log("Creating demo user...");

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log("User already exists:", email);
    console.log("\n=== Demo Account Credentials ===");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("================================\n");
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create organization first
  const slug = "test-agency-" + Date.now();
  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      slug,
      type: "AGENCY",
    },
  });

  console.log("Created organization:", organization.name);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashedPassword,
    },
  });

  console.log("Created user:", user.email);

  // Create organization membership
  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  console.log("Added user to organization as OWNER");

  console.log("\n=== Demo Account Credentials ===");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
