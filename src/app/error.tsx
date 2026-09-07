"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Log sanitized error internally for telemetry
    console.error("Application error boundary triggered:", error?.message || error);
  }, [error]);

  const handleRetry = () => {
    startTransition(() => {
      reset();
    });
  };

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center px-4 py-16 overflow-hidden">
      {/* Background subtle warning glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-25 dark:opacity-15"
      >
        <div className="h-[450px] w-[450px] rounded-full bg-gradient-to-tr from-amber-500/30 to-destructive/20 blur-3xl" />
      </div>

      <div className="w-full max-w-xl mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
        <section className="relative rounded-2xl border border-border/70 bg-card/80 p-8 md:p-10 shadow-xl backdrop-blur-md">
          {/* Status Badge & Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5 shadow-inner">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-semibold tracking-wide border-amber-500/30 text-amber-600 dark:text-amber-400">
            NOTICE • TEMPORARY DISPLAY ISSUE
          </Badge>

          {/* Heading & Student-focused Copy */}
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Unable to load this study view
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            We ran into an issue rendering this section of your study portal. Your saved progress, mock test submissions, and attempt history are completely safe.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={handleRetry}
              disabled={isPending}
              size="lg"
              className="w-full sm:w-auto cursor-pointer gap-2 shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Reloading..." : "Try Again"}
            </Button>

            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto cursor-pointer gap-2">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>

            <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto cursor-pointer gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>

          {/* Student Support Footer */}
          <div className="mt-8 pt-6 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-center gap-4">
            <span>If reloading does not resolve the issue, please try returning to your dashboard or signing in again.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
