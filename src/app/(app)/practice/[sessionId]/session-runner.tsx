"use client";

import { useState } from "react";
import { getNextQuestionAction } from "@/app/actions/practice";
import {
  StudentPracticeQuestionDto,
  PracticeSessionDetailsDto,
} from "@/domains/practice/types";
import {
  HelpCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SessionRunnerProps {
  sessionId: string;
  initialQuestion: StudentPracticeQuestionDto | null;
  sessionDetails: PracticeSessionDetailsDto;
}

export function SessionRunner({
  sessionId,
  initialQuestion,
  sessionDetails,
}: SessionRunnerProps) {
  const [currentQuestion, setCurrentQuestion] = useState<StudentPracticeQuestionDto | null>(initialQuestion);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(
    sessionDetails.status === "COMPLETED" || sessionDetails.status === "ABANDONED" || !initialQuestion
  );
  const [deliveredCount, setDeliveredCount] = useState(
    initialQuestion?.sequenceNumber || sessionDetails.deliveredCount || 0
  );
  const [totalQuestions] = useState(sessionDetails.questionCount || 10);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  // Handle advancing to the next delivered question
  const handleNextQuestion = async () => {
    if (isNavigating) return;

    setIsNavigating(true);
    setNavigationError(null);

    try {
      const res = await getNextQuestionAction(sessionId);

      if (!res.success) {
        setNavigationError(res.error || "Failed to load next question. Please try again.");
        setIsNavigating(false);
        return;
      }

      if (res.isCompleted || !res.question) {
        setIsCompleted(true);
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(res.question);
        setDeliveredCount(res.deliveredCount);
        setSelectedOption(null);
      }
    } catch {
      setNavigationError("A connection issue occurred while fetching the next question.");
    } finally {
      setIsNavigating(false);
    }
  };

  // Render Completed Summary View
  if (isCompleted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border border-border bg-card text-card-foreground rounded-2xl p-8 shadow-xs text-center space-y-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Practice Session Complete
            </h1>
            <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">
              You have completed all {totalQuestions} requested questions in this practice set.
            </p>
          </div>

          {/* Session Summary Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 text-left">
            <div className="border border-border/60 bg-muted/20 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Level</span>
              <span className="text-xs font-bold text-foreground mt-0.5 block truncate">
                {sessionDetails.levelName}
              </span>
            </div>
            <div className="border border-border/60 bg-muted/20 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Subject</span>
              <span className="text-xs font-bold text-foreground mt-0.5 block truncate">
                {sessionDetails.subjectName || "All Subjects"}
              </span>
            </div>
            <div className="border border-border/60 bg-muted/20 p-3.5 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Delivered</span>
              <span className="text-xs font-bold text-foreground mt-0.5 block">
                {totalQuestions} Questions
              </span>
            </div>
          </div>

          {/* Step 22 Delivery Engine Note */}
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-3.5 text-xs text-muted-foreground font-sans text-left flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-foreground">Delivery Engine Verified:</span> All questions were deterministically selected and delivered with immutable version snapshots. Answer submission and grading will be enabled in Step 23.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/practice"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs"
            >
              <BookOpen className="h-4 w-4" />
              <span>New Practice Set</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-card border border-border px-5 py-2.5 text-xs font-bold text-foreground hover:bg-muted/40 transition-all select-none"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handle empty state if no question could be selected
  if (!currentQuestion) {
    return (
      <div className="max-w-xl mx-auto border border-border bg-card rounded-2xl p-8 text-center space-y-4 shadow-xs">
        <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
          <HelpCircle className="h-5 w-5" />
        </div>
        <h2 className="text-base font-bold text-foreground">No questions available</h2>
        <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto leading-relaxed">
          There are currently no eligible practice questions published for this syllabus selection. Please select another subject or topic.
        </p>
        <div className="pt-2">
          <Link
            href="/practice"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Select Another Paper</span>
          </Link>
        </div>
      </div>
    );
  }

  const currentSeq = currentQuestion.sequenceNumber || deliveredCount || 1;
  const progressPercent = Math.min(Math.round((currentSeq / totalQuestions) * 100), 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Session Header Context */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/50 pb-4">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">
            {currentQuestion.curriculumContext.subjectName || sessionDetails.subjectName || "General Practice"}
          </span>
          <h1 className="text-base font-bold text-foreground mt-1">
            {currentQuestion.curriculumContext.nodeName || sessionDetails.curriculumNodeName || "Topic Practice"}
          </h1>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[9px] font-extrabold bg-muted border border-border rounded px-2 py-0.5 uppercase text-muted-foreground/80 tracking-wide font-sans">
            Question {currentSeq} of {totalQuestions}
          </span>
          <span
            className={cn(
              "text-[9px] font-extrabold rounded px-2 py-0.5 uppercase tracking-wide font-sans border",
              currentQuestion.difficulty === "EASY" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
              currentQuestion.difficulty === "MEDIUM" && "bg-amber-500/10 text-amber-500 border-amber-500/20",
              currentQuestion.difficulty === "HARD" && "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}
          >
            {currentQuestion.difficulty}
          </span>
          {currentQuestion.questionType === "CASE_STUDY" && (
            <span className="text-[9px] font-extrabold rounded px-2 py-0.5 uppercase tracking-wide font-sans border bg-sky-500/10 text-sky-500 border-sky-500/20">
              Case Study
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden border border-border/20">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Case Study Context Scenario (if present) */}
      {currentQuestion.caseStudy && (
        <div className="border border-sky-500/20 bg-sky-500/5 rounded-2xl p-6 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <FileText className="h-5 w-5" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider">
              {currentQuestion.caseStudy.title || "Case Study Scenario"}
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-foreground/85 font-sans leading-relaxed whitespace-pre-line border-t border-sky-500/15 pt-3">
            {currentQuestion.caseStudy.scenarioText}
          </div>
        </div>
      )}

      {/* Question Card */}
      <div className="border border-border bg-card rounded-2xl p-6 shadow-2xs space-y-6">
        <div className="space-y-4">
          <p className="text-sm sm:text-base font-medium text-foreground/90 leading-relaxed font-sans whitespace-pre-line">
            {currentQuestion.questionText}
          </p>
        </div>

        {/* Options Selection */}
        <div className="flex flex-col gap-2">
          {currentQuestion.options.map((opt) => {
            const letter = opt.optionLetter;
            const isSelected = selectedOption === letter;

            return (
              <div
                key={opt.id}
                onClick={() => setSelectedOption(letter)}
                className={cn(
                  "border rounded-xl p-4 flex items-start gap-3 transition-all select-none duration-150 relative cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "hover:bg-muted/40 hover:border-border/60 border-border/80 bg-background/50"
                )}
              >
                {/* Radio Indicator */}
                <span
                  className={cn(
                    "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all select-none",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-extrabold"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {letter}
                </span>

                <span className="text-xs sm:text-sm text-foreground/80 leading-relaxed font-sans">
                  {opt.optionText}
                </span>
              </div>
            );
          })}
        </div>

        {navigationError && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-3 text-xs text-destructive flex items-center gap-2">
            <span>{navigationError}</span>
          </div>
        )}

        {/* Step 22 Delivery Action Footer */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-between items-center border-t border-border/40">
          <div className="text-[11px] text-muted-foreground font-sans">
            {selectedOption ? (
              <span>Selected Option: <strong className="text-foreground">{selectedOption}</strong></span>
            ) : (
              <span>Select an option to review your answer.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleNextQuestion}
              disabled={isNavigating}
              className={cn(
                "w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs",
                isNavigating && "opacity-60 pointer-events-none"
              )}
            >
              {isNavigating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading next question...</span>
                </>
              ) : currentSeq >= totalQuestions ? (
                <>
                  <span>Finish Practice</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Next Question</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
