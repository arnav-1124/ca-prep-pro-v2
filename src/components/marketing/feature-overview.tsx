import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

export function FeatureOverview() {
  const capabilities = [
    {
      title: "Practice",
      description: "Work through MCQs and case studies across your syllabus.",
    },
    {
      title: "Understand",
      description: "Get clear explanations and AI-assisted study support.",
    },
    {
      title: "Track",
      description: "Keep your preparation progress organized by subject and chapter.",
    },
    {
      title: "Prepare",
      description: "Use tests, insights, and preparation tools to stay exam-ready.",
    },
  ];

  return (
    <section id="features" className="py-20 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            What CA Prep Pro Helps You Do
          </h2>
          <p className="mt-4 text-muted-foreground">
            A comprehensive study companion bringing together assessment tools and structured progress logs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {capabilities.map((cap) => (
            <div key={cap.title} className="flex flex-col border border-border bg-card p-6 rounded-xl shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Check className="h-5 w-5" strokeWidth={3} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{cap.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/features">
            <Button variant="outline" className="cursor-pointer gap-2">
              View Detailed Features <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
