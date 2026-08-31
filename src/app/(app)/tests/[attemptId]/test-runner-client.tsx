"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { testAttempts, tests } from "@/db/schema";
import { RunnerQuestion } from "@/domains/tests/services";
import {
  saveAnswerStateAction,
  pauseAttemptAction,
  resumeAttemptAction,
  submitTestAttemptAction
} from "@/app/actions/tests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Pause,
  Play,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  FileText,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

interface TestRunnerClientProps {
  attemptId: string;
  initialAttempt: typeof testAttempts.$inferSelect;
  test: typeof tests.$inferSelect;
  initialQuestions: RunnerQuestion[];
  initialTimeRemaining: number;
}

export function TestRunnerClient({
  attemptId,
  initialAttempt,
  test,
  initialQuestions,
  initialTimeRemaining,
}: TestRunnerClientProps) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(initialAttempt);
  const [questionsList, setQuestionsList] = useState<RunnerQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [activeModal, setActiveModal] = useState<"confirm" | "empty" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Keep track of time spent per question. Key is questionVersionId, value is seconds
  const [timeSpentMap, setTimeSpentMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    initialQuestions.forEach((q) => {
      map[q.questionVersionId] = 0;
    });
    return map;
  });

  const activeQuestion = questionsList[currentIndex];

  // Ref to track interval timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeQuestionRef = useRef(activeQuestion);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  const handleAutoSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await submitTestAttemptAction(attemptId);
      router.push(`/tests/${attemptId}/results`);
    } catch {
      router.push(`/tests/${attemptId}/results`);
    }
  }, [attemptId, router]);

  // 1. Timer logic
  useEffect(() => {
    if (attempt.status !== "STARTED") return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });

      // Increment time spent on current question
      if (activeQuestionRef.current) {
        setTimeSpentMap((prev) => ({
          ...prev,
          [activeQuestionRef.current.questionVersionId]:
            (prev[activeQuestionRef.current.questionVersionId] || 0) + 1,
        }));
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attempt.status, currentIndex, handleAutoSubmit]);

  // 2. Answer Selection & Review Flags
  const handleSelectOption = async (optionLetter: string) => {
    if (attempt.status !== "STARTED") return;

    setSaveStatus("saving");
    const updatedQuestions = [...questionsList];
    const q = { ...updatedQuestions[currentIndex], selectedAnswer: optionLetter };
    updatedQuestions[currentIndex] = q;
    setQuestionsList(updatedQuestions);

    try {
      const response = await saveAnswerStateAction(
        attemptId,
        q.questionVersionId,
        optionLetter,
        q.markedForReview,
        timeSpentMap[q.questionVersionId] || 0
      );

      if (response.success) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  };

  const handleToggleReview = async () => {
    if (attempt.status !== "STARTED") return;

    setSaveStatus("saving");
    const updatedQuestions = [...questionsList];
    const q = { ...updatedQuestions[currentIndex], markedForReview: !updatedQuestions[currentIndex].markedForReview };
    updatedQuestions[currentIndex] = q;
    setQuestionsList(updatedQuestions);

    try {
      const response = await saveAnswerStateAction(
        attemptId,
        q.questionVersionId,
        q.selectedAnswer,
        q.markedForReview,
        timeSpentMap[q.questionVersionId] || 0
      );

      if (response.success) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  };

  // 3. Pause & Resume Controls
  const handlePause = async () => {
    if (isPausing) return;
    setIsPausing(true);
    try {
      const res = await pauseAttemptAction(attemptId);
      if (res.success) {
        setAttempt((prev) => ({ ...prev, status: "PAUSED" }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    if (isPausing) return;
    setIsPausing(true);
    try {
      const res = await resumeAttemptAction(attemptId);
      if (res.success) {
        // Fetch fresh state to sync correct remaining time
        router.refresh();
        setAttempt((prev) => ({ ...prev, status: "STARTED" }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPausing(false);
    }
  };

  // 4. Submission Handlers
  const triggerSubmitCheck = () => {
    const hasAnyAnswer = questionsList.some((q) => q.selectedAnswer !== null);
    if (!hasAnyAnswer) {
      setActiveModal("empty");
    } else {
      setActiveModal("confirm");
    }
  };

  const handleActualSubmit = async () => {
    if (isSubmitting) return;
    setActiveModal(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      // Save current active question's elapsed timing first
      if (activeQuestion) {
        await saveAnswerStateAction(
          attemptId,
          activeQuestion.questionVersionId,
          activeQuestion.selectedAnswer,
          activeQuestion.markedForReview,
          timeSpentMap[activeQuestion.questionVersionId] || 0
        );
      }

      const res = await submitTestAttemptAction(attemptId);
      if (res.success) {
        router.push(`/tests/${attemptId}/results`);
      }
    } catch {
      setSubmitError("Something went wrong while submitting your assessment. Your answers are safe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format remaining timer display
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Render Paused Overlay state
  if (attempt.status === "PAUSED") {
    return (
      <main className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center min-h-[70vh] text-center max-w-lg mx-auto space-y-6">
        <div className="bg-amber-500/10 text-amber-500 rounded-full p-4 animate-pulse">
          <Pause className="h-10 w-10 fill-current" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Assessment Paused
          </h1>
          <p className="text-sm text-muted-foreground">
            Your timer is paused. The time spent will not count toward your duration budget. Resume when you are ready to continue.
          </p>
        </div>
        <Button
          onClick={handleResume}
          disabled={isPausing}
          size="lg"
          className="w-full font-bold cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground"
        >
          {isPausing ? "Resuming..." : "Resume Assessment"}
          <Play className="ml-2 h-4 w-4 fill-current" />
        </Button>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* 1. Header Toolbar */}
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Assessment Test
            </span>
            {saveStatus === "saving" && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/20 text-primary animate-pulse">
                Saving answers...
              </Badge>
            )}
            {saveStatus === "error" && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/20 text-destructive">
                Save connection error
              </Badge>
            )}
          </div>
          <h1 className="text-sm font-extrabold text-foreground line-clamp-1">
            {test.title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60 font-mono text-sm font-black text-foreground">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span>{formatTime(timeRemaining)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={isPausing}
              className="font-bold cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline ml-1.5">Pause</span>
            </Button>
             <Button
              size="sm"
              onClick={triggerSubmitCheck}
              disabled={isSubmitting}
              className="font-bold cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground"
            >
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline ml-1.5">Submit Test</span>
            </Button>
          </div>
        </div>
      </header>

      {submitError && (
        <div className="bg-destructive/10 border-b border-destructive/20 text-destructive text-xs px-6 py-2.5 font-bold flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 2. Main Runner Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          {activeQuestion?.caseStudyId ? (
            /* Split layout for case studies */
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left Column: Scrollable Scenario */}
              <ScrollArea className="h-full bg-muted/5">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                      {activeQuestion.caseStudyTitle || "Case Scenario"}
                    </h2>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {activeQuestion.caseStudyScenarioText}
                  </div>
                </div>
              </ScrollArea>

              {/* Right Column: Question + Options */}
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <span className="text-xs font-bold text-muted-foreground">
                      Case Question {currentIndex + 1} of {questionsList.length}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-extrabold uppercase px-2 py-0.5">
                      Case-Based MCQ
                    </Badge>
                  </div>
                  <h3 className="text-base font-extrabold text-foreground leading-snug whitespace-pre-wrap">
                    {activeQuestion.questionText}
                  </h3>
                  <div className="space-y-3">
                    {activeQuestion.options.map((opt) => (
                      <button
                        key={opt.optionLetter}
                        onClick={() => handleSelectOption(opt.optionLetter)}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer flex items-start gap-3",
                          activeQuestion.selectedAnswer === opt.optionLetter
                            ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                            : "border-border hover:border-border/100 hover:bg-muted/10 text-foreground"
                        )}
                      >
                        <span className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center text-xs shrink-0",
                          activeQuestion.selectedAnswer === opt.optionLetter
                            ? "border-primary bg-primary text-primary-foreground font-black"
                            : "border-muted-foreground/30 text-muted-foreground"
                        )}>
                          {opt.optionLetter}
                        </span>
                        <span className="flex-1 pt-0.5 leading-snug">{opt.optionText}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Full-width standalone layout */
            <ScrollArea className="flex-1 h-full">
              <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <span className="text-xs font-bold text-muted-foreground">
                    Question {currentIndex + 1} of {questionsList.length}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-extrabold uppercase px-2 py-0.5 border-border/60 text-muted-foreground">
                    Standalone MCQ
                  </Badge>
                </div>
                <h3 className="text-lg font-extrabold text-foreground leading-snug whitespace-pre-wrap">
                  {activeQuestion?.questionText}
                </h3>
                <div className="space-y-3">
                  {activeQuestion?.options.map((opt) => (
                    <button
                      key={opt.optionLetter}
                      onClick={() => handleSelectOption(opt.optionLetter)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer flex items-start gap-3",
                        activeQuestion.selectedAnswer === opt.optionLetter
                          ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                          : "border-border hover:border-border/100 hover:bg-muted/10 text-foreground"
                      )}
                    >
                      <span className={cn(
                        "h-5 w-5 rounded-full border flex items-center justify-center text-xs shrink-0",
                        activeQuestion.selectedAnswer === opt.optionLetter
                          ? "border-primary bg-primary text-primary-foreground font-black"
                          : "border-muted-foreground/30 text-muted-foreground"
                      )}>
                        {opt.optionLetter}
                      </span>
                      <span className="flex-1 pt-0.5 leading-snug">{opt.optionText}</span>
                    </button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right Navigator Panel (Sidebar) */}
        <aside className="w-80 border-l border-border/80 bg-card/40 flex flex-col shrink-0 hidden lg:flex">
          <div className="p-4 border-b border-border/60 shrink-0">
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Questions Navigation
            </h3>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-4 gap-2.5">
              {questionsList.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = q.selectedAnswer !== null;
                const isMarked = q.markedForReview;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "h-10 rounded-lg text-xs font-bold border transition-all duration-150 cursor-pointer flex items-center justify-center relative",
                      isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      isAnswered && !isMarked && "bg-primary text-primary-foreground border-primary",
                      isAnswered && isMarked && "bg-indigo-600 text-white border-indigo-600",
                      !isAnswered && isMarked && "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400",
                      !isAnswered && !isMarked && "border-border bg-background hover:bg-muted/20 text-muted-foreground"
                    )}
                  >
                    {idx + 1}
                    {isMarked && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-background" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Navigator Legend */}
          <div className="p-4 border-t border-border/60 bg-muted/10 space-y-2 shrink-0 text-[10px] font-bold text-muted-foreground">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-primary shrink-0" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-border bg-background shrink-0" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-amber-500 bg-amber-500/15 shrink-0" />
                <span>Marked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-indigo-600 shrink-0" />
                <span>Answered + Marked</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. Bottom Toolbar */}
      <footer className="border-t border-border/80 bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleReview}
            className={cn(
              "font-bold cursor-pointer transition-all duration-200",
              activeQuestion?.markedForReview
                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border text-foreground hover:bg-muted/10"
            )}
          >
            <Flag className={cn("h-4 w-4 shrink-0", activeQuestion?.markedForReview && "fill-current")} />
            <span className="hidden sm:inline ml-1.5">
              {activeQuestion?.markedForReview ? "Marked for Review" : "Mark for Review"}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="font-bold cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex === questionsList.length - 1}
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="font-bold cursor-pointer"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>

      {/* Custom Shadcn Dialog for Submission Confirmation */}
      <Dialog open={activeModal === "confirm"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-md bg-neutral-950 border-neutral-855 text-foreground rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              Submit Assessment?
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs mt-1.5 font-sans">
              Are you sure you want to submit your assessment? You won&apos;t be able to modify your answers after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setActiveModal(null)}
              className="border-neutral-800 hover:bg-neutral-900 cursor-pointer font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleActualSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/95 text-primary-foreground cursor-pointer font-bold text-xs"
            >
              {isSubmitting ? "Submitting..." : "Submit Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Shadcn Dialog for Empty Submission Warnings */}
      <Dialog open={activeModal === "empty"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-md bg-neutral-950 border-neutral-855 text-foreground rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              No Answers Yet
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs mt-1.5 font-sans">
              You haven&apos;t answered any questions yet. Your assessment has not been submitted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setActiveModal(null)}
              className="border-neutral-800 hover:bg-neutral-900 cursor-pointer font-bold text-xs"
            >
              Resume Test
            </Button>
            <Link href="/tests" className="w-full">
              <Button
                variant="destructive"
                className="cursor-pointer font-bold text-xs w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Go Back
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
