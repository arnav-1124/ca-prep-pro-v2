"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { shufflePracticeOptions } from "@/lib/option-shuffler";
import {
  getNextQuestionAction,
  submitPracticeAnswerAction,
  getSessionSummaryAction,
  getExplanationAction,
  completeSessionAction,
} from "@/app/actions/practice";
import {
  StudentPracticeQuestionDto,
  PracticeSessionDetailsDto,
  SubmitAnswerResultDto,
  PracticeSessionSummaryDto,
} from "@/domains/practice/types";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  FileText,
  Sparkles,
  Award,
  BarChart2,
  Check,
  X,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { LimitDialog } from "@/components/app/limit-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SessionRunnerProps {
  sessionId: string;
  initialQuestion: StudentPracticeQuestionDto | null;
  initialAttempt?: SubmitAnswerResultDto | null;
  initialSummary?: PracticeSessionSummaryDto | null;
  sessionDetails: PracticeSessionDetailsDto;
}

export function SessionRunner({
  sessionId,
  initialQuestion,
  initialAttempt = null,
  initialSummary = null,
  sessionDetails,
}: SessionRunnerProps) {
  const isUnlimited = sessionDetails.questionCount === 0;

  const [currentQuestion, setCurrentQuestion] = useState<StudentPracticeQuestionDto | null>(initialQuestion);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    initialAttempt?.selectedAnswer || null
  );
  const [submittedResult, setSubmittedResult] = useState<SubmitAnswerResultDto | null>(
    initialAttempt || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(
    sessionDetails.status === "COMPLETED" || sessionDetails.status === "ABANDONED" || !initialQuestion
  );
  const [sessionSummary, setSessionSummary] = useState<PracticeSessionSummaryDto | null>(initialSummary);
  const [deliveredCount, setDeliveredCount] = useState(
    initialQuestion?.sequenceNumber || sessionDetails.deliveredCount || 0
  );
  const [totalQuestions] = useState(isUnlimited ? 0 : (sessionDetails.questionCount || 10));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI Explanation & Tutor State
  const [aiExplanation, setAiExplanation] = useState<{
    explanation: string;
    keyPoint?: string | null;
  } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);

  // Limit Dialog State for Quota Limits
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitMetadata, setLimitMetadata] = useState<{
    studentName: string;
    featureName: string;
    currentPlan: string;
    limitCount: number;
    period: string;
    isRenewable: boolean;
  } | null>(null);

  // Helper to load complete session summary
  const loadSummary = useCallback(async () => {
    try {
      const res = await getSessionSummaryAction(sessionId);
      if (res.success && res.summary) {
        setSessionSummary(res.summary);
      }
    } catch {
      // Fallback silently if summary fails to load
    }
  }, [sessionId]);

  // Handle student answer submission
  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !selectedOption || isSubmitting || submittedResult) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitPracticeAnswerAction({
        sessionId,
        sessionQuestionId: currentQuestion.sessionQuestionId,
        selectedAnswer: selectedOption,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to evaluate answer. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSubmittedResult(res as SubmitAnswerResultDto);

      if (res.isSessionCompleted) {
        setIsCompleted(true);
        await loadSummary();
      }
    } catch {
      setErrorMessage("A connection issue occurred while submitting your answer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle advancing to the next delivered question
  const handleNextQuestion = async () => {
    if (isNavigating) return;

    // If current submission already completed the session, transition to summary
    if (submittedResult?.isSessionCompleted) {
      setIsCompleted(true);
      setCurrentQuestion(null);
      if (!sessionSummary) {
        await loadSummary();
      }
      return;
    }

    setIsNavigating(true);
    setErrorMessage(null);

    try {
      const res = await getNextQuestionAction(sessionId);

      if (!res.success) {
        setErrorMessage(res.error || "Failed to load next question. Please try again.");
        setIsNavigating(false);
        return;
      }

      if (res.isCompleted || !res.question) {
        setIsCompleted(true);
        setCurrentQuestion(null);
        await loadSummary();
      } else {
        setCurrentQuestion(res.question);
        setDeliveredCount(res.deliveredCount);
        setSelectedOption(null);
        setSubmittedResult(null);
        setAiExplanation(null);
        setAiErrorMessage(null);
        setIsGeneratingAi(false);
        isGeneratingRef.current = false;
      }
    } catch {
      setErrorMessage("A connection issue occurred while fetching the next question.");
    } finally {
      setIsNavigating(false);
    }
  };

  // Handle student ending continuous session on demand
  const handleFinishSession = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await completeSessionAction(sessionId);
      setIsCompleted(true);
      setCurrentQuestion(null);
      await loadSummary();
    } catch {
      setIsCompleted(true);
      setCurrentQuestion(null);
      await loadSummary();
    } finally {
      setIsFinishing(false);
    }
  };

  // Handle AI Explanation generation
  const handleUnderstandWithAi = async () => {
    if (!currentQuestion || isGeneratingAi || aiExplanation || isGeneratingRef.current) return;

    isGeneratingRef.current = true;
    setIsGeneratingAi(true);
    setAiErrorMessage(null);

    try {
      const res = await getExplanationAction(sessionId, currentQuestion.questionVersionId);

      if (res.success && res.explanation) {
        setAiExplanation({
          explanation: res.explanation,
          keyPoint: res.keyPoint || null,
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
          setAiErrorMessage(res.error || "Failed to contact study tutor. Please try again.");
        }
      }
    } catch {
      setAiErrorMessage("An unexpected connection issue occurred. Please try again.");
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingAi(false);
    }
  };

  // 1. Render Completed Session Summary View
  if (isCompleted) {
    const summary = sessionSummary;
    const correctCount = summary?.progress.correctCount ?? (submittedResult?.sessionProgress.correctCount || 0);
    const accuracy = summary?.progress.accuracyPercentage ?? (submittedResult?.sessionProgress.accuracyPercentage || 0);
    const answered = summary?.progress.answeredCount ?? totalQuestions;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border border-border bg-card text-card-foreground rounded-2xl p-8 shadow-xs text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Award className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Practice Session Completed!
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans max-w-md mx-auto">
              You have completed all {totalQuestions} requested questions in this practice set.
            </p>
          </div>

          {/* Performance Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-left">
            <div className="border border-border/60 bg-muted/20 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Score</span>
              <span className="text-lg font-extrabold text-foreground mt-0.5 block">
                {correctCount} / {totalQuestions}
              </span>
            </div>
            <div className="border border-border/60 bg-muted/20 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Accuracy</span>
              <span className="text-lg font-extrabold text-foreground mt-0.5 block">
                {accuracy}%
              </span>
            </div>
            <div className="border border-emerald-500/20 bg-emerald-500/5 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Correct</span>
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {correctCount}
              </span>
            </div>
            <div className="border border-rose-500/20 bg-rose-500/5 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase block">Incorrect</span>
              <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5 block">
                {Math.max(0, answered - correctCount)}
              </span>
            </div>
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="text-[10px] font-bold bg-muted border border-border rounded-lg px-2.5 py-1 text-muted-foreground">
              Level: {sessionDetails.levelName}
            </span>
            <span className="text-[10px] font-bold bg-muted border border-border rounded-lg px-2.5 py-1 text-muted-foreground">
              Subject: {sessionDetails.subjectName || "All Subjects"}
            </span>
            {sessionDetails.curriculumNodeName && (
              <span className="text-[10px] font-bold bg-muted border border-border rounded-lg px-2.5 py-1 text-muted-foreground">
                Topic: {sessionDetails.curriculumNodeName}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-border/40">
            <Link
              href="/practice"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs"
            >
              <BookOpen className="h-4 w-4" />
              <span>Start New Practice Set</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-card border border-border px-6 py-2.5 text-xs font-bold text-foreground hover:bg-muted/40 transition-all select-none"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Detailed Question Review List (if loaded) */}
        {summary && summary.reviewItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-foreground px-1">
              <BarChart2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Question Review & Academic Explanations
              </h2>
            </div>

            <div className="space-y-4">
              {summary.reviewItems.map((item) => (
                <div
                  key={item.sessionQuestionId}
                  className="border border-border bg-card rounded-2xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <span className="text-[10px] font-extrabold bg-muted border border-border rounded px-2 py-0.5 uppercase text-muted-foreground">
                      Question {item.sequenceNumber}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-extrabold rounded-full px-2.5 py-0.5 border flex items-center gap-1",
                        item.isCorrect
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      )}
                    >
                      {item.isCorrect ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-foreground/90 font-sans whitespace-pre-line leading-relaxed">
                    {item.questionText}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                    {shufflePracticeOptions(item.options, item.sessionQuestionId).map((opt) => {
                      const isCorrectOpt = opt.originalLetter === item.correctAnswer;
                      const isSelectedOpt = opt.originalLetter === item.selectedAnswer;

                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            "border rounded-xl p-3 flex items-start gap-2.5",
                            isCorrectOpt && "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                            isSelectedOpt && !isCorrectOpt && "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
                            !isCorrectOpt && !isSelectedOpt && "border-border/60 bg-muted/10 text-muted-foreground"
                          )}
                        >
                          <span className="text-[10px] font-bold shrink-0 mt-0.5">
                            {opt.displayLetter}.
                          </span>
                          <span className="text-xs leading-relaxed">{opt.optionText}</span>
                        </div>
                      );
                    })}
                  </div>

                  {item.explanation && (
                    <div className="border border-border/80 bg-muted/20 rounded-xl p-4 text-xs font-sans space-y-1.5">
                      <span className="font-bold text-foreground block">ICAI Academic Explanation:</span>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {item.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Handle empty state if no question could be selected
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

  // Randomize / rotate options per question delivery instance while keeping hardcoded A, B, C, D labels
  const shuffledOptions = useMemo(() => {
    return shufflePracticeOptions(
      currentQuestion?.options || [],
      currentQuestion?.sessionQuestionId || sessionId
    );
  }, [currentQuestion?.sessionQuestionId, currentQuestion?.options, sessionId]);

  const correctDisplayLetter = useMemo(() => {
    if (!submittedResult) return "";
    const match = shuffledOptions.find(
      (o) => o.originalLetter === submittedResult.correctAnswer
    );
    return match ? match.displayLetter : submittedResult.correctAnswer;
  }, [submittedResult, shuffledOptions]);

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
            {isUnlimited ? `Question ${currentSeq} (Continuous Practice ∞)` : `Question ${currentSeq} of ${totalQuestions}`}
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
          <button
            onClick={handleFinishSession}
            disabled={isFinishing}
            className="text-[10px] font-bold border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground rounded px-2.5 py-1 transition-all cursor-pointer inline-flex items-center gap-1"
          >
            {isFinishing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            <span>Finish Session</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden border border-border/20">
        <div
          className={cn("bg-primary h-full transition-all duration-300", isUnlimited && "w-full animate-pulse bg-primary/70")}
          style={isUnlimited ? undefined : { width: `${progressPercent}%` }}
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
          {shuffledOptions.map((opt) => {
            const isSelected = selectedOption === opt.originalLetter;

            // In reveal state, highlight correct and incorrect options
            const isRevealed = submittedResult !== null;
            const isCorrectOption = isRevealed && submittedResult.correctAnswer === opt.originalLetter;
            const isWrongOption = isRevealed && isSelected && !submittedResult.isCorrect;

            return (
              <div
                key={opt.id}
                onClick={() => {
                  if (!isRevealed && !isSubmitting) {
                    setSelectedOption(opt.originalLetter);
                  }
                }}
                className={cn(
                  "border rounded-xl p-4 flex items-start gap-3 transition-all select-none duration-150 relative",
                  !isRevealed && "cursor-pointer",
                  !isRevealed && isSelected
                    ? "border-primary bg-primary/5 shadow-xs"
                    : !isRevealed && "hover:bg-muted/40 hover:border-border/60 border-border/80 bg-background/50",
                  // Revealed State Styling
                  isCorrectOption && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-xs",
                  isWrongOption && "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 shadow-xs",
                  isRevealed && !isCorrectOption && !isWrongOption && "opacity-50 border-border/50 bg-background/30"
                )}
              >
                {/* Radio / Result Indicator */}
                <span
                  className={cn(
                    "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all select-none",
                    !isRevealed && isSelected && "border-primary bg-primary text-primary-foreground font-extrabold",
                    !isRevealed && !isSelected && "border-border text-muted-foreground",
                    isCorrectOption && "border-emerald-500 bg-emerald-500 text-white font-extrabold",
                    isWrongOption && "border-rose-500 bg-rose-500 text-white font-extrabold"
                  )}
                >
                  {isCorrectOption ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                  ) : isWrongOption ? (
                    <X className="h-3 w-3 stroke-[3]" />
                  ) : (
                    opt.displayLetter
                  )}
                </span>

                <span className="text-xs sm:text-sm text-foreground/85 leading-relaxed font-sans">
                  {opt.optionText}
                </span>
              </div>
            );
          })}
        </div>

        {/* Evaluation Feedback Banner (Revealed after submission) */}
        {submittedResult && (
          <div
            className={cn(
              "border rounded-xl p-4 flex items-start gap-3 transition-all animate-in fade-in duration-200",
              submittedResult.isCorrect
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
            )}
          >
            {submittedResult.isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="text-xs font-bold block">
                {submittedResult.isCorrect
                  ? "Correct Answer! (+1 Mark)"
                  : `Incorrect. The correct answer is Option ${correctDisplayLetter}.`}
              </span>
              <p className="text-[11px] opacity-90">
                Graded against the authoritative delivered question version.
              </p>
            </div>
          </div>
        )}

        {/* Academic Explanation Card (Revealed after submission) */}
        {submittedResult && submittedResult.explanation && (
          <div className="border border-border/80 bg-muted/30 rounded-xl p-5 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-foreground">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wide">
                ICAI Academic Explanation
              </span>
            </div>
            <p className="text-xs font-sans text-muted-foreground leading-relaxed whitespace-pre-line">
              {submittedResult.explanation}
            </p>
          </div>
        )}

        {/* AI Study Tutor Breakdown Card (Revealed when Understand with AI is clicked) */}
        {aiExplanation && (
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-5 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wide">
                AI Study Tutor Breakdown
              </span>
            </div>
            <p className="text-xs font-sans text-foreground/85 leading-relaxed whitespace-pre-line select-text">
              {aiExplanation.explanation}
            </p>
            {aiExplanation.keyPoint && (
              <div className="flex items-start gap-2 border-t border-primary/15 pt-3 mt-2 text-xs">
                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-foreground font-medium select-text">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-amber-600 dark:text-amber-400 mr-1.5">
                    Key Takeaway:
                  </span>
                  {aiExplanation.keyPoint}
                </p>
              </div>
            )}
          </div>
        )}

        {/* AI Error Alert */}
        {aiErrorMessage && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-3 text-xs text-destructive flex items-center gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{aiErrorMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-3 text-xs text-destructive flex items-center gap-2">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-between items-center border-t border-border/40">
          <div className="text-[11px] text-muted-foreground font-sans">
            {submittedResult ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>
                  Progress: <strong>{submittedResult.sessionProgress.answeredCount}</strong> of <strong>{totalQuestions}</strong> answered
                </span>
              </span>
            ) : selectedOption ? (
              <span>Selected Option: <strong className="text-foreground">{selectedOption}</strong></span>
            ) : (
              <span>Select an option, then click Submit to verify.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* If NOT submitted yet: Submit Button */}
            {!submittedResult ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!selectedOption || isSubmitting}
                className={cn(
                  "w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all select-none shadow-xs",
                  (!selectedOption || isSubmitting) && "opacity-50 pointer-events-none"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Evaluating answer...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : (
              /* If submitted: Understand with AI Button + Next Question / View Summary Button */
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {!aiExplanation && (
                  <button
                    onClick={handleUnderstandWithAi}
                    disabled={isGeneratingAi}
                    className={cn(
                      "w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary transition-all select-none",
                      isGeneratingAi && "opacity-60 pointer-events-none"
                    )}
                  >
                    {isGeneratingAi ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Analyzing with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>Understand with AI</span>
                      </>
                    )}
                  </button>
                )}

                {isUnlimited && (
                  <button
                    onClick={handleFinishSession}
                    disabled={isFinishing}
                    className="w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-all select-none"
                  >
                    {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>Finish & View Summary</span>
                  </button>
                )}

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
                  ) : !isUnlimited && (submittedResult.isSessionCompleted || currentSeq >= totalQuestions) ? (
                    <>
                      <span>View Session Summary</span>
                      <Award className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <span>Next Question</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
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
