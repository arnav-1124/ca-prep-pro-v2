"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  Sparkles,
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
import { createImportBatchAction } from "@/app/actions/admin-question-imports";
import { QuestionSourceType } from "@/domains/questions/import/types";
import { cn } from "@/lib/utils";

interface ImportBatchItem {
  id: string;
  batchName: string;
  sourceType: string;
  sourceTitle: string | null;
  sourceYear: number | null;
  sourceMonth: number | null;
  status: string;
  totalQuestions: number;
  validQuestionsCount: number;
  invalidQuestionsCount: number;
  duplicateCandidatesCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingReviewCount: number;
  publishedCount: number;
  createdByUserEmail: string | null;
  createdAt: Date;
  levelCode: string;
  levelName: string;
  versionName: string;
  subjectName: string | null;
}

interface AdminImportsClientProps {
  initialBatches: ImportBatchItem[];
  levels: { id: string; code: string; name: string }[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  selectedLevel: string;
  selectedStatus: string;
  modalData: {
    allLevels: { id: string; code: string; name: string }[];
    allVersions: { id: string; academicLevelId: string; name: string; isActive: boolean }[];
    allSubjects: { id: string; academicLevelId: string; code: string; name: string }[];
  };
}

export function AdminImportsClient({
  initialBatches,
  levels,
  pagination,
  selectedLevel,
  selectedStatus,
  modalData,
}: AdminImportsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // Dialog state
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const initialLevelId = modalData.allLevels[0]?.id || "";
  const initialVersionId =
    modalData.allVersions.find((v) => v.academicLevelId === initialLevelId && v.isActive)?.id ||
    modalData.allVersions.find((v) => v.academicLevelId === initialLevelId)?.id ||
    "";

  // Form states
  const [uploadLevelId, setUploadLevelId] = React.useState<string>(initialLevelId);
  const [uploadVersionId, setUploadVersionId] = React.useState<string>(initialVersionId);
  const [uploadSubjectId, setUploadSubjectId] = React.useState<string>("NONE");
  const [sourceType, setSourceType] = React.useState<QuestionSourceType>("STUDY_MATERIAL");
  const [sourceTitle, setSourceTitle] = React.useState("");
  const [sourceYear, setSourceYear] = React.useState("");
  const [batchName, setBatchName] = React.useState("");
  const [jsonText, setJsonText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);

  // Filter versions by selected level in modal
  const filteredVersions = React.useMemo(() => {
    return modalData.allVersions.filter((v) => v.academicLevelId === uploadLevelId);
  }, [modalData.allVersions, uploadLevelId]);

  // Filter subjects by selected level in modal
  const filteredSubjects = React.useMemo(() => {
    return modalData.allSubjects.filter((s) => s.academicLevelId === uploadLevelId);
  }, [modalData.allSubjects, uploadLevelId]);

  const handleUploadLevelChange = (lvlId: string) => {
    setUploadLevelId(lvlId);
    const matchedVer =
      modalData.allVersions.find((v) => v.academicLevelId === lvlId && v.isActive) ||
      modalData.allVersions.find((v) => v.academicLevelId === lvlId);
    setUploadVersionId(matchedVer?.id || "");
    setUploadSubjectId("NONE");
  };

  // URL Navigation helper
  const updateFilters = (newLevel?: string, newStatus?: string, newPage?: number) => {
    const lvl = newLevel !== undefined ? newLevel : selectedLevel;
    const st = newStatus !== undefined ? newStatus : selectedStatus;
    const p = newPage !== undefined ? newPage : 1;

    startTransition(() => {
      router.push(`/admin/questions/imports?level=${lvl}&status=${st}&page=${p}&pageSize=${pagination.pageSize}`);
    });
  };

  // Handle file upload selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
    };
    reader.readAsText(file);
  };

  // Submit Upload Form
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonText.trim()) {
      setStatusMessage({ type: "error", text: "Please provide valid JSON content to import." });
      return;
    }

    if (!uploadVersionId) {
      setStatusMessage({ type: "error", text: "Please select a target curriculum version." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const result = await createImportBatchAction({
      rawJsonString: jsonText,
      batchName: batchName.trim() || undefined,
      academicLevelId: uploadLevelId,
      curriculumVersionId: uploadVersionId,
      subjectId: uploadSubjectId !== "NONE" ? uploadSubjectId : undefined,
      sourceType,
      sourceTitle: sourceTitle.trim() || undefined,
      sourceYear: sourceYear ? parseInt(sourceYear, 10) : undefined,
    });

    setIsSubmitting(false);

    if (result.success && result.data) {
      setIsUploadOpen(false);
      setJsonText("");
      setFileName(null);
      setBatchName("");
      setStatusMessage({
        type: "success",
        text: `Batch created with ${result.data.totalQuestions} questions (${result.data.validCount} valid, ${result.data.duplicateCandidatesCount} duplicate candidates).`,
      });
      router.push(`/admin/questions/imports/${result.data.batchId}`);
    } else {
      setStatusMessage({
        type: "error",
        text: result.error || "Failed to process import batch.",
      });
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border bg-card rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/questions"
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Question Bank Explorer</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Question Import & Review Queues
            </h1>
            <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Step 18
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Upload structured JSON question batches, run deterministic validation, and conduct one-by-one human review.
          </p>
        </div>

        <Button
          onClick={() => setIsUploadOpen(true)}
          className="font-bold text-xs h-9.5 px-4 rounded-xl cursor-pointer gap-2 shadow-xs"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload Question Batch</span>
        </Button>
      </div>

      {/* Filter & Transition Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border border-border rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Level Filter */}
          <div className="w-44">
            <Select
              value={selectedLevel}
              onValueChange={(val) => updateFilters(val, undefined, 1)}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-medium cursor-pointer">
                <SelectValue placeholder="All Academic Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Academic Levels</SelectItem>
                {levels.map((lvl) => (
                  <SelectItem key={lvl.id} value={lvl.code}>
                    {lvl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-44">
            <Select
              value={selectedStatus}
              onValueChange={(val) => updateFilters(undefined, val, 1)}
              disabled={isPending}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs font-medium cursor-pointer">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Batch Statuses</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                <SelectItem value="PARTIALLY_APPROVED">Partially Approved</SelectItem>
                <SelectItem value="COMPLETED">Completed / Published</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-sans flex items-center gap-2">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          <span>
            Showing <strong className="text-foreground">{initialBatches.length}</strong> of{" "}
            <strong className="text-foreground">{pagination.totalCount}</strong> batches
          </span>
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

      {/* Batches Table List */}
      <div
        className={cn(
          "border border-border bg-card rounded-2xl overflow-hidden shadow-xs relative transition-opacity duration-200",
          isPending && "opacity-50 pointer-events-none"
        )}
        aria-busy={isPending}
      >
        {isPending && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-pulse z-10" />
        )}

        {initialBatches.length > 0 ? (
          <div className="divide-y divide-border/60">
            {initialBatches.map((batch) => {
              const reviewProgress =
                batch.totalQuestions > 0
                  ? Math.round(((batch.approvedCount + batch.rejectedCount) / batch.totalQuestions) * 100)
                  : 0;

              return (
                <div
                  key={batch.id}
                  className="p-5 hover:bg-muted/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/questions/imports/${batch.id}`}
                        className="text-sm font-extrabold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {batch.batchName}
                      </Link>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase border border-border">
                        {batch.sourceType.replace("_", " ")}
                      </span>
                      {batch.status === "COMPLETED" && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          Published
                        </span>
                      )}
                      {batch.status === "PARTIALLY_APPROVED" && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          Partially Approved
                        </span>
                      )}
                      {batch.status === "PENDING_REVIEW" && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          Review Required
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-sans">
                      <span>{batch.levelName}</span>
                      <span>•</span>
                      <span>{batch.versionName}</span>
                      {batch.subjectName && (
                        <>
                          <span>•</span>
                          <span>{batch.subjectName}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{new Date(batch.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Counts breakdown badge strip */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
                        Total: {batch.totalQuestions}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        Valid: {batch.validQuestionsCount}
                      </span>
                      {batch.invalidQuestionsCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                          Invalid: {batch.invalidQuestionsCount}
                        </span>
                      )}
                      {batch.duplicateCandidatesCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          Duplicates: {batch.duplicateCandidatesCount}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Approved: {batch.approvedCount}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                        Rejected: {batch.rejectedCount}
                      </span>
                    </div>
                  </div>

                  {/* Progress & Review Action */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block space-y-1 w-28">
                      <div className="text-[11px] font-bold text-muted-foreground">
                        {batch.approvedCount + batch.rejectedCount} / {batch.totalQuestions} Reviewed
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${reviewProgress}%` }}
                        />
                      </div>
                    </div>

                    <Button asChild size="sm" className="font-bold text-xs rounded-xl cursor-pointer gap-1">
                      <Link href={`/admin/questions/imports/${batch.id}`}>
                        <span>Review Batch</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No Question Import Batches</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No import batches found for the selected filter criteria. Upload a structured JSON batch to begin review.
              </p>
            </div>
            <Button
              onClick={() => setIsUploadOpen(true)}
              className="font-bold text-xs h-9 px-4 rounded-xl cursor-pointer gap-1.5 mt-2"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Upload First Batch</span>
            </Button>
          </div>
        )}
      </div>

      {/* UPLOAD BATCH DIALOG */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl font-sans max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Upload Question Import Batch</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Provide structured JSON questions. Content is validated and staged in the review queue before publication.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
            {/* Target Level & Version */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Target Academic Level *</label>
                <Select
                  value={uploadLevelId}
                  onValueChange={handleUploadLevelChange}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {modalData.allLevels.map((lvl) => (
                      <SelectItem key={lvl.id} value={lvl.id}>
                        {lvl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Curriculum Version *</label>
                <Select
                  value={uploadVersionId}
                  onValueChange={(val) => setUploadVersionId(val)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Select Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVersions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.isActive && "(Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Optional Default Subject & Source Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Default Subject <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Select
                  value={uploadSubjectId}
                  onValueChange={(val) => setUploadSubjectId(val)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Auto-detect from JSON" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Auto-detect from question hints</SelectItem>
                    {filteredSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Source Type</label>
                <Select
                  value={sourceType}
                  onValueChange={(val) => setSourceType(val as QuestionSourceType)}
                >
                  <SelectTrigger className="h-9.5 rounded-xl text-xs cursor-pointer">
                    <SelectValue placeholder="Source Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDY_MATERIAL">ICAI Study Material</SelectItem>
                    <SelectItem value="RTP">Revision Test Paper (RTP)</SelectItem>
                    <SelectItem value="MTP">Mock Test Paper (MTP)</SelectItem>
                    <SelectItem value="PYQ">Past Year Question (PYQ)</SelectItem>
                    <SelectItem value="AI_GENERATED">AI Generated / Draft</SelectItem>
                    <SelectItem value="OTHER_OFFICIAL">Other Official Resource</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Batch Name, Source Title, & Source Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Batch Name <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. May 2027 RTP"
                  className="h-9.5 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Source Title <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="e.g. ICAI Study Module 1"
                  className="h-9.5 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Exam Year <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  value={sourceYear}
                  onChange={(e) => setSourceYear(e.target.value)}
                  placeholder="e.g. 2027"
                  className="h-9.5 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* File Upload Dropzone or Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">JSON Question Payload *</label>
                {fileName && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{fileName}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="text-xs h-9.5 rounded-xl cursor-pointer file:cursor-pointer file:text-xs file:font-bold"
                />
              </div>

              <Textarea
                rows={7}
                value={jsonText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonText(e.target.value)}
                placeholder='Paste raw JSON here or select file above... e.g. { "questions": [ { "questionText": "...", "options": [...], "correctAnswer": "A" } ] }'
                className="font-mono text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadOpen(false)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !jsonText.trim() || !uploadVersionId}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Validate & Create Batch</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
