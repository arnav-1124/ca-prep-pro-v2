import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTestAttemptStateAction } from "@/app/actions/tests";
import { TestRunnerClient } from "./test-runner-client";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Test Runner | CA Prep Pro",
  description: "Interactive assessment runner environment for CA Prep Pro.",
};

interface TestRunnerPageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function TestRunnerPage({ params }: TestRunnerPageProps) {
  const { attemptId } = await params;
  const result = await getTestAttemptStateAction(attemptId);

  if (!result.success || !result.attempt || !result.test || !result.questions) {
    return (
      <main className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-destructive/10 text-destructive rounded-full p-3.5 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-1.5">
          Failed to Load Runner
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {result.error || "This test is no longer available, or you are not authorized to access it."}
        </p>
      </main>
    );
  }

  // Redirect to results if attempt is already completed
  if (result.attempt.status === "COMPLETED") {
    redirect(`/tests/${attemptId}/results`);
  }

  return (
    <TestRunnerClient
      attemptId={attemptId}
      initialAttempt={result.attempt}
      test={result.test}
      initialQuestions={result.questions}
      initialTimeRemaining={result.timeRemainingSeconds}
    />
  );
}
