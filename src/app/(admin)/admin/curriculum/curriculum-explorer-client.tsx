"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminLevelSummary,
  AdminSubjectSummary,
  AdminCurriculumNodeDetail,
} from "@/domains/academics/services";
import {
  createCurriculumNodeAction,
  updateCurriculumNodeAction,
  moveCurriculumNodeAction,
  reorderCurriculumNodeAction,
  checkNodeDependenciesAction,
  deleteCurriculumNodeAction,
  createSubjectAction,
  updateSubjectAction,
  reorderSubjectAction,
  deleteSubjectAction,
} from "@/app/actions/admin-curriculum";
import {
  BookOpen,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
  CheckCircle2,
  Calendar,
  Copy,
  Check,
  Info,
  Shield,
  Hash,
  Plus,
  Edit2,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const NODE_TYPES = ["MODULE", "SECTION", "CHAPTER", "UNIT", "TOPIC"] as const;

interface CurriculumExplorerClientProps {
  levels: { id: string; code: string; name: string }[];
  selectedLevel: AdminLevelSummary | null;
}

function findNodeInTree(nodes: AdminCurriculumNodeDetail[], id: string): AdminCurriculumNodeDetail | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNodeInTree(n.children, id);
    if (found) return found;
  }
  return null;
}

export function CurriculumExplorerClient({
  levels,
  selectedLevel,
}: CurriculumExplorerClientProps) {
  const router = useRouter();

  // Selected subject
  const defaultSubjectId = selectedLevel?.subjects[0]?.id || "";
  const [userSelectedSubjectId, setUserSelectedSubjectId] = React.useState<string | null>(null);

  const currentSubjectId =
    userSelectedSubjectId && selectedLevel?.subjects.some((s) => s.id === userSelectedSubjectId)
      ? userSelectedSubjectId
      : defaultSubjectId;

  const activeSubject = selectedLevel?.subjects.find((s) => s.id === currentSubjectId) || null;

  // Selected node
  const [userSelectedNode, setUserSelectedNode] = React.useState<AdminCurriculumNodeDetail | null>(null);

  const selectedNode =
    (userSelectedNode && activeSubject
      ? findNodeInTree(activeSubject.rootNodes, userSelectedNode.id) || userSelectedNode
      : null) || activeSubject?.rootNodes[0] || null;

  // Search & Filtering
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Toast / Feedback state
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Dialog States - Nodes
  const [createNodeParent, setCreateNodeParent] = React.useState<AdminCurriculumNodeDetail | null>(null);
  const [isCreateNodeOpen, setIsCreateNodeOpen] = React.useState(false);
  const [nodeToEdit, setNodeToEdit] = React.useState<AdminCurriculumNodeDetail | null>(null);
  const [nodeToMove, setNodeToMove] = React.useState<AdminCurriculumNodeDetail | null>(null);
  const [nodeToDelete, setNodeToDelete] = React.useState<AdminCurriculumNodeDetail | null>(null);
  const [deleteDepInfo, setDeleteDepInfo] = React.useState<{
    hasChildren: boolean;
    childCount: number;
    questionsCount: number;
    practiceSessionsCount: number;
    customTestsCount: number;
    isSafeToDelete: boolean;
    blockReason?: string;
  } | null>(null);

  // Dialog States - Subjects
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = React.useState(false);
  const [subjectToEdit, setSubjectToEdit] = React.useState<AdminSubjectSummary | null>(null);
  const [subjectToDelete, setSubjectToDelete] = React.useState<AdminSubjectSummary | null>(null);

  // Node Form States
  const [nodeFormName, setNodeFormName] = React.useState("");
  const [nodeFormCode, setNodeFormCode] = React.useState("");
  const [nodeFormType, setNodeFormType] = React.useState<string>("CHAPTER");
  const [nodeFormSortOrder, setNodeFormSortOrder] = React.useState<number>(1);
  const [nodeFormIsActive, setNodeFormIsActive] = React.useState(true);

  // Move Form State
  const [targetParentId, setTargetParentId] = React.useState<string>("");

  // Subject Form States
  const [subjectFormName, setSubjectFormName] = React.useState("");
  const [subjectFormCode, setSubjectFormCode] = React.useState("");
  const [subjectFormSortOrder, setSubjectFormSortOrder] = React.useState<number>(1);
  const [subjectFormIsActive, setSubjectFormIsActive] = React.useState(true);
  const [isNavPending, startNavTransition] = React.useTransition();

  const handleLevelChange = (levelCode: string) => {
    startNavTransition(() => {
      router.push(`/admin/curriculum?level=${levelCode}`);
    });
  };

  const toggleNodeExpanded = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => {
    if (!activeSubject) return;
    const allIds = new Set<string>();
    const collectIds = (nodes: AdminCurriculumNodeDetail[]) => {
      for (const n of nodes) {
        allIds.add(n.id);
        collectIds(n.children);
      }
    };
    collectIds(activeSubject.rootNodes);
    setExpandedNodeIds(allIds);
  };

  const collapseAll = () => {
    setExpandedNodeIds(new Set());
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Node type styles & icons
  const getNodeTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    switch (t) {
      case "MODULE":
        return { label: "Module", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      case "CHAPTER":
        return { label: "Chapter", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "SECTION":
        return { label: "Section", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
      case "UNIT":
        return { label: "Unit", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
      case "TOPIC":
        return { label: "Topic", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" };
      default:
        return { label: type, color: "bg-muted text-muted-foreground border-border" };
    }
  };

  // Recursive search filter
  const filterNode = (node: AdminCurriculumNodeDetail): boolean => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
    const matchesType = typeFilter === "ALL" || node.type.toUpperCase() === typeFilter;

    if (matchesSearch && matchesType) return true;
    return node.children.some((child) => filterNode(child));
  };

  /* =========================================================================
     NODE HANDLERS
  ========================================================================= */

  const openCreateNodeModal = (parent?: AdminCurriculumNodeDetail) => {
    if (!selectedLevel?.activeVersion) {
      showFeedback("error", "Cannot add nodes without an active curriculum version for this level.");
      return;
    }
    if (!activeSubject) {
      showFeedback("error", "Please select a subject first.");
      return;
    }
    setCreateNodeParent(parent || null);
    setNodeFormName("");
    setNodeFormCode("");
    setNodeFormType(parent ? (parent.type === "MODULE" ? "CHAPTER" : "TOPIC") : "MODULE");
    setNodeFormIsActive(true);
    setIsCreateNodeOpen(true);
  };

  const handleCreateNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevel?.activeVersion || !activeSubject) return;

    setIsPending(true);
    try {
      const res = await createCurriculumNodeAction({
        curriculumVersionId: selectedLevel.activeVersion.id,
        subjectId: activeSubject.id,
        parentId: createNodeParent?.id || null,
        type: nodeFormType,
        name: nodeFormName.trim(),
        code: nodeFormCode.trim(),
        isActive: nodeFormIsActive,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to create curriculum node.");
      } else {
        showFeedback("success", `Created node "${nodeFormName}".`);
        setIsCreateNodeOpen(false);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const openEditNodeModal = (node: AdminCurriculumNodeDetail) => {
    setNodeToEdit(node);
    setNodeFormName(node.name);
    setNodeFormCode(node.code);
    setNodeFormType(node.type);
    setNodeFormSortOrder(node.sortOrder);
    setNodeFormIsActive(node.isActive);
  };

  const handleEditNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeToEdit) return;

    setIsPending(true);
    try {
      const res = await updateCurriculumNodeAction({
        id: nodeToEdit.id,
        name: nodeFormName.trim(),
        code: nodeFormCode.trim(),
        type: nodeFormType,
        sortOrder: Number(nodeFormSortOrder),
        isActive: nodeFormIsActive,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to update node.");
      } else {
        showFeedback("success", `Updated node "${nodeFormName}".`);
        setNodeToEdit(null);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const openMoveNodeModal = (node: AdminCurriculumNodeDetail) => {
    setNodeToMove(node);
    setTargetParentId(node.parentId || "");
  };

  const handleMoveNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeToMove) return;

    setIsPending(true);
    try {
      const res = await moveCurriculumNodeAction({
        nodeId: nodeToMove.id,
        targetParentId: targetParentId ? targetParentId : null,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to move node.");
      } else {
        showFeedback("success", `Successfully moved "${nodeToMove.name}".`);
        setNodeToMove(null);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleReorderNode = async (nodeId: string, direction: "UP" | "DOWN", e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPending(true);
    try {
      const res = await reorderCurriculumNodeAction({ nodeId, direction });
      if (!res.success) {
        showFeedback("error", res.error || "Failed to reorder node.");
      } else {
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const openDeleteNodeModal = async (node: AdminCurriculumNodeDetail) => {
    setNodeToDelete(node);
    setIsPending(true);
    try {
      const res = await checkNodeDependenciesAction(node.id);
      if (res.success && res.data) {
        setDeleteDepInfo(res.data as typeof deleteDepInfo);
      } else {
        showFeedback("error", res.error || "Failed to check node dependencies.");
      }
    } catch {
      showFeedback("error", "Failed to check node dependencies.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteNodeConfirm = async () => {
    if (!nodeToDelete) return;

    setIsPending(true);
    const targetNode = nodeToDelete;
    try {
      const res = await deleteCurriculumNodeAction(targetNode.id);
      setNodeToDelete(null);
      if (!res.success) {
        showFeedback("error", res.error || "Failed to delete node.");
      } else {
        showFeedback("success", `Node "${targetNode.name}" deleted.`);
        if (selectedNode?.id === targetNode.id) {
          setUserSelectedNode(null);
        }
        router.refresh();
      }
    } catch {
      setNodeToDelete(null);
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDeactivateFromDeleteModal = async () => {
    if (!nodeToDelete) return;
    setIsPending(true);
    const targetNode = nodeToDelete;
    try {
      const res = await updateCurriculumNodeAction({
        id: targetNode.id,
        name: targetNode.name,
        code: targetNode.code,
        type: targetNode.type,
        sortOrder: targetNode.sortOrder,
        isActive: false,
      });
      setNodeToDelete(null);
      if (!res.success) {
        showFeedback("error", res.error || "Failed to deactivate node.");
      } else {
        showFeedback("success", `Node "${targetNode.name}" has been deactivated to preserve question history.`);
        router.refresh();
      }
    } catch {
      setNodeToDelete(null);
      showFeedback("error", "An unexpected error occurred during deactivation.");
    } finally {
      setIsPending(false);
    }
  };

  /* =========================================================================
     SUBJECT HANDLERS
  ========================================================================= */

  const openCreateSubjectModal = () => {
    if (!selectedLevel) return;
    setSubjectFormName("");
    setSubjectFormCode(`PAPER_${(selectedLevel.subjects.length || 0) + 1}`);
    setSubjectFormSortOrder((selectedLevel.subjects.length || 0) + 1);
    setSubjectFormIsActive(true);
    setIsCreateSubjectOpen(true);
  };

  const handleCreateSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevel) return;

    setIsPending(true);
    try {
      const res = await createSubjectAction({
        academicLevelId: selectedLevel.id,
        name: subjectFormName.trim(),
        code: subjectFormCode.trim().toUpperCase(),
        sortOrder: Number(subjectFormSortOrder),
        isActive: subjectFormIsActive,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to create subject.");
      } else {
        showFeedback("success", `Subject "${subjectFormName}" created.`);
        setIsCreateSubjectOpen(false);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const openEditSubjectModal = (sub: AdminSubjectSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubjectToEdit(sub);
    setSubjectFormName(sub.name);
    setSubjectFormCode(sub.code);
    setSubjectFormSortOrder(sub.sortOrder);
    setSubjectFormIsActive(sub.isActive);
  };

  const handleEditSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectToEdit) return;

    setIsPending(true);
    try {
      const res = await updateSubjectAction({
        id: subjectToEdit.id,
        name: subjectFormName.trim(),
        code: subjectFormCode.trim().toUpperCase(),
        sortOrder: Number(subjectFormSortOrder),
        isActive: subjectFormIsActive,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to update subject.");
      } else {
        showFeedback("success", `Subject updated.`);
        setSubjectToEdit(null);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleReorderSubject = async (subjectId: string, direction: "UP" | "DOWN", e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPending(true);
    try {
      const res = await reorderSubjectAction({ subjectId, direction });
      if (!res.success) {
        showFeedback("error", res.error || "Failed to reorder subject.");
      } else {
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const openDeleteSubjectModal = (sub: AdminSubjectSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubjectToDelete(sub);
  };

  const handleDeleteSubjectConfirm = async () => {
    if (!subjectToDelete) return;

    setIsPending(true);
    const targetSubject = subjectToDelete;
    try {
      const res = await deleteSubjectAction(targetSubject.id);
      setSubjectToDelete(null);
      if (!res.success) {
        showFeedback("error", res.error || "Failed to delete subject.");
      } else {
        showFeedback("success", `Subject deleted.`);
        router.refresh();
      }
    } catch {
      setSubjectToDelete(null);
      showFeedback("error", "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  // Helper to build list of valid parent options for Move modal (excluding self and descendants)
  const getMoveParentCandidates = (
    nodes: AdminCurriculumNodeDetail[],
    movingNodeId: string
  ): { id: string; name: string; type: string; depth: number }[] => {
    const list: { id: string; name: string; type: string; depth: number }[] = [];

    // First collect all descendants of moving node to exclude them
    const descendantIds = new Set<string>();
    const collectDescendants = (n: AdminCurriculumNodeDetail) => {
      descendantIds.add(n.id);
      n.children.forEach(collectDescendants);
    };

    const movingNode = findNodeInTree(nodes, movingNodeId);
    if (movingNode) collectDescendants(movingNode);

    const traverse = (items: AdminCurriculumNodeDetail[], depth: number) => {
      for (const item of items) {
        if (!descendantIds.has(item.id)) {
          list.push({ id: item.id, name: item.name, type: item.type, depth });
          traverse(item.children, depth + 1);
        }
      }
    };

    traverse(nodes, 0);
    return list;
  };

  // Recursive Tree Node Renderer with Hover Actions
  const renderTreeNodes = (nodes: AdminCurriculumNodeDetail[], depth = 0) => {
    return nodes.map((node, index) => {
      const isVisible = filterNode(node);
      if (!isVisible) return null;

      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodeIds.has(node.id) || searchQuery.trim().length > 0;
      const isSelected = selectedNode?.id === node.id;
      const badge = getNodeTypeBadge(node.type);

      const isFirst = index === 0;
      const isLast = index === nodes.length - 1;

      return (
        <div key={node.id} className="flex flex-col">
          <div
            onClick={() => setUserSelectedNode(node)}
            className={cn(
              "group flex items-center justify-between py-2 px-2.5 rounded-xl text-xs cursor-pointer transition-all select-none border",
              isSelected
                ? "bg-primary text-primary-foreground font-semibold shadow-xs border-primary"
                : "hover:bg-muted/70 text-foreground border-transparent"
            )}
            style={{ paddingLeft: `${Math.max(10, depth * 20 + 10)}px` }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleNodeExpanded(node.id, e)}
                  className={cn(
                    "p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0",
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-4.5 shrink-0" />
              )}

              <span
                className={cn(
                  "text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                    : badge.color
                )}
              >
                {badge.label}
              </span>

              <span className="truncate font-sans">{node.name}</span>

              {!node.isActive && (
                <span
                  className={cn(
                    "text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase",
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  Inactive
                </span>
              )}
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span
                className={cn(
                  "text-[10px] font-mono",
                  isSelected ? "text-primary-foreground/70" : "text-muted-foreground/60"
                )}
              >
                {node.code}
              </span>

              {hasChildren && (
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded-full font-bold",
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {node.children.length}
                </span>
              )}

              {/* Hover Quick Actions */}
              <div
                className={cn(
                  "items-center gap-0.5 pl-1.5 border-l",
                  isSelected ? "border-primary-foreground/20 flex" : "border-border hidden group-hover:flex"
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateNodeModal(node);
                      }}
                      className={cn(
                        "p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer",
                        isSelected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add Child Node</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={isFirst || isPending}
                      onClick={(e) => handleReorderNode(node.id, "UP", e)}
                      className={cn(
                        "p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                        isSelected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Move Up</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={isLast || isPending}
                      onClick={(e) => handleReorderNode(node.id, "DOWN", e)}
                      className={cn(
                        "p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                        isSelected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Move Down</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="flex flex-col border-l border-border/40 ml-4 pl-1">
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Level Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border bg-card rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Curriculum Structure Manager
            </h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>Admin Editor</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Manage, edit, reorder, and structure curriculum nodes and subjects across Academic Levels.
          </p>
        </div>

        {/* Level Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60">
          {levels.map((lvl) => {
            const isActive = selectedLevel?.code.toUpperCase() === lvl.code.toUpperCase();
            return (
              <button
                key={lvl.id}
                type="button"
                disabled={isNavPending}
                onClick={() => handleLevelChange(lvl.code)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer font-sans inline-flex items-center gap-1.5",
                  isActive
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground",
                  isNavPending && "opacity-80"
                )}
              >
                {isNavPending && isActive && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>{lvl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Version Status Ribbon */}
      {selectedLevel && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted/30 border border-border/60 rounded-xl text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Active Version:
            </span>
            {selectedLevel.activeVersion ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{selectedLevel.activeVersion.name}</span>
                <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Active</span>
                </span>
              </div>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                No active syllabus version published
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
            {selectedLevel.activeVersion?.applicableFrom && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Effective: {format(new Date(selectedLevel.activeVersion.applicableFrom), "MMM yyyy")}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>{selectedLevel.totalNodesCount} Total Nodes</span>
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 text-[10px] font-bold px-2.5 rounded-lg cursor-pointer ml-1"
            >
              <Link href={`/admin/curriculum/versions?level=${selectedLevel.code}`}>Manage Versions</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={cn(
            "p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200",
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-70 transition-opacity">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div
        className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative transition-opacity duration-200", isNavPending && "opacity-50 pointer-events-none")}
        aria-busy={isNavPending}
      >
        {isNavPending && (
          <div className="absolute -top-3 left-0 right-0 h-0.5 bg-primary animate-pulse z-10 rounded-full" />
        )}
        {/* Left Column: Subjects List (3 cols) */}
        <div className="lg:col-span-3 border border-border bg-card rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              Subjects ({selectedLevel?.subjects.length || 0})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={openCreateSubjectModal}
              className="h-6.5 text-[10px] font-bold px-2 rounded-lg cursor-pointer gap-1 text-primary hover:text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" />
              <span>Add Subject</span>
            </Button>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {selectedLevel?.subjects.map((sub: AdminSubjectSummary, index: number) => {
              const isSelected = sub.id === currentSubjectId;
              const isFirst = index === 0;
              const isLast = index === (selectedLevel?.subjects.length || 0) - 1;

              return (
                <div
                  key={sub.id}
                  onClick={() => {
                    setUserSelectedSubjectId(sub.id);
                    setUserSelectedNode(sub.rootNodes[0] || null);
                  }}
                  className={cn(
                    "group w-full text-left p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1 border relative",
                    isSelected
                      ? "bg-primary/10 border-primary/30 shadow-xs"
                      : "bg-background/50 hover:bg-muted/50 border-border/50 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-primary">
                        {sub.code}
                      </span>
                      {!sub.isActive && (
                        <span className="text-[8px] font-extrabold px-1 rounded bg-muted text-muted-foreground uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                      {sub.nodesCount} nodes
                    </span>
                  </div>

                  <span
                    className={cn(
                      "text-xs font-bold truncate",
                      isSelected ? "text-foreground" : "text-foreground/80"
                    )}
                  >
                    {sub.name}
                  </span>

                  {/* Subject Quick Actions */}
                  <div
                    className={cn(
                      "items-center gap-1 pt-2 mt-1 border-t border-border/40 justify-end",
                      isSelected ? "flex" : "hidden group-hover:flex"
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isFirst || isPending}
                          onClick={(e) => handleReorderSubject(sub.id, "UP", e)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Move Up</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isLast || isPending}
                          onClick={(e) => handleReorderSubject(sub.id, "DOWN", e)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Move Down</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => openEditSubjectModal(sub, e)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Edit Subject</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => openDeleteSubjectModal(sub, e)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-destructive/70 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Delete Subject</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}

            {(!selectedLevel?.subjects || selectedLevel.subjects.length === 0) && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No subjects found for this level.
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Interactive Node Tree (5 cols) */}
        <div className="lg:col-span-5 border border-border bg-card rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-foreground">
                {activeSubject?.name || "Subject Tree"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end">
              <Button
                variant="default"
                size="sm"
                onClick={() => openCreateNodeModal()}
                className="h-7 text-[10px] px-2.5 font-bold cursor-pointer gap-1 shadow-xs"
              >
                <Plus className="h-3 w-3" />
                <span>Add Node</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                className="h-7 text-[10px] px-2 font-bold cursor-pointer"
              >
                Expand
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                className="h-7 text-[10px] px-2 font-bold cursor-pointer"
              >
                Collapse
              </Button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search nodes by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 pl-8.5 text-xs rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {["ALL", "MODULE", "SECTION", "CHAPTER", "UNIT", "TOPIC"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    "text-[9px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider transition-colors shrink-0 cursor-pointer font-sans",
                    typeFilter === type
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Tree View */}
          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
            {activeSubject && activeSubject.rootNodes.length > 0 ? (
              renderTreeNodes(activeSubject.rootNodes)
            ) : (
              <div className="text-center py-12 space-y-3">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No syllabus nodes published for this subject.</p>
                <Button
                  onClick={() => openCreateNodeModal()}
                  className="font-bold text-xs h-8 px-3 rounded-xl cursor-pointer gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Create First Node</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Node Metadata Inspector & Mutation Tools (4 cols) */}
        <div className="lg:col-span-4 border border-border bg-card rounded-2xl p-5 shadow-xs space-y-5 sticky top-20">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-foreground">
                Node Inspector & Actions
              </span>
            </div>
            <span className="text-[9px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
              Admin
            </span>
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs font-sans">
              {/* Title & Type */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider inline-block",
                      getNodeTypeBadge(selectedNode.type).color
                    )}
                  >
                    {selectedNode.type}
                  </span>
                  {selectedNode.isActive ? (
                    <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-[9px] font-extrabold bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase">
                      Inactive
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-extrabold text-foreground leading-snug">{selectedNode.name}</h3>
              </div>

              {/* Administrative Action Bar */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditNodeModal(selectedNode)}
                  className="h-8 text-xs font-bold rounded-xl cursor-pointer gap-1.5 shadow-2xs"
                >
                  <Edit2 className="h-3.5 w-3.5 text-primary" />
                  <span>Edit Metadata</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openMoveNodeModal(selectedNode)}
                  className="h-8 text-xs font-bold rounded-xl cursor-pointer gap-1.5 shadow-2xs"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />
                  <span>Move / Parent</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCreateNodeModal(selectedNode)}
                  className="h-8 text-xs font-bold rounded-xl cursor-pointer gap-1.5 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Add Child</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDeleteNodeModal(selectedNode)}
                  className="h-8 text-xs font-bold rounded-xl cursor-pointer gap-1.5 shadow-2xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  <span>Delete Node</span>
                </Button>
              </div>

              {/* Attributes Table */}
              <div className="space-y-2.5 bg-muted/30 p-3.5 rounded-xl border border-border/60 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Node Code:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground">{selectedNode.code}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedNode.code, "code")}
                          className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {copiedField === "code" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Copy Code</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Database ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {selectedNode.id}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedNode.id, "id")}
                          className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {copiedField === "id" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Copy UUID</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Sort Order:</span>
                  <span className="font-bold text-foreground">#{selectedNode.sortOrder}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Direct Children:</span>
                  <span className="font-bold text-foreground">{selectedNode.directChildrenCount}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Total Descendants:</span>
                  <span className="font-bold text-foreground">{selectedNode.totalDescendantsCount}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Created:</span>
                  <span className="text-muted-foreground font-sans">
                    {format(new Date(selectedNode.createdAt), "dd MMM yyyy")}
                  </span>
                </div>
              </div>

              {/* Active Syllabus Warning Notice */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-primary text-[10px] font-extrabold uppercase tracking-wider">
                  <Shield className="h-3 w-3" />
                  <span>Active Syllabus Protection</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Modifications apply immediately to the active curriculum version. Structural hierarchy checks prevent circular loops and preserve relational mapping.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-2">
              <Hash className="h-7 w-7 mx-auto text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Select a syllabus node from the tree to inspect its details and execute management operations.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
         NODE MODALS
      ========================================================================= */}

      {/* CREATE NODE DIALOG */}
      <Dialog open={isCreateNodeOpen} onOpenChange={setIsCreateNodeOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>{createNodeParent ? `Add Child Node under "${createNodeParent.name}"` : "Create Root Node"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Add a new syllabus node under {activeSubject?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNodeSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Node Type <span className="text-destructive">*</span></label>
                <select
                  value={nodeFormType}
                  onChange={(e) => setNodeFormType(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-node-code" className="text-xs font-bold text-foreground">
                  Node Code <span className="text-destructive">*</span>
                </label>
                <Input
                  id="create-node-code"
                  required
                  placeholder="e.g. CH_05 or TOPIC_05_A"
                  value={nodeFormCode}
                  onChange={(e) => setNodeFormCode(e.target.value)}
                  className="h-9.5 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-node-name" className="text-xs font-bold text-foreground">
                Node Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="create-node-name"
                required
                placeholder="e.g. Financial Instruments & Accounting Standards"
                value={nodeFormName}
                onChange={(e) => setNodeFormName(e.target.value)}
                className="h-9.5 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-xl border border-border text-xs">
              <Checkbox
                id="create-node-active"
                checked={nodeFormIsActive}
                onCheckedChange={(checked) => setNodeFormIsActive(Boolean(checked))}
              />
              <label htmlFor="create-node-active" className="cursor-pointer select-none text-foreground font-medium">
                Active / Published immediately
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateNodeOpen(false)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Create Node</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT NODE DIALOG */}
      <Dialog open={!!nodeToEdit} onOpenChange={(open) => !open && setNodeToEdit(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              <span>Edit Curriculum Node</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Update metadata and publishing status for this node.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditNodeSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Node Type <span className="text-destructive">*</span></label>
                <select
                  value={nodeFormType}
                  onChange={(e) => setNodeFormType(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-node-code" className="text-xs font-bold text-foreground">
                  Node Code <span className="text-destructive">*</span>
                </label>
                <Input
                  id="edit-node-code"
                  required
                  value={nodeFormCode}
                  onChange={(e) => setNodeFormCode(e.target.value)}
                  className="h-9.5 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-node-name" className="text-xs font-bold text-foreground">
                Node Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-node-name"
                required
                value={nodeFormName}
                onChange={(e) => setNodeFormName(e.target.value)}
                className="h-9.5 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-node-order" className="text-xs font-bold text-foreground">
                  Sort Order Number
                </label>
                <Input
                  id="edit-node-order"
                  type="number"
                  required
                  value={nodeFormSortOrder}
                  onChange={(e) => setNodeFormSortOrder(Number(e.target.value))}
                  className="h-9.5 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-xl border border-border text-xs self-end">
                <Checkbox
                  id="edit-node-active"
                  checked={nodeFormIsActive}
                  onCheckedChange={(checked) => setNodeFormIsActive(Boolean(checked))}
                />
                <label htmlFor="edit-node-active" className="cursor-pointer select-none text-foreground font-medium">
                  Active
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNodeToEdit(null)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MOVE NODE DIALOG */}
      <Dialog open={!!nodeToMove} onOpenChange={(open) => !open && setNodeToMove(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" />
              <span>Move & Re-parent Node</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Change the parent container of &ldquo;{nodeToMove?.name}&rdquo;. Circular loops are blocked.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMoveNodeSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Select New Parent Container</label>
              <select
                value={targetParentId}
                onChange={(e) => setTargetParentId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="">(Root Level - No Parent)</option>
                {activeSubject &&
                  nodeToMove &&
                  getMoveParentCandidates(activeSubject.rootNodes, nodeToMove.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth)}[{c.type}] {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="p-3 bg-muted/40 border border-border/60 rounded-xl text-xs space-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground font-bold">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>Hierarchy Safety Guarantee</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                PostgreSQL foreign keys and application checks ensure a node cannot be moved underneath its own descendants or outside its subject container.
              </p>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNodeToMove(null)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Move</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE NODE DIALOG */}
      <Dialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-extrabold text-foreground">
              Delete Curriculum Node
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              Evaluating deletion safety for <strong className="text-foreground">{nodeToDelete?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {deleteDepInfo ? (
            <div className="space-y-3">
              {!deleteDepInfo.isSafeToDelete ? (
                <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl space-y-2 text-xs text-destructive">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Deletion Blocked by System Guardrails</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-destructive/90">
                    {deleteDepInfo.blockReason}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl space-y-1.5 text-xs text-muted-foreground">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Safe to Delete</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This node has 0 child nodes and 0 referencing questions/tests. It can be safely deleted.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing dependencies in PostgreSQL...</span>
            </div>
          )}

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNodeToDelete(null)}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            {deleteDepInfo && !deleteDepInfo.isSafeToDelete && nodeToDelete?.isActive && (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={handleDeactivateFromDeleteModal}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 border border-border shadow-2xs"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Deactivate Instead</span>
              </Button>
            )}
            {deleteDepInfo?.isSafeToDelete && (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleDeleteNodeConfirm}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 shadow-xs"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Permanently Delete</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
         SUBJECT MODALS
      ========================================================================= */}

      {/* CREATE SUBJECT DIALOG */}
      <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Create Subject for {selectedLevel?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Add a new paper/subject to the {selectedLevel?.code} syllabus curriculum.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubjectSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="create-sub-code" className="text-xs font-bold text-foreground">
                  Subject Code <span className="text-destructive">*</span>
                </label>
                <Input
                  id="create-sub-code"
                  required
                  placeholder="e.g. PAPER_5"
                  value={subjectFormCode}
                  onChange={(e) => setSubjectFormCode(e.target.value)}
                  className="h-9.5 rounded-xl text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-sub-order" className="text-xs font-bold text-foreground">
                  Sort Order
                </label>
                <Input
                  id="create-sub-order"
                  type="number"
                  required
                  value={subjectFormSortOrder}
                  onChange={(e) => setSubjectFormSortOrder(Number(e.target.value))}
                  className="h-9.5 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-sub-name" className="text-xs font-bold text-foreground">
                Subject Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="create-sub-name"
                required
                placeholder="e.g. Auditing and Ethics"
                value={subjectFormName}
                onChange={(e) => setSubjectFormName(e.target.value)}
                className="h-9.5 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-xl border border-border text-xs">
              <Checkbox
                id="create-sub-active"
                checked={subjectFormIsActive}
                onCheckedChange={(checked) => setSubjectFormIsActive(Boolean(checked))}
              />
              <label htmlFor="create-sub-active" className="cursor-pointer select-none text-foreground font-medium">
                Active / Published
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateSubjectOpen(false)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Create Subject</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT SUBJECT DIALOG */}
      <Dialog open={!!subjectToEdit} onOpenChange={(open) => !open && setSubjectToEdit(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              <span>Edit Subject</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Update subject metadata and paper code.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubjectSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-sub-code" className="text-xs font-bold text-foreground">
                  Subject Code <span className="text-destructive">*</span>
                </label>
                <Input
                  id="edit-sub-code"
                  required
                  value={subjectFormCode}
                  onChange={(e) => setSubjectFormCode(e.target.value)}
                  className="h-9.5 rounded-xl text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-sub-order" className="text-xs font-bold text-foreground">
                  Sort Order
                </label>
                <Input
                  id="edit-sub-order"
                  type="number"
                  required
                  value={subjectFormSortOrder}
                  onChange={(e) => setSubjectFormSortOrder(Number(e.target.value))}
                  className="h-9.5 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-sub-name" className="text-xs font-bold text-foreground">
                Subject Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-sub-name"
                required
                value={subjectFormName}
                onChange={(e) => setSubjectFormName(e.target.value)}
                className="h-9.5 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-xl border border-border text-xs">
              <Checkbox
                id="edit-sub-active"
                checked={subjectFormIsActive}
                onCheckedChange={(checked) => setSubjectFormIsActive(Boolean(checked))}
              />
              <label htmlFor="edit-sub-active" className="cursor-pointer select-none text-foreground font-medium">
                Active / Published
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSubjectToEdit(null)}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE SUBJECT DIALOG */}
      <Dialog open={!!subjectToDelete} onOpenChange={(open) => !open && setSubjectToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-extrabold text-foreground">
              Delete Subject
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{subjectToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl space-y-1.5 text-xs text-muted-foreground">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              <span>Production Relational Protection</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              If this subject contains curriculum nodes or practice questions, deletion will be safely rejected by the database. Consider deactivating the subject instead.
            </p>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubjectToDelete(null)}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDeleteSubjectConfirm}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 shadow-xs"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Delete Subject</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
