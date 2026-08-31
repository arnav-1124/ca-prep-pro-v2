import { auth } from "@clerk/nextjs/server";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { FeatureOverview } from "@/components/marketing/feature-overview";
import { LevelOverview } from "@/components/marketing/level-overview";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PlanTeaser } from "@/components/marketing/plan-teaser";
import { FinalCta } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  
  if (userId) {
    redirect("/dashboard");
  }

  const isAuthenticated = !!userId;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex-1">
        <Hero isAuthenticated={isAuthenticated} />
        <FeatureOverview />
        <LevelOverview />
        <HowItWorks />
        <PlanTeaser />
        <FinalCta isAuthenticated={isAuthenticated} />
      </main>
      <Footer />
    </div>
  );
}
