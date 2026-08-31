import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, Award, FileText, ArrowRight } from "lucide-react";

export function LevelOverview() {
  const levels = [
    {
      title: "CA Foundation",
      description: "Build strong foundational understanding across accounting, mercantile laws, and quantitative aptitude.",
      icon: BookOpen,
      phase: "Entry Level",
    },
    {
      title: "CA Intermediate",
      description: "Master intermediate-level topics including taxation, auditing, financial management, and advanced accounting.",
      icon: FileText,
      phase: "Group I & II",
    },
    {
      title: "CA Final",
      description: "Prepare for final-level advanced reporting, strategic management, corporate laws, and complex case analysis.",
      icon: Award,
      phase: "Professional Level",
    },
  ];

  return (
    <section id="levels" className="py-20 bg-muted/40 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Targeted Level Preparation
          </h2>
          <p className="mt-4 text-muted-foreground">
            Whether starting your CA path or preparing for the finals, progress and history are mapped specifically to your active level context and target attempt.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((lvl) => {
            const IconComponent = lvl.icon;
            return (
              <div
                key={lvl.title}
                className="flex flex-col justify-between border border-border bg-card text-card-foreground shadow-xs rounded-xl p-8 hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-6">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{lvl.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{lvl.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span>Structured Syllabus</span>
                  <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md">{lvl.phase}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link href="/syllabus">
            <Button variant="outline" className="cursor-pointer gap-2">
              Explore Syllabus <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
