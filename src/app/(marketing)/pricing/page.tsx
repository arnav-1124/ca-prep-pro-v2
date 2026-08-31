import { auth, currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { PricingClient } from "./pricing-client";

export const metadata = {
  title: "Plans - CA Prep Pro",
  description: "Review study membership options and plans on CA Prep Pro.",
};

export default async function PricingPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const isAuthenticated = !!userId;

  let currentPlan = "FREE";
  let studentEmail = "";
  let studentName = "";

  if (isAuthenticated && user) {
    studentEmail = user.emailAddresses[0]?.emailAddress || "";
    studentName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    try {
      const profile = await getOrCreateStudentProfile(user.id, studentEmail);
      currentPlan = profile.plan;
    } catch (err) {
      console.error("Failed to load user plan in pricing page:", err);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex-1 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Plans for Your CA Preparation
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Select the plan that matches your study routine and resource requirements.
            </p>
          </div>

          <PricingClient
            isAuthenticated={isAuthenticated}
            currentPlan={currentPlan}
            studentEmail={studentEmail}
            studentName={studentName}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
