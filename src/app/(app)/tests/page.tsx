import { Metadata } from "next";
import { getAvailableTestsAction } from "@/app/actions/tests";
import { TestListClient } from "./test-list-client";
import { AlertCircle } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  title: "Assessments & Tests | CA Prep Pro",
  description: "Take structured practice tests, chapter assessments, and mock examinations to prepare for your Chartered Accountancy exam.",
};

export default async function TestsPage() {
  const result = await getAvailableTestsAction();

  if (!result.success || !result.tests) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="bg-destructive/10 text-destructive rounded-full p-3.5 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-1.5">
            Connection Issue
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {result.error || "We encountered a temporary connection issue. Please check your network and try again."}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Assessments & Mock Tests
          </h1>
          <p className="text-xs text-muted-foreground">
            Complete admin-curated assessments with fixed question sets, timer constraints, and pause/resume support.
          </p>
        </div>

        <TestListClient initialTests={result.tests} />
      </div>
    </AppShell>
  );
}
