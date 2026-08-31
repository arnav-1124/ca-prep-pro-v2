import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { getActiveStudentAttempt, getAvailableAcademicLevels } from "@/domains/academics/services";
import { AppShell } from "@/components/app/app-shell";
import { PreparationSetup } from "@/components/app/preparation-setup";
import { Calendar, GraduationCap, CheckCircle2, ClipboardList, BookOpen, FileText } from "lucide-react";
import { format } from "date-fns";

export const metadata = {
  title: "Dashboard - CA Prep Pro",
  description: "Your personalized CA exam preparation workspace.",
};

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress || "";
  const profile = await getOrCreateStudentProfile(user.id, email);

  // 1. Check if the student has an active exam attempt context
  const activeAttempt = await getActiveStudentAttempt(profile.id);

  // 2. If no active context is found, render the onboarding setup form
  if (!activeAttempt) {
    const levels = await getAvailableAcademicLevels();
    return (
      <AppShell>
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
          <PreparationSetup studentProfileId={profile.id} academicLevels={levels} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="border border-border bg-card text-card-foreground rounded-2xl p-6 shadow-xs flex justify-between items-center transition-colors">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Welcome back{user.firstName ? `, ${user.firstName}` : ""}
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5">
              Plan and track your preparation path dynamically.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {profile.plan === "PAID" ? "Paid Member" : "Free Tier"}
          </span>
        </div>

        {/* Selected Academic Context Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Active Level */}
          <div className="border border-border bg-card rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Study Level</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">{activeAttempt.levelName}</div>
            </div>
          </div>

          {/* Target Exam Date */}
          <div className="border border-border bg-card rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Target Date</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">
                {activeAttempt.targetDate ? format(new Date(activeAttempt.targetDate), "PPP") : "Not set"}
              </div>
            </div>
          </div>
        </div>

        {/* Practice and Assessment Sections (Honest Empty States) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Practice History block */}
          <div className="lg:col-span-2 border border-border bg-card rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Practice Logs</span>
            </h2>
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-3 bg-muted/5 rounded-lg border border-border/50">
              <BookOpen className="h-8 w-8 text-primary/45" />
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Your practice history will appear here once you start practicing.
              </p>
            </div>
          </div>

          {/* Test Assessments block */}
          <div className="border border-border bg-card rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span>Simulated Tests</span>
            </h2>
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-3 bg-muted/5 rounded-lg border border-border/50">
              <FileText className="h-8 w-8 text-primary/45" />
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                No tests are available yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
