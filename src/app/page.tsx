import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Redirect based on organization type
  if (session.user.organizationType === "AGENCY") {
    redirect("/agency/dashboard");
  } else {
    redirect("/client/dashboard");
  }
}
