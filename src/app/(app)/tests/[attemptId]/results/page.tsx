import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTestAttemptStateAction } from "@/app/actions/tests";
import { ResultsClient } from "./results-client";
import { AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: "Assessment Results | CA Prep Pro",
  description: "View your detailed score breakdown, question-level analytics, and standard explanations.",
};

interface ResultsPageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { attemptId } = await params;
  const result = await getTestAttemptStateAction(attemptId);

  if (!result.success || !result.attempt || !result.test || !result.questions) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="bg-destructive/10 text-destructive rounded-full p-3.5 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-1.5">
            Failed to Load Results
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {result.error || "We could not fetch the result data for this attempt."}
          </p>
        </div>
      </AppShell>
    );
  }

  // If attempt is not yet completed, redirect back to the active runner
  if (result.attempt.status !== "COMPLETED") {
    redirect(`/tests/${attemptId}`);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <ResultsClient
          attemptId={attemptId}
          attempt={result.attempt}
          test={result.test}
          questions={result.questions}
        />
      </div>
    </AppShell>
  );
}
