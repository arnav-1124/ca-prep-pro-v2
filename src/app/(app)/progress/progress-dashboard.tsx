"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OverallProgressState, CurriculumProgressNode } from "@/domains/progress/services";
import { updateTargetDateAction, getSubjectDrillDownAction } from "@/app/actions/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Sparkles,
  Trophy,
  Activity,
  Award,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  HelpCircle,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CurriculumDrilldown } from "./curriculum-drilldown";

interface ExamAttemptOption {
  id: string;
  name: string;
  targetDate: Date | null;
}

interface ProgressDashboardProps {
  initialStats: OverallProgressState;
  availableExamAttempts: ExamAttemptOption[];
}

export function ProgressDashboard({
  initialStats,
  availableExamAttempts
}: ProgressDashboardProps) {
  const router = useRouter();
  const stats = initialStats;

  // Target Date edit states
  const [showTargetEditor, setShowTargetEditor] = useState<boolean>(!initialStats.targetDate);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(initialStats.targetAttemptName ? "SELECT" : "");
  const [customDate, setCustomDate] = useState<string>(
    initialStats.targetDate ? new Date(initialStats.targetDate).toISOString().split("T")[0] : ""
  );
  const [savingTarget, setSavingTarget] = useState<boolean>(false);
  const [targetError, setTargetError] = useState<string | null>(null);

  // Subject Drilldown states
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeSubjectName, setActiveSubjectName] = useState<string>("");
  const [drilldownTree, setDrilldownTree] = useState<CurriculumProgressNode[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState<boolean>(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);

  // Handle attempt option change
  const handleAttemptChange = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    if (attemptId && attemptId !== "CUSTOM" && attemptId !== "SELECT") {
      const match = availableExamAttempts.find((a) => a.id === attemptId);
      if (match && match.targetDate) {
        setCustomDate(new Date(match.targetDate).toISOString().split("T")[0]);
      }
    }
  };

  // Save Target Date configuration
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTarget(true);
    setTargetError(null);

    const targetDateStr = customDate ? new Date(customDate).toISOString() : null;
    const attemptId = selectedAttemptId && selectedAttemptId !== "CUSTOM" && selectedAttemptId !== "SELECT" ? selectedAttemptId : null;

    const result = await updateTargetDateAction(targetDateStr, attemptId);
    if (result.success) {
      setShowTargetEditor(false);
      router.refresh();
    } else {
      setTargetError(result.error || "Failed to update target date.");
    }
    setSavingTarget(false);
  };

  // Open drilldown drawer sheet
  const handleOpenDrilldown = async (subjectId: string, subjectName: string) => {
    setActiveSubjectId(subjectId);
    setActiveSubjectName(subjectName);
    setDrilldownTree([]);
    setLoadingDrilldown(true);
    setDrilldownError(null);

    const result = await getSubjectDrillDownAction(subjectId);
    if (result.success && result.tree) {
      setDrilldownTree(result.tree);
    } else {
      setDrilldownError(result.error || "Failed to load curriculum tree.");
    }
    setLoadingDrilldown(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Target Date Controller */}
      <div className="border border-border bg-card rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Trophy className="h-5 w-5" />
              <span>{stats.academicLevelName}</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground mt-1">
              Progress & Syllabus Intelligence
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Track your preparation coverage, analyze topic strengths, and view historical mock and practice trends.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!showTargetEditor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTargetEditor(true)}
                className="font-bold cursor-pointer shrink-0"
              >
                <CalendarIcon className="h-4 w-4 mr-1.5" />
                <span>Configure Exam Attempt</span>
              </Button>
            )}
          </div>
        </div>

        {/* Target Date Form (Shown inline if unset or editing) */}
        {showTargetEditor ? (
          <form onSubmit={handleSaveTarget} className="border border-dashed border-border/80 rounded-xl p-4 bg-muted/10 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span>Set Your Target CA Exam Attempt</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Upcoming Exam Attempt
                </label>
                <Select value={selectedAttemptId || "SELECT"} onValueChange={(val) => handleAttemptChange(val)}>
                  <SelectTrigger className="w-full h-10 border-input bg-card text-foreground text-xs">
                    <SelectValue placeholder="-- Select Upcoming Attempt --" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="bg-popover text-popover-foreground">
                    <SelectItem value="SELECT">-- Select Upcoming Attempt --</SelectItem>
                    {availableExamAttempts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} (Official Attempt)
                      </SelectItem>
                    ))}
                    <SelectItem value="CUSTOM">Custom Target Date Override</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  Target Exam Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-10 pl-3 text-left font-sans text-xs font-semibold justify-start border-input bg-card text-foreground",
                        !customDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {customDate ? (
                        format(new Date(customDate), "PPP")
                      ) : (
                        <span>Pick a target date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover text-popover-foreground shadow-md ring-1 ring-black/5" align="start">
                    <Calendar
                      mode="single"
                      selected={customDate ? new Date(customDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedAttemptId("CUSTOM");
                          setCustomDate(date.toISOString().split("T")[0]);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {targetError && (
              <div className="text-xs text-destructive flex items-center gap-1.5 font-sans font-bold">
                <AlertTriangle className="h-4 w-4" />
                <span>{targetError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={savingTarget} size="sm" className="font-bold cursor-pointer">
                {savingTarget ? "Saving Configuration..." : "Save Exam Target"}
              </Button>
              {stats.targetDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTargetEditor(false)}
                  className="font-bold cursor-pointer"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/20 border border-border/50 rounded-xl gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-sans font-medium">Target Exam:</div>
                <div className="text-sm font-extrabold text-foreground mt-0.5">
                  {stats.targetAttemptName || "Custom Selection"} — {stats.targetDate ? new Date(stats.targetDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : "Not set"}
                </div>
              </div>
            </div>

            {stats.daysRemaining !== null && (
              <div className="bg-card border border-border rounded-xl px-4 py-2 text-right self-stretch sm:self-auto flex items-center justify-between sm:justify-end gap-3">
                <span className="text-xs text-muted-foreground font-sans font-semibold">Remaining Study Time:</span>
                <span className="text-sm font-black text-primary font-mono">{stats.daysRemaining} days</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Overall Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Syllabus Coverage Card */}
        <div className="border border-border bg-card rounded-2xl p-5 shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Syllabus Coverage</span>
            <div className="text-2xl font-black text-foreground font-mono">{stats.overallSyllabusCoverage}%</div>
            <p className="text-[10px] text-muted-foreground font-sans">Calculated across syllabus nodes</p>
          </div>
          <CircularProgress value={stats.overallSyllabusCoverage} />
        </div>

        {/* Practice Accuracy Card */}
        <div className="border border-border bg-card rounded-2xl p-5 shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Practice Accuracy</span>
            <div className="text-2xl font-black text-foreground font-mono">{stats.overallAccuracy}%</div>
            <p className="text-[10px] text-muted-foreground font-sans">Ratio of correct practice answers</p>
          </div>
          <CircularProgress value={stats.overallAccuracy} />
        </div>

        {/* Questions Completed Card */}
        <div className="border border-border bg-card rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Questions Completed</span>
            <div className="text-xl font-black text-foreground font-mono">
              {stats.totalAttemptedQuestions} <span className="text-xs text-muted-foreground font-sans font-medium">answered</span>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-bold flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>{stats.totalCorrectAnswers} correct submissions</span>
            </p>
          </div>
        </div>

        {/* Practice Sessions Card */}
        <div className="border border-border bg-card rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Practice Sessions</span>
            <div className="text-xl font-black text-foreground font-mono">
              {stats.totalSessions} <span className="text-xs text-muted-foreground font-sans font-medium">launched</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-sans">Total attempts across subjects</p>
          </div>
        </div>
      </div>

      {/* 3. Subject-wise Progress Workspace */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
            Syllabus Coverage & Subject-wise Performance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.subjectsProgress.map((sub) => (
            <div key={sub.id} className="border border-border bg-card rounded-2xl p-6 shadow-2xs space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-sm">
                      {sub.code}
                    </span>
                    <h3 className="text-base font-extrabold text-foreground mt-2">{sub.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-sans text-muted-foreground">Volume Coverage</span>
                    <div className="text-sm font-black text-foreground mt-0.5">
                      {sub.totalAttempted} <span className="text-xs font-medium text-muted-foreground font-sans">attempts</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  {/* Coverage Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-sans">Syllabus Coverage</span>
                      <span className="font-bold text-foreground font-mono">{sub.coverage}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${sub.coverage}%` }}
                      />
                    </div>
                  </div>

                  {/* Accuracy Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-sans">Accuracy Ratio</span>
                      <span className="font-bold text-foreground font-mono">{sub.accuracy}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${sub.accuracy}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 flex items-center justify-end mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDrilldown(sub.id, sub.name)}
                  className="text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <span>Drill Down Syllabus Chapters</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Performance Insights & Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Insights Column */}
        <div className="lg:col-span-1 border border-border bg-card rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-black text-foreground uppercase tracking-widest">
              Performance Insights
            </h2>
          </div>

          {/* Strongest Areas */}
          <div className="space-y-3">
            <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Strongest Areas (&ge;70% Accuracy)
            </div>
            {stats.strongestAreas.length === 0 ? (
              <p className="text-xs text-muted-foreground font-sans">
                Keep practicing. Strongest areas will appear as you maintain high accuracy on topics.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.strongestAreas.map((node) => (
                  <div key={node.nodeId} className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex justify-between items-center text-xs gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{node.nodeName}</div>
                      <div className="text-[10px] text-muted-foreground truncate font-sans">{node.subjectName}</div>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {node.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weakest Areas */}
          <div className="space-y-3 pt-2">
            <div className="text-[10px] font-black text-destructive uppercase tracking-wider">
              Areas Needing Practice (&lt;50% Accuracy)
            </div>
            {stats.weakestAreas.length === 0 ? (
              <p className="text-xs text-muted-foreground font-sans">
                No weak areas flagged. Maintain consistent review cycles to trace development.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.weakestAreas.map((node) => (
                  <div key={node.nodeId} className="p-2.5 rounded-xl bg-destructive/5 border border-destructive/10 flex justify-between items-center text-xs gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{node.nodeName}</div>
                      <div className="text-[10px] text-muted-foreground truncate font-sans">{node.subjectName}</div>
                    </div>
                    <span className="font-black text-destructive font-mono text-sm">
                      {node.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Log Column */}
        <div className="lg:col-span-2 border border-border bg-card rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-black text-foreground uppercase tracking-widest">
              Recent Practice Activity
            </h2>
          </div>

          {stats.recentActivity.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-xs text-muted-foreground font-sans">
                No historical practice sessions found. Start a practice block to populate active reports.
              </p>
              <Button asChild size="sm" className="font-bold cursor-pointer">
                <Link href="/practice">Go to Practice Workspace</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground truncate">{activity.subjectName}</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-wider bg-muted text-muted-foreground">
                        {activity.practiceMode === "CASE_STUDY" ? (
                          <FileText className="h-2.5 w-2.5" />
                        ) : (
                          <HelpCircle className="h-2.5 w-2.5" />
                        )}
                        <span>{activity.practiceMode === "CASE_STUDY" ? "Case Study" : "MCQ"}</span>
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-sans">
                      {new Date(activity.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} &bull; {activity.questionsCount} questions
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground font-sans block">Session Score</span>
                    <span className={cn(
                      "font-black font-mono text-sm",
                      activity.accuracy >= 70
                        ? "text-emerald-600 dark:text-emerald-400"
                        : activity.accuracy >= 40
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-destructive"
                    )}>
                      {activity.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Collapsible Syllabus Drilldown drawer Sheet */}
      <Sheet open={activeSubjectId !== null} onOpenChange={(open) => { if (!open) setActiveSubjectId(null); }}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto font-sans">
          <SheetHeader className="pb-6">
            <SheetTitle className="font-extrabold text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Syllabus Drill Down</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Curriculum progress tracking for <span className="font-bold text-foreground">{activeSubjectName}</span>. Drill down to trace topic statuses.
            </SheetDescription>
          </SheetHeader>

          {loadingDrilldown ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-full bg-muted/30 border border-border/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : drilldownError ? (
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-xs text-muted-foreground font-sans">{drilldownError}</p>
            </div>
          ) : (
            <CurriculumDrilldown nodes={drilldownTree} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Circular SVG Progress component
function CircularProgress({ value }: { value: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
      <svg className="h-full w-full -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="stroke-muted/40 fill-none stroke-[3.5] dark:stroke-muted/10"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className={cn(
            "fill-none stroke-[3.5] transition-all duration-500 ease-out",
            value >= 70
              ? "stroke-emerald-500"
              : value >= 40
                ? "stroke-amber-500"
                : "stroke-primary"
          )}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-black text-foreground font-mono">{value}%</span>
    </div>
  );
}
