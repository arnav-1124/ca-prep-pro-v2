"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { testAttempts, tests } from "@/db/schema";
import { RunnerQuestion } from "@/domains/tests/services";
import { startTestAttemptAction } from "@/app/actions/tests";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RotateCcw,
  BookOpen,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultsClientProps {
  attemptId: string;
  attempt: typeof testAttempts.$inferSelect;
  test: typeof tests.$inferSelect;
  questions: RunnerQuestion[];
}

export function ResultsClient({ attempt, test, questions }: ResultsClientProps) {
  const router = useRouter();
  const [isRetaking, setIsRetaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);


  // Computations
  const totalQuestions = questions.length;
  const correctAnswers = questions.filter((q) => q.isCorrect === true).length;
  const incorrectAnswers = questions.filter((q) => q.isCorrect === false && q.selectedAnswer !== null).length;
  const unansweredCount = questions.filter((q) => q.selectedAnswer === null).length;
  const answeredCount = questions.filter((q) => q.selectedAnswer !== null).length;

  const scorePercentage = Math.round((attempt.score || 0) / (test.totalMarks || 1) * 100);

  // Compute time spent (convert completedAt - startedAt - pausedDuration to seconds)
  const durationMs = (attempt.completedAt ? new Date(attempt.completedAt).getTime() : new Date(attempt.startedAt).getTime()) -
    new Date(attempt.startedAt).getTime() -
    attempt.totalPausedTimeSeconds * 1000;
  const durationSeconds = Math.max(0, Math.round(durationMs / 1000));
  const displayTime = durationSeconds < 60
    ? `${durationSeconds}s`
    : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

  const isPass = scorePercentage >= 50;
  const performanceState = isPass ? "Pass / Satisfactory" : "Unsatisfactory / Needs Practice";

  const handleRetake = async () => {
    setErrorMsg(null);
    setIsRetaking(true);
    try {
      const result = await startTestAttemptAction(test.id);
      if (result.success && result.attemptId) {
        router.push(`/tests/${result.attemptId}`);
      } else {
        setErrorMsg(result.error || "Failed to start a new attempt.");
      }
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setIsRetaking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5">
            Test Submitted & Graded
          </Badge>
          <h1 className="text-2xl font-black text-foreground">
            {test.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Attempted on {new Date(attempt.completedAt || "").toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/tests")}
            className="font-bold cursor-pointer"
          >
            Back to Catalog
          </Button>
          <Button
            onClick={handleRetake}
            disabled={isRetaking}
            className="font-bold cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground"
          >
            {isRetaking ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                Initiating...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 shrink-0" />
                Retake Assessment
              </span>
            )}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Assessment Blocked</p>
            <p className="text-xs opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* 2. Primary Assessment Result Card */}
      <Card className="border border-border bg-card p-6 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-left">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Overall Performance
          </span>
          <h2 className={cn(
            "text-2xl font-black tracking-tight",
            isPass ? "text-emerald-500" : "text-destructive"
          )}>
            {performanceState}
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Score: <span className="font-bold text-foreground">{attempt.score}</span> out of <span className="font-bold text-foreground">{test.totalMarks}</span> marks obtained
          </p>
        </div>

        <div className="flex items-center gap-8 border-t sm:border-t-0 sm:border-l border-border/60 pt-4 sm:pt-0 sm:pl-8 shrink-0">
          <div className="text-center sm:text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
              Marks Percentage
            </span>
            <span className="text-3xl font-black text-foreground block mt-1">
              {Math.round(((attempt.score || 0) / (test.totalMarks || 1)) * 100)}%
            </span>
          </div>

          <div className="text-center sm:text-left">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
              Accuracy Ratio
            </span>
            <span className="text-3xl font-black text-primary block mt-1">
              {scorePercentage}%
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Supporting Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border border-border/60 bg-card p-4 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            Total Items
          </span>
          <span className="text-2xl font-black text-foreground mt-2">
            {totalQuestions}
          </span>
        </Card>

        <Card className="border border-border/60 bg-card p-4 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            Answered
          </span>
          <span className="text-2xl font-black text-foreground mt-2">
            {answeredCount}
          </span>
        </Card>

        <Card className="border border-border/60 bg-card p-4 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            Unanswered
          </span>
          <span className="text-2xl font-black text-foreground mt-2">
            {unansweredCount}
          </span>
        </Card>

        <Card className="border border-emerald-500/20 bg-card p-4 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
            Correct
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-2">
            {correctAnswers}
          </span>
        </Card>

        <Card className="border border-destructive/20 bg-card p-4 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-destructive">
            Incorrect
          </span>
          <span className="text-2xl font-black text-destructive mt-2">
            {incorrectAnswers}
          </span>
        </Card>

        <Card className="border border-border/60 bg-card p-4 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            Time Taken
          </span>
          <span className="text-2xl font-black text-foreground mt-2">
            {displayTime}
          </span>
        </Card>
      </div>

      {/* 3. Detailed Answers Review */}
      <div className="space-y-6">
        <h2 className="text-lg font-black text-foreground border-b border-border/60 pb-2">
          Question Breakdown & Review
        </h2>

        {questions.map((q, idx) => {
          const isCorrect = q.isCorrect === true;
          const isIncorrect = q.isCorrect === false && q.selectedAnswer !== null;
          const isUnanswered = q.selectedAnswer === null;
          const isCaseStudy = q.caseStudyId !== null;

          return (
            <Card key={q.id} className="border border-border/50 bg-card overflow-hidden">
              {/* Question Header Status */}
              <div className="bg-muted/10 px-5 py-3 border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-foreground">
                    Question {idx + 1}
                  </span>
                  {isCaseStudy && (
                    <Badge variant="secondary" className="text-[9px] font-extrabold uppercase px-1.5 py-0">
                      Case-Based MCQ
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isCorrect && (
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] px-2 py-0.5">
                      Correct
                    </Badge>
                  )}
                  {isIncorrect && (
                    <Badge variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive font-extrabold text-[10px] px-2 py-0.5">
                      Incorrect
                    </Badge>
                  )}
                  {isUnanswered && (
                    <Badge variant="outline" className="border-muted-foreground/20 bg-muted/10 text-muted-foreground font-extrabold text-[10px] px-2 py-0.5">
                      Unanswered
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                {/* Case Scenario Toggle */}
                {isCaseStudy && q.caseStudyId && (
                  <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/5">
                    <button
                      onClick={() => setExpandedCaseId(expandedCaseId === q.caseStudyId ? null : q.caseStudyId)}
                      className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-foreground bg-muted/20 hover:bg-muted/35 transition-all duration-150 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span>Case Context: {q.caseStudyTitle || "Scenario Passage"}</span>
                      </span>
                      {expandedCaseId === q.caseStudyId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedCaseId === q.caseStudyId && (
                      <div className="p-4 border-t border-border/60 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {q.caseStudyScenarioText}
                      </div>
                    )}
                  </div>
                )}

                {/* Question Text */}
                <p className="text-sm font-extrabold text-foreground leading-snug whitespace-pre-wrap pt-1">
                  {q.questionText}
                </p>

                {/* Option list */}
                <div className="space-y-2.5">
                  {q.options.map((opt) => {
                    const isSelected = q.selectedAnswer === opt.optionLetter;
                    const isRightAnswer = q.correctAnswer === opt.optionLetter;

                    return (
                      <div
                        key={opt.optionLetter}
                        className={cn(
                          "p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-3",
                          isRightAnswer
                            ? "border-emerald-500 bg-emerald-500/5 text-emerald-800 dark:text-emerald-400 font-bold"
                            : isSelected && isIncorrect
                            ? "border-destructive bg-destructive/5 text-destructive font-bold"
                            : "border-border/60 text-foreground"
                        )}
                      >
                        <span className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] shrink-0",
                          isRightAnswer
                            ? "border-emerald-500 bg-emerald-500 text-white font-extrabold"
                            : isSelected && isIncorrect
                            ? "border-destructive bg-destructive text-white font-extrabold"
                            : "border-muted-foreground/30 text-muted-foreground"
                        )}>
                          {opt.optionLetter}
                        </span>
                        <span className="flex-1 pt-0.5 leading-snug">{opt.optionText}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Explanations & Workings */}
                {q.explanation && (
                  <div className="mt-4 p-4 rounded-xl border border-dashed border-border bg-muted/5 space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Academic Explanation & Reference
                    </h4>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {q.explanation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
