import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { getPracticeSessionState } from "@/domains/practice/services";
import { AppShell } from "@/components/app/app-shell";
import { CaseRunner } from "./case-runner";

interface PageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default async function CaseSessionPage({ params }: PageProps) {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  const email = user.emailAddresses[0]?.emailAddress || "";
  const profile = await getOrCreateStudentProfile(user.id, email);

  let state;
  try {
    state = await getPracticeSessionState(sessionId, profile.id);
    if (state.practiceMode !== "CASE_STUDY") {
      redirect(`/practice/${sessionId}`);
    }
  } catch {
    redirect("/practice");
  }

  return (
    <AppShell>
      <CaseRunner initialState={state} />
    </AppShell>
  );
}
