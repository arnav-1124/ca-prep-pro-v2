"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Layers,
  Loader2,
  FileText,
  BookOpen,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveImportedQuestionAction,
  rejectImportedQuestionAction,
  editImportedQuestionAction,
  publishApprovedQuestionsAction,
} from "@/app/actions/admin-question-imports";
import {
  getImportBatchDetailData,
  getImportedQuestionReviewDetail,
} from "@/domains/questions/import/services";
import {
  QuestionType,
  QuestionDifficulty,
  RejectionReason,
  RawImportQuestionJson,
} from "@/domains/questions/import/types";
import { cn } from "@/lib/utils";

interface ReviewClientProps {
  batch: NonNullable<Awaited<ReturnType<typeof getImportBatchDetailData>>>["batch"];
  reviewDetail: Awaited<ReturnType<typeof getImportedQuestionReviewDetail>>;
  currentFilter: string;
}

export function BatchReviewClient({
  batch,
  reviewDetail,
  currentFilter,
}: ReviewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // Status & Feedback
  const [isActionPending, setIsActionPending] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [isRejectOpen, setIsRejectOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isPublishOpen, setIsPublishOpen] = React.useState(false);
  const [showRawPayload, setShowRawPayload] = React.useState(false);

  // Reject Form
  const [rejectionReason, setRejectionReason] = React.useState<RejectionReason>("DUPLICATE");
  const [rejectionNotes, setRejectionNotes] = React.useState("");

  // Edit Form
  const currentQ = reviewDetail?.question;
  const effectivePayload = (currentQ?.editedPayload || currentQ?.rawPayload) as RawImportQuestionJson | undefined;

  const [editText, setEditText] = React.useState("");
  const [editDifficulty, setEditDifficulty] = React.useState<QuestionDifficulty>("MEDIUM");
  const [editType, setEditType] = React.useState<QuestionType>("MCQ");
  const [editOptions, setEditOptions] = React.useState<{ letter: string; text: string }[]>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = React.useState("A");
  const [editExplanation, setEditExplanation] = React.useState("");
  const [editNodeId, setEditNodeId] = React.useState<string>("");

  const openEditDialog = React.useCallback(() => {
    if (effectivePayload) {
      setEditText(effectivePayload.questionText || "");
      setEditDifficulty((effectivePayload.difficulty as QuestionDifficulty) || "MEDIUM");
      setEditType((effectivePayload.questionType as QuestionType) || "MCQ");
      setEditOptions(effectivePayload.options || []);
      setEditCorrectAnswer(effectivePayload.correctAnswer || "A");
      setEditExplanation(effectivePayload.explanation || "");
      setEditNodeId(currentQ?.curriculumNodeId || "");
    }
    setIsEditOpen(true);
  }, [currentQ?.curriculumNodeId, effectivePayload]);

  // Navigate to Question
  const navigateToQuestion = React.useCallback((qId?: string | null, index?: number) => {
    if (!qId && !index) return;
    startTransition(() => {
      const url = qId
        ? `/admin/questions/imports/${batch.id}?qId=${qId}&filter=${currentFilter}`
        : `/admin/questions/imports/${batch.id}?index=${index}&filter=${currentFilter}`;
      router.push(url);
    });
  }, [batch.id, currentFilter, router]);

  // Action: Approve
  const handleApprove = React.useCallback(async () => {
    if (!currentQ) return;
    setIsActionPending(true);
    setStatusMessage(null);

    const result = await approveImportedQuestionAction({
      batchId: batch.id,
      importedQuestionId: currentQ.id,
      expectedUpdatedAt: currentQ.updatedAt,
    });

    setIsActionPending(false);

    if (result.success) {
      setStatusMessage({ type: "success", text: `Question #${currentQ.questionIndex} approved.` });
      if (reviewDetail?.navigation.nextId) {
        navigateToQuestion(reviewDetail.navigation.nextId);
      } else {
        router.refresh();
      }
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to approve question." });
    }
  }, [batch.id, currentQ, navigateToQuestion, reviewDetail, router]);

  // Keyboard Navigation & Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === "ArrowLeft" && reviewDetail?.navigation.prevId) {
        e.preventDefault();
        navigateToQuestion(reviewDetail.navigation.prevId);
      } else if (e.key === "ArrowRight" && reviewDetail?.navigation.nextId) {
        e.preventDefault();
        navigateToQuestion(reviewDetail.navigation.nextId);
      } else if (e.key.toLowerCase() === "a" || e.key === "Enter") {
        if (!isRejectOpen && !isEditOpen && !isPublishOpen && currentQ) {
          e.preventDefault();
          handleApprove();
        }
      } else if (e.key.toLowerCase() === "r") {
        if (!isRejectOpen && !isEditOpen && !isPublishOpen) {
          e.preventDefault();
          setIsRejectOpen(true);
        }
      } else if (e.key.toLowerCase() === "e") {
        if (!isRejectOpen && !isEditOpen && !isPublishOpen) {
          e.preventDefault();
          openEditDialog();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    navigateToQuestion,
    handleApprove,
    openEditDialog,
    reviewDetail,
    isRejectOpen,
    isEditOpen,
    isPublishOpen,
    currentQ,
  ]);

  // Action: Reject Confirm
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQ) return;

    setIsActionPending(true);
    setStatusMessage(null);

    const result = await rejectImportedQuestionAction({
      batchId: batch.id,
      importedQuestionId: currentQ.id,
      rejectionReason,
      rejectionNotes: rejectionNotes.trim() || undefined,
      expectedUpdatedAt: currentQ.updatedAt,
    });

    setIsActionPending(false);
    setIsRejectOpen(false);

    if (result.success) {
      setStatusMessage({ type: "success", text: `Question #${currentQ.questionIndex} marked as rejected.` });
      if (reviewDetail?.navigation.nextId) {
        navigateToQuestion(reviewDetail.navigation.nextId);
      } else {
        router.refresh();
      }
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to reject question." });
    }
  };

  // Action: Save Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQ) return;

    setIsActionPending(true);
    setStatusMessage(null);

    const result = await editImportedQuestionAction({
      batchId: batch.id,
      importedQuestionId: currentQ.id,
      editData: {
        questionText: editText,
        difficulty: editDifficulty,
        questionType: editType,
        options: editOptions,
        correctAnswer: editCorrectAnswer,
        explanation: editExplanation.trim() || undefined,
        curriculumNodeId: editNodeId || undefined,
      },
      expectedUpdatedAt: currentQ.updatedAt,
    });

    setIsActionPending(false);
    setIsEditOpen(false);

    if (result.success) {
      setStatusMessage({ type: "success", text: `Question #${currentQ.questionIndex} edits saved.` });
      router.refresh();
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to save edits." });
    }
  };

  // Action: Quick Node Assignment
  const handleQuickNodeChange = async (newNodeId: string) => {
    if (!currentQ || !effectivePayload) return;
    setIsActionPending(true);

    const result = await editImportedQuestionAction({
      batchId: batch.id,
      importedQuestionId: currentQ.id,
      editData: {
        questionText: effectivePayload.questionText,
        difficulty: (effectivePayload.difficulty as QuestionDifficulty) || "MEDIUM",
        questionType: (effectivePayload.questionType as QuestionType) || "MCQ",
        options: effectivePayload.options || [],
        correctAnswer: effectivePayload.correctAnswer || "A",
        explanation: effectivePayload.explanation,
        curriculumNodeId: newNodeId,
      },
      expectedUpdatedAt: currentQ.updatedAt,
    });

    setIsActionPending(false);
    if (result.success) {
      setStatusMessage({ type: "success", text: "Curriculum node mapping updated." });
      router.refresh();
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to map curriculum node." });
    }
  };

  // Action: Publish Batch
  const handlePublishSubmit = async () => {
    setIsActionPending(true);
    setStatusMessage(null);

    const result = await publishApprovedQuestionsAction({
      batchId: batch.id,
    });

    setIsActionPending(false);
    setIsPublishOpen(false);

    if (result.success && result.data) {
      setStatusMessage({
        type: "success",
        text: `Successfully published ${result.data.publishedCount} approved questions to the live Question Bank!`,
      });
      router.refresh();
    } else {
      setStatusMessage({
        type: "error",
        text: result.error || "Failed to publish approved questions.",
      });
    }
  };

  const validationErrors = (currentQ?.validationErrors as { field: string; message: string }[]) || [];
  const validationWarnings = (currentQ?.validationWarnings as { field: string; message: string }[]) || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border bg-card rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/questions/imports"
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Import Queues</span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              {batch.batchName}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase border border-border">
              {batch.levelName}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase border border-border">
              {batch.versionName}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-sans">
            <span>Approved: <strong className="text-foreground">{batch.approvedCount}</strong></span>
            <span>•</span>
            <span>Rejected: <strong className="text-foreground">{batch.rejectedCount}</strong></span>
            <span>•</span>
            <span>Pending: <strong className="text-foreground">{batch.pendingReviewCount}</strong></span>
            <span>•</span>
            <span>Published: <strong className="text-foreground">{batch.publishedCount}</strong></span>
          </div>
        </div>

        {/* Publish Action Button */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            onClick={() => setIsPublishOpen(true)}
            disabled={batch.approvedCount === 0 || isActionPending}
            className="font-bold text-xs h-9.5 px-4 rounded-xl cursor-pointer gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Publish {batch.approvedCount} Approved Questions</span>
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusMessage && (
        <div
          className={cn(
            "p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200",
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:opacity-70 transition-opacity cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Question Quick Jump Strip */}
      {reviewDetail?.navigation && (
        <div className="p-3 bg-card border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground shrink-0">
            <span>Questions in Batch ({reviewDetail.navigation.total}):</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            {reviewDetail.navigation.siblings.map((s) => {
              const isSelected = currentQ?.id === s.id;
              const isApproved = s.status === "APPROVED";
              const isRejected = s.status === "REJECTED";
              const isInvalid = s.validationStatus === "INVALID";
              const isDuplicate = s.duplicateStatus !== "NO_DUPLICATE";

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigateToQuestion(s.id)}
                  disabled={isPending}
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-extrabold flex items-center justify-center transition-all cursor-pointer shrink-0 relative",
                    isSelected
                      ? "ring-2 ring-primary bg-primary text-primary-foreground shadow-xs"
                      : isApproved
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                      : isRejected
                      ? "bg-destructive/15 text-destructive hover:bg-destructive/25 line-through"
                      : isInvalid
                      ? "bg-destructive/10 text-destructive border border-destructive/40"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                    isDuplicate && !isApproved && !isRejected && "ring-1 ring-amber-500/60"
                  )}
                  title={`Question #${s.questionIndex} (${s.status})`}
                >
                  {s.questionIndex}
                  {isDuplicate && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main One-by-One Review Surface */}
      {currentQ && effectivePayload ? (
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start transition-opacity duration-200",
            (isPending || isActionPending) && "opacity-50 pointer-events-none"
          )}
        >
          {/* LEFT COLUMN: Question Inspector (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="border border-border bg-card rounded-2xl p-6 shadow-xs space-y-5">
              {/* Question Header Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-extrabold px-3 py-1 rounded-xl">
                    Question #{currentQ.questionIndex} of {reviewDetail?.navigation.total}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-muted text-muted-foreground uppercase border border-border">
                    {currentQ.questionType}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-extrabold px-2.5 py-1 rounded-xl border uppercase",
                      currentQ.difficulty === "HARD"
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : currentQ.difficulty === "MEDIUM"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    )}
                  >
                    {currentQ.difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentQ.status === "APPROVED" && (
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      <span>Approved</span>
                    </span>
                  )}
                  {currentQ.status === "REJECTED" && (
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                      <X className="h-3.5 w-3.5" />
                      <span>Rejected ({currentQ.rejectionReason})</span>
                    </span>
                  )}
                  {currentQ.status === "PENDING_REVIEW" && (
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                      Pending Review
                    </span>
                  )}
                  {currentQ.status === "PUBLISHED" && (
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Published
                    </span>
                  )}
                </div>
              </div>

              {/* Validation Diagnostics (If Errors or Warnings) */}
              {(validationErrors.length > 0 || validationWarnings.length > 0) && (
                <div
                  className={cn(
                    "p-3.5 rounded-xl border space-y-1.5 text-xs font-sans",
                    validationErrors.length > 0
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  )}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {validationErrors.length > 0
                        ? "Validation Errors (Fix required before approval)"
                        : "Validation Warnings"}
                    </span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                    {validationErrors.map((err, i) => (
                      <li key={i}>
                        <strong>{err.field}:</strong> {err.message}
                      </li>
                    ))}
                    {validationWarnings.map((warn, i) => (
                      <li key={i}>
                        <strong>{warn.field}:</strong> {warn.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Case Study Scenario (if applicable) */}
              {effectivePayload.caseStudy && (
                <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                      Case Study: {effectivePayload.caseStudy.title}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 font-serif leading-relaxed whitespace-pre-wrap">
                    {effectivePayload.caseStudy.scenarioText}
                  </p>
                </div>
              )}

              {/* Question Text */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Question Text
                </span>
                <p className="text-sm font-semibold text-foreground font-serif leading-relaxed whitespace-pre-wrap">
                  {effectivePayload.questionText}
                </p>
                {Boolean(currentQ.editedPayload) && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <Edit2 className="h-3 w-3" />
                    <span>Contains saved human edits (raw payload preserved in audit)</span>
                  </span>
                )}
              </div>

              {/* Options List */}
              <div className="space-y-2.5 pt-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Options & Answer Key
                </span>
                <div className="space-y-2">
                  {effectivePayload.options?.map((opt) => {
                    const isCorrect = opt.letter.toUpperCase() === effectivePayload.correctAnswer?.toUpperCase();
                    return (
                      <div
                        key={opt.letter}
                        className={cn(
                          "p-3 rounded-xl border flex items-start gap-3 transition-all",
                          isCorrect
                            ? "bg-emerald-500/10 border-emerald-500/40 text-foreground shadow-xs font-semibold"
                            : "bg-background border-border text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "h-6 w-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0",
                            isCorrect
                              ? "bg-emerald-600 text-white"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {opt.letter}
                        </span>
                        <div className="text-xs leading-relaxed flex-1 pt-0.5 font-sans">
                          {opt.text}
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider shrink-0 flex items-center gap-1 pt-0.5">
                            <Check className="h-3.5 w-3.5" />
                            <span>Correct</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Academic Explanation */}
              <div className="p-4 bg-muted/20 border border-border/80 rounded-xl space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Academic Explanation</span>
                </span>
                <p className="text-xs text-foreground/90 font-sans leading-relaxed">
                  {effectivePayload.explanation || (
                    <em className="text-muted-foreground">No academic explanation provided in raw import.</em>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Curriculum Mapping & Duplicate Inspector (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Curriculum Mapping Card */}
            <div className="border border-border bg-card rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Curriculum Mapping</span>
                </span>
                <span
                  className={cn(
                    "text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase",
                    currentQ.curriculumMappingStatus === "MATCHED_CANONICAL" ||
                      currentQ.curriculumMappingStatus === "MATCHED_DATABASE_ID" ||
                      currentQ.curriculumMappingStatus === "MATCHED_EXACT_NAME"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                      : currentQ.curriculumMappingStatus === "AMBIGUOUS_MATCH"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  )}
                >
                  {currentQ.curriculumMappingStatus.replace("_", " ")}
                </span>
              </div>

              {/* Resolved Breadcrumbs */}
              {reviewDetail?.breadcrumbs ? (
                <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1.5 font-sans">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Mapped Chapter / Topic:
                  </div>
                  <div className="font-extrabold text-foreground text-sm">
                    {reviewDetail.breadcrumbs.nodeName}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>{reviewDetail.breadcrumbs.subjectName}</span>
                    {reviewDetail.breadcrumbs.nodeCode && (
                      <>
                        <span>•</span>
                        <span className="font-mono font-bold text-primary">
                          {reviewDetail.breadcrumbs.nodeCode}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive space-y-1">
                  <strong>Unmapped Question</strong>
                  <p className="text-[11px] text-destructive/80">
                    This question must be mapped to a valid Chapter or Topic before it can be approved.
                  </p>
                </div>
              )}

              {/* Inline Node Re-assignment Select */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-foreground">Re-assign Curriculum Node</label>
                <Select
                  value={currentQ.curriculumNodeId || "NONE"}
                  onValueChange={(val) => {
                    if (val !== "NONE") handleQuickNodeChange(val);
                  }}
                  disabled={isActionPending}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Select Chapter / Topic" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="NONE">-- Select Node --</SelectItem>
                    {reviewDetail?.availableNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.subjectName} → {n.name} {n.code && `(${n.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Duplicate Candidate Comparison Card */}
            {reviewDetail?.candidateDetail ? (
              <div className="border border-amber-500/40 bg-amber-500/5 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Duplicate Candidate Detected</span>
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {currentQ.duplicateSimilarityScore}% Match
                  </span>
                </div>

                <p className="text-xs text-amber-900 dark:text-amber-200 font-sans">
                  {currentQ.duplicateMatchReason}
                </p>

                {/* Existing Live Question Comparison Preview */}
                <div className="p-3 bg-background border border-border rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase">
                    <span>Live Question Bank Entry</span>
                    <span>{reviewDetail.candidateDetail.difficulty}</span>
                  </div>
                  <p className="font-serif text-xs font-medium text-foreground leading-relaxed">
                    {reviewDetail.candidateDetail.questionText}
                  </p>
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Correct Answer: Option {reviewDetail.candidateDetail.correctAnswer}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-border bg-card rounded-2xl p-4 shadow-xs flex items-center gap-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>No high-confidence duplicate candidates found in live Question Bank.</span>
              </div>
            )}

            {/* Audit & Raw Payload Toggle Card */}
            <div className="border border-border bg-card rounded-2xl p-4 shadow-xs space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Review History</span>
                {currentQ.reviewedBy && (
                  <span className="text-[11px]">By {currentQ.reviewedBy}</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowRawPayload(!showRawPayload)}
                className="w-full text-xs font-bold rounded-xl cursor-pointer h-8"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                <span>{showRawPayload ? "Hide Raw JSON" : "Inspect Raw JSON Payload"}</span>
              </Button>
              {showRawPayload && (
                <pre className="p-3 bg-muted/40 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 text-foreground">
                  {JSON.stringify(currentQ.rawPayload, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-16 text-center border border-border bg-card rounded-2xl space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <h3 className="text-base font-bold text-foreground">No Question Selected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Select a question from the navigation strip above to begin one-by-one review.
          </p>
        </div>
      )}

      {/* STICKY BOTTOM ACTION TOOLBAR */}
      {currentQ && (
        <div className="sticky bottom-4 z-20 bg-card/95 backdrop-blur border border-border rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!reviewDetail?.navigation.prevId || isPending}
              onClick={() => navigateToQuestion(reviewDetail?.navigation.prevId)}
              className="font-bold text-xs rounded-xl cursor-pointer gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Previous</span>
              <kbd className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border">←</kbd>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!reviewDetail?.navigation.nextId || isPending}
              onClick={() => navigateToQuestion(reviewDetail?.navigation.nextId)}
              className="font-bold text-xs rounded-xl cursor-pointer gap-1"
            >
              <span className="hidden sm:inline">Next</span>
              <kbd className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border">→</kbd>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Edit Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openEditDialog}
              disabled={isActionPending}
              className="font-bold text-xs rounded-xl cursor-pointer gap-1.5"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
              <kbd className="text-[9px] bg-muted px-1.5 py-0.5 rounded border border-border">E</kbd>
            </Button>

            {/* Reject Button */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsRejectOpen(true)}
              disabled={isActionPending}
              className="font-bold text-xs rounded-xl cursor-pointer gap-1.5 shadow-xs"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reject</span>
              <kbd className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">R</kbd>
            </Button>

            {/* Approve Button */}
            <Button
              type="button"
              size="sm"
              onClick={handleApprove}
              disabled={isActionPending || currentQ.validationStatus === "INVALID" || !currentQ.curriculumNodeId}
              className="font-bold text-xs rounded-xl cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {isActionPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Approve & Next</span>
              <kbd className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">A / ↵</kbd>
            </Button>
          </div>
        </div>
      )}

      {/* REJECT QUESTION DIALOG */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Reject Question #{currentQ?.questionIndex}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Provide an auditable reason for rejecting this question.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejectSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Rejection Reason *</label>
              <Select
                value={rejectionReason}
                onValueChange={(val) => setRejectionReason(val as RejectionReason)}
              >
                <SelectTrigger className="h-9.5 rounded-xl text-xs cursor-pointer">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DUPLICATE">Duplicate Question</SelectItem>
                  <SelectItem value="WRONG_CURRICULUM">Wrong Curriculum / Out of Syllabus</SelectItem>
                  <SelectItem value="INCORRECT_ANSWER">Incorrect Answer Key</SelectItem>
                  <SelectItem value="OUTDATED_LAW">Outdated Law / Superseded Standard</SelectItem>
                  <SelectItem value="POOR_QUALITY">Poor Question Quality / Ambiguous</SelectItem>
                  <SelectItem value="FORMATTING_ISSUE">Malformed Formatting</SelectItem>
                  <SelectItem value="OTHER">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Rejection Notes <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <Textarea
                rows={3}
                value={rejectionNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionNotes(e.target.value)}
                placeholder="Add contextual details for audit trail..."
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRejectOpen(false)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isActionPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 shadow-xs"
              >
                {isActionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT QUESTION DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl font-sans max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              <span>Edit Question #{currentQ?.questionIndex}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Correct wording, answer key, explanation, or curriculum assignment before approval.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Difficulty</label>
                <Select
                  value={editDifficulty}
                  onValueChange={(val) => setEditDifficulty(val as QuestionDifficulty)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EASY">Easy</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HARD">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Curriculum Node</label>
                <Select
                  value={editNodeId || "NONE"}
                  onValueChange={(val) => setEditNodeId(val === "NONE" ? "" : val)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Select Node" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="NONE">-- Select Node --</SelectItem>
                    {reviewDetail?.availableNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.subjectName} → {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Question Text *</label>
              <Textarea
                rows={3}
                required
                value={editText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditText(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            {/* Edit Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Options *</label>
              <div className="space-y-2">
                {editOptions.map((opt, idx) => (
                  <div key={opt.letter} className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-lg bg-muted text-foreground text-xs font-extrabold flex items-center justify-center shrink-0">
                      {opt.letter}
                    </span>
                    <Input
                      required
                      value={opt.text}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const newOpts = [...editOptions];
                        newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                        setEditOptions(newOpts);
                      }}
                      className="h-8 rounded-xl text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Correct Answer Letter *</label>
              <Select
                value={editCorrectAnswer}
                onValueChange={(val) => setEditCorrectAnswer(val)}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs cursor-pointer">
                  <SelectValue placeholder="Correct Option" />
                </SelectTrigger>
                <SelectContent>
                  {editOptions.map((opt) => (
                    <SelectItem key={opt.letter} value={opt.letter}>
                      Option {opt.letter} ({opt.text.slice(0, 30)}...)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Academic Explanation</label>
              <Textarea
                rows={3}
                value={editExplanation}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditExplanation(e.target.value)}
                placeholder="Academic explanation for the solution..."
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isActionPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isActionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Question Edits</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PUBLISH CONFIRMATION DIALOG */}
      <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-extrabold text-foreground">
              Publish Approved Questions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              You are about to publish <strong className="text-foreground">{batch.approvedCount} approved questions</strong> from this batch to the live CA Prep Pro Question Bank.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border text-xs space-y-2.5 font-sans">
            <div className="font-bold text-foreground">Pre-Publication Breakdown:</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-700 dark:text-emerald-300 font-bold block">Ready to Publish</span>
                <span className="text-emerald-900 dark:text-emerald-100 font-extrabold text-sm">{batch.approvedCount} Questions</span>
              </div>
              <div className="p-2 rounded-lg bg-background border border-border">
                <span className="text-muted-foreground font-medium block">Will Remain Staged</span>
                <span className="text-foreground font-extrabold text-sm">{batch.pendingReviewCount + batch.rejectedCount} Questions</span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-muted-foreground space-y-1">
              <div>• <strong>{batch.pendingReviewCount}</strong> pending review / unmapped questions will not be published.</div>
              {batch.rejectedCount > 0 && <div>• <strong>{batch.rejectedCount}</strong> rejected questions will remain archived in this batch.</div>}
              <div>• Pre-flight checks verify active curriculum nodes and check for duplicate collisions before writing.</div>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPublishOpen(false)}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isActionPending}
              onClick={handlePublishSubmit}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {isActionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm & Publish Now</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
