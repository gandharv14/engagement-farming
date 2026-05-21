import Link from "next/link";
import { Flame, Gift, LayoutDashboard, LogOut, Medal, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AppRole } from "@/lib/roles";

const taskerLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leaderboards", label: "Leaderboards", icon: Medal },
  { href: "/guild", label: "Guild", icon: Users },
  { href: "/goodies", label: "Goodies", icon: Gift },
  { href: "/earnings", label: "Earnings", icon: Flame },
  { href: "/profile", label: "Profile", icon: ShieldCheck },
];

const reviewerLinks = [
  { href: "/review/queue", label: "Review Queue", icon: ShieldCheck },
];

const adminLinks = [
  { href: "/admin", label: "Operations", icon: LayoutDashboard },
  { href: "/admin/taskers", label: "Taskers", icon: Users },
  { href: "/admin/reviewers", label: "Reviewers", icon: ShieldCheck },
  { href: "/admin/config", label: "Config", icon: Flame },
  { href: "/admin/economics", label: "Economics", icon: Medal },
  { href: "/admin/guilds", label: "Guilds", icon: Users },
  { href: "/admin/payouts", label: "Payouts", icon: Gift },
];

function linksForRole(role: AppRole) {
  if (role === "admin") {
    return adminLinks;
  }

  if (role === "reviewer") {
    return reviewerLinks;
  }

  return taskerLinks;
}

export function AppShell({
  role,
  name,
  children,
}: {
  role: AppRole;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href={role === "admin" ? "/admin" : role === "reviewer" ? "/review/queue" : "/"} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Sprint Arcade</p>
              <p className="text-xs text-muted-foreground">Long-horizon labeling</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
            <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
            <Button asChild variant="ghost" size="sm">
              <a href="/api/auth/logout">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </a>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {linksForRole(role).map((link) => {
              const Icon = link.icon;

              return (
                <Button key={link.href} asChild variant="ghost" className="justify-start">
                  <Link href={link.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {link.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <Separator className="my-4 hidden lg:block" />
          <p className="hidden text-xs text-muted-foreground lg:block">
            Public surfaces show momentum, not private economics. Admin-only spend data stays behind RLS.
          </p>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
