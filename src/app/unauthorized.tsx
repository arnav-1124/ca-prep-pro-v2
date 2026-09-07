import Link from "next/link";
import { ShieldAlert, LogIn, UserPlus, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function UnauthorizedPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center px-4 py-16 overflow-hidden">
      {/* Background subtle security glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-30 dark:opacity-20"
      >
        <div className="h-[450px] w-[450px] rounded-full bg-gradient-to-tr from-primary/30 to-violet-500/20 blur-3xl" />
      </div>

      <div className="w-full max-w-xl mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
        <section className="relative rounded-2xl border border-border/70 bg-card/80 p-8 md:p-10 shadow-xl backdrop-blur-md">
          {/* Status Badge & Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5 shadow-inner">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-semibold tracking-wide border-primary/20 text-primary">
            401 • AUTHENTICATION REQUIRED
          </Badge>

          {/* Heading & Student-focused Copy */}
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Access Restricted
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            You must be signed in to view practice questions, take mock tests, or review your preparation analytics. Sign in to your account to resume your preparation.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto cursor-pointer gap-2 shadow-md">
              <Link href="/sign-in">
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto cursor-pointer gap-2">
              <Link href="/sign-up">
                <UserPlus className="h-4 w-4" />
                Create Free Account
              </Link>
            </Button>

            <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto cursor-pointer gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>

          {/* Student Benefits Reminder */}
          <div className="mt-8 pt-6 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-center gap-6">
            <span>Free Access to Core MCQs</span>
            <span>•</span>
            <span>Progress Tracking</span>
            <span>•</span>
            <span>Mock Test Scoring</span>
          </div>
        </section>
      </div>
    </main>
  );
}
