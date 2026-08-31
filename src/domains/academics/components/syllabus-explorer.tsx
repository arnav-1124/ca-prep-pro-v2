"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Layers,
  GraduationCap
} from "lucide-react";
import { CurriculumTreeNode } from "../services";

interface Subject {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

interface SyllabusExplorerProps {
  levelName: string;
  versionName: string;
  subjects: Subject[];
  treesBySubjectId: Record<string, CurriculumTreeNode[]>;
}

export function SyllabusExplorer({
  levelName,
  versionName,
  subjects,
  treesBySubjectId,
}: SyllabusExplorerProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ""
  );
  
  // Track collapsed state of nodes by their code/id
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (nodeCode: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeCode]: !prev[nodeCode],
    }));
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedTree = selectedSubject ? treesBySubjectId[selectedSubject.id] || [] : [];

  // Recursive component to render a node in the tree
  const NodeItem = ({ node, depth = 0 }: { node: CurriculumTreeNode; depth: number }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = !!collapsedNodes[node.code];
    const Icon = getNodeIcon(node.type);

    return (
      <div className="flex flex-col w-full">
        {/* Node Label Row */}
        <div
          onClick={() => hasChildren && toggleNode(node.code)}
          className={cn(
            "flex items-center py-2 px-3 rounded-lg transition-colors cursor-pointer group select-none",
            hasChildren ? "hover:bg-muted/40" : "hover:bg-muted/20 cursor-default",
            depth === 0 ? "font-bold text-foreground bg-muted/20 border border-border/30 mt-3" : "text-sm mt-1"
          )}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
        >
          {/* Collapse indicator for expandable folders/chapters */}
          {hasChildren ? (
            <span className="mr-1.5 text-muted-foreground/60 group-hover:text-foreground shrink-0 transition-transform">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          ) : (
            <span className="w-4 mr-1.5 shrink-0" />
          )}

          {/* Node type icon */}
          <span className={cn(
            "mr-2 shrink-0 transition-colors",
            depth === 0 ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
          )}>
            <Icon className="h-4 w-4" />
          </span>

          {/* Node text */}
          <span className="flex-1 truncate font-sans text-foreground/90 group-hover:text-foreground">
            {node.name}
          </span>

          {/* Badge indicating node type */}
          {depth === 0 && (
            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 tracking-wider">
              {node.type}
            </span>
          )}
        </div>

        {/* Child Nodes Container (hidden when collapsed) */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col relative pl-4 mt-0.5 ml-3 border-l border-border/40">
            {node.children.map((child) => (
              <NodeItem key={child.code} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header Info Block */}
      <div className="border border-border bg-card text-card-foreground rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <GraduationCap className="h-5 w-5" />
            <span>{levelName}</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground mt-1">
            Academic Curriculum Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            Review subjects, papers, chapters, and topics applicable for your preparation.
          </p>
        </div>
        <div className="shrink-0 flex items-center md:justify-end">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground font-sans">
            Syllabus scheme: {versionName}
          </span>
        </div>
      </div>

      {/* Main Split Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Subjects list */}
        <div className="md:col-span-4 flex flex-col gap-2 bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[9px] font-extrabold text-muted-foreground/60 uppercase tracking-widest px-2 mb-1">
            CA Papers / Subjects
          </span>
          <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
            {subjects.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id)}
                className={cn(
                  "w-full text-left py-2.5 px-4 rounded-xl transition-all duration-150 flex items-center gap-3 border select-none cursor-pointer group",
                  selectedSubjectId === sub.id
                    ? "bg-primary/10 border-primary/20 text-foreground font-bold shadow-2xs"
                    : "bg-transparent border-transparent hover:bg-muted/40 hover:border-border/30 text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <span className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center font-sans text-xs font-black shrink-0 border transition-all",
                  selectedSubjectId === sub.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border group-hover:bg-card group-hover:text-foreground"
                )}>
                  {sub.code.replace("PAPER_", "")}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold text-muted-foreground/60 leading-none mb-1">
                    {sub.code}
                  </span>
                  <span className="text-sm truncate">
                    {sub.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Selected subject tree structure */}
        <div className="md:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-2xs min-h-[400px]">
          {selectedSubject ? (
            <div className="space-y-4">
              {/* Active Paper Header */}
              <div className="border-b border-border/50 pb-4 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none">
                    {selectedSubject.code}
                  </span>
                  <h2 className="text-lg font-bold text-foreground mt-1">
                    {selectedSubject.name}
                  </h2>
                </div>
              </div>

              {/* Curriculum Tree Explorer */}
              {selectedTree.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {selectedTree.map((node) => (
                    <NodeItem key={node.code} node={node} depth={0} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Syllabus details coming soon</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1 font-sans">
                    Authoritative topics and chapters for this subject are currently being processed.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-24">
              <span className="text-xs text-muted-foreground">Select a paper from the list to explore the syllabus.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Map node types to readable icons
function getNodeIcon(type: string) {
  switch (type.toUpperCase()) {
    case "MODULE":
      return Layers;
    case "SECTION":
      return Folder;
    case "CHAPTER":
      return BookOpen;
    default:
      return FileText;
  }
}
