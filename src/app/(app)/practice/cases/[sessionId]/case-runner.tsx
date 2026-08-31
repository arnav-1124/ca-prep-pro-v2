"use client";

import { useState, useRef } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import {
  PracticeSessionState
} from "@/domains/practice/services";
import {
  submitAnswerAction,
  getExplanationAction
} from "@/app/actions/practice";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LimitDialog } from "@/components/app/limit-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

interface CaseRunnerProps {
  initialState: PracticeSessionState;
}

export function CaseRunner({ initialState }: CaseRunnerProps) {
  const router = useNextRouter();

  // Active runner state
  const [state, setState] = useState<PracticeSessionState>(initialState);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  
  // Interaction states
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<{ explanation: string; keyPoint: string } | null>(null);
  const [aiQuotaError, setAiQuotaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loadingAiRef = useRef(false);

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

  const questionsList = state.questions;
  const currentQuestion = questionsList[currentIndex] || null;

  // Sync index on completion redirect or end of questions
  const totalQuestions = questionsList.length;

  // Resolve if current question has already been submitted to DB
  const existingAttempt = state.attempts.find(
    (a) => a.questionVersionId === currentQuestion?.questionVersionId
  );

  // Selected option is either the submitted answer or the client draft answer
  const selectedOption = existingAttempt
    ? existingAttempt.selectedAnswer
    : currentQuestion
      ? (draftAnswers[currentQuestion.questionVersionId] || "")
      : "";

  const handleSelectOption = (letter: string) => {
    if (existingAttempt) return; // Answer locked
    if (!currentQuestion) return;

    setDraftAnswers({
      ...draftAnswers,
      [currentQuestion.questionVersionId]: letter,
    });
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || existingAttempt || !selectedOption) return;

    setLoadingSubmit(true);
    setAiExplanation(null);
    setAiQuotaError(null);

    const res = await submitAnswerAction(
      state.sessionId,
      currentQuestion.questionVersionId,
      selectedOption
    );

    if (res.success && res.result) {
      // Append the attempt and update local runner state
      const newAttempts = [
        ...state.attempts,
        {
          id: res.result.attemptId,
          questionVersionId: currentQuestion.questionVersionId,
          selectedAnswer: selectedOption,
          isCorrect: res.result.isCorrect,
          questionText: currentQuestion.questionText,
          correctAnswer: res.result.correctAnswer,
          explanation: res.result.explanation,
        },
      ];

      const isCompleted = newAttempts.length >= totalQuestions;

      setState({
        ...state,
        attempts: newAttempts,
        status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      });
      setSubmitError(null);
    } else {
      setSubmitError(res.error || "Failed to submit answer. Please try again.");
    }
    setLoadingSubmit(false);
  };

  const handleUnderstandWithAi = async () => {
    if (loadingAi || aiExplanation || loadingAiRef.current) return;
    loadingAiRef.current = true;
    setLoadingAi(true);
    setAiQuotaError(null);
    setAiExplanation(null);

    try {
      const res = await getExplanationAction(state.sessionId, currentQuestion.questionVersionId);
      if (res.success && res.explanation) {
        setAiExplanation({
          explanation: res.explanation,
          keyPoint: res.keyPoint || "",
        });
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
          setAiQuotaError(res.error || "Failed to contact study tutor. Please try again.");
        }
      }
    } catch {
      setAiQuotaError("An unexpected connection issue occurred. Please try again.");
    } finally {
      loadingAiRef.current = false;
      setLoadingAi(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
      setAiExplanation(null);
      setAiQuotaError(null);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAiExplanation(null);
      setAiQuotaError(null);
    }
  };

  // Case Study Details Panel Render Helper
  const renderCaseStudyPassage = () => {
    if (!currentQuestion) return null;
    return (
      <div className="space-y-4 font-sans text-sm leading-relaxed text-foreground select-text pr-2">
        <div className="flex items-center gap-2 text-primary font-bold">
          <BookOpen className="h-4 w-4" />
          <span className="uppercase tracking-wider text-xs">Shared Passage Facts</span>
        </div>
        <h2 className="text-base font-extrabold text-foreground border-b border-border pb-2">
          {currentQuestion.caseStudyTitle || "Case Scenario"}
        </h2>
        <div className="whitespace-pre-wrap text-muted-foreground bg-muted/20 border border-border/50 rounded-xl p-4 md:p-5 text-xs md:text-sm font-sans font-medium max-h-[70vh] overflow-y-auto">
          {currentQuestion.caseStudyScenarioText}
        </div>
      </div>
    );
  };

  if (state.status === "COMPLETED") {
    // Session summary view
    const correctCount = state.attempts.filter((a) => a.isCorrect).length;
    const accuracy = state.attempts.length > 0
      ? Math.round((correctCount / state.attempts.length) * 100)
      : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="border border-border bg-card rounded-2xl p-6 shadow-xs text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-black text-foreground">Practice Session Completed!</h1>
          <p className="text-xs text-muted-foreground font-sans">
            You&apos;ve completed all questions in the Case Study session.
          </p>

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-6 mt-6">
            <div className="text-center space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Attempted</span>
              <p className="text-xl font-bold text-foreground">{state.attempts.length}</p>
            </div>
            <div className="text-center space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Correct</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</p>
            </div>
            <div className="text-center space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Accuracy</span>
              <p className="text-xl font-bold text-foreground">{accuracy}%</p>
            </div>
          </div>

          <div className="border border-border/60 bg-muted/10 rounded-xl p-4 mt-6">
            <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${accuracy}%` }}
              />
            </div>
          </div>

          <div className="pt-6">
            <Button
              onClick={() => router.push("/practice")}
              className="w-full sm:w-auto font-bold cursor-pointer"
            >
              Back to Practice Config
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="space-y-6">
      {/* Top Session Progress Bar */}
      <div className="flex items-center justify-between gap-4 border border-border bg-card rounded-2xl px-5 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
            Case Study
          </span>
          <span className="text-xs font-bold text-muted-foreground font-sans uppercase">
            {currentQuestion.subjectName}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-sans font-bold text-muted-foreground">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <div className="h-4 w-px bg-muted" />
          <span className="uppercase text-[10px] tracking-wider bg-muted border border-border/80 px-2 py-0.5 rounded text-foreground">
            {currentQuestion.difficulty}
          </span>
        </div>
      </div>

      {/* Main Runner Body Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Side: Case Study Passage (Visible on Desktop / Tablet Only) */}
        <div className="hidden lg:block border border-border bg-card rounded-2xl p-6 shadow-2xs sticky top-20 min-h-[500px]">
          {renderCaseStudyPassage()}
        </div>

        {/* Right Side: Active Question Panel */}
        <div className="space-y-6">
          
          {/* Mobile Overlay Trigger (Visible on Mobile Only) */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex items-center justify-center gap-2 cursor-pointer font-bold">
                  <Menu className="h-4 w-4" />
                  <span>View Case Study Scenario / Passage</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl font-sans">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-left font-extrabold">Case Scenario</SheetTitle>
                </SheetHeader>
                {renderCaseStudyPassage()}
              </SheetContent>
            </Sheet>
          </div>

          <div className="border border-border bg-card rounded-2xl p-6 shadow-2xs space-y-6">
            
            {/* Question Text */}
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                Question Context
              </span>
              <p className="text-sm md:text-base font-bold text-foreground leading-relaxed select-text mt-1">
                {currentQuestion.questionText}
              </p>
            </div>

            {/* Options list */}
            <div className="space-y-3">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt.optionLetter;
                const isCorrect = currentQuestion.correctAnswer === opt.optionLetter;

                let optStyle = "border-border hover:border-primary/20 bg-card text-foreground";
                if (isSelected) {
                  optStyle = "border-primary bg-primary/5 text-primary";
                }

                // If submitted, show correctness coloring overrides
                if (existingAttempt) {
                  if (opt.optionLetter === existingAttempt.selectedAnswer) {
                    optStyle = existingAttempt.isCorrect
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400";
                  } else if (isCorrect) {
                    optStyle = "border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
                  } else {
                    optStyle = "border-border bg-card text-muted-foreground opacity-50";
                  }
                }

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.optionLetter)}
                    className={cn(
                      "flex items-start gap-3 border rounded-xl p-4 transition-all duration-150 cursor-pointer select-none text-xs md:text-sm font-sans font-medium",
                      optStyle,
                      existingAttempt && "cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center justify-center h-6 w-6 rounded-full border border-current font-bold shrink-0 text-xs">
                      {opt.optionLetter}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{opt.optionText}</span>
                  </div>
                );
              })}
            </div>

            {/* Submit Control */}
            {!existingAttempt && (
              <div className="space-y-3 pt-2 border-t border-border">
                {submitError && (
                  <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-3 text-xs text-destructive flex items-center gap-2">
                    <span>{submitError}</span>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!selectedOption || loadingSubmit}
                    className="w-full sm:w-auto h-9 cursor-pointer select-none font-bold"
                  >
                    {loadingSubmit ? "Checking Answer..." : "Submit Answer"}
                  </Button>
                </div>
              </div>
            )}

            {/* Feedback Box & AI explanation Trigger */}
            {existingAttempt && (
              <div className="space-y-4 pt-4 border-t border-border animate-in fade-in duration-200">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl p-4 border text-xs md:text-sm font-sans",
                    existingAttempt.isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400"
                  )}
                >
                  {existingAttempt.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <span className="font-bold">
                      {existingAttempt.isCorrect ? "Correct answer!" : "Incorrect option selected."}
                    </span>
                    <p className="text-muted-foreground">
                      Reference Option <span className="font-bold text-foreground">{existingAttempt.correctAnswer}</span> is correct.
                    </p>
                  </div>
                </div>

                {/* AI explanations container */}
                {aiExplanation && (
                  <div className="border border-border/80 bg-muted/10 rounded-xl p-4 md:p-5 space-y-4 animate-in fade-in duration-300 text-xs md:text-sm font-sans">
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      <span>Study Tutor Breakdown</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed select-text">
                      {aiExplanation.explanation}
                    </p>
                    {aiExplanation.keyPoint && (
                      <div className="flex items-start gap-2 border-t border-border pt-3 mt-3 text-xs">
                        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-foreground font-medium select-text">
                          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-600 mr-1.5">
                            Key Takeaway:
                          </span>
                          {aiExplanation.keyPoint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {aiQuotaError && (
                  <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-4 flex items-start gap-2 text-xs text-destructive animate-in fade-in duration-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{aiQuotaError}</span>
                  </div>
                )}

                {/* AI Action Trigger */}
                {!aiExplanation && (
                  <div className="flex justify-end">
                    <Button
                      onClick={handleUnderstandWithAi}
                      disabled={loadingAi}
                      variant="outline"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-150 cursor-pointer font-bold text-xs"
                    >
                      {loadingAi ? (
                        <>
                          <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span>Generating explanation...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Understand with AI Study Tutor</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation controls */}
          <div className="flex items-center justify-between gap-4">
            <Button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              variant="outline"
              className="flex items-center gap-1.5 cursor-pointer font-bold text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous Question</span>
            </Button>

            <Button
              onClick={handleNext}
              disabled={currentIndex === totalQuestions - 1}
              variant="outline"
              className="flex items-center gap-1.5 cursor-pointer font-bold text-xs"
            >
              <span>Next Question</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

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
