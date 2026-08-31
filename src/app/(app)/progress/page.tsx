import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { getProgressDashboardAction } from "@/app/actions/progress";
import { AppShell } from "@/components/app/app-shell";
import { ProgressDashboard } from "./progress-dashboard";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Progress & Syllabus Intelligence - CA Prep Pro",
  description: "Track your CA preparation progress, syllabus coverage, and performance insights.",
};

export default async function ProgressPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress || "";
  await getOrCreateStudentProfile(user.id, email);

  // Load initial progress data on the server
  const result = await getProgressDashboardAction();

  if (!result.success) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 border border-border bg-card rounded-2xl shadow-xs space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Failed to load progress</h2>
          <p className="text-sm text-muted-foreground max-w-sm font-sans">
            {result.error || "We couldn&apos;t load your progress right now. Please try again."}
          </p>
          <a href="/progress">
            <Button variant="outline" className="font-bold cursor-pointer">
              Retry Connection
            </Button>
          </a>
        </div>
      </AppShell>
    );
  }

  if (!result.stats) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 border border-border bg-card rounded-2xl shadow-xs space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">No active attempt context</h2>
          <p className="text-sm text-muted-foreground max-w-sm font-sans">
            Please register your target curriculum level in the profile dashboard to start preparation.
          </p>
          <a href="/dashboard">
            <Button className="font-bold cursor-pointer">
              Go to Dashboard
            </Button>
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProgressDashboard
        initialStats={result.stats}
        availableExamAttempts={result.availableExamAttempts || []}
      />
    </AppShell>
  );
}
