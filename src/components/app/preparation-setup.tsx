"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { submitOnboardingAction } from "@/domains/academics/actions";
import { Loader2, Sparkles, BookOpen, Calendar as CalendarIcon, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface PreparationSetupProps {
  studentProfileId: string;
  academicLevels: { id: string; name: string; code: string }[];
}

export function PreparationSetup({ studentProfileId, academicLevels }: PreparationSetupProps) {
  const [selectedLevelId, setSelectedLevelId] = React.useState<string>("");
  const [targetDate, setTargetDate] = React.useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevelId) {
      setError("Please select a study level.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitOnboardingAction(studentProfileId, selectedLevelId, targetDate || null);
    } catch {
      setError("Failed to save your settings. Please try again.");
      setSubmitting(false);
    }
  };

  if (academicLevels.length === 0) {
    return (
      <div className="border border-border bg-card text-card-foreground rounded-2xl p-8 max-w-md mx-auto text-center space-y-4 shadow-sm">
        <BookOpen className="h-12 w-12 text-primary/50 mx-auto" />
        <h3 className="text-xl font-bold">Preparation options aren&apos;t available yet</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The study levels and exam target attempts have not been published by platform administrators. Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card text-card-foreground rounded-2xl shadow-md p-6 max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-extrabold text-foreground">Set up your preparation</h3>
        <p className="text-xs text-muted-foreground">
          Tell us which CA level and attempt you are preparing for so we can organize your study workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-left">
        {/* CA Level Selector Cards */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-foreground block">Choose CA Study Level</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {academicLevels.map((lvl) => {
              const isSelected = selectedLevelId === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSelectedLevelId(lvl.id)}
                  disabled={submitting}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-xl transition-all cursor-pointer text-center bg-muted/5",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-foreground/20"
                  )}
                >
                  <GraduationCap className={cn("h-6 w-6 mb-2", isSelected ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-xs font-bold block">{lvl.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Date Picker (Optional) */}
        {selectedLevelId && (
          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-foreground">Target Exam Date (Optional)</label>
              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate(undefined)}
                  className="text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Set later
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-start text-left font-normal cursor-pointer text-xs",
                      !targetDate && "text-muted-foreground"
                    )}
                    disabled={submitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {targetDate ? format(targetDate, "PPP") : <span>Pick a target date (Optional)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover text-popover-foreground border border-border rounded-lg shadow-md" align="start">
                  <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={setTargetDate}
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Leave this unset if you are not sure of your exact exam target date yet. You can adjust this later in settings.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

        <Button
          type="submit"
          disabled={submitting || !selectedLevelId}
          className="w-full cursor-pointer flex justify-center items-center gap-2 mt-4"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving Settings...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Start Preparation
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
