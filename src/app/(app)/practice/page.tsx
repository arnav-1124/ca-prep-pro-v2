import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import {
  getActiveStudentAttempt,
  getActiveCurriculumVersion,
  getCurriculumSubjects
} from "@/domains/academics/services";
import { AppShell } from "@/components/app/app-shell";
import { PracticeConfig } from "./practice-config";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Practice - CA Prep Pro",
  description: "Dynamic practice sessions for Chartered Accountancy exams.",
};

export default async function PracticePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress || "";
  const profile = await getOrCreateStudentProfile(user.id, email);

  // 1. Resolve student attempt target
  const activeAttempt = await getActiveStudentAttempt(profile.id);
  if (!activeAttempt) {
    redirect("/dashboard");
  }

  // 2. Resolve active syllabus version
  const activeVersion = await getActiveCurriculumVersion(activeAttempt.levelId);
  if (!activeVersion) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 border border-border bg-card rounded-2xl shadow-xs">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Syllabus scheme not found</h2>
          <p className="text-sm text-muted-foreground max-w-sm mt-2 font-sans">
            No official syllabus structures have been published for {activeAttempt.levelName} yet. Please check back later.
          </p>
        </div>
      </AppShell>
    );
  }

  // 3. Resolve subjects
  const subjects = await getCurriculumSubjects(activeVersion.id);

  return (
    <AppShell>
      <PracticeConfig
        levelId={activeAttempt.levelId}
        levelName={activeAttempt.levelName}
        activeVersionId={activeVersion.id}
        subjects={subjects}
      />
    </AppShell>
  );
}
