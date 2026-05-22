import { Award, Flame, Rows3 } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";
import { getLeaderboards, type LeaderboardEntry } from "@/lib/data";

export const dynamic = "force-dynamic";

function LeaderboardCard({ title, entries }: { title: string; entries: LeaderboardEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Top 5 only. Earnings and ranks 6+ are never shown publicly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length ? (
          entries.map((entry) => (
            <div key={`${title}-${entry.rank}`} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <Badge variant={entry.rank === 1 ? "default" : "secondary"}>#{entry.rank}</Badge>
                <span className="font-medium">{entry.display_name}</span>
              </div>
              <span className="text-sm text-muted-foreground">{entry.metric}</span>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Be the first to light up this board.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function LeaderboardsPage() {
  const context = await requireTaskerGameContext();
  const boards = await getLeaderboards();

  return (
    <AppShell {...getTaskerShellProps(context)}>
      <RealtimeRefresh subscriptions={[{ table: "rows" }, { table: "streaks" }]} />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Public Leaderboards</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Celebrate the front of the pack without exposing private economics or bottom rankings.
          </p>
        </div>
        <Tabs defaultValue="volume">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="volume">
              <Rows3 className="mr-2 h-4 w-4" />
              Volume
            </TabsTrigger>
            <TabsTrigger value="quality">
              <Award className="mr-2 h-4 w-4" />
              Quality
            </TabsTrigger>
            <TabsTrigger value="consistency">
              <Flame className="mr-2 h-4 w-4" />
              Consistency
            </TabsTrigger>
          </TabsList>
          <TabsContent value="volume">
            <LeaderboardCard title="Volume" entries={boards.volume} />
          </TabsContent>
          <TabsContent value="quality">
            <LeaderboardCard title="Quality" entries={boards.quality} />
          </TabsContent>
          <TabsContent value="consistency">
            <LeaderboardCard title="Consistency" entries={boards.consistency} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
