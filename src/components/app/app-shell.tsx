import Link from "next/link";
import { Flame, Gamepad2, Gift, LayoutDashboard, LogOut, Medal, ShieldCheck, Users } from "lucide-react";

import { exitAdminGameMode } from "@/app/admin/game-mode/actions";
import { GameRulesDialog } from "@/components/app/game-rules-dialog";
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
  { href: "/admin/game-mode", label: "Game Mode", icon: Gamepad2 },
  { href: "/admin/taskers", label: "Taskers", icon: Users },
  { href: "/admin/reviewers", label: "Reviewers", icon: ShieldCheck },
  { href: "/admin/config", label: "Config", icon: Flame },
  { href: "/admin/economics", label: "Economics", icon: Medal },
  { href: "/admin/goodies", label: "Goodies", icon: Gift },
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
  navigationRole,
  gameMode,
  children,
}: {
  role: AppRole;
  name: string;
  navigationRole?: AppRole;
  gameMode?: {
    label: string;
    targetName: string;
  };
  children: React.ReactNode;
}) {
  const activeNavigationRole = navigationRole ?? role;
  const homeHref = activeNavigationRole === "admin" ? "/admin" : activeNavigationRole === "reviewer" ? "/review/queue" : "/";

  return (
    <div className="arena-bg relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-arena-cyan/70 to-transparent" />
      <header className="sticky top-0 z-20 border-b border-arena-cyan/20 bg-background/78 shadow-[0_0_48px_oklch(0.79_0.18_205/0.08)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={homeHref} className="flex items-center gap-2">
            <div className="arena-glow flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-arena-cyan via-arena-blue to-arena-pink text-primary-foreground">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none tracking-wide text-foreground">Tokenmaxxing</p>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-arena-cyan">Token Arena</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <GameRulesDialog />
            <Badge variant="secondary" className="border-arena-purple/40 bg-arena-purple/15 text-arena-cyan capitalize">
              {role}
            </Badge>
            {gameMode ? <Badge className="bg-arena-gold text-background">Game mode</Badge> : null}
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{name}</span>
            <Button asChild variant="ghost" size="sm" className="hover:bg-arena-pink/10 hover:text-arena-pink">
              <a href="/api/auth/logout">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign out</span>
              </a>
            </Button>
          </div>
        </div>
      </header>
      {gameMode ? (
        <div className="border-b border-arena-gold/25 bg-arena-gold/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <span className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-arena-gold">Admin game mode:</span>{" "}
              <span className="text-muted-foreground">
                {gameMode.label} as {gameMode.targetName}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin">Admin Ops</Link>
              </Button>
              <form action={exitAdminGameMode}>
                <Button size="sm" variant="outline" type="submit">
                  Exit Game Mode
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <nav className="arena-panel flex gap-2 overflow-x-auto rounded-2xl p-2 pb-2 lg:flex-col lg:overflow-visible">
            {linksForRole(activeNavigationRole).map((link) => {
              const Icon = link.icon;

              return (
                <Button
                  key={link.href}
                  asChild
                  variant="ghost"
                  className="justify-start border border-transparent text-muted-foreground hover:border-arena-cyan/35 hover:bg-arena-cyan/10 hover:text-foreground"
                >
                  <Link href={link.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {link.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <Separator className="my-4 hidden bg-arena-cyan/20 lg:block" />
          <div className="hidden rounded-2xl border border-arena-purple/20 bg-arena-purple/10 p-3 lg:block">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-arena-purple">Arena Rule</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Public surfaces show momentum, not private economics. Admin-only spend data stays behind RLS.
            </p>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
