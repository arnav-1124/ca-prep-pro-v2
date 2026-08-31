import { currentUser } from "@clerk/nextjs/server";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { db } from "@/db";
import { academicLevels } from "@/db/schema";
import { BookOpen, AlertCircle } from "lucide-react";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import {
  getActiveStudentAttempt,
  getActiveCurriculumVersion,
  getCurriculumSubjects,
  getCurriculumTree,
  CurriculumTreeNode
} from "@/domains/academics/services";
import { AppShell } from "@/components/app/app-shell";
import { SyllabusExplorer } from "@/domains/academics/components/syllabus-explorer";
import { redirect } from "next/navigation";

export const metadata = {
  title: "CA Syllabus - CA Prep Pro",
  description: "Browse CA Foundation, Intermediate, and Final syllabus subjects on CA Prep Pro.",
};

export default async function SyllabusPage() {
  const user = await currentUser();
  const isAuthenticated = !!user;

  // Case 1: Authenticated student -> render the full app shell and Explorer
  if (user) {
    const email = user.emailAddresses[0]?.emailAddress || "";
    const profile = await getOrCreateStudentProfile(user.id, email);

    // 1. Fetch active exam attempt context
    const activeAttempt = await getActiveStudentAttempt(profile.id);

    // 2. Redirect to dashboard if onboarding is incomplete
    if (!activeAttempt) {
      redirect("/dashboard");
    }

    // 3. Resolve active curriculum version for this CA level
    const activeVersion = await getActiveCurriculumVersion(activeAttempt.levelId);

    // 4. Handle empty state if no active version is defined for the level
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

    // 5. Fetch subjects/papers for the active curriculum version
    const subjectsList = await getCurriculumSubjects(activeVersion.id);

    // 6. Fetch recursive node trees for each subject in parallel
    const treesBySubjectId: Record<string, CurriculumTreeNode[]> = {};
    const treePromises = subjectsList.map(async (subject) => {
      const tree = await getCurriculumTree(subject.id, activeVersion.id);
      treesBySubjectId[subject.id] = tree;
    });
    await Promise.all(treePromises);

    return (
      <AppShell>
        <SyllabusExplorer
          levelName={activeAttempt.levelName}
          versionName={activeVersion.name}
          subjects={subjectsList}
          treesBySubjectId={treesBySubjectId}
        />
      </AppShell>
    );
  }

  // Case 2: Guest user -> render the public marketing syllabus page
  let dbLevels: (typeof academicLevels.$inferSelect)[] = [];
  try {
    dbLevels = await db.select().from(academicLevels);
  } catch {
    // Graceful fallback if database schema is not reachable in local dev
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex-1 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              CA Examination Syllabus
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Explore the structured academic syllabus for CA Foundation, CA Intermediate, and CA Final.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-12">
            {/* Overview cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  name: "CA Foundation",
                  desc: "Focuses on entry-level quantitative aptitude, accounting foundations, and laws.",
                },
                {
                  name: "CA Intermediate",
                  desc: "Focuses on group-level taxation systems, corporate laws, cost auditing, and advanced accounting.",
                },
                {
                  name: "CA Final",
                  desc: "Focuses on professional-level advanced financial reporting, strategic tax audit, and corporate guidelines.",
                },
              ].map((lvl) => (
                <div key={lvl.name} className="border border-border bg-card p-6 rounded-xl shadow-xs">
                  <h3 className="text-base font-bold text-foreground mb-2">{lvl.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{lvl.desc}</p>
                </div>
              ))}
            </div>

            {/* Dynamic syllabus directory or empty state */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-xs">
              <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <span>Syllabus Directory</span>
              </h2>

              {dbLevels.length > 0 ? (
                <div className="space-y-6">
                  {dbLevels.map((lvl) => (
                    <div key={lvl.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <h4 className="text-sm font-bold text-foreground">{lvl.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">Code: {lvl.code}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 text-xs text-muted-foreground leading-normal bg-muted/40 p-4 rounded border border-border">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground">Syllabus Details Not Yet Published:</span>
                    <p className="mt-1">
                      The detailed academic papers, chapters, and topic indexes are currently being compiled.
                      Our study syllabus database will be dynamically populated and published shortly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
