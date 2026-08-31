"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminVersionItem } from "@/domains/academics/services";
import {
  createCurriculumVersionAction,
  updateCurriculumVersionAction,
  activateCurriculumVersionAction,
  deactivateCurriculumVersionAction,
} from "@/app/actions/admin-curriculum";
import {
  Layers,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  Shield,
  Loader2,
  Clock,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
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

interface VersionsClientProps {
  levels: { id: string; code: string; name: string }[];
  versions: AdminVersionItem[];
  selectedLevelCode: string;
}

export function VersionsClient({
  levels,
  versions,
  selectedLevelCode,
}: VersionsClientProps) {
  const router = useRouter();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingVersion, setEditingVersion] = React.useState<AdminVersionItem | null>(null);
  const [activatingVersion, setActivatingVersion] = React.useState<AdminVersionItem | null>(null);
  const [deactivatingVersion, setDeactivatingVersion] = React.useState<AdminVersionItem | null>(null);

  // Form states
  const [formLevelId, setFormLevelId] = React.useState(
    levels.find((l) => l.code === selectedLevelCode)?.id || levels[0]?.id || ""
  );
  const [formName, setFormName] = React.useState("");
  const [formFromDate, setFormFromDate] = React.useState<Date | null>(new Date());
  const [formToDate, setFormToDate] = React.useState<Date | null>(null);
  const [formIsActive, setFormIsActive] = React.useState(false);

  // Status & Feedback
  const [isPending, setIsPending] = React.useState(false);
  const [isNavPending, startNavTransition] = React.useTransition();
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Clear message helper
  const showFeedback = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  const handleLevelChange = (levelCode: string) => {
    startNavTransition(() => {
      router.push(`/admin/curriculum/versions?level=${levelCode}`);
    });
  };

  // Open Create Dialog
  const openCreateDialog = () => {
    const activeLevelObj = levels.find((l) => l.code === selectedLevelCode) || levels[0];
    setFormLevelId(activeLevelObj?.id || "");
    setFormName("");
    setFormFromDate(new Date());
    setFormToDate(null);
    setFormIsActive(false);
    setIsCreateOpen(true);
  };

  // Open Edit Dialog
  const openEditDialog = (ver: AdminVersionItem) => {
    setEditingVersion(ver);
    setFormName(ver.name);
    setFormFromDate(new Date(ver.applicableFrom));
    setFormToDate(ver.applicableTo ? new Date(ver.applicableTo) : null);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formFromDate) {
      showFeedback("error", "Version name and applicable-from date are required.");
      return;
    }

    setIsPending(true);
    try {
      const fromStr = format(formFromDate, "yyyy-MM-dd");
      const toStr = formToDate ? format(formToDate, "yyyy-MM-dd") : null;
      const res = await createCurriculumVersionAction({
        academicLevelId: formLevelId,
        name: formName.trim(),
        applicableFrom: fromStr,
        applicableTo: toStr,
        isActive: formIsActive,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to create curriculum version.");
      } else {
        showFeedback("success", `Curriculum version "${formName}" created successfully.`);
        setIsCreateOpen(false);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred during version creation.");
    } finally {
      setIsPending(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVersion) return;
    if (!formName.trim() || !formFromDate) {
      showFeedback("error", "Version name and applicable-from date are required.");
      return;
    }

    setIsPending(true);
    try {
      const fromStr = format(formFromDate, "yyyy-MM-dd");
      const toStr = formToDate ? format(formToDate, "yyyy-MM-dd") : null;
      const res = await updateCurriculumVersionAction({
        id: editingVersion.id,
        name: formName.trim(),
        applicableFrom: fromStr,
        applicableTo: toStr,
      });

      if (!res.success) {
        showFeedback("error", res.error || "Failed to update curriculum version.");
      } else {
        showFeedback("success", `Curriculum version updated successfully.`);
        setEditingVersion(null);
        router.refresh();
      }
    } catch {
      showFeedback("error", "An unexpected error occurred during version update.");
    } finally {
      setIsPending(false);
    }
  };

  // Submit Activate
  const handleActivateConfirm = async () => {
    if (!activatingVersion) return;
    setIsPending(true);
    const targetVer = activatingVersion;
    try {
      const res = await activateCurriculumVersionAction(targetVer.id);
      setActivatingVersion(null);
      if (!res.success) {
        showFeedback("error", res.error || "Failed to activate version.");
      } else {
        showFeedback("success", `Version "${targetVer.name}" is now the active syllabus.`);
        router.refresh();
      }
    } catch {
      setActivatingVersion(null);
      showFeedback("error", "An unexpected error occurred during activation.");
    } finally {
      setIsPending(false);
    }
  };

  // Submit Deactivate
  const handleDeactivateConfirm = async () => {
    if (!deactivatingVersion) return;
    setIsPending(true);
    const targetVer = deactivatingVersion;
    try {
      const res = await deactivateCurriculumVersionAction(targetVer.id);
      setDeactivatingVersion(null);
      if (!res.success) {
        showFeedback("error", res.error || "Failed to deactivate version.");
      } else {
        showFeedback("success", `Version "${targetVer.name}" deactivated.`);
        router.refresh();
      }
    } catch {
      setDeactivatingVersion(null);
      showFeedback("error", "An unexpected error occurred during deactivation.");
    } finally {
      setIsPending(false);
    }
  };

  const activeVersion = versions.find((v) => v.isActive);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Level Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border bg-card rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/curriculum"
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Curriculum Explorer</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Syllabus Version Management
            </h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>Admin</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Manage, publish, and activate versioned curriculum schemas per CA Academic Level.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Button
            onClick={openCreateDialog}
            className="font-bold text-xs h-9.5 px-4 rounded-xl cursor-pointer gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Version</span>
          </Button>
        </div>
      </div>

      {/* Level Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 w-fit">
        {levels.map((lvl) => {
          const isActive = selectedLevelCode.toUpperCase() === lvl.code.toUpperCase();
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

      {/* Main Content Area */}
      <div
        className={cn("space-y-6 relative transition-opacity duration-200", isNavPending && "opacity-50 pointer-events-none")}
        aria-busy={isNavPending}
      >
        {isNavPending && (
          <div className="absolute -top-3 left-0 right-0 h-0.5 bg-primary animate-pulse z-10 rounded-full" />
        )}

        {/* Feedback Toast Banner */}
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
              className="p-1 hover:opacity-70 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Level Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-border bg-card rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Total Versions
          </span>
          <div className="text-xl font-extrabold text-foreground">{versions.length}</div>
          <span className="text-[10px] text-muted-foreground block font-sans">
            Created for {selectedLevelCode}
          </span>
        </div>

        <div className="border border-border bg-card rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Active Syllabus
          </span>
          <div className="text-sm font-extrabold text-foreground truncate">
            {activeVersion ? activeVersion.name : "None Published"}
          </div>
          <span className="text-[10px] text-muted-foreground block font-sans">
            {activeVersion ? "Serving student practice" : "Action required"}
          </span>
        </div>

        <div className="border border-border bg-card rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Active Nodes Count
          </span>
          <div className="text-xl font-extrabold text-foreground">
            {activeVersion?.nodesCount || 0}
          </div>
          <span className="text-[10px] text-muted-foreground block font-sans">
            Published chapters & topics
          </span>
        </div>
      </div>

      {/* Versions List Table / Cards */}
      <div className="border border-border bg-card rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Curriculum Versions for {selectedLevelCode}
            </h2>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">
            Enforces 1 Active Version Invariant
          </span>
        </div>

        {versions.length > 0 ? (
          <div className="divide-y divide-border">
            {versions.map((ver) => {
              const isOnlyActive = ver.isActive && versions.filter((v) => v.isActive).length <= 1;

              return (
                <div
                  key={ver.id}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-sm font-extrabold text-foreground">
                        {ver.name}
                      </h3>
                      {ver.isActive ? (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active / Published</span>
                        </span>
                      ) : (
                        <span className="bg-muted text-muted-foreground border border-border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Inactive Draft
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <span>Effective:</span>
                        <strong className="text-foreground">
                          {format(new Date(ver.applicableFrom), "dd MMM yyyy")}
                        </strong>
                        {ver.applicableTo && (
                          <>
                            <span>→</span>
                            <strong className="text-foreground">
                              {format(new Date(ver.applicableTo), "dd MMM yyyy")}
                            </strong>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {format(new Date(ver.createdAt), "dd MMM yyyy")}</span>
                      </div>

                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <span>{ver.nodesCount} Nodes</span>
                        <span>•</span>
                        <span>{ver.subjectsCount} Subjects</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(ver)}
                      className="h-8 text-xs font-bold rounded-xl cursor-pointer gap-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>

                    {!ver.isActive ? (
                      <Button
                        size="sm"
                        onClick={() => setActivatingVersion(ver)}
                        className="h-8 text-xs font-bold rounded-xl cursor-pointer gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Activate</span>
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="inline-block">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isOnlyActive}
                              onClick={() => setDeactivatingVersion(ver)}
                              className={cn(
                                "h-8 text-xs font-bold rounded-xl",
                                isOnlyActive
                                  ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                  : "cursor-pointer text-destructive hover:bg-destructive/10"
                              )}
                            >
                              <span>Deactivate</span>
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {isOnlyActive
                            ? "Cannot deactivate the only active version for this level"
                            : "Deactivate version"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No Curriculum Versions</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                There are currently no curriculum versions for {selectedLevelCode}. Create a new version to begin establishing syllabus models.
              </p>
            </div>
            <Button
              onClick={openCreateDialog}
              className="font-bold text-xs h-9 px-4 rounded-xl cursor-pointer gap-1.5 mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Version</span>
            </Button>
          </div>
        )}
      </div>

      {/* CREATE VERSION DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Create Curriculum Version</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Create a new version snapshot container for syllabus nodes under {selectedLevelCode}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Academic Level</label>
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border text-xs font-semibold text-foreground">
                {levels.find((l) => l.id === formLevelId)?.name || selectedLevelCode}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-version-name" className="text-xs font-bold text-foreground">
                Version Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="create-version-name"
                required
                placeholder="e.g. CA Intermediate Syllabus 2027-2028"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9.5 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Applicable From <span className="text-destructive">*</span>
                </label>
                <DatePicker
                  date={formFromDate}
                  onSelect={(d) => setFormFromDate(d || null)}
                  placeholder="Select start date"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Applicable To <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <DatePicker
                  date={formToDate}
                  onSelect={(d) => setFormToDate(d || null)}
                  placeholder="Select end date"
                  clearable
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-xl border border-border text-xs">
              <Checkbox
                id="create-active-check"
                checked={formIsActive}
                onCheckedChange={(checked) => setFormIsActive(Boolean(checked))}
              />
              <label htmlFor="create-active-check" className="cursor-pointer select-none text-muted-foreground">
                Activate immediately upon creation (deactivates current active version)
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
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
                <span>Create Version</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT VERSION DIALOG */}
      <Dialog open={!!editingVersion} onOpenChange={(open) => !open && setEditingVersion(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              <span>Edit Curriculum Version</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans">
              Update version metadata. Structural nodes and academic level binding remain protected.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Academic Level</label>
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border text-xs font-semibold text-muted-foreground">
                {editingVersion?.levelName} (Immutable)
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-version-name" className="text-xs font-bold text-foreground">
                Version Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-version-name"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9.5 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Applicable From <span className="text-destructive">*</span>
                </label>
                <DatePicker
                  date={formFromDate}
                  onSelect={(d) => setFormFromDate(d || null)}
                  placeholder="Select start date"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Applicable To
                </label>
                <DatePicker
                  date={formToDate}
                  onSelect={(d) => setFormToDate(d || null)}
                  placeholder="Select end date"
                  clearable
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingVersion(null)}
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

      {/* ACTIVATE CONFIRMATION DIALOG */}
      <Dialog open={!!activatingVersion} onOpenChange={(open) => !open && setActivatingVersion(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-extrabold text-foreground">
              Confirm Version Activation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              Activating <strong className="text-foreground">{activatingVersion?.name}</strong> will immediately establish it as the authoritative syllabus for all <strong className="text-foreground">{selectedLevelCode}</strong> students. Any currently active version will be deactivated.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted/40 border border-border/60 rounded-xl text-xs space-y-1 text-muted-foreground">
            <div className="flex items-center gap-1.5 text-foreground font-bold">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Production Invariant</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This switch executes atomically. Student mock tests and practice will immediately resolve syllabus nodes from this version.
            </p>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActivatingVersion(null)}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleActivateConfirm}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 shadow-xs"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm & Activate</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DEACTIVATE CONFIRMATION DIALOG */}
      <Dialog open={!!deactivatingVersion} onOpenChange={(open) => !open && setDeactivatingVersion(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl font-sans">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-extrabold text-foreground">
              Deactivate Curriculum Version
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-sans leading-relaxed">
              Are you sure you want to deactivate <strong className="text-foreground">{deactivatingVersion?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivatingVersion(null)}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDeactivateConfirm}
              className="font-bold text-xs h-9.5 rounded-xl cursor-pointer gap-1.5 shadow-xs"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Deactivate Version</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
