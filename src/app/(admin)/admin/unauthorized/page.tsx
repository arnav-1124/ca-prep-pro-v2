import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Access Restricted - CA Prep Pro",
  description: "Administrative access restricted.",
};

export default function AdminUnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 font-sans selection:bg-primary/20">
      <div className="max-w-md w-full border border-border bg-card rounded-2xl p-8 shadow-xs text-center space-y-6">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">
            Access Restricted
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            You don&apos;t have permission to access the administration area. If you believe this is an error, please contact your workspace administrator.
          </p>
        </div>

        <div className="pt-2">
          <Button asChild className="w-full font-bold text-xs h-10 rounded-xl cursor-pointer gap-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
