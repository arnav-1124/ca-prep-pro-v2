"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  date?: Date | null;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Select date",
  className,
  disabled = false,
  clearable = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-sans text-xs h-9.5 rounded-xl border-input bg-transparent px-3 hover:bg-muted/40 cursor-pointer shadow-xs",
              !date && "text-muted-foreground font-normal"
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{date ? format(date, "dd MMM yyyy") : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border border-border bg-popover font-sans z-[60]" align="start">
          <Calendar
            mode="single"
            selected={date || undefined}
            onSelect={(selectedDate) => {
              onSelect?.(selectedDate);
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && date && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(undefined);
          }}
          className="absolute right-2.5 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
