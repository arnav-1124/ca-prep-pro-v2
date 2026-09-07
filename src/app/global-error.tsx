"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    console.error("Global application error caught:", error);
  }, [error]);

  const handleRetry = () => {
    startTransition(() => {
      reset();
    });
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased flex flex-col items-center justify-center p-4">
        <main className="w-full max-w-lg mx-auto text-center rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-8 ring-destructive/5">
            <AlertOctagon className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Unable to initialize application
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            A critical issue prevented the application from starting properly. Your saved student profile and test records are safe.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={handleRetry}
              disabled={isPending}
              size="lg"
              className="w-full sm:w-auto cursor-pointer gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Reloading..." : "Reload Application"}
            </Button>

            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto cursor-pointer gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
