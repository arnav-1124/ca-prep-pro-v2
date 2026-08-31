"use client";

import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { GraduationCap, ShieldCheck } from "lucide-react";

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 transition-colors font-sans">
      <div className="flex items-center gap-3 sm:gap-4">
        <SidebarTrigger className="h-9 w-9 cursor-pointer" />
        
        <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg tracking-tight text-foreground">
              CA Prep Pro
            </span>
            <span className="text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Admin</span>
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ModeToggle />
      </div>
    </header>
  );
}
