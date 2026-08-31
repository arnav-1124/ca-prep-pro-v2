"use client";

import { useState, useRef } from "react";
import {
  getPracticeStateAction,
  submitAnswerAction,
  getExplanationAction
} from "@/app/actions/practice";
import { PracticeSessionState } from "@/domains/practice/services";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { LimitDialog } from "@/components/app/limit-dialog";

interface SessionRunnerProps {
  sessionId: string;
  initialState: PracticeSessionState;
}

export function SessionRunner({ sessionId, initialState }: SessionRunnerProps) {
  const [state, setState] = useState<PracticeSessionState>(initialState);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // Storing submit progress
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string | null;
  } | null>(null);

  // Storing AI Explanation progress
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [keyPointText, setKeyPointText] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Limit Dialog state
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitMetadata, setLimitMetadata] = useState<{
    studentName: string;
    featureName: string;
    currentPlan: string;
    limitCount: number;
    period: string;
    isRenewable: boolean;
  } | null>(null);

  const currentQuestion = state.currentQuestion;
  const isCompleted = state.status === "COMPLETED";

  // Reload session state from the server side
  const refreshState = async () => {
    const res = await getPracticeStateAction(sessionId);
    if (res.success && res.state) {
      setState(res.state);
      setSelectedOption(null);
      setShowFeedback(false);
      setFeedbackResult(null);
      setExplanationText(null);
      setKeyPointText(null);
      setExplanationError(null);
    }
  };

  // Submit student answer choice
  const handleSubmit = async () => {
    if (!currentQuestion || !selectedOption || isSubmitting) return;

    setIsSubmitting(true);
    const res = await submitAnswerAction(
      sessionId,
      currentQuestion.questionVersionId,
      selectedOption
    );

    if (res.success && res.result) {
      setSubmitError(null);
      setFeedbackResult({
        isCorrect: res.result.isCorrect,
        correctAnswer: res.result.correctAnswer,
        explanation: res.result.explanation,
      });
      setShowFeedback(true);
    } else {
      setSubmitError(res.error || "Failed to submit answer. Please try again.");
    }
    setIsSubmitting(false);
  };

  const handleUnderstandWithAi = async () => {
    if (!currentQuestion || isGeneratingExplanation || explanationText || isGeneratingRef.current) return;

    isGeneratingRef.current = true;
    setIsGeneratingExplanation(true);
    setExplanationError(null);

    try {
      const res = await getExplanationAction(
        sessionId,
        currentQuestion.questionVersionId
      );

      if (res.success && res.explanation) {
        setExplanationText(res.explanation);
        setKeyPointText(res.keyPoint || null);
      } else {
        if (res.isQuotaExceeded && res.limitDetails) {
          setLimitMetadata({
            studentName: res.limitDetails.name,
            featureName: "AI Explanation",
            currentPlan: res.limitDetails.plan,
            limitCount: res.limitDetails.limit,
            period: "24-hour",
            isRenewable: true,
          });
          setShowLimitDialog(true);
        } else {
          setExplanationError(res.error || "Could not generate an explanation right now.");
        }
      }
    } catch {
      setExplanationError("An unexpected connection issue occurred. Please try again.");
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingExplanation(false);
    }
  };

  // Render Completed Summary State
  if (isCompleted) {
    const summary = state.summary;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border border-border bg-card text-card-foreground rounded-2xl p-8 shadow-xs text-center space-y-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Practice Session Complete</h1>
            <p className="text-xs text-muted-foreground font-sans">
              Excellent! You have successfully completed your study practice set.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4">
            <div className="border border-border/60 bg-muted/20 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase block">Attempted</span>
              <span className="text-xl font-extrabold text-foreground mt-1 block">{state.totalQuestions}</span>
            </div>
            <div className="border border-border/60 bg-primary/5 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-primary block uppercase">Correct</span>
              <span className="text-xl font-extrabold text-primary mt-1 block">{summary?.correctCount || 0}</span>
            </div>
            <div className="border border-border/60 bg-muted/20 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">Incorrect</span>
              <span className="text-xl font-extrabold text-foreground mt-1 block">{summary?.incorrectCount || 0}</span>
            </div>
            <div className="border border-border/60 bg-primary/10 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-primary block uppercase">Accuracy</span>
              <span className="text-xl font-extrabold text-primary mt-1 block">{summary?.accuracy || 0}%</span>
            </div>
          </div>

          {/* Accuracy Progress bar */}
          <div className="space-y-1.5 px-2">
            <div className="flex justify-between text-[10px] font-extrabold text-muted-foreground/75 uppercase tracking-wide">
              <span>Overall Accuracy</span>
              <span>{summary?.accuracy || 0}%</span>
            </div>
            <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden border border-border/40">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${summary?.accuracy || 0}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/practice"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs"
            >
              <BookOpen className="h-4 w-4" />
              <span>Practice Again</span>
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

  // Handle empty state if no questions were returned for the selected paper/scope
  if (!currentQuestion) {
    return (
      <div className="max-w-xl mx-auto border border-border bg-card rounded-2xl p-8 text-center space-y-4 shadow-xs">
        <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
          <HelpCircle className="h-5 w-5" />
        </div>
        <h2 className="text-base font-bold text-foreground">No questions available</h2>
        <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto leading-relaxed">
          There are currently no practice questions published under this paper code. Please choose another subject or check back later.
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Session Header Context */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/50 pb-4">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">
            {currentQuestion.subjectName}
          </span>
          <h1 className="text-base font-bold text-foreground mt-1">
            {state.curriculumNodeName || "Practice Session"}
          </h1>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[9px] font-extrabold bg-muted border border-border rounded px-2 py-0.5 uppercase text-muted-foreground/80 tracking-wide font-sans">
            Question {state.currentNumber} of {state.totalQuestions}
          </span>
          <span className={cn(
            "text-[9px] font-extrabold rounded px-2 py-0.5 uppercase tracking-wide font-sans border",
            currentQuestion.difficulty === "EASY" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            currentQuestion.difficulty === "MEDIUM" && "bg-amber-500/10 text-amber-500 border-amber-500/20",
            currentQuestion.difficulty === "HARD" && "bg-rose-500/10 text-rose-500 border-rose-500/20"
          )}>
            {currentQuestion.difficulty}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden border border-border/20">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${((state.currentNumber - 1) / state.totalQuestions) * 100}%` }}
        />
      </div>

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
            const isAnswered = showFeedback;
            
            // Highlight styling after submission
            const isCorrectAnswer = feedbackResult?.correctAnswer === letter;
            const isSelectedWrong = isSelected && !feedbackResult?.isCorrect;

            return (
              <div
                key={opt.id}
                onClick={() => !isAnswered && setSelectedOption(letter)}
                className={cn(
                  "border rounded-xl p-4 flex items-start gap-3 transition-all select-none duration-150 relative",
                  !isAnswered ? "cursor-pointer hover:bg-muted/40 hover:border-border/60" : "cursor-default",
                  isSelected && "border-primary bg-primary/5",
                  isAnswered && isCorrectAnswer && "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-50",
                  isAnswered && isSelectedWrong && "border-rose-500/30 bg-rose-500/5 text-rose-950 dark:text-rose-50"
                )}
              >
                {/* Radio Indicator */}
                <span className={cn(
                  "h-5 w-5 rounded-full border border-border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all select-none",
                  isSelected && "border-primary bg-primary text-primary-foreground",
                  isAnswered && isCorrectAnswer && "border-emerald-500 bg-emerald-500 text-white",
                  isAnswered && isSelectedWrong && "border-rose-500 bg-rose-500 text-white"
                )}>
                  {isAnswered && isCorrectAnswer ? <Check className="h-3 w-3" /> : null}
                  {isAnswered && isSelectedWrong ? <X className="h-3 w-3" /> : null}
                  {!isAnswered || (!isCorrectAnswer && !isSelectedWrong) ? letter : null}
                </span>

                <span className="text-xs sm:text-sm text-foreground/80 leading-relaxed leading-normal font-sans">
                  {opt.optionText}
                </span>
              </div>
            );
          })}
        </div>

        {submitError && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-3 text-xs text-destructive flex items-center gap-2">
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-end">
          {!showFeedback ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption || isSubmitting}
              className={cn(
                "w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs",
                (!selectedOption || isSubmitting) && "opacity-50 pointer-events-none"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Answer</span>
              )}
            </button>
          ) : (
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-3">
              {/* Feedback banner */}
              <div className="flex items-center gap-2 self-start">
                {feedbackResult?.isCorrect ? (
                  <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-extrabold uppercase">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Correct Answer</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-500 text-xs font-extrabold uppercase">
                    <XCircle className="h-5 w-5" />
                    <span>Incorrect Answer</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={handleUnderstandWithAi}
                  disabled={isGeneratingExplanation || !!explanationText}
                  className={cn(
                    "w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 px-5 py-2.5 text-xs font-bold text-primary transition-all select-none",
                    (isGeneratingExplanation || !!explanationText) && "opacity-50 pointer-events-none"
                  )}
                >
                  {isGeneratingExplanation ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Understand with AI</span>
                    </>
                  )}
                </button>
                <button
                  onClick={refreshState}
                  className="w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs"
                >
                  <span>Next Question</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Explanation Compact Box */}
      {(explanationText || isGeneratingExplanation || explanationError) && (
        <div className="border border-primary/15 bg-primary/5 rounded-2xl p-6 shadow-2xs space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-wider">Concept tutor explanation</span>
          </div>

          {isGeneratingExplanation ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Generating concept brief explaining the accounting rules...</span>
            </div>
          ) : explanationError ? (
            <p className="text-xs text-rose-500 font-sans leading-relaxed">{explanationError}</p>
          ) : (
            <div className="space-y-4 font-sans text-foreground/80">
              <p className="text-xs sm:text-sm leading-relaxed leading-normal whitespace-pre-line">
                {explanationText}
              </p>

              {keyPointText && (
                <div className="bg-primary/10 border-l-2 border-primary p-3 rounded-r-lg">
                  <span className="text-[10px] font-bold text-primary block uppercase">Key Takeaway</span>
                  <p className="text-xs text-foreground/90 mt-1 font-medium italic">{keyPointText}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Default Book explanation (Only shown if AI was not generated yet, to help student study offline) */}
      {showFeedback && !explanationText && !isGeneratingExplanation && feedbackResult?.explanation && (
        <div className="border border-border/80 bg-muted/10 rounded-2xl p-5 space-y-3 font-sans text-muted-foreground">
          <span className="text-[9px] font-extrabold uppercase tracking-wider block text-muted-foreground/60">
            Study reference explanation
          </span>
          <p className="text-xs leading-relaxed whitespace-pre-line">{feedbackResult.explanation}</p>
        </div>
      )}

      {limitMetadata && (
        <LimitDialog
          isOpen={showLimitDialog}
          onClose={() => setShowLimitDialog(false)}
          studentName={limitMetadata.studentName}
          featureName={limitMetadata.featureName}
          currentPlan={limitMetadata.currentPlan}
          limitCount={limitMetadata.limitCount}
          period={limitMetadata.period}
          isRenewable={limitMetadata.isRenewable}
        />
      )}
    </div>
  );
}
