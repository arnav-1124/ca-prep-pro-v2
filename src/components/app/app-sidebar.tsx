"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  BarChart2,
  Sparkles,
  TrendingUp,
  Settings,
  CreditCard,
  ShieldCheck
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
  useSidebar
} from "@/components/ui/sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  plan: string;
  workspaceName: string;
  isAdmin?: boolean;
}

export function AppSidebar({ plan, workspaceName, isAdmin, className, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const mainNavItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, isAvailable: true },
    { name: "Practice", href: "/practice", icon: BookOpen, isAvailable: true },
    { name: "Tests", href: "/tests", icon: FileText, isAvailable: true },
    { name: "Progress", href: "/progress", icon: BarChart2, isAvailable: true },
    { name: "Billing", href: "/billing", icon: CreditCard, isAvailable: true },
    { name: "AI Study", href: "/ai", icon: Sparkles, isAvailable: false },
    { name: "Predictions", href: "/predictions", icon: TrendingUp, isAvailable: false },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className={cn("border-r border-border bg-card transition-all duration-200", className)}
      {...props}
    >
      {/* Workspace identity in Sidebar Header - hidden when collapsed */}
      <SidebarHeader className={cn("p-3 border-b border-border min-h-[64px] flex justify-center", isCollapsed && "hidden")}>
        <div className="flex flex-col px-3 py-2.5 bg-muted/40 rounded-lg border border-border/50 transition-all duration-200">
          <span className="text-[9px] font-extrabold text-muted-foreground/60 uppercase tracking-widest leading-none">
            Workspace
          </span>
          <span className="text-xs font-semibold text-foreground mt-1.5 truncate">
            {workspaceName}
          </span>
        </div>
      </SidebarHeader>

      {/* Main navigation content */}
      <SidebarContent className="p-3 flex flex-col justify-between h-full">
        {/* Main Section */}
        <div className="space-y-4">
          <SidebarGroup className="p-0">
            {!isCollapsed && (
              <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 mb-2 pt-2">
                Main
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === "/dashboard"
                    ? pathname === "/dashboard"
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
                            <Icon className="h-4.5 w-4.5 shrink-0" />
                            <span>{item.name}</span>
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
                          <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
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
        </div>

        {/* Settings & Admin bottom Section */}
        <div className="mt-auto space-y-2">
          {isAdmin && (
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/admin")}
                      tooltip="Admin Console"
                      className="cursor-pointer h-9 px-3 text-primary hover:text-primary font-bold"
                    >
                      <Link href="/admin">
                        <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
                        <span>Admin Console</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    disabled
                    tooltip="Settings (Coming Soon)"
                    className="w-full h-9 px-3 text-muted-foreground/50 cursor-not-allowed hover:bg-transparent flex items-center gap-2"
                  >
                    <Settings className="h-4.5 w-4.5 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                    {!isCollapsed && (
                      <span className="ml-auto text-[8px] font-bold bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground/50 shrink-0 uppercase tracking-wider">
                        Soon
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>

      <div className="mx-3 h-px bg-sidebar-border" />

      {/* User profile footer - clean bg and spacing without custom line overflow */}
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
                    {user?.fullName || user?.firstName || "Student"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate font-medium font-sans">
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </span>
                  <span className="text-[9px] font-bold text-primary mt-0.5 uppercase tracking-wider font-sans">
                    {plan === "FREE" ? "Free Tier" : plan === "PLUS" ? "Plus Member" : plan === "PRO" || plan === "PAID" ? "Pro Member" : "Free Tier"}
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
