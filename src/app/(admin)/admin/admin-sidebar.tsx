"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  HelpCircle,
  CreditCard,
  Settings2,
  ArrowLeft,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserButton, useUser } from "@clerk/nextjs";

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const adminNavItems = [
    { name: "Overview", href: "/admin", icon: LayoutDashboard, isAvailable: true },
    { name: "Curriculum", href: "/admin/curriculum", icon: BookOpen, isAvailable: true },
    { name: "Question Bank", href: "/admin/questions", icon: HelpCircle, isAvailable: true },
    { name: "Users & Accounts", href: "/admin/users", icon: Users, isAvailable: false },
    { name: "Billing & Plans", href: "/admin/billing", icon: CreditCard, isAvailable: false },
    { name: "System & AI Config", href: "/admin/settings", icon: Settings2, isAvailable: false },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card top-16 h-[calc(100vh-4rem)] transition-all duration-200"
    >
      <SidebarHeader className={cn("p-3 border-b border-border min-h-[64px] flex justify-center", isCollapsed && "hidden")}>
        <div className="flex flex-col px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
          <span className="text-[9px] font-extrabold text-primary uppercase tracking-widest leading-none">
            Console Mode
          </span>
          <span className="text-xs font-bold text-foreground mt-1 truncate">
            Platform Administration
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-3 flex flex-col justify-between h-full">
        <SidebarGroup className="p-0">
          {!isCollapsed && (
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 mb-2 pt-2">
              Management
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/admin" 
                  ? pathname === "/admin" 
                  : pathname.startsWith(item.href);

                if (item.isAvailable) {
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                        className="cursor-pointer h-9 px-3"
                      >
                        <Link href={item.href}>
                          <Icon className="h-4.5 w-4.5 shrink-0 text-primary" />
                          <span className="font-semibold">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                } else {
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        disabled
                        tooltip={`${item.name} (Coming Soon)`}
                        className="w-full h-9 px-3 text-muted-foreground/50 cursor-not-allowed hover:bg-transparent flex items-center gap-2"
                      >
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden text-xs">{item.name}</span>
                        {!isCollapsed && (
                          <span className="ml-auto text-[8px] font-bold bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground/50 shrink-0 uppercase tracking-wider">
                            Soon
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto pt-4 border-t border-border">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Back to Student App"
                    className="cursor-pointer h-9 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/dashboard">
                      <ArrowLeft className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-xs font-semibold">Student App</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>

      <div className="mx-3 h-px bg-sidebar-border" />

      <SidebarFooter className="p-3 bg-muted/10">
        <SidebarMenu>
          <SidebarMenuItem>
            {isCollapsed ? (
              <div className="flex w-full items-center justify-center py-1">
                <UserButton />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-1.5 w-full overflow-hidden">
                <div className="flex-shrink-0">
                  <UserButton />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-foreground truncate font-sans">
                    {user?.fullName || user?.firstName || "Administrator"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate font-medium font-sans">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </span>
                  <span className="text-[9px] font-extrabold text-destructive mt-0.5 uppercase tracking-wider font-sans">
                    Super Admin
                  </span>
                </div>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
