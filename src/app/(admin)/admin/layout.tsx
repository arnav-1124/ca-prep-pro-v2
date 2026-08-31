import * as React from "react";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireAdmin } from "@/domains/auth/admin";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Console - CA Prep Pro",
  description: "CA Prep Pro Administration & Configuration Console.",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHENTICATED") {
      redirect("/sign-in?redirect_url=/admin");
    } else {
      redirect("/admin/unauthorized");
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-col min-h-screen w-full bg-background text-foreground transition-colors font-sans">
          {/* Top Admin Navbar */}
          <AdminHeader />

          {/* Main Layout Body */}
          <div className="flex flex-1 relative">
            <AdminSidebar />

            <SidebarInset className="flex-1 overflow-y-auto">
              <main className="p-6 sm:p-8">
                <div className="mx-auto max-w-6xl">
                  {children}
                </div>
              </main>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
