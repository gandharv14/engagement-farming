import Link from "next/link";
import { Gamepad2, UserRoundSearch } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth";
import { getAdminGameModeStatus, getReviewerOptionsForAdmin, getTaskerOptionsForAdmin } from "@/lib/admin-game-mode";
import { getMyUserRow } from "@/lib/data";
import { enterOwnAdminGameMode, enterReviewerImpersonationMode, enterTaskerImpersonationMode, exitAdminGameMode } from "./actions";

export const dynamic = "force-dynamic";

function displayName(user: { display_name: string | null; email: string | null }) {
  return user.display_name ?? user.email ?? "User";
}

function statusDescription(status: Awaited<ReturnType<typeof getAdminGameModeStatus>>) {
  if (!status) {
    return "";
  }

  if (status.mode === "own") {
    return "Your admin-owned game profile";
  }

  return status.role === "reviewer" ? "Existing reviewer impersonation" : "Existing tasker impersonation";
}

export default async function AdminGameModePage() {
  const user = await requireRole("admin");
  const admin = await getMyUserRow(user.sub);
  const [status, taskers, reviewers] = admin
    ? await Promise.all([getAdminGameModeStatus(admin), getTaskerOptionsForAdmin(), getReviewerOptionsForAdmin()])
    : [null, [], []];

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-purple">Simulator</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin Game Mode</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter tasker-facing gameplay while keeping your admin session and operations access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Target</CardTitle>
            <CardDescription>
              Game mode changes only the tasker context used by the game surfaces and game actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status ? (
              <div className="rounded-2xl border border-arena-purple/25 bg-arena-purple/10 p-4 text-sm">
                <p className="font-mono font-medium">{displayName(status.target)}</p>
                <p className="mt-1 text-muted-foreground">{statusDescription(status)}</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No admin mode target is active. Choose a mode below to enter the tasker or reviewer experience.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {status ? (
                <Button asChild>
                  <Link href={status.role === "reviewer" ? "/review/queue" : "/"}>
                    {status.role === "reviewer" ? "Open Review Queue" : "Open Game Dashboard"}
                  </Link>
                </Button>
              ) : null}
              <form action={exitAdminGameMode}>
                <Button type="submit" variant="secondary" disabled={!status}>
                  Exit Game Mode
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                Play as Yourself
              </CardTitle>
              <CardDescription>
                Creates or resumes a linked tasker profile owned by your admin account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={enterOwnAdminGameMode}>
                <Button type="submit" className="w-full">
                  Enter My Game Profile
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundSearch className="h-5 w-5" />
                Impersonate Tasker
              </CardTitle>
              <CardDescription>
                Use an existing tasker context to inspect or test their game experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={enterTaskerImpersonationMode} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="taskerId">Tasker</Label>
                  <select
                    id="taskerId"
                    name="taskerId"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    required
                    disabled={!taskers.length}
                  >
                    <option value="">Choose a tasker</option>
                    {taskers.map((tasker) => (
                      <option key={tasker.id} value={tasker.id}>
                        {displayName(tasker)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={!taskers.length}>
                  Enter as Selected Tasker
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundSearch className="h-5 w-5" />
                Impersonate Reviewer
              </CardTitle>
              <CardDescription>
                Use an existing reviewer context to inspect or work through the review queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={enterReviewerImpersonationMode} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="reviewerId">Reviewer</Label>
                  <select
                    id="reviewerId"
                    name="reviewerId"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    required
                    disabled={!reviewers.length}
                  >
                    <option value="">Choose a reviewer</option>
                    {reviewers.map((reviewer) => (
                      <option key={reviewer.id} value={reviewer.id}>
                        {displayName(reviewer)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={!reviewers.length}>
                  Enter as Selected Reviewer
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
