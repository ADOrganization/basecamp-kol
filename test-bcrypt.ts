import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "agency@demo.com" },
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log("User found:", user.email);
  console.log("Stored hash:", user.passwordHash);

  // Test password comparison
  const testPassword = "password123";
  const isValid = await bcrypt.compare(testPassword, user.passwordHash);
  console.log("Password valid:", isValid);

  // Generate a new hash and compare
  const newHash = await bcrypt.hash(testPassword, 12);
  console.log("New hash:", newHash);
  const isNewValid = await bcrypt.compare(testPassword, newHash);
  console.log("New hash valid:", isNewValid);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
