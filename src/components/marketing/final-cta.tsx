import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FinalCtaProps {
  isAuthenticated: boolean;
}

export function FinalCta({ isAuthenticated }: FinalCtaProps) {
  return (
    <section className="py-20 bg-muted/40 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Start preparing for your next CA attempt.
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Create an account and setup your level attempt parameters to begin practicing.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link href={isAuthenticated ? "/dashboard" : "/sign-up"}>
            <Button size="lg" className="w-full sm:w-auto gap-2 cursor-pointer">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/features">
            <Button size="lg" variant="outline" className="w-full sm:w-auto cursor-pointer">
              Explore the platform
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
