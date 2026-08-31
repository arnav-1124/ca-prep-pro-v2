import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function PlanTeaser() {
  return (
    <section className="py-16 bg-muted/40 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Choose the level of support that fits your preparation.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            CA Prep Pro offers a straightforward Free tier for regular practice alongside a Paid membership for advanced AI evaluations and simulated exams.
          </p>
          <div className="pt-4">
            <Link href="/pricing">
              <Button className="cursor-pointer gap-2">
                View Plans <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
