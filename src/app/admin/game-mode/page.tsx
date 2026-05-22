import Link from "next/link";
import { Gamepad2, UserRoundSearch } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth";
import { getAdminGameModeStatus, getTaskerOptionsForAdmin } from "@/lib/admin-game-mode";
import { getMyUserRow } from "@/lib/data";
import { enterOwnAdminGameMode, enterTaskerImpersonationMode, exitAdminGameMode } from "./actions";

export const dynamic = "force-dynamic";

function displayName(user: { display_name: string | null; email: string | null }) {
  return user.display_name ?? user.email ?? "Tasker";
}

export default async function AdminGameModePage() {
  const user = await requireRole("admin");
  const admin = await getMyUserRow(user.sub);
  const [status, taskers] = admin
    ? await Promise.all([getAdminGameModeStatus(admin), getTaskerOptionsForAdmin()])
    : [null, []];

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin Game Mode</h1>
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
              <div className="rounded-xl border p-4 text-sm">
                <p className="font-medium">{displayName(status.target)}</p>
                <p className="mt-1 text-muted-foreground">
                  {status.mode === "own" ? "Your admin-owned game profile" : "Existing tasker impersonation"}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No game mode target is active. Choose a mode below to enter the game.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {status ? (
                <Button asChild>
                  <Link href="/">Open Game Dashboard</Link>
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

        <section className="grid gap-4 lg:grid-cols-2">
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
        </section>
      </div>
    </AppShell>
  );
}
