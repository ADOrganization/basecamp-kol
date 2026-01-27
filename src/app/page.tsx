import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  try {
    const session = await auth();

    if (!session?.user) {
      redirect("/login");
    }

    // Redirect based on organization type with fallback
    const orgType = session.user?.organizationType;
    if (orgType === "AGENCY") {
      redirect("/dashboard");
    } else if (orgType === "CLIENT") {
      redirect("/client/dashboard");
    } else {
      // Fallback if orgType is undefined
      redirect("/login");
    }
  } catch (error) {
    console.error("Home page error:", error);
    redirect("/login");
  }
}
