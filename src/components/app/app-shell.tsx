import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { getActiveStudentAttempt } from "@/domains/academics/services";
import { isCurrentAdmin } from "@/domains/auth/admin";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  let plan = "FREE";
  let workspaceName = "Student Workspace";
  const isAdmin = await isCurrentAdmin();

  if (user) {
    try {
      const email = user.emailAddresses[0]?.emailAddress || "";
      const profile = await getOrCreateStudentProfile(user.id, email);
      plan = profile.plan;

      const activeAttempt = await getActiveStudentAttempt(profile.id);
      if (activeAttempt?.levelName) {
        workspaceName = `${activeAttempt.levelName} Workspace`;
      }
    } catch {
      // Fallback if DB connectivity is interrupted in development
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-col min-h-screen w-full bg-background text-foreground transition-colors">
          {/* Top sticky navbar */}
          <AppHeader />

          {/* Main layout area */}
          <div className="flex flex-1 relative">
            {/* Collapsible sidebar starting below header */}
            <AppSidebar
              plan={plan}
              workspaceName={workspaceName}
              isAdmin={isAdmin}
              className="top-16 h-[calc(100vh-4rem)]"
            />
            
            {/* Main content area */}
            <SidebarInset className="flex-1 overflow-y-auto">
              <main className="p-6 sm:p-8">
                <div className="mx-auto max-w-5xl">
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
