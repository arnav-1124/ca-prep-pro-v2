"use client";

import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { GraduationCap, PanelLeft } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm h-16 flex items-center justify-between sticky top-0 z-50 transition-colors pr-4 sm:pr-6 lg:pr-8">
      <div className="flex items-center">
        {/* Permanently aligned trigger container matching collapsed sidebar icon column (48px wide) */}
        <div className="flex items-center justify-center w-12 h-16 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 cursor-pointer text-foreground hover:bg-muted"
            title="Toggle Sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer ml-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg tracking-tight text-foreground">
            CA Prep Pro
          </span>
        </Link>
      </div>

      {/* Header controls (No UserButton since it is located in the sidebar footer) */}
      <div className="flex items-center gap-4">
        <ModeToggle />
      </div>
    </header>
  );
}
