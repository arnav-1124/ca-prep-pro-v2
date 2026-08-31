import Link from "next/link";
import { requireAdmin } from "@/domains/auth/admin";
import { db } from "@/db";
import { studentProfiles, subscriptions, questions, curriculumNodes } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import {
  Users,
  CreditCard,
  BookOpen,
  HelpCircle,
  ShieldCheck,
  Cpu,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const adminContext = await requireAdmin();

  // 1. Fetch real platform counts from database
  const [studentsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentProfiles);

  const [activeSubsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  const [questionsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions);

  const [nodesCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curriculumNodes);

  const totalStudents = studentsCount?.count || 0;
  const activeSubs = activeSubsCount?.count || 0;
  const totalQuestions = questionsCount?.count || 0;
  const totalNodes = nodesCount?.count || 0;

  const modules = [
    {
      title: "Content & Curriculum",
      description: "Explore CA syllabus hierarchy across Foundation, Intermediate, and Final.",
      icon: BookOpen,
      status: "Available (Step 14)",
      badge: "Active",
      href: "/admin/curriculum",
      isAvailable: true,
    },
    {
      title: "Question Bank & Versions",
      description: "Inspect, filter, and audit curriculum-to-question mappings across Foundation, Intermediate, and Final.",
      icon: HelpCircle,
      status: "Available (Step 17)",
      badge: "Active",
      href: "/admin/questions",
      isAvailable: true,
    },
    {
      title: "User & Account Administration",
      description: "Inspect student preparation profiles, manual plan adjustments, and resets.",
      icon: Users,
      status: "Planned (Step 16)",
      badge: "Coming Soon",
      href: "/admin/users",
      isAvailable: false,
    },
    {
      title: "Billing & Coupons Engine",
      description: "Manage subscription plans, Razorpay payment reconciliations, and coupons.",
      icon: CreditCard,
      status: "Planned (Step 17)",
      badge: "Coming Soon",
      href: "/admin/billing",
      isAvailable: false,
    },
    {
      title: "AI Provider & Model Tuning",
      description: "Configure Gemini / OpenRouter fallbacks, token limits, and prompts.",
      icon: Cpu,
      status: "Planned (Step 18)",
      badge: "Coming Soon",
      href: "/admin/settings",
      isAvailable: false,
    },
    {
      title: "Audit Trail & System Logs",
      description: "Comprehensive immutable logs for administrative mutations and security.",
      icon: FileText,
      status: "Planned (Step 19)",
      badge: "Coming Soon",
      href: "/admin/logs",
      isAvailable: false,
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Admin Header Card */}
      <div className="border border-border bg-card rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-foreground tracking-tight">
              CA Prep Pro Administration
            </span>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Verified</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Secure administrative control plane. Authenticated as <span className="font-semibold text-foreground">{adminContext.email}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted/40 border border-border/60 px-3.5 py-2 rounded-xl text-xs text-muted-foreground font-sans">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>Role: <strong className="text-foreground">{adminContext.role}</strong></span>
        </div>
      </div>

      {/* Real Live Database Metrics Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground/80 px-1">
          Database & System Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-border bg-card rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Registered Students</span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-foreground tracking-tight">{totalStudents}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 font-sans">Active student accounts in Neon DB</span>
            </div>
          </div>

          <div className="border border-border bg-card rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Subscriptions</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-foreground tracking-tight">{activeSubs}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 font-sans">Paid memberships active</span>
            </div>
          </div>

          <div className="border border-border bg-card rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Question Bank</span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <HelpCircle className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-foreground tracking-tight">{totalQuestions}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 font-sans">Published practice questions</span>
            </div>
          </div>

          <Link
            href="/admin/curriculum"
            className="border border-border bg-card hover:border-primary/40 rounded-2xl p-5 shadow-xs space-y-3 transition-all cursor-pointer block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Curriculum Nodes</span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-foreground tracking-tight">{totalNodes}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 font-sans">Syllabus chapters & topics →</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Planned Administrative Modules Roadmap */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground/80">
            Administrative Modules Roadmap
          </h2>
          <span className="text-[10px] text-muted-foreground font-sans flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Incremental development</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const cardContent = (
              <div
                className={`border rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 h-full transition-all ${
                  mod.isAvailable
                    ? "bg-card border-border hover:border-primary/40 cursor-pointer shadow-sm group"
                    : "bg-card/60 border-border opacity-85"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${mod.isAvailable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        mod.isAvailable
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {mod.badge}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">{mod.title}</h3>
                      {mod.isAvailable && <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-sans">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 text-[10px] font-medium text-muted-foreground/70 font-sans">
                  {mod.status}
                </div>
              </div>
            );

            return mod.isAvailable ? (
              <Link key={mod.title} href={mod.href}>
                {cardContent}
              </Link>
            ) : (
              <div key={mod.title}>{cardContent}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
