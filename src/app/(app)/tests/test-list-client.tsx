"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TestMetadata } from "@/domains/tests/services";
import { startTestAttemptAction } from "@/app/actions/tests";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  HelpCircle,
  Play,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TestListClientProps {
  initialTests: TestMetadata[];
}

export function TestListClient({ initialTests }: TestListClientProps) {
  const router = useRouter();
  const testsList = initialTests;
  const [loadingTestId, setLoadingTestId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAction = async (test: TestMetadata) => {
    setErrorMsg(null);
    
    // If active attempt exists, redirect to it directly
    if (test.status === "CONTINUE" && test.activeAttemptId) {
      router.push(`/tests/${test.activeAttemptId}`);
      return;
    }

    setLoadingTestId(test.id);
    try {
      const result = await startTestAttemptAction(test.id);
      if (result.success && result.attemptId) {
        router.push(`/tests/${result.attemptId}`);
      } else {
        setErrorMsg(result.error || "Could not start the assessment.");
      }
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setLoadingTestId(null);
    }
  };

  if (testsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-2xl bg-muted/10 min-h-[300px]">
        <FileText className="h-12 w-12 text-muted-foreground/60 mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-1.5">No Assessments Available</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          There are currently no practice tests or mock assessments configured for your active study level.
        </p>
        <Button onClick={() => router.push("/practice")} className="font-bold cursor-pointer">
          Go to Practice Section
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Assessment Blocked</p>
            <p className="text-xs opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testsList.map((test) => {
          const isButtonLoading = loadingTestId === test.id;
          
          return (
            <Card key={test.id} className="border border-border/60 bg-card hover:border-border/100 transition-all duration-200 shadow-sm flex flex-col">
              <CardHeader className="p-5 pb-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] font-extrabold tracking-wide uppercase px-2 py-0.5 bg-neutral-900 border border-neutral-805 text-neutral-200">
                    {test.subjectName || "Comprehensive"}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold px-2 py-0.5",
                    test.chapterName ? "text-primary border-primary/20 bg-primary/5" : "text-muted-foreground"
                  )}>
                    {test.chapterName ? "Chapter Assessment" : "Mixed Content"}
                  </Badge>
                </div>
                {test.chapterName && (
                  <div className="text-[10px] font-bold text-neutral-400 font-sans flex items-center gap-1 mt-0.5">
                    <span className="text-primary font-black uppercase text-[9px] tracking-wide">Chapter:</span>
                    <span className="truncate max-w-[240px]" title={test.chapterName}>{test.chapterName}</span>
                  </div>
                )}
                <div className="pt-1">
                  <CardTitle className="text-base font-extrabold line-clamp-1 text-foreground leading-tight">
                    {test.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                    {test.description || "Take this curated test to gauge your conceptual clarity under simulated constraints."}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-0 pb-4 flex-1 flex flex-col justify-end space-y-4">
                <div className="grid grid-cols-3 gap-2 border-t border-b border-border/40 py-3 text-center text-xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Questions
                    </span>
                    <span className="block font-black text-foreground mt-0.5 flex items-center justify-center gap-1">
                      <HelpCircle className="h-3 w-3 text-primary" />
                      {test.questionsCount}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Duration
                    </span>
                    <span className="block font-black text-foreground mt-0.5 flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-primary" />
                      {test.durationMinutes}m
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total Marks
                    </span>
                    <span className="block font-black text-foreground mt-0.5 flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      {test.totalMarks}
                    </span>
                  </div>
                </div>

                {test.attemptsCount > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
                    <span className="font-semibold">Attempts: {test.attemptsCount}</span>
                    {test.bestScore !== null && (
                      <span className="font-extrabold text-foreground flex items-center gap-1">
                        Best: <span className="text-primary">{test.bestScore}/{test.totalMarks}</span>
                      </span>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="p-5 pt-0">
                <Button
                  onClick={() => handleAction(test)}
                  disabled={isButtonLoading || loadingTestId !== null}
                  className={cn(
                    "w-full font-bold cursor-pointer transition-all duration-200",
                    test.status === "CONTINUE" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  )}
                >
                  {isButtonLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                      Loading...
                    </span>
                  ) : test.status === "CONTINUE" ? (
                    <span className="flex items-center gap-1.5">
                      <Play className="h-4 w-4 fill-current shrink-0" />
                      Continue Attempt
                    </span>
                  ) : test.status === "RETAKE" ? (
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="h-4 w-4 shrink-0" />
                      Retake Assessment
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      Start Assessment
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
