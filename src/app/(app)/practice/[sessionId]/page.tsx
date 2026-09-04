import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { getCurrentPracticeQuestion, getPracticeSessionSummary } from "@/domains/practice/services";
import { AppShell } from "@/components/app/app-shell";
import { SessionRunner } from "./session-runner";

interface PracticeSessionPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export const metadata = {
  title: "Practice Session - CA Prep Pro",
  description: "Solve deterministic practice questions aligned with official CA curriculum.",
};

export default async function PracticeSessionPage({ params }: PracticeSessionPageProps) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;

  const email = user.emailAddresses[0]?.emailAddress || "";
  const profile = await getOrCreateStudentProfile(user.id, email);

  let initialData;
  try {
    initialData = await getCurrentPracticeQuestion(profile.id, sessionId);
  } catch {
    redirect("/practice");
  }

  let initialSummary = null;
  if (initialData.isCompleted || initialData.session.status === "COMPLETED") {
    try {
      initialSummary = await getPracticeSessionSummary(profile.id, sessionId);
    } catch {
      // Ignore if summary fails
    }
  }

  return (
    <AppShell>
      <SessionRunner
        sessionId={sessionId}
        initialQuestion={initialData.question}
        initialAttempt={initialData.existingAttempt || null}
        initialSummary={initialSummary}
        sessionDetails={initialData.session}
      />
    </AppShell>
  );
}
