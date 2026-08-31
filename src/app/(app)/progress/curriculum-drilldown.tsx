"use client";

import { useState } from "react";
import { CurriculumProgressNode } from "@/domains/progress/services";
import { ChevronRight, ChevronDown, CheckCircle2, Play, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurriculumDrilldownProps {
  nodes: CurriculumProgressNode[];
}

export function CurriculumDrilldown({ nodes }: CurriculumDrilldownProps) {
  return (
    <div className="space-y-3 font-sans">
      {nodes.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No syllabus sections found under this version.
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: CurriculumProgressNode; depth: number }) {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 1); // Expand top-level nodes by default
  const hasChildren = node.children && node.children.length > 0;

  const getStatusBadge = (status: typeof node.status) => {
    switch (status) {
      case "Covered":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            <span>Covered</span>
          </span>
        );
      case "Practicing":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Play className="h-2.5 w-2.5 fill-current" />
            <span>Practicing</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border">
            <Circle className="h-2.5 w-2.5" />
            <span>Not Started</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-1">
      {/* Node Row */}
      <div
        className={cn(
          "flex items-center justify-between p-2 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors text-xs gap-3",
          depth === 0 ? "bg-muted/10 font-bold border-border/80 text-foreground" : "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-muted rounded-md text-muted-foreground cursor-pointer select-none transition-transform"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest bg-primary/5 px-1 py-0.5 rounded-sm">
                {node.type}
              </span>
              <span className="truncate text-foreground font-semibold">{node.name}</span>
            </div>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Question metrics */}
          {node.availableQuestions > 0 && (
            <span className="text-[11px] font-sans font-medium text-muted-foreground hidden sm:inline">
              {node.attemptedQuestions} / {node.availableQuestions} questions
            </span>
          )}

          {/* Accuracy info */}
          {node.attemptedQuestions > 0 && (
            <span className="text-[11px] font-sans font-bold text-foreground">
              {node.accuracy}% accuracy
            </span>
          )}

          {/* Status Badge */}
          {getStatusBadge(node.status)}
        </div>
      </div>

      {/* Children Nodes */}
      {hasChildren && isExpanded && (
        <div className="pl-4 border-l border-border/50 ml-3.5 mt-1.5 space-y-1.5">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
