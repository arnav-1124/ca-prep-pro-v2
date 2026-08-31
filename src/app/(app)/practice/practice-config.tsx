"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  startSessionAction,
  getAvailableQuestionsCountAction,
  getCurriculumNodesAction
} from "@/app/actions/practice";
import {
  GraduationCap,
  Sparkles,
  Filter,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface CurriculumNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  sortOrder: number;
}

interface PracticeConfigProps {
  levelId: string;
  levelName: string;
  activeVersionId: string;
  subjects: Subject[];
}

export function PracticeConfig({
  levelId,
  levelName,
  activeVersionId,
  subjects
}: PracticeConfigProps) {
  const router = useRouter();

  // Core config states
  const [practiceMode, setPracticeMode] = useState<"QUESTION" | "CASE_STUDY">("QUESTION");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>("ANY");
  const questionType = "MCQ";
  const [requestedCount, setRequestedCount] = useState<number>(10);

  // Dynamic load states
  const [flatNodes, setFlatNodes] = useState<CurriculumNode[]>([]);
  const [availableCount, setAvailableCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState<boolean>(false);
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // 1. Fetch nodes when subject changes
  useEffect(() => {
    async function loadNodes() {
      if (selectedSubjectId === "ALL") {
        setFlatNodes([]);
        setSelectedNodeIds([]);
        return;
      }
      const res = await getCurriculumNodesAction(selectedSubjectId, activeVersionId);
      if (res.success && res.nodes) {
        setFlatNodes(res.nodes);
      } else {
        setFlatNodes([]);
      }
      setSelectedNodeIds([]);
    }
    loadNodes();
  }, [selectedSubjectId, activeVersionId]);

  // Resolve current active node ID (last selected in progressive select list)
  const finalNodeId = selectedNodeIds.filter(Boolean).slice(-1)[0] || null;

  // 2. Query available questions/cases count in real-time
  useEffect(() => {
    async function fetchCount() {
      setLoadingCount(true);
      const res = await getAvailableQuestionsCountAction(
        levelId,
        selectedSubjectId === "ALL" ? null : selectedSubjectId,
        finalNodeId,
        practiceMode,
        difficulty,
        practiceMode === "CASE_STUDY" ? "CASE_STUDY" : questionType
      );
      if (res.success) {
        setAvailableCount(res.count);
        // Adjust request count if it exceeds availability
        if (requestedCount > res.count && res.count > 0) {
          setRequestedCount(res.count);
        }
      }
      setLoadingCount(false);
    }
    fetchCount();
  }, [
    levelId,
    selectedSubjectId,
    finalNodeId,
    practiceMode,
    difficulty,
    questionType,
    requestedCount
  ]);

  // Handle progressive selects change
  const handleNodeSelect = (index: number, value: string) => {
    const nextSelected = [...selectedNodeIds];
    if (value === "") {
      // Clear this select and all subsequent selects
      nextSelected.splice(index);
    } else {
      nextSelected[index] = value;
      nextSelected.splice(index + 1); // Reset children
    }
    setSelectedNodeIds(nextSelected);
  };

  // Build progressive selects array
  const buildProgressiveSelects = () => {
    const selects = [];
    const currentParentId: string | null = null;

    // Dropdown 0 (Root Level)
    const levelNodes = flatNodes.filter((n) => n.parentId === currentParentId);
    if (levelNodes.length > 0) {
      selects.push({
        parentId: currentParentId,
        nodes: levelNodes,
        value: selectedNodeIds[0] || "",
        index: 0,
        label: "Module / Division"
      });
    }

    // Dropdown 1 to N
    for (let i = 0; i < selectedNodeIds.length; i++) {
      const parentId = selectedNodeIds[i];
      if (!parentId) break;
      const childNodes = flatNodes.filter((n) => n.parentId === parentId);
      if (childNodes.length > 0) {
        selects.push({
          parentId,
          nodes: childNodes,
          value: selectedNodeIds[i + 1] || "",
          index: i + 1,
          label: childNodes[0]?.type ? `${childNodes[0].type.charAt(0) + childNodes[0].type.slice(1).toLowerCase()}` : "Sub-topic"
        });
      } else {
        break;
      }
    }

    return selects;
  };

  const progressiveSelects = buildProgressiveSelects();

  // Create session and launch runner
  const handleStartPractice = async () => {
    setLoadingSubmit(true);
    setConfigError(null);
    const result = await startSessionAction(
      selectedSubjectId === "ALL" ? null : selectedSubjectId,
      finalNodeId,
      practiceMode,
      difficulty,
      practiceMode === "CASE_STUDY" ? "CASE_STUDY" : questionType,
      requestedCount
    );

    if (result.success && result.sessionId) {
      if (practiceMode === "CASE_STUDY") {
        router.push(`/practice/cases/${result.sessionId}`);
      } else {
        router.push(`/practice/${result.sessionId}`);
      }
    } else {
      setConfigError(result.error || "Failed to initialize practice session. Please try again.");
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="border border-border bg-card text-card-foreground rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <GraduationCap className="h-5 w-5" />
            <span>{levelName}</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground mt-1">
            Practice Workspace
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 font-sans">
            Customize and launch targeted practice sessions using CA Prep Pro&apos;s syllabus library.
          </p>
        </div>
      </div>

      {/* Segmented Mode Selector */}
      <div className="flex border border-border rounded-xl p-1 bg-muted/30 w-full max-w-md">
        <button
          onClick={() => {
            setPracticeMode("QUESTION");
            setRequestedCount(10);
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all duration-150 select-none",
            practiceMode === "QUESTION"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Question Practice</span>
        </button>
        <button
          onClick={() => {
            setPracticeMode("CASE_STUDY");
            setRequestedCount(1);
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all duration-150 select-none",
            practiceMode === "CASE_STUDY"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="h-4 w-4" />
          <span>Case Studies</span>
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 border border-border bg-card rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Configure Practice Scope
            </h2>
          </div>

          <div className="space-y-4">
            {/* Subject Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Select Subject / Paper
              </label>
              <Select value={selectedSubjectId} onValueChange={(val) => setSelectedSubjectId(val)}>
                <SelectTrigger className="w-full h-10 border-input bg-card text-foreground">
                  <SelectValue placeholder="All Papers (Comprehensive Practice)" />
                </SelectTrigger>
                <SelectContent position="popper" className="bg-popover text-popover-foreground">
                  <SelectItem value="ALL">All Papers (Comprehensive Practice)</SelectItem>
                  {subjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progressive Curriculum Selectors */}
            {selectedSubjectId !== "ALL" && progressiveSelects.map((select) => (
              <div key={select.index} className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Narrow by: {select.label}
                </label>
                <Select
                  value={select.value || "ALL"}
                  onValueChange={(val) => handleNodeSelect(select.index, val === "ALL" ? "" : val)}
                >
                  <SelectTrigger className="w-full h-10 border-input bg-card text-foreground">
                    <SelectValue placeholder="All in current section" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-popover text-popover-foreground">
                    <SelectItem value="ALL">All in current section</SelectItem>
                    {select.nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* Question Type Selector (Question Mode only) */}
            {practiceMode === "QUESTION" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Question Type
                </label>
                <div className="flex gap-2">
                  <button
                    disabled
                    className="border border-primary bg-primary/5 text-primary text-xs font-bold px-4 py-2 rounded-lg cursor-not-allowed select-none"
                  >
                    Multiple Choice (MCQ)
                  </button>
                  <button
                    disabled
                    className="border border-border text-muted-foreground/40 text-xs font-bold px-4 py-2 rounded-lg cursor-not-allowed select-none"
                  >
                    True / False (Future)
                  </button>
                </div>
              </div>
            )}

            {/* Difficulty Toggle Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Difficulty Level
              </label>
              <div className="flex flex-wrap gap-2">
                {["ANY", "EASY", "MEDIUM", "HARD"].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-lg border cursor-pointer select-none transition-all duration-150",
                      difficulty === diff
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted/10 text-foreground"
                    )}
                  >
                    {diff === "ANY" ? "Any Difficulty" : diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Count Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {practiceMode === "CASE_STUDY" ? "Number of Case Studies" : "Question Count"}
              </label>
              <div className="flex gap-2">
                {(practiceMode === "CASE_STUDY" ? [1, 2, 5] : [5, 10, 20, 30]).map((count) => {
                  const isCapped = availableCount > 0 && count > availableCount;
                  return (
                    <button
                      key={count}
                      type="button"
                      disabled={isCapped}
                      onClick={() => setRequestedCount(count)}
                      className={cn(
                        "w-12 py-2 text-xs font-bold rounded-lg border cursor-pointer select-none transition-all duration-150",
                        requestedCount === count
                          ? "border-primary bg-primary/5 text-primary"
                          : isCapped
                            ? "border-dashed border-border text-muted-foreground/30 cursor-not-allowed"
                            : "border-border hover:bg-muted/10 text-foreground"
                      )}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Summary & Launch Card */}
        <div className="border border-border bg-card rounded-2xl p-6 shadow-2xs flex flex-col justify-between min-h-[300px]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Session Summary
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Mode:</span>
                <span className="font-bold text-foreground">
                  {practiceMode === "CASE_STUDY" ? "Case Study Study" : "Question Prep"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-muted/20">
                <span className="text-muted-foreground">Subject scope:</span>
                <span className="font-bold text-foreground truncate max-w-[150px]">
                  {selectedSubjectId !== "ALL"
                    ? subjects.find((s) => s.id === selectedSubjectId)?.name
                    : "Comprehensive (All)"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-muted/20">
                <span className="text-muted-foreground">Difficulty:</span>
                <span className="font-bold text-foreground">{difficulty}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-muted/20">
                <span className="text-muted-foreground">Target volume:</span>
                <span className="font-bold text-foreground">
                  {requestedCount} {practiceMode === "CASE_STUDY" ? "cases" : "questions"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {/* Availability Indicator */}
            <div className="rounded-xl border border-muted p-3 bg-muted/10">
              {loadingCount ? (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-sans">
                  <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Checking syllabus library...</span>
                </div>
              ) : availableCount === 0 ? (
                <div className="flex items-start gap-2 text-xs text-destructive font-sans">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>No matching items found. Please change subject filters or select a different difficulty level.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-sans font-bold">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {availableCount} {practiceMode === "CASE_STUDY" ? "case studies" : "questions"} available for this selection.
                  </span>
                </div>
              )}
            </div>

            {configError && (
              <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-3 text-xs text-destructive flex items-center gap-2">
                <span>{configError}</span>
              </div>
            )}

            <Button
              onClick={handleStartPractice}
              disabled={availableCount === 0 || loadingCount || loadingSubmit}
              className="w-full h-10 cursor-pointer select-none font-bold"
            >
              {loadingSubmit ? "Initializing Session..." : "Start Practice Session"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
