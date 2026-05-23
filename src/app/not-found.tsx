import { Flame } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { getCurrentUser, getHomePathForRole } from "@/lib/auth";

function roleHomeLabel(role: string) {
  if (role === "admin") {
    return "admin operations";
  }

  if (role === "reviewer") {
    return "reviewer dashboard";
  }

  return "dashboard";
}

function PublicNotFound() {
  return (
    <main className="arena-bg relative flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="arena-glow mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-arena-cyan via-arena-blue to-arena-pink text-primary-foreground">
            <Flame className="h-5 w-5" />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Route Missing</p>
          <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
          <CardDescription>This page is not available. Sign in to return to the Token Arena.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Sign in to continue</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function NotFound() {
  const user = await getCurrentUser();

  if (!user) {
    return <PublicNotFound />;
  }

  const homeHref = getHomePathForRole(user.role);

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Arena user"}>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Route Missing</p>
          <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
          <CardDescription>
            This page is not available. Use the navigation menu or return to your {roleHomeLabel(user.role)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={homeHref}>Return to {roleHomeLabel(user.role)}</Link>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
