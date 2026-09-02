"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  X,
  Loader2,
  Eye,
  Edit3,
  Trash2,
  Power,
  RotateCcw,
  BookOpen,
  ShieldCheck,
  Flag,
  UploadCloud,
} from "lucide-react";
import {
  ReviewQueueFilterParams,
  ReviewQueueResponse,
  ReviewDecision,
  AttentionSeverity,
  ReviewHistoryRecord,
} from "@/domains/questions/review/types";
import { QuestionDetailView } from "@/domains/questions/services";
import {
  fetchQuestionDetailAction,
  recordQuestionReviewAction,
  fetchQuestionReviewHistoryAction,
  updateQuestionAction,
  toggleQuestionStatusAction,
  deleteQuestionAction,
} from "@/app/actions/admin-questions";

interface QuestionReviewClientProps {
  initialData: ReviewQueueResponse;
  currentFilters: ReviewQueueFilterParams;
}

export function QuestionReviewClient({
  initialData,
  currentFilters,
}: QuestionReviewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local search state
  const [searchValue, setSearchValue] = useState(currentFilters.searchQuery || "");

  // Drawer / Inspector State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [questionDetail, setQuestionDetail] = useState<QuestionDetailView | null>(null);
  const [activeVersionTab, setActiveVersionTab] = useState<number>(1);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryRecord[]>([]);

  // Review Decision Form State
  const [selectedDecision, setSelectedDecision] = useState<ReviewDecision>("ACCEPTED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isRecordingReview, setIsRecordingReview] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    questionId: string;
    questionText: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    questionType: "MCQ" | "CASE_STUDY";
    options: { letter: string; text: string }[];
    correctAnswer: string;
    explanation: string;
    curriculumNodeId: string;
    caseStudyTitle: string;
    caseStudyScenario: string;
    expectedUpdatedAt?: string;
  }>({
    questionId: "",
    questionText: "",
    difficulty: "MEDIUM",
    questionType: "MCQ",
    options: [],
    correctAnswer: "A",
    explanation: "",
    curriculumNodeId: "",
    caseStudyTitle: "",
    caseStudyScenario: "",
  });

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status message banner
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Helper to build URL with updated params
  const buildFilterUrl = (updatedParams: Partial<ReviewQueueFilterParams>) => {
    const params = new URLSearchParams();
    const merged = { ...currentFilters, ...updatedParams };

    if (merged.levelCode && merged.levelCode !== "INTERMEDIATE") params.set("level", merged.levelCode);
    if (merged.attentionReason && merged.attentionReason !== "ALL") params.set("reason", merged.attentionReason);
    if (merged.severity && merged.severity !== "ALL") params.set("severity", merged.severity);
    if (merged.subjectId && merged.subjectId !== "ALL") params.set("subject", merged.subjectId);
    if (merged.curriculumVersionId && merged.curriculumVersionId !== "ALL") params.set("version", merged.curriculumVersionId);
    if (merged.reviewStatus && merged.reviewStatus !== "ALL") params.set("reviewStatus", merged.reviewStatus);
    if (merged.usageState && merged.usageState !== "ALL") params.set("usage", merged.usageState);
    if (merged.searchQuery) params.set("q", merged.searchQuery);
    if (merged.sortBy && merged.sortBy !== "severity") params.set("sortBy", merged.sortBy);
    if (merged.sortOrder && merged.sortOrder !== "desc") params.set("sortOrder", merged.sortOrder);
    if (merged.page && merged.page > 1) params.set("page", merged.page.toString());
    if (merged.pageSize && merged.pageSize !== 20) params.set("pageSize", merged.pageSize.toString());

    const qs = params.toString();
    return `/admin/questions/review${qs ? `?${qs}` : ""}`;
  };

  const handleFilterChange = (updates: Partial<ReviewQueueFilterParams>) => {
    const nextUpdates = { ...updates };
    if (!("page" in updates)) {
      nextUpdates.page = 1;
    }
    startTransition(() => {
      router.push(buildFilterUrl(nextUpdates));
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange({ searchQuery: searchValue.trim() || undefined });
  };

  const handleInspectQuestion = async (questionId: string) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setQuestionDetail(null);
    setReviewHistory([]);
    setReviewNotes("");

    try {
      const [detailRes, historyRes] = await Promise.all([
        fetchQuestionDetailAction(questionId),
        fetchQuestionReviewHistoryAction(questionId),
      ]);

      if (detailRes.success && detailRes.data) {
        setQuestionDetail(detailRes.data);
        const activeVer = detailRes.data.versions.find((v) => v.isActive) || detailRes.data.versions[0];
        setActiveVersionTab(activeVer ? activeVer.versionNumber : 1);
      }
      if (historyRes.success && historyRes.data) {
        setReviewHistory(historyRes.data);
      }
    } catch (err) {
      console.error("Failed to inspect question", err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Submit Review Decision
  const handleRecordReview = async () => {
    if (!questionDetail) return;
    const activeVer = questionDetail.versions.find((v) => v.isActive) || questionDetail.versions[0];
    setIsRecordingReview(true);
    setStatusMessage(null);

    try {
      const res = await recordQuestionReviewAction({
        questionId: questionDetail.id,
        versionId: activeVer?.id,
        decision: selectedDecision,
        notes: reviewNotes.trim() || undefined,
      });

      if (res.success && res.data) {
        setStatusMessage({
          type: "success",
          text: res.data.message || "Review decision recorded.",
        });
        setReviewNotes("");
        // Reload history & detail
        const historyRes = await fetchQuestionReviewHistoryAction(questionDetail.id);
        if (historyRes.success && historyRes.data) {
          setReviewHistory(historyRes.data);
        }
        startTransition(() => {
          router.refresh();
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to record review decision.",
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error recording review.",
      });
    } finally {
      setIsRecordingReview(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = () => {
    if (!questionDetail) return;
    const activeVer = questionDetail.versions.find((v) => v.isActive) || questionDetail.versions[0];
    if (!activeVer) return;

    setEditForm({
      questionId: questionDetail.id,
      questionText: activeVer.questionText,
      difficulty: questionDetail.difficulty,
      questionType: questionDetail.questionType,
      options: activeVer.options.map((o) => ({ letter: o.optionLetter, text: o.optionText })),
      correctAnswer: activeVer.correctAnswer,
      explanation: activeVer.explanation || "",
      curriculumNodeId: questionDetail.curriculumNode.id,
      caseStudyTitle: questionDetail.caseStudy?.title || "",
      caseStudyScenario: questionDetail.caseStudy?.scenarioText || "",
      expectedUpdatedAt: activeVer.createdAt ? new Date(activeVer.createdAt).toISOString() : undefined,
    });
    setIsEditOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    setStatusMessage(null);

    try {
      const res = await updateQuestionAction({
        questionId: editForm.questionId,
        questionText: editForm.questionText,
        difficulty: editForm.difficulty,
        questionType: editForm.questionType,
        options: editForm.options,
        correctAnswer: editForm.correctAnswer,
        explanation: editForm.explanation || undefined,
        curriculumNodeId: editForm.curriculumNodeId,
        caseStudy:
          editForm.questionType === "CASE_STUDY"
            ? { title: editForm.caseStudyTitle, scenarioText: editForm.caseStudyScenario }
            : null,
        expectedUpdatedAt: editForm.expectedUpdatedAt,
      });

      if (res.success && res.data) {
        setIsEditOpen(false);
        setStatusMessage({
          type: "success",
          text: res.data.message || "Question updated successfully.",
        });
        await handleInspectQuestion(editForm.questionId);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update question.",
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update question.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Status Toggle
  const handleToggleStatus = async () => {
    if (!questionDetail) return;
    const activeVer = questionDetail.versions.find((v) => v.isActive) || questionDetail.versions[0];
    const newStatus = !activeVer?.isActive;

    try {
      const res = await toggleQuestionStatusAction(questionDetail.id, newStatus);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Question marked as ${newStatus ? "Active" : "Retired / Inactive"}.`,
        });
        await handleInspectQuestion(questionDetail.id);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async () => {
    if (!questionDetail) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteQuestionAction(questionDetail.id);
      if (res.success) {
        setIsDeleteOpen(false);
        setIsDetailOpen(false);
        setStatusMessage({
          type: "success",
          text: "Question deleted permanently.",
        });
        startTransition(() => {
          router.refresh();
        });
      } else {
        setDeleteError(res.error || "Failed to delete question.");
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error deleting question.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getSeverityBadge = (sev: AttentionSeverity) => {
    switch (sev) {
      case "CRITICAL":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 uppercase tracking-wide">Critical</span>;
      case "HIGH":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wide">High</span>;
      case "MEDIUM":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 uppercase tracking-wide">Medium</span>;
      case "LOW":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wide">Low</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wide">Info</span>;
    }
  };

  const getDecisionBadge = (decision: ReviewDecision | null) => {
    switch (decision) {
      case "ACCEPTED":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"><CheckCircle2 className="h-3 w-3" />Accepted</span>;
      case "REVIEWED":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"><ShieldCheck className="h-3 w-3" />Reviewed</span>;
      case "NEEDS_CHANGES":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"><AlertTriangle className="h-3 w-3" />Needs Changes</span>;
      case "DISMISSED":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border">Dismissed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"><Clock className="h-3 w-3" />Unreviewed</span>;
    }
  };

  const { items, pagination, filterOptions, metrics } = initialData;
  const startIndex = pagination.totalCount > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endIndex = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Status Banner */}
      {statusMessage && (
        <div
          className={cn(
            "p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-1",
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive dark:text-red-400"
          )}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
         TOP LEVEL HEADER & NAVIGATION TABS
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <span>Operational Review Queue</span>
                <span className="text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider border border-primary/20">
                  Audit Intelligence
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Deterministic operational review queue, attention condition triage, and editorial decisions.
          </p>
        </div>

        {/* Global Level Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80 self-start md:self-center">
          {filterOptions.levels.map((lvl) => {
            const isSelected = currentFilters.levelCode === lvl.code;
            return (
              <button
                key={lvl.code}
                type="button"
                onClick={() => handleFilterChange({ levelCode: lvl.code })}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  isSelected
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {lvl.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
         SECTION NAVIGATION TABS
      ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-xs font-bold rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <Link href="/admin/questions">
            <HelpCircle className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <span>Explorer & Management</span>
          </Link>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="text-xs font-bold rounded-lg cursor-pointer bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20 gap-1.5"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Review Queue</span>
          {metrics.totalQuestionsNeedingAttention > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {metrics.totalQuestionsNeedingAttention}
            </span>
          )}
        </Button>

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-xs font-bold rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <Link href="/admin/questions/imports">
            <UploadCloud className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <span>Import Batches</span>
          </Link>
        </Button>
      </div>

      {/* =========================================================================
         OPERATIONAL METRICS CARDS
      ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Needing Attention</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black text-foreground">{metrics.totalQuestionsNeedingAttention}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Questions with attention flags</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Critical / High</span>
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="text-xl font-black text-red-600 dark:text-red-400">
            {metrics.criticalCount + metrics.highCount}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Inactive nodes & severe flags</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Obsolete Syllabus</span>
            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-black text-foreground">{metrics.obsoleteCurriculumCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Mapped to inactive versions</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Weak Explanations</span>
            <FileText className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-black text-foreground">{metrics.weakExplanationCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Short or missing reasoning</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unreviewed</span>
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-foreground">{metrics.unreviewedCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">No decision recorded yet</p>
        </div>
      </div>

      {/* =========================================================================
         FILTER CONTROLS BAR
      ========================================================================= */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {/* Attention Reason */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attention Reason</label>
            <select
              value={currentFilters.attentionReason || "ALL"}
              onChange={(e) => handleFilterChange({ attentionReason: e.target.value })}
              className="w-full h-8 text-xs font-semibold bg-background border border-border rounded-lg px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Attention Reasons</option>
              <option value="OBSOLETE_CURRICULUM">Obsolete Curriculum</option>
              <option value="INACTIVE_NODE">Inactive Node</option>
              <option value="RETIRED_QUESTION">Retired Question</option>
              <option value="WEAK_EXPLANATION">Weak Explanation</option>
              <option value="FEW_OPTIONS">Malformed Options</option>
              <option value="POTENTIAL_DUPLICATE">Duplicate Candidate</option>
              <option value="NEEDS_CHANGES">Needs Changes</option>
              <option value="NEVER_REVIEWED">Unreviewed</option>
              <option value="ZERO_USAGE">Zero Usage</option>
              <option value="HEAVY_USAGE">Heavy Traffic</option>
              <option value="MULTI_VERSIONED">Amended / Multi-Version</option>
            </select>
          </div>

          {/* Severity */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Severity</label>
            <select
              value={currentFilters.severity || "ALL"}
              onChange={(e) => handleFilterChange({ severity: e.target.value })}
              className="w-full h-8 text-xs font-semibold bg-background border border-border rounded-lg px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
            <select
              value={currentFilters.subjectId || "ALL"}
              onChange={(e) => handleFilterChange({ subjectId: e.target.value })}
              className="w-full h-8 text-xs font-semibold bg-background border border-border rounded-lg px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Subjects</option>
              {filterOptions.subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Review Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Review Decision</label>
            <select
              value={currentFilters.reviewStatus || "ALL"}
              onChange={(e) => handleFilterChange({ reviewStatus: e.target.value })}
              className="w-full h-8 text-xs font-semibold bg-background border border-border rounded-lg px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Decisions</option>
              <option value="UNREVIEWED">Unreviewed</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="NEEDS_CHANGES">Needs Changes</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>

          {/* Usage Traffic */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Usage State</label>
            <select
              value={currentFilters.usageState || "ALL"}
              onChange={(e) => handleFilterChange({ usageState: e.target.value })}
              className="w-full h-8 text-xs font-semibold bg-background border border-border rounded-lg px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Usage</option>
              <option value="ZERO_USAGE">Zero Usage (0 attempts)</option>
              <option value="ATTEMPTED">Attempted (&gt;0 attempts)</option>
              <option value="HEAVY_USAGE">Heavy Traffic (20+ attempts)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Search</label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <Input
                type="text"
                placeholder="Search node or code..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="h-8 text-xs pr-7 rounded-lg"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Reset Filters */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleFilterChange({
              attentionReason: undefined,
              severity: undefined,
              subjectId: undefined,
              curriculumVersionId: undefined,
              reviewStatus: undefined,
              usageState: undefined,
              searchQuery: undefined,
            })}
            className="text-[11px] font-bold h-7 px-2.5 text-muted-foreground hover:text-foreground cursor-pointer gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Filters</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
         REVIEW QUEUE TABLE
      ========================================================================= */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs relative">
        {isPending && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-2xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl shadow-md text-xs font-bold">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Updating Review Queue...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 w-28">Severity</th>
                <th className="py-3 px-4">Question Preview</th>
                <th className="py-3 px-4">Attention Flags</th>
                <th className="py-3 px-4">Curriculum Location</th>
                <th className="py-3 px-4 w-24 text-center">Usage</th>
                <th className="py-3 px-4 w-32">Review Status</th>
                <th className="py-3 px-4 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="h-8 w-8 text-emerald-500/60" />
                      <p className="font-bold text-sm text-foreground">No Questions Needing Review</p>
                      <p className="text-xs max-w-sm">All questions in this scope have clean metadata, active curriculum mapping, and satisfied review criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                    {/* Severity */}
                    <td className="py-3 px-4 align-top">
                      {getSeverityBadge(item.highestSeverity)}
                    </td>

                    {/* Question Preview */}
                    <td className="py-3 px-4 align-top max-w-xs">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground line-clamp-2 leading-relaxed">
                          {item.questionTextPreview}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-bold">{item.questionType}</span>
                          <span>•</span>
                          <span className="font-semibold">{item.difficulty}</span>
                          {item.totalVersionsCount > 1 && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-primary">v{item.versionNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Attention Flags */}
                    <td className="py-3 px-4 align-top max-w-sm">
                      <div className="flex flex-wrap gap-1">
                        {item.attentionFlags.map((flag) => (
                          <Tooltip key={flag.reason}>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-bold border cursor-help",
                                  flag.severity === "CRITICAL" && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
                                  flag.severity === "HIGH" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                                  flag.severity === "MEDIUM" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
                                  flag.severity === "LOW" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                                  flag.severity === "INFO" && "bg-muted text-muted-foreground border-border"
                                )}
                              >
                                <Flag className="h-2.5 w-2.5 shrink-0" />
                                <span>{flag.label}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-xs p-2">
                              <p className="font-bold">{flag.label}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{flag.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </td>

                    {/* Curriculum Location */}
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-0.5 max-w-xs">
                        <div className="font-semibold text-foreground truncate">{item.subjectName}</div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <span>{item.curriculumNodeName}</span>
                          {!item.isCurriculumVersionActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                Attached to obsolete syllabus version: {item.curriculumVersionName}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Usage Counts */}
                    <td className="py-3 px-4 align-top text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-foreground">{item.totalUsageCount}</span>
                        <span className="text-[9px] text-muted-foreground">{item.practiceAttemptsCount}p / {item.testQuestionsCount}t</span>
                      </div>
                    </td>

                    {/* Review Status */}
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        {getDecisionBadge(item.latestReviewDecision)}
                        {item.latestReviewedBy && (
                          <div className="text-[9px] text-muted-foreground truncate" title={item.latestReviewedBy}>
                            by {item.latestReviewedBy.split("@")[0]}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 align-top text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleInspectQuestion(item.id)}
                        className="h-7 text-xs font-bold rounded-lg cursor-pointer gap-1 shadow-2xs hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalCount > 0 && (
          <div className="p-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground text-[11px]">
              Showing <span className="font-bold text-foreground">{startIndex}</span> to{" "}
              <span className="font-bold text-foreground">{endIndex}</span> of{" "}
              <span className="font-bold text-foreground">{pagination.totalCount}</span> questions
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handleFilterChange({ page: pagination.page - 1 })}
                className="h-7 px-2 text-xs font-bold rounded-lg cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <span className="text-xs font-bold px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handleFilterChange({ page: pagination.page + 1 })}
                className="h-7 px-2 text-xs font-bold rounded-lg cursor-pointer"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
         CANONICAL QUESTION DETAIL & REVIEW DRAWER
      ========================================================================= */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-foreground">Question Review & Lifecycle</h2>
                  <p className="text-[10px] text-muted-foreground font-mono truncate max-w-xs">{questionDetail?.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {isDetailLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-muted rounded-md w-3/4" />
                  <div className="h-24 bg-muted rounded-xl" />
                  <div className="h-32 bg-muted rounded-xl" />
                </div>
              ) : questionDetail ? (
                <>
                  {/* Curriculum Breadcrumbs */}
                  <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Curriculum Mapping</div>
                    <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{questionDetail.academicLevel.name}</span>
                      <span className="text-muted-foreground">›</span>
                      <span>{questionDetail.curriculumVersion.name}</span>
                      <span className="text-muted-foreground">›</span>
                      <span>{questionDetail.subject.name}</span>
                      <span className="text-muted-foreground">›</span>
                      <span className="text-primary font-bold">{questionDetail.curriculumNode.name}</span>
                    </div>
                  </div>

                  {/* Version Snapshot Tabs */}
                  {questionDetail.versions.length > 1 && (
                    <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
                      {questionDetail.versions.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setActiveVersionTab(v.versionNumber)}
                          className={cn(
                            "flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            activeVersionTab === v.versionNumber
                              ? "bg-card text-foreground shadow-xs border border-border"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          v{v.versionNumber} {v.isActive && "(Active)"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Question Content */}
                  {(() => {
                    const ver = questionDetail.versions.find((v) => v.versionNumber === activeVersionTab) || questionDetail.versions[0];
                    if (!ver) return null;

                    return (
                      <div className="space-y-4">
                        {/* Case Study Scenario if applicable */}
                        {questionDetail.caseStudy && (
                          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                              Case Study Scenario: {questionDetail.caseStudy.title}
                            </div>
                            <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                              {questionDetail.caseStudy.scenarioText}
                            </p>
                          </div>
                        )}

                        {/* Question Text */}
                        <div className="p-4 bg-card border border-border rounded-xl space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Question Text</span>
                            <span className="text-[10px] font-bold text-primary">Version {ver.versionNumber}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">
                            {ver.questionText}
                          </p>
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Options & Answer Key</div>
                          <div className="space-y-1.5">
                            {ver.options.map((opt) => {
                              const isCorrect = opt.optionLetter === ver.correctAnswer;
                              return (
                                <div
                                  key={opt.id}
                                  className={cn(
                                    "p-3 rounded-xl border flex items-start gap-3 text-xs transition-colors",
                                    isCorrect
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 font-semibold"
                                      : "bg-card border-border text-foreground"
                                  )}
                                >
                                  <span className={cn(
                                    "h-5 w-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0",
                                    isCorrect ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                                  )}>
                                    {opt.optionLetter}
                                  </span>
                                  <span className="flex-1 leading-relaxed">{opt.optionText}</span>
                                  {isCorrect && (
                                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Academic Explanation */}
                        {ver.explanation ? (
                          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Academic Explanation</div>
                            <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{ver.explanation}</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>No explanation provided for this question version.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Operational Review Panel */}
                  <div className="p-4 bg-card border border-primary/30 rounded-xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Record Operational Review Decision</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDecision("ACCEPTED")}
                        className={cn(
                          "py-2 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1",
                          selectedDecision === "ACCEPTED"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Accept</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDecision("REVIEWED")}
                        className={cn(
                          "py-2 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1",
                          selectedDecision === "REVIEWED"
                            ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-2xs"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Reviewed</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDecision("NEEDS_CHANGES")}
                        className={cn(
                          "py-2 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1",
                          selectedDecision === "NEEDS_CHANGES"
                            ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-2xs"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <span>Needs Changes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDecision("DISMISSED")}
                        className={cn(
                          "py-2 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1",
                          selectedDecision === "DISMISSED"
                            ? "bg-muted border-foreground/30 text-foreground shadow-2xs"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <X className="h-4 w-4" />
                        <span>Dismiss</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reviewer Notes (Optional)</label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add reason for decision or note required changes..."
                        rows={2}
                        className="w-full text-xs p-2 bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <Button
                      type="button"
                      disabled={isRecordingReview}
                      onClick={handleRecordReview}
                      className="w-full text-xs font-bold h-8 rounded-lg cursor-pointer"
                    >
                      {isRecordingReview ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      <span>Save Review Decision</span>
                    </Button>
                  </div>

                  {/* Review History Audit Log */}
                  {reviewHistory.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Review History Audit Log</div>
                      <div className="space-y-2">
                        {reviewHistory.map((h) => (
                          <div key={h.id} className="p-3 bg-muted/40 border border-border rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground">{h.decision} (v{h.versionNumber})</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">by {h.reviewedBy}</p>
                            {h.notes && <p className="text-xs text-foreground italic mt-1">&ldquo;{h.notes}&rdquo;</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lifecycle Action Buttons */}
                  <div className="pt-4 border-t border-border flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenEdit}
                      className="text-xs font-bold rounded-lg cursor-pointer gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-primary" />
                      <span>Edit Question</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleStatus}
                      className="text-xs font-bold rounded-lg cursor-pointer gap-1"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>Toggle Active / Retire</span>
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setIsDeleteOpen(true)}
                      className="text-xs font-bold rounded-lg cursor-pointer gap-1 ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-extrabold text-foreground">Edit Question Content</h2>
              <button type="button" onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-muted rounded-lg cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold">Historical Attempt Preservation: </span>
              If students have already attempted this question, saving material changes will automatically generate a new version snapshot.
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Question Text</label>
                <textarea
                  value={editForm.questionText}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, questionText: e.target.value }))}
                  rows={4}
                  className="w-full text-xs p-3 bg-background border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Options</label>
                {editForm.options.map((opt, idx) => (
                  <div key={opt.letter} className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs shrink-0">
                      {opt.letter}
                    </span>
                    <Input
                      value={opt.text}
                      onChange={(e) => {
                        const next = [...editForm.options];
                        next[idx].text = e.target.value;
                        setEditForm((prev) => ({ ...prev, options: next }));
                      }}
                      className="text-xs h-8"
                    />
                  </div>
                ))}
              </div>

              {/* Correct Answer */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Correct Answer Key</label>
                <select
                  value={editForm.correctAnswer}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, correctAnswer: e.target.value }))}
                  className="w-full h-8 text-xs font-bold bg-background border border-border rounded-lg px-2 cursor-pointer"
                >
                  {editForm.options.map((opt) => (
                    <option key={opt.letter} value={opt.letter}>Option {opt.letter}</option>
                  ))}
                </select>
              </div>

              {/* Explanation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Academic Explanation</label>
                <textarea
                  value={editForm.explanation}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, explanation: e.target.value }))}
                  rows={3}
                  className="w-full text-xs p-3 bg-background border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="text-xs font-bold cursor-pointer">
                Cancel
              </Button>
              <Button type="button" disabled={isSavingEdit} onClick={handleSaveEdit} className="text-xs font-bold cursor-pointer">
                {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                <span>Save Changes</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Question Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-extrabold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Question</span>
            </h2>

            {deleteError ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                {deleteError}
              </div>
            ) : (
              <p className="text-xs text-foreground leading-relaxed">
                Hard deletion is only permitted on unattempted questions ($0$ student practice sessions and $0$ mock tests).
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} className="text-xs font-bold cursor-pointer">
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={isDeleting} onClick={handleDeleteQuestion} className="text-xs font-bold cursor-pointer">
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                <span>Confirm Delete</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
