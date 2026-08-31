import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { auth } from "@clerk/nextjs/server";
import { BookOpen, CheckSquare, FileText, Sparkles, Compass, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Features - CA Prep Pro",
  description: "Explore practice assessments, study tools, progress tracking, and AI tutoring helpers on the CA Prep Pro platform.",
};

export default async function FeaturesPage() {
  const { userId } = await auth();
  const isAuthenticated = !!userId;

  const sections = [
    {
      title: "Structured Practice",
      icon: BookOpen,
      items: [
        "Multiple-Choice Questions (MCQs): Access a robust catalog of practice questions mapped directly to the syllabus.",
        "Case-Study Practice: Work through structured problem scenarios that mimic real ICAI examinations.",
        "Hierarchical Organization: Navigate syllabus topics mapped cleanly at Level → Subject → Chapter → Topic boundaries.",
        "Detailed Explanations: Review instant, clear breakdowns of correct and incorrect options.",
      ],
    },
    {
      title: "Preparation Tracking",
      icon: CheckSquare,
      items: [
        "Attempt Calibrations: Input your target attempt window (e.g. May 2027) to focus your stats.",
        "Syllabus Completion progress: See real-time metrics showing how much of each paper is completed.",
        "Practice Velocity: Track average response times and accuracy levels to maintain exam pacing.",
        "Attempt-Aware History: Keep history safe when switching levels, preserving all past statistics.",
      ],
    },
    {
      title: "Simulated Assessments",
      icon: FileText,
      items: [
        "Mock Exams: Take structured mock tests designed around past examination formats.",
        "Scoring & Evaluation: Receive clear score logs and performance reviews immediately after submission.",
        "Assessment Reviews: Study correct option profiles for every question completed under exam conditions.",
      ],
    },
    {
      title: "AI Study Assistance",
      icon: Sparkles,
      items: [
        "Concept Explanations: Receive simplified explanations for accounting entries, tax provisions, and legal sections.",
        "Assisted Assessment Reviews: Get help analyzing wrong answers to correct logical flaws.",
        "Targeted Assessments: Paid members can generate customized practice question sets on specific chapters.",
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="flex-1 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Platform Features
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Discover how CA Prep Pro structures your study path, practices, and progress metrics to help you prepare for CA examinations.
            </p>
          </div>

          {/* Grid Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <div key={sec.title} className="border border-border bg-card rounded-xl p-6 shadow-xs">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">{sec.title}</h2>
                  </div>
                  <ul className="space-y-4">
                    {sec.items.map((item, idx) => {
                      const [label, desc] = item.split(": ");
                      return (
                        <li key={idx} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                          <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                          <div>
                            <strong className="text-foreground">{label}</strong>: {desc}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Prediction Notice */}
          <div className="max-w-3xl mx-auto mt-12 border border-border bg-card p-6 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <Compass className="h-5 w-5" />
              <span>Trend Identification & Prediction Disclaimer</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              CA Prep Pro leverages historical patterns and syllabus evidence to identify question trends and exam probabilities.
              This feature is designed for supplementary study analysis only. **Prediction metrics are estimates and do not guarantee actual examination questions.**
            </p>
          </div>

          {/* Free vs Paid Overview */}
          <div className="max-w-3xl mx-auto mt-12 border border-border bg-card p-6 rounded-xl shadow-xs">
            <h3 className="text-base font-bold text-foreground mb-4">Membership Tiers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs leading-relaxed">
              <div>
                <h4 className="font-bold text-primary mb-2">Free Tier</h4>
                <p className="text-muted-foreground">
                  Includes unlimited standard MCQ and case-study practice, syllabus completion logs, and basic stats tracker parameters.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-primary mb-2">Paid Tier</h4>
                <p className="text-muted-foreground">
                  Adds full AI study tutoring, custom practice question generation, flexible test difficulty, advanced progress charts, and mock exam simulations.
                </p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="max-w-xl mx-auto text-center mt-16 pt-8 border-t border-border/40">
            <Link href={isAuthenticated ? "/dashboard" : "/sign-up"}>
              <Button size="lg" className="w-full sm:w-auto gap-2 cursor-pointer">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
