"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles } from "lucide-react";
import Link from "next/link";

interface LimitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  featureName: string;
  currentPlan: string;
  limitCount: number;
  period: string; // "24 hours", "lifetime", etc.
  isRenewable: boolean;
}

export function LimitDialog({
  isOpen,
  onClose,
  studentName,
  featureName,
  currentPlan,
  limitCount,
  period,
  isRenewable,
}: LimitDialogProps) {
  const titleText = `Limit Reached: ${featureName}`;
  
  const descriptionText = isRenewable
    ? `Hi ${studentName || "Student"}, you've reached your ${period} AI limit of ${limitCount} ${featureName.toLowerCase()}s on your current ${currentPlan} plan. Upgrade your plan to continue using this feature immediately, or come back when your allowance resets.`
    : `Hi ${studentName || "Student"}, you've used all available ${limitCount} attempts for this ${featureName.toLowerCase()} on your current ${currentPlan} plan. Upgrade your plan to get more or unlimited attempts.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] bg-card border border-border/80 rounded-2xl p-6 gap-6 shadow-lg">
        <DialogHeader className="flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0 animate-pulse">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground leading-none">
            {titleText}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/90 font-sans mt-2 px-1 leading-relaxed">
            {descriptionText}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2.5 w-full">
          <Button
            asChild
            className="w-full sm:flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-xl h-10 order-2 sm:order-1"
            onClick={onClose}
          >
            <Link href="/pricing" className="flex items-center justify-center gap-1.5 w-full">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade Plan</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full sm:flex-1 cursor-pointer border-border hover:bg-muted/40 font-bold text-xs rounded-xl h-10 order-1 sm:order-2"
            onClick={onClose}
          >
            Come Back Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
