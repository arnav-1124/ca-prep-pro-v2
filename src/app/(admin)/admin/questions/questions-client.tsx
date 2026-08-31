"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  QuestionBankResponse,
  QuestionDetailView,
  QuestionBankFilterParams,
} from "@/domains/questions/services";
import { fetchQuestionDetailAction } from "@/app/actions/admin-questions";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Search,
  Filter,
  Sparkles,
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
  FolderTree,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuestionsExplorerClientProps {
  initialData: QuestionBankResponse;
  currentFilters: QuestionBankFilterParams;
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

  // Search input state
  const [searchQuery, setSearchQuery] = React.useState(currentFilters.searchQuery || "");
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<string | null>(null);
  const [questionDetail, setQuestionDetail] = React.useState<QuestionDetailView | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [activeSortColumn, setActiveSortColumn] = React.useState<string | null>(null);

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

    // Reset to page 1 whenever filters or sorting changes (unless page itself is explicitly specified)
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

  // Cycle: none (default created desc) -> asc -> desc -> reset
  const handleColumnSort = (columnKey: "content" | "curriculum" | "difficulty" | "type" | "status" | "created") => {
    setActiveSortColumn(columnKey);
    const currentSort = currentFilters.sortBy || "created";
    const currentOrder = currentFilters.sortOrder || "desc";

    if (currentSort !== columnKey) {
      updateUrlParams({ sortBy: columnKey, sortOrder: "asc" });
    } else if (currentOrder === "asc") {
      updateUrlParams({ sortBy: columnKey, sortOrder: "desc" });
    } else {
      // Reset to default sort
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

  // Helper styles
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

  return (
    <div className="space-y-6 font-sans">
      {/* =========================================================================
         TOP LEVEL HEADER & METRICS
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <HelpCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <span>Question Bank Explorer</span>
                <span className="text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider border border-primary/20">
                  Read Only
                </span>
              </h1>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Inspect, filter, and audit curriculum-to-question mappings across CA Foundation, Intermediate, and Final.
          </p>
        </div>

        {/* Controls & Level Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
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
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleResetFilters}
              className="h-9 px-3 text-xs font-bold rounded-xl cursor-pointer gap-1.5"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
              <span>Reset Filters</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Standardized shadcn Select Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Subject Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Subject</label>
            <Select
              value={currentFilters.subjectId || "ALL"}
              onValueChange={(val) => updateUrlParams({ subject: val === "ALL" ? null : val, node: null })}
            >
              <SelectTrigger className="w-full h-8.5 text-xs rounded-xl bg-background border-border cursor-pointer">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl font-sans">
                <SelectItem value="ALL">All Subjects</SelectItem>
                {filterOptions.subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Curriculum Node Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Chapter / Topic</label>
            <Select
              value={currentFilters.curriculumNodeId || "ALL"}
              onValueChange={(val) => updateUrlParams({ node: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="w-full h-8.5 text-xs rounded-xl bg-background border-border cursor-pointer">
                <SelectValue placeholder="All Nodes / Chapters" />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl font-sans">
                <SelectItem value="ALL">All Nodes / Chapters</SelectItem>
                {filterOptions.nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    [{n.type}] {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Question Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Type</label>
            <Select
              value={currentFilters.questionType || "ALL"}
              onValueChange={(val) => updateUrlParams({ type: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="w-full h-8.5 text-xs rounded-xl bg-background border-border cursor-pointer">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-sans">
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="MCQ">MCQ (Single Choice)</SelectItem>
                <SelectItem value="CASE_STUDY">Case Study Integrated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Difficulty</label>
            <Select
              value={currentFilters.difficulty || "ALL"}
              onValueChange={(val) => updateUrlParams({ difficulty: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="w-full h-8.5 text-xs rounded-xl bg-background border-border cursor-pointer">
                <SelectValue placeholder="All Difficulties" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-sans">
                <SelectItem value="ALL">All Difficulties</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Publication Status</label>
            <Select
              value={currentFilters.status || "ALL"}
              onValueChange={(val) => updateUrlParams({ status: val === "ALL" ? null : val })}
            >
              <SelectTrigger className="w-full h-8.5 text-xs rounded-xl bg-background border-border cursor-pointer">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-sans">
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active (Published)</SelectItem>
                <SelectItem value="INACTIVE">Inactive (Draft / Retired)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* =========================================================================
         QUESTIONS LIST TABLE WITH TRANSITION STATE
      ========================================================================= */}
      <div
        className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden relative"
        aria-busy={isPending}
      >
        {/* Top Progress Loading Line */}
        {isPending && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-pulse z-10" />
        )}

        {/* Table Top Status Bar */}
        <div className="px-5 py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-foreground">
              Showing {startIndex}–{endIndex} of {pagination.totalCount} questions
            </span>
            {isPending && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Updating records...</span>
              </span>
            )}
          </div>

          {/* Top Rows Per Page Quick Control */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">Rows per page:</span>
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={(val) => updateUrlParams({ pageSize: val, page: "1" })}
            >
              <SelectTrigger className="h-7 w-20 px-2 text-xs rounded-lg bg-background border-border cursor-pointer">
                <SelectValue placeholder="20" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-sans">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {questions.length === 0 ? (
          /* Honest Empty State */
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
              <Filter className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-bold text-foreground">No questions found</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No questions match your current filter selection. Try resetting filters or switching academic levels.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-2 text-xs font-bold rounded-xl cursor-pointer"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider select-none">
                  {/* Column: Type */}
                  <th
                    onClick={() => handleColumnSort("type")}
                    className="py-3 px-4 w-28 cursor-pointer group/col hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Type</span>
                      {renderSortIndicator("type")}
                    </div>
                  </th>

                  {/* Column: Content */}
                  <th
                    onClick={() => handleColumnSort("content")}
                    className="py-3 px-4 cursor-pointer group/col hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Question Content</span>
                      {renderSortIndicator("content")}
                    </div>
                  </th>

                  {/* Column: Curriculum */}
                  <th
                    onClick={() => handleColumnSort("curriculum")}
                    className="py-3 px-4 w-52 cursor-pointer group/col hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Curriculum Location</span>
                      {renderSortIndicator("curriculum")}
                    </div>
                  </th>

                  {/* Column: Difficulty */}
                  <th
                    onClick={() => handleColumnSort("difficulty")}
                    className="py-3 px-4 w-28 cursor-pointer group/col hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Difficulty</span>
                      {renderSortIndicator("difficulty")}
                    </div>
                  </th>

                  {/* Column: Key (Static) */}
                  <th className="py-3 px-4 w-20">Key</th>

                  {/* Column: Status */}
                  <th
                    onClick={() => handleColumnSort("status")}
                    className="py-3 px-4 w-24 text-center cursor-pointer group/col hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Status</span>
                      {renderSortIndicator("status")}
                    </div>
                  </th>

                  {/* Column: Actions */}
                  <th className="py-3 px-4 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {questions.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => handleInspectQuestion(q.id)}
                    className={cn(
                      "hover:bg-muted/30 transition-colors cursor-pointer group",
                      selectedQuestionId === q.id && "bg-primary/5 font-medium"
                    )}
                  >
                    {/* Type Badge */}
                    <td className="py-3 px-4 align-top">
                      {getTypeBadge(q.questionType)}
                    </td>

                    {/* Question Content & IDs */}
                    <td className="py-3 px-4 align-top space-y-1">
                      <p className="font-semibold text-foreground line-clamp-2 leading-relaxed">
                        {q.questionTextPreview}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono bg-muted/60 px-1.5 py-0.2 rounded border border-border/60">
                          {q.id.slice(0, 8)}...
                        </span>
                        {q.isAiGenerated && (
                          <span className="flex items-center gap-1 text-primary font-bold">
                            <Sparkles className="h-3 w-3" />
                            <span>AI Seed</span>
                          </span>
                        )}
                        {q.caseStudyTitle && (
                          <span className="text-purple-600 dark:text-purple-400 font-medium truncate max-w-[200px]">
                            Case: {q.caseStudyTitle}
                          </span>
                        )}
                        {q.sourceType && (
                          <span className="bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                            {q.sourceType}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Curriculum Location */}
                    <td className="py-3 px-4 align-top space-y-1">
                      <div className="font-bold text-foreground truncate max-w-[200px]">
                        {q.subjectCode}: {q.subjectName}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-[200px]" title={q.hierarchyPath}>
                        <FolderTree className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate">{q.curriculumNodeName}</span>
                      </div>
                    </td>

                    {/* Difficulty */}
                    <td className="py-3 px-4 align-top">
                      {getDifficultyBadge(q.difficulty)}
                    </td>

                    {/* Answer Key */}
                    <td className="py-3 px-4 align-top">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border/80">
                        {q.correctAnswer}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 align-top text-center">
                      {q.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectQuestion(q.id);
                        }}
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
           ADVANCED NUMBERED PAGINATION BAR
        ========================================================================= */}
        <div className="px-5 py-3.5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 text-xs">
          <div className="text-muted-foreground text-xs">
            Showing <strong className="text-foreground">{startIndex}</strong> to <strong className="text-foreground">{endIndex}</strong> of <strong className="text-foreground">{pagination.totalCount}</strong> results
          </div>

          <div className="flex items-center gap-1.5">
            {/* Previous Page Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isPending}
              onClick={() => updateUrlParams({ page: (pagination.page - 1).toString() })}
              className="h-8 px-2.5 text-xs font-bold rounded-xl cursor-pointer gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>

            {/* Abbreviated Numbered Page Buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {pageRange.map((p, idx) => {
                if (p === "...") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 text-xs text-muted-foreground select-none">
                      ...
                    </span>
                  );
                }
                const isCurrent = p === pagination.page;
                return (
                  <Button
                    key={`page-${p}`}
                    type="button"
                    variant={isCurrent ? "default" : "outline"}
                    size="sm"
                    disabled={isPending}
                    onClick={() => updateUrlParams({ page: p.toString() })}
                    className={cn(
                      "h-8 w-8 p-0 text-xs font-bold rounded-xl cursor-pointer transition-all",
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {p}
                  </Button>
                );
              })}
            </div>

            {/* Next Page Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || isPending}
              onClick={() => updateUrlParams({ page: (pagination.page + 1).toString() })}
              className="h-8 px-2.5 text-xs font-bold rounded-xl cursor-pointer gap-1"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* =========================================================================
         QUESTION INSPECTOR MODAL WITH HIGH-FIDELITY SKELETON
      ========================================================================= */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto font-sans p-6">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold text-foreground">
                    Question Inspector
                  </DialogTitle>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ID: {selectedQuestionId}
                  </span>
                </div>
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
              {/* Hierarchy Skeleton */}
              <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl space-y-2">
                <Skeleton className="h-3 w-36 rounded" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-md" />
                  <Skeleton className="h-6 w-28 rounded-md" />
                  <Skeleton className="h-6 w-32 rounded-md" />
                </div>
              </div>

              {/* Question Text Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>

              {/* Options Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-xl" />
                  ))}
                </div>
              </div>

              {/* Explanation Skeleton */}
              <div className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>

              {/* Stats & History Grid Skeleton */}
              <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-28 rounded" />
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          ) : questionDetail ? (
            <div className="space-y-6 pt-2">
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
              {questionDetail.versions[0] && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Question Text (Version {questionDetail.versions[0].versionNumber})
                    </span>
                    <div className="p-4 bg-background border border-border rounded-xl text-xs font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                      {questionDetail.versions[0].questionText}
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Options & Answer Key
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {questionDetail.versions[0].options.map((opt) => {
                        const isCorrect = opt.optionLetter === questionDetail.versions[0].correctAnswer;
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
                  {questionDetail.versions[0].explanation && (
                    <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Academic Explanation</span>
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed">
                        {questionDetail.versions[0].explanation}
                      </p>
                    </div>
                  )}

                  {/* Source Metadata */}
                  {questionDetail.versions[0].source && (
                    <div className="p-3 bg-muted/40 border border-border/80 rounded-xl flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Source Material</span>
                        <div className="font-bold text-foreground">
                          {questionDetail.versions[0].source.sourceTitle} ({questionDetail.versions[0].source.sourceType})
                        </div>
                      </div>
                      {questionDetail.versions[0].source.sourceYear && (
                        <span className="text-xs text-muted-foreground font-mono">
                          Year: {questionDetail.versions[0].source.sourceYear}
                        </span>
                      )}
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
                    <span>Version Snapshots ({questionDetail.versions.length})</span>
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {questionDetail.versions.map((v) => (
                      <div key={v.id} className="p-2 bg-muted/30 border border-border/60 rounded-lg flex items-center justify-between text-[11px]">
                        <span className="font-bold">v{v.versionNumber} ({v.isActive ? "Active" : "Archived"})</span>
                        <span className="text-muted-foreground font-mono">{new Date(v.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Relational References Diagnostic */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span>Platform Utilization</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-muted/30 border border-border/60 rounded-lg">
                      <div className="font-black text-sm text-foreground">{questionDetail.references.practiceAttemptsCount}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">Practice Attempts</div>
                    </div>
                    <div className="p-2 bg-muted/30 border border-border/60 rounded-lg">
                      <div className="font-black text-sm text-foreground">{questionDetail.references.testQuestionsCount}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">Test Usages</div>
                    </div>
                    <div className="p-2 bg-muted/30 border border-border/60 rounded-lg">
                      <div className="font-black text-sm text-foreground">{questionDetail.references.aiConversationsCount}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">AI Doubt Chats</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Entity IDs for Diagnostics */}
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
    </div>
  );
}
