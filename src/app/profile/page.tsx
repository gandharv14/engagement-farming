import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppUserDisplayName, getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const context = await requireTaskerGameContext();

  return (
    <AppShell {...getTaskerShellProps(context)}>
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Player Identity</p>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {context.isAdminGameMode ? "Active tasker target for admin game mode." : "Account information from Auth0."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
            <span className="text-muted-foreground">Name</span>
            <span className="font-mono">{getAppUserDisplayName(context.tasker, "Not set")}</span>
          </div>
          <div className="flex justify-between rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono">{context.tasker.email ?? "Not set"}</span>
          </div>
          <div className="flex justify-between rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
            <span className="text-muted-foreground">Role</span>
            <span className="font-mono capitalize text-arena-cyan">{context.tasker.role}</span>
          </div>
          {context.isAdminGameMode ? (
            <div className="flex justify-between rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-3">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="font-mono">{context.sessionUser.name ?? context.sessionUser.email ?? "Admin"}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
