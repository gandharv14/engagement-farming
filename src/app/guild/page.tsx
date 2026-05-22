import { PartyPopper, Users } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";
import { getGuildData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GuildPage() {
  const context = await requireTaskerGameContext();
  const data = await getGuildData(context.tasker.auth0_sub);

  return (
    <AppShell {...getTaskerShellProps(context)}>
      <RealtimeRefresh subscriptions={[{ table: "rows" }, { table: "guild_memberships" }]} />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Guild Room</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Guilds compete on accepted rows. The winning team celebrates together.
          </p>
        </div>
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {data.myGuild ?? "No guild assigned yet"}
              </CardTitle>
              <CardDescription>Your sprint roster</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.roster.length ? (
                data.roster.map((member) => (
                  <div key={member} className="rounded-xl border p-3 text-sm">
                    {member}
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Guild rosters appear here once admins draft teams.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5" />
                Guild Standings
              </CardTitle>
              <CardDescription>No dollar amounts, just the shared goal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.standings.map((guild) => (
                <div key={guild.name} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={guild.rank === 1 ? "default" : "secondary"}>#{guild.rank}</Badge>
                    <span className="font-medium">{guild.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{guild.accepted_rows} accepted</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
