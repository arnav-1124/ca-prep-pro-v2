"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  QuestionBankResponse,
  QuestionDetailView,
  QuestionBankFilterParams,
} from "@/domains/questions/services";
import {
  fetchQuestionDetailAction,
  updateQuestionAction,
  toggleQuestionStatusAction,
  deleteQuestionAction,
  exportQuestionsAction,
  downloadCanonicalTemplateAction,
} from "@/app/actions/admin-questions";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Search,
  Layers,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Eye,
  FileText,
  AlertCircle,
  X,
  BookOpen,
  ArrowRight,
  History,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  UploadCloud,
  Download,
  ShieldCheck,
  Edit3,
  Power,
  Trash2,
  Plus,
  Trash,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionDifficulty, QuestionType } from "@/domains/questions/import/types";

interface QuestionsExplorerClientProps {
  initialData: QuestionBankResponse;
  currentFilters: QuestionBankFilterParams;
}

interface EditQuestionState {
  questionId: string;
  questionText: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  curriculumNodeId: string;
  caseStudyTitle: string;
  caseStudyScenario: string;
  expectedUpdatedAt: Date | string;
}

/**
 * Calculates page number list with abbreviation ellipses for large counts.
 */
function getPaginationRange(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export function QuestionsExplorerClient({ initialData, currentFilters }: QuestionsExplorerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Native React 19 transition hook for instant UI feedback
  const [isPending, startTransition] = React.useTransition();

  // Search and filter state
  const [searchQuery, setSearchQuery] = React.useState(currentFilters.searchQuery || "");
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<string | null>(null);
  const [questionDetail, setQuestionDetail] = React.useState<QuestionDetailView | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [activeSortColumn, setActiveSortColumn] = React.useState<string | null>(null);

  // Status feedback toast
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Export State
  const [isExporting, setIsExporting] = React.useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [editForm, setEditForm] = React.useState<EditQuestionState | null>(null);

  // Status Toggle State
  const [isStatusToggling, setIsStatusToggling] = React.useState(false);

  // Deletion Modal State
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Push new query params to URL with native React transition
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    if (!updates.page) {
      params.delete("page");
    }

    startTransition(() => {
      router.push(`/admin/questions?${params.toString()}`);
    });
  };

  const handleLevelChange = (levelCode: string) => {
    updateUrlParams({
      level: levelCode,
      version: null,
      subject: null,
      node: null,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ q: searchQuery.trim() || null });
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    startTransition(() => {
      router.push(`/admin/questions?level=${currentFilters.levelCode || "INTERMEDIATE"}`);
    });
  };

  const handleColumnSort = (columnKey: "content" | "curriculum" | "difficulty" | "type" | "status" | "created") => {
    setActiveSortColumn(columnKey);
    const currentSort = currentFilters.sortBy || "created";
    const currentOrder = currentFilters.sortOrder || "desc";

    if (currentSort !== columnKey) {
      updateUrlParams({ sortBy: columnKey, sortOrder: "asc" });
    } else if (currentOrder === "asc") {
      updateUrlParams({ sortBy: columnKey, sortOrder: "desc" });
    } else {
      updateUrlParams({ sortBy: null, sortOrder: null });
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInspectQuestion = async (qId: string) => {
    setSelectedQuestionId(qId);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    try {
      const res = await fetchQuestionDetailAction(qId);
      if (res.success && res.data) {
        setQuestionDetail(res.data);
      } else {
        setQuestionDetail(null);
      }
    } catch {
      setQuestionDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Export Question Bank to Canonical JSON
  const handleExportQuestions = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await exportQuestionsAction({
        levelCode: currentFilters.levelCode,
        curriculumVersionId: currentFilters.curriculumVersionId,
        subjectId: currentFilters.subjectId,
        curriculumNodeId: currentFilters.curriculumNodeId,
        questionType: currentFilters.questionType,
        difficulty: currentFilters.difficulty,
        sourceType: currentFilters.sourceType,
        status: currentFilters.status,
        searchQuery: currentFilters.searchQuery,
      });

      if (res.success && res.data) {
        const blob = new Blob([res.data.jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatusMessage({
          type: "success",
          text: `Successfully exported ${res.data.questionCount} questions to ${res.data.fileName}`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to export questions.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "An error occurred while exporting question data.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Download Canonical Import Template & Schema
  const handleDownloadTemplate = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await downloadCanonicalTemplateAction(currentFilters.levelCode);
      if (res.success && res.data) {
        const blob = new Blob([res.data.jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatusMessage({
          type: "success",
          text: `Downloaded Canonical Import Schema Template (${res.data.fileName}). Contains complete compulsory/optional specifications and sample questions for AI agents.`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to download canonical template.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "An error occurred while downloading template.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Open Question Edit Modal
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
      expectedUpdatedAt: activeVer.createdAt,
    });
    setIsEditOpen(true);
  };

  // Save Question Edits
  const handleSaveEdit = async () => {
    if (!editForm) return;
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
        // Refresh question detail inspector
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

  // Toggle Active/Retire Status
  const handleToggleStatus = async () => {
    if (!questionDetail) return;
    const activeVer = questionDetail.versions.find((v) => v.isActive) || questionDetail.versions[0];
    const newStatus = !activeVer?.isActive;

    setIsStatusToggling(true);
    setStatusMessage(null);

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
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update status.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Error toggling question status.",
      });
    } finally {
      setIsStatusToggling(false);
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

  // Helper badge styles
  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case "EASY":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Easy</span>;
      case "MEDIUM":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Medium</span>;
      case "HARD":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Hard</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">{diff}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === "CASE_STUDY") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <FileText className="h-3 w-3" />
          <span>Case Study</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <HelpCircle className="h-3 w-3" />
        <span>MCQ</span>
      </span>
    );
  };

  const renderSortIndicator = (columnKey: "content" | "curriculum" | "difficulty" | "type" | "status" | "created") => {
    const isCurrent = currentFilters.sortBy === columnKey;
    const isAsc = currentFilters.sortOrder === "asc";

    if (isPending && activeSortColumn === columnKey) {
      return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    }

    if (!isCurrent) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover/col:opacity-100 transition-opacity" />;
    }
    return isAsc ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" />
    );
  };

  const { questions, pagination, filterOptions, metrics } = initialData;

  const startIndex = pagination.totalCount > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endIndex = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);
  const pageRange = getPaginationRange(pagination.page, pagination.totalPages);

  const activeQuestionVersion = questionDetail?.versions.find((v) => v.isActive) || questionDetail?.versions[0];
  const hasHistoricalAttempts =
    (questionDetail?.references.practiceAttemptsCount || 0) > 0 ||
    (questionDetail?.references.testQuestionsCount || 0) > 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Status Feedback Toast Banner */}
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
         TOP LEVEL HEADER & ACTIONS TOOLBAR
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <HelpCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <span>Question Bank Management</span>
                <span className="text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider border border-primary/20">
                  Management & Audit
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Manage educational questions, curriculum mappings, version revisions, and export canonical JSON datasets.
          </p>
        </div>

        {/* Action Controls & Level Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
          {/* Export Questions Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isExporting}
            onClick={handleExportQuestions}
            className="font-bold text-xs h-9 rounded-xl cursor-pointer gap-1.5 shadow-2xs border-border/80"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Download className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Export Questions</span>
          </Button>

          {/* Download AI Schema Template Button */}
          <Button
            type="button"
            variant="outline"
            disabled={isExporting}
            onClick={handleDownloadTemplate}
            className="font-bold text-xs h-9 rounded-xl cursor-pointer gap-1.5 shadow-2xs border-primary/30 text-primary hover:bg-primary/10"
            title="Download Master Canonical Schema & Sample Questions for AI extraction"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Import Template</span>
          </Button>

          {/* Review Queue Link */}
          <Button
            asChild
            variant="outline"
            className="font-bold text-xs h-9 rounded-xl cursor-pointer gap-1.5 shadow-2xs border-border/80 text-primary hover:text-primary"
          >
            <Link href="/admin/questions/review">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Review Queue</span>
            </Link>
          </Button>

          {/* Import Batches Link */}
          <Button
            asChild
            variant="outline"
            className="font-bold text-xs h-9 rounded-xl cursor-pointer gap-1.5 shadow-2xs border-border/80"
          >
            <Link href="/admin/questions/imports">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Import Batches</span>
            </Link>
          </Button>

          {/* Academic Level Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80">
            {filterOptions.levels.map((lvl) => {
              const isSelected = lvl.code.toUpperCase() === filterOptions.selectedLevelCode.toUpperCase();
              return (
                <Button
                  key={lvl.id}
                  type="button"
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleLevelChange(lvl.code)}
                  className={cn(
                    "h-8 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  {isPending && isSelected && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                  <span>{lvl.name}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
         METRICS SUMMARY BAR
      ========================================================================= */}
      <div className={cn("grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 transition-opacity duration-200", isPending && "opacity-60")}>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total in Level</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.totalQuestions}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">MCQs</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.mcqCount}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Case Studies</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.caseStudyCount}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.activeCount}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Easy</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.easyCount}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Medium</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.mediumCount}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Hard</span>
          <div className="text-lg font-black text-foreground mt-0.5">{metrics.hardCount}</div>
        </div>
      </div>

      {/* =========================================================================
         MULTI-DIMENSIONAL FILTER TOOLBAR WITH SHADCN SELECTS
      ========================================================================= */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        {/* Row 1: Search and Reset */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search question text, code, or enter UUID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs rounded-xl bg-background font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  updateUrlParams({ q: null });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSearchSubmit}
              disabled={isPending}
              className="h-9 px-4 text-xs font-bold rounded-xl cursor-pointer"
            >
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              disabled={isPending}
              className="h-9 px-3 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Row 2: Shadcn Dropdown Select Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 border-t border-border/60">
          {/* Syllabus Version Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Version</label>
            <Select
              value={currentFilters.curriculumVersionId || "ALL"}
              onValueChange={(val) => updateUrlParams({ version: val === "ALL" ? null : val, subject: null, node: null })}
            >
              <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background cursor-pointer">
                <SelectValue placeholder="All Versions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Versions</SelectItem>
                {filterOptions.versions.map((ver) => (
                  <SelectItem key={ver.id} value={ver.id}>
                    {ver.name} {ver.isActive ? "(Active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subject / Paper</label>
            <Select
              value={currentFilters.subjectId || "ALL"}
              onValueChange={(val) => updateUrlParams({ subject: val === "ALL" ? null : val, node: null })}
            >
              <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background cursor-pointer">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Subjects</SelectItem>
                {filterOptions.subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.code}: {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chapter / Topic Node Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chapter / Topic</label>
            <Select
              value={currentFilters.curriculumNodeId || "ALL"}
              onValueChange={(val) => updateUrlParams({ node: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background cursor-pointer">
                <SelectValue placeholder="All Chapters / Topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Chapters / Topics</SelectItem>
                {filterOptions.nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    [{node.type}] {node.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Question Type Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</label>
            <Select
              value={currentFilters.questionType || "ALL"}
              onValueChange={(val) => updateUrlParams({ type: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background cursor-pointer">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="MCQ">MCQ</SelectItem>
                <SelectItem value="CASE_STUDY">Case Study</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Difficulty</label>
            <Select
              value={currentFilters.difficulty || "ALL"}
              onValueChange={(val) => updateUrlParams({ difficulty: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background cursor-pointer">
                <SelectValue placeholder="All Difficulties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Difficulties</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</label>
            <Select
              value={currentFilters.status || "ALL"}
              onValueChange={(val) => updateUrlParams({ status: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="h-8.5 rounded-xl text-xs bg-background cursor-pointer">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive / Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* =========================================================================
         QUESTION BANK DATA TABLE WITH SORTABLE HEADERS
      ========================================================================= */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs relative">
        {/* Pending visual indicator bar */}
        {isPending && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary overflow-hidden z-20">
            <div className="h-full bg-primary/40 animate-pulse w-full" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table
            className={cn(
              "w-full text-left text-xs border-collapse transition-opacity duration-200",
              isPending && "opacity-50 pointer-events-none"
            )}
            aria-busy={isPending}
          >
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th
                  onClick={() => handleColumnSort("content")}
                  className="py-3 px-4 min-w-[340px] cursor-pointer select-none group/col hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Question Preview</span>
                    {renderSortIndicator("content")}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSort("curriculum")}
                  className="py-3 px-4 min-w-[240px] cursor-pointer select-none group/col hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Curriculum Hierarchy</span>
                    {renderSortIndicator("curriculum")}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSort("type")}
                  className="py-3 px-3 w-28 cursor-pointer select-none group/col hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Type</span>
                    {renderSortIndicator("type")}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSort("difficulty")}
                  className="py-3 px-3 w-24 cursor-pointer select-none group/col hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Difficulty</span>
                    {renderSortIndicator("difficulty")}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSort("status")}
                  className="py-3 px-3 w-24 cursor-pointer select-none group/col hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    {renderSortIndicator("status")}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSort("created")}
                  className="py-3 px-3 w-28 cursor-pointer select-none group/col hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Created</span>
                    {renderSortIndicator("created")}
                  </div>
                </th>
                <th className="py-3 px-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <div className="max-w-sm mx-auto space-y-2">
                      <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/40" />
                      <p className="font-bold text-foreground">No questions found</p>
                      <p className="text-xs">No questions matched your current filter criteria.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="mt-2 text-xs rounded-xl cursor-pointer"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                questions.map((q, idx) => {
                  const globalIndex = startIndex + idx;
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-muted/40 transition-colors group cursor-pointer"
                      onClick={() => handleInspectQuestion(q.id)}
                    >
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-muted-foreground">
                        {globalIndex}
                      </td>

                      {/* Question Text & Options Summary */}
                      <td className="py-3 px-4 space-y-1">
                        <div className="font-semibold text-foreground line-clamp-2 leading-relaxed">
                          {q.questionTextPreview}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground font-mono">
                          <span className="bg-muted px-1.5 py-0.5 rounded font-bold text-foreground">
                            Key: {q.correctAnswer}
                          </span>
                          <span>•</span>
                          <span>{q.optionsCount} Options</span>
                          <span>•</span>
                          <span>v{q.versionNumber}</span>
                          {q.caseStudyTitle && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 dark:text-purple-400 font-semibold truncate max-w-[180px]">
                                Case: {q.caseStudyTitle}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Curriculum Mapping Hierarchy */}
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="font-bold text-foreground truncate max-w-[260px]">
                          {q.subjectCode}: {q.subjectName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                          {q.hierarchyPath}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 font-mono">
                          Node: {q.curriculumNodeCode}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3">{getTypeBadge(q.questionType)}</td>

                      {/* Difficulty */}
                      <td className="py-3 px-3">{getDifficultyBadge(q.difficulty)}</td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {q.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                            Retired
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-3 text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInspectQuestion(q.id)}
                          className="h-8 px-2.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          <span>Inspect</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
           NUMBERED SERVER-SIDE PAGINATION TOOLBAR
        ========================================================================= */}
        {pagination.totalCount > 0 && (
          <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground font-mono text-[11px]">
              Showing <strong className="text-foreground">{startIndex}</strong> to{" "}
              <strong className="text-foreground">{endIndex}</strong> of{" "}
              <strong className="text-foreground">{pagination.totalCount}</strong> questions
            </div>

            <div className="flex items-center gap-1.5">
              {/* Previous Page */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || isPending}
                onClick={() => updateUrlParams({ page: String(pagination.page - 1) })}
                className="h-8 px-2.5 text-xs rounded-lg cursor-pointer gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              {/* Numbered Page Buttons with Ellipses */}
              <div className="flex items-center gap-1">
                {pageRange.map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-xs text-muted-foreground font-bold">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === pagination.page;
                  return (
                    <Button
                      key={p}
                      type="button"
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      disabled={isPending}
                      onClick={() => updateUrlParams({ page: String(p) })}
                      className={cn(
                        "h-8 w-8 p-0 text-xs font-bold rounded-lg cursor-pointer",
                        isCurrent && "bg-primary text-primary-foreground pointer-events-none shadow-2xs"
                      )}
                    >
                      {p}
                    </Button>
                  );
                })}
              </div>

              {/* Next Page */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || isPending}
                onClick={() => updateUrlParams({ page: String(pagination.page + 1) })}
                className="h-8 px-2.5 text-xs rounded-lg cursor-pointer gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
         QUESTION MANAGEMENT INSPECTOR DIALOG
      ========================================================================= */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl font-sans">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <span>Question Inspector & Management</span>
                  {activeQuestionVersion && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      v{activeQuestionVersion.versionNumber} ({activeQuestionVersion.isActive ? "Active" : "Retired"})
                    </span>
                  )}
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">
                  Reference: {selectedQuestionId || "N/A"}
                </p>
              </div>

              {questionDetail && !isDetailLoading && (
                <div className="flex items-center gap-2">
                  {getTypeBadge(questionDetail.questionType)}
                  {getDifficultyBadge(questionDetail.difficulty)}
                </div>
              )}
            </div>
          </DialogHeader>

          {isDetailLoading ? (
            /* High-Fidelity Inspector Skeleton */
            <div className="space-y-6 pt-2">
              <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl space-y-2">
                <Skeleton className="h-3 w-36 rounded" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-md" />
                  <Skeleton className="h-6 w-28 rounded-md" />
                  <Skeleton className="h-6 w-32 rounded-md" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          ) : questionDetail ? (
            <div className="space-y-6 pt-2">
              {/* Management Actions Header Bar */}
              <div className="p-3 bg-muted/30 border border-border rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleOpenEdit}
                    className="h-8 px-3 text-xs font-bold rounded-lg cursor-pointer gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit Question</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isStatusToggling}
                    onClick={handleToggleStatus}
                    className="h-8 px-3 text-xs font-semibold rounded-lg cursor-pointer gap-1.5"
                  >
                    {isStatusToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Power className={cn("h-3.5 w-3.5", activeQuestionVersion?.isActive ? "text-amber-500" : "text-emerald-500")} />
                    )}
                    <span>{activeQuestionVersion?.isActive ? "Retire / Deactivate" : "Activate Question"}</span>
                  </Button>
                </div>

                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setIsDeleteOpen(true);
                    }}
                    className="h-8 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>

              {/* 1. Visual Curriculum Mapping Breadcrumbs */}
              <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl space-y-1.5">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Curriculum Hierarchy Mapping</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground font-bold">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                    {questionDetail.academicLevel.name}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="bg-background px-2 py-0.5 rounded-md border border-border text-muted-foreground">
                    {questionDetail.curriculumVersion.name}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="bg-background px-2 py-0.5 rounded-md border border-border">
                    {questionDetail.subject.code}: {questionDetail.subject.name}
                  </span>
                  {questionDetail.hierarchyBreadcrumbs.map((b) => (
                    <React.Fragment key={b.id}>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="bg-background px-2 py-0.5 rounded-md border border-border text-foreground">
                        [{b.type}] {b.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono pt-1">
                  Canonical Code: <strong className="text-foreground">{questionDetail.curriculumNode.code}</strong>
                </div>
              </div>

              {/* 2. Case Study Scenario (If Applicable) */}
              {questionDetail.caseStudy && (
                <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                    <BookOpen className="h-4 w-4" />
                    <span>Case Study: {questionDetail.caseStudy.title}</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto p-2.5 bg-background/80 rounded-lg border border-purple-500/10">
                    {questionDetail.caseStudy.scenarioText}
                  </p>
                </div>
              )}

              {/* 3. Question Text & Latest Version */}
              {activeQuestionVersion && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Question Text (Version {activeQuestionVersion.versionNumber})
                    </span>
                    <div className="p-4 bg-background border border-border rounded-xl text-xs font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                      {activeQuestionVersion.questionText}
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Options & Answer Key
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {activeQuestionVersion.options.map((opt) => {
                        const isCorrect = opt.optionLetter === activeQuestionVersion.correctAnswer;
                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              "p-3 rounded-xl border text-xs flex items-start gap-3 transition-colors",
                              isCorrect
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 font-semibold"
                                : "bg-muted/30 border-border text-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "h-6 w-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                                isCorrect
                                  ? "bg-emerald-500 text-white"
                                  : "bg-muted border border-border text-muted-foreground"
                              )}
                            >
                              {opt.optionLetter}
                            </span>
                            <span className="flex-1 pt-0.5 leading-relaxed">{opt.optionText}</span>
                            {isCorrect && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation Box */}
                  {activeQuestionVersion.explanation && (
                    <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Academic Explanation</span>
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed">
                        {activeQuestionVersion.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Historical Version Snapshots & Relational Reference Diagnostics */}
              <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Version Revisions */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-primary" />
                    <span>Version History ({questionDetail.versions.length})</span>
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {questionDetail.versions.map((v) => (
                      <div
                        key={v.id}
                        className={cn(
                          "p-2.5 rounded-xl border text-[11px] flex items-center justify-between",
                          v.isActive
                            ? "bg-primary/5 border-primary/30 font-bold text-foreground"
                            : "bg-muted/30 border-border/60 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>v{v.versionNumber}</span>
                          <span
                            className={cn(
                              "px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase",
                              v.isActive
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted border border-border text-muted-foreground"
                            )}
                          >
                            {v.isActive ? "Current Active" : "Archived Snapshot"}
                          </span>
                        </div>
                        <span className="font-mono text-[10px]">{new Date(v.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Relational References Diagnostic */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span>Student Usage & Analytics</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-muted/30 border border-border/60 rounded-xl">
                      <div className="font-black text-sm text-foreground">{questionDetail.references.practiceAttemptsCount}</div>
                      <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Practice Attempts</div>
                    </div>
                    <div className="p-2.5 bg-muted/30 border border-border/60 rounded-xl">
                      <div className="font-black text-sm text-foreground">{questionDetail.references.testQuestionsCount}</div>
                      <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Test Usages</div>
                    </div>
                    <div className="p-2.5 bg-muted/30 border border-border/60 rounded-xl">
                      <div className="font-black text-sm text-foreground">{questionDetail.references.aiConversationsCount}</div>
                      <div className="text-[9px] text-muted-foreground uppercase mt-0.5">AI Doubt Chats</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Diagnostics IDs */}
              <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                <div className="flex items-center gap-1">
                  <span>Question ID: {questionDetail.id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(questionDetail.id, "qId")}
                    className="p-1 hover:text-foreground cursor-pointer"
                  >
                    {copiedKey === "qId" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <span>Node ID: {questionDetail.curriculumNode.id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(questionDetail.curriculumNode.id, "nodeId")}
                    className="p-1 hover:text-foreground cursor-pointer"
                  >
                    {copiedKey === "nodeId" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Question details could not be loaded.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================================
         EDIT QUESTION MODAL WITH AUTOMATIC VERSIONING INTELLIGENCE
      ========================================================================= */}
      {editForm && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl font-sans">
            <DialogHeader className="pb-3 border-b border-border">
              <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" />
                <span>Edit Question Details</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              {/* Intelligent Versioning Notice Banner */}
              {hasHistoricalAttempts ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Historical Attempts Protected</p>
                    <p className="text-[11px] leading-relaxed">
                      This question has <strong>{questionDetail?.references.practiceAttemptsCount}</strong> student practice attempts. Saving content modifications will automatically create <strong>Question Version {(activeQuestionVersion?.versionNumber || 1) + 1}</strong> to preserve past student grading and test analytics.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2.5 text-blue-900 dark:text-blue-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Zero Historical Attempts</p>
                    <p className="text-[11px] leading-relaxed">
                      This question has not been attempted by students yet. Updates will safely apply in-place to Version 1.
                    </p>
                  </div>
                </div>
              )}

              {/* Question Type & Difficulty & Curriculum Node */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Type</label>
                  <Select
                    value={editForm.questionType}
                    onValueChange={(val) => setEditForm((prev) => prev ? { ...prev, questionType: val as QuestionType } : null)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-background cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">MCQ</SelectItem>
                      <SelectItem value="CASE_STUDY">Case Study</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Difficulty</label>
                  <Select
                    value={editForm.difficulty}
                    onValueChange={(val) => setEditForm((prev) => prev ? { ...prev, difficulty: val as QuestionDifficulty } : null)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-background cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EASY">Easy</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HARD">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Chapter / Topic</label>
                  <Select
                    value={editForm.curriculumNodeId}
                    onValueChange={(val) => setEditForm((prev) => prev ? { ...prev, curriculumNodeId: val } : null)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-background cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.nodes.map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          [{node.type}] {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Case Study Details if applicable */}
              {editForm.questionType === "CASE_STUDY" && (
                <div className="p-3.5 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-purple-700 dark:text-purple-300">Case Study Title</label>
                    <Input
                      value={editForm.caseStudyTitle}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, caseStudyTitle: e.target.value } : null)}
                      placeholder="e.g. Comprehensive Case Scenario 1"
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-purple-700 dark:text-purple-300">Scenario Text</label>
                    <Textarea
                      value={editForm.caseStudyScenario}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, caseStudyScenario: e.target.value } : null)}
                      placeholder="Enter the case study background facts and numbers..."
                      rows={4}
                      className="rounded-xl text-xs bg-background font-sans"
                    />
                  </div>
                </div>
              )}

              {/* Question Text */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">Question Text *</label>
                <Textarea
                  value={editForm.questionText}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, questionText: e.target.value } : null)}
                  rows={3}
                  className="rounded-xl text-xs bg-background font-sans leading-relaxed"
                  placeholder="Enter the question text..."
                />
              </div>

              {/* Options Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground">Options & Correct Answer</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={editForm.options.length >= 6}
                    onClick={() => {
                      const nextLetter = String.fromCharCode(65 + editForm.options.length);
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, options: [...prev.options, { letter: nextLetter, text: "" }] }
                          : null
                      );
                    }}
                    className="h-7 px-2 text-[11px] font-bold rounded-lg cursor-pointer gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Option</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  {editForm.options.map((opt, idx) => (
                    <div key={opt.letter} className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center font-bold text-xs shrink-0">
                        {opt.letter}
                      </span>
                      <Input
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editForm.options];
                          updated[idx].text = e.target.value;
                          setEditForm((prev) => prev ? { ...prev, options: updated } : null);
                        }}
                        placeholder={`Option ${opt.letter} text...`}
                        className="h-8.5 text-xs rounded-xl bg-background flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={editForm.options.length <= 2}
                        onClick={() => {
                          const filtered = editForm.options.filter((_, i) => i !== idx);
                          // Re-letter
                          const relettered = filtered.map((o, i) => ({
                            letter: String.fromCharCode(65 + i),
                            text: o.text,
                          }));
                          setEditForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  options: relettered,
                                  correctAnswer: relettered.some((r) => r.letter === prev.correctAnswer)
                                    ? prev.correctAnswer
                                    : relettered[0]?.letter || "A",
                                }
                              : null
                          );
                        }}
                        className="h-8.5 w-8.5 p-0 text-muted-foreground hover:text-destructive cursor-pointer rounded-lg"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Correct Answer Selector */}
                <div className="pt-1 flex items-center gap-3">
                  <span className="font-bold text-foreground">Select Correct Answer:</span>
                  <div className="flex items-center gap-1.5">
                    {editForm.options.map((opt) => {
                      const isSelected = editForm.correctAnswer === opt.letter;
                      return (
                        <Button
                          key={opt.letter}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditForm((prev) => prev ? { ...prev, correctAnswer: opt.letter } : null)}
                          className={cn(
                            "h-7 w-7 p-0 text-xs font-bold rounded-lg cursor-pointer",
                            isSelected && "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                        >
                          {opt.letter}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Explanation Textarea */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">Academic Explanation</label>
                <Textarea
                  value={editForm.explanation}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, explanation: e.target.value } : null)}
                  rows={2}
                  className="rounded-xl text-xs bg-background font-sans"
                  placeholder="Explain why the selected option is correct..."
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isSavingEdit || !editForm.questionText.trim()}
                onClick={handleSaveEdit}
                className="h-9 px-4 text-xs font-bold rounded-xl cursor-pointer gap-1.5"
              >
                {isSavingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* =========================================================================
         DELETE QUESTION GUARDRAIL MODAL
      ========================================================================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl font-sans">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-black text-foreground">
              Delete Question Confirmation
            </DialogTitle>
          </DialogHeader>

          {deleteError ? (
            <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Deletion Blocked</span>
              </div>
              <p className="leading-relaxed">{deleteError}</p>
            </div>
          ) : hasHistoricalAttempts ? (
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Historical Student Dependencies Detected</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  This question has <strong>{questionDetail?.references.practiceAttemptsCount}</strong> student practice attempts and <strong>{questionDetail?.references.testQuestionsCount}</strong> mock test usages.
                </p>
              </div>
              <p>
                Hard deletion is strictly prohibited to preserve historical student test results and scoring integrity. We recommend deactivating or retiring this question instead.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Are you sure you want to delete this question? This question has <strong>0 historical student practice records</strong>, so it can be cleanly and permanently deleted.
              </p>
              <p className="text-[11px] text-destructive font-semibold">
                This action is permanent and cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </Button>

            {hasHistoricalAttempts ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={async () => {
                  setIsDeleteOpen(false);
                  await handleToggleStatus();
                }}
                className="h-9 px-4 text-xs font-bold rounded-xl cursor-pointer"
              >
                Deactivate Instead
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteQuestion}
                className="h-9 px-4 text-xs font-bold rounded-xl cursor-pointer gap-1.5"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Delete Permanently</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
