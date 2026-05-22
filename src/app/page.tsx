import { Flame, Gift, Hourglass, Target, Trophy } from "lucide-react";

import { submitRow } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";
import { formatCurrency, formatSource, getTaskerDashboard } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await requireTaskerGameContext();
  const data = await getTaskerDashboard(context.tasker.auth0_sub);

  return (
    <AppShell {...getTaskerShellProps(context)}>
      <RealtimeRefresh subscriptions={[{ table: "rows" }, { table: "earnings" }, { table: "streaks" }]} />
      <div className="space-y-6">
        <section className="rounded-3xl border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge>
                  Day {data.config.current_sprint_day} of {data.config.total_sprint_days}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {data.config.current_phase}
                </Badge>
                <Badge variant="outline">{data.config.quality_multiplier}x quality multiplier</Badge>
                {data.config.endgame_bounty_active ? <Badge variant="destructive">Finale bounty active</Badge> : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Keep your streak warm.</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Long-horizon rows take time. Today counts if you get a submission in, and accepted work keeps the sprint
                moving toward {data.config.collective_goal_rows.toLocaleString()} rows.
              </p>
            </div>
            <div className="rounded-2xl bg-muted p-4 text-center">
              <Flame className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-3xl font-semibold">{data.currentStreak}</p>
              <p className="text-xs text-muted-foreground">day streak</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Accepted rows" value={data.acceptedRows} helper="Clean + accepted with edits" icon={Trophy} />
          <StatCard title="Pending review" value={data.pendingRows} helper="FIFO reviewer queue" icon={Hourglass} />
          <StatCard title="Current streak" value={`${data.currentStreak} days`} helper="Today matters" icon={Flame} />
          <StatCard title="Milestones" value={`${data.milestonesUnlocked} / 3`} helper="Goodie tiers unlocked" icon={Gift} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Status</CardTitle>
              <CardDescription>
                {data.submittedToday
                  ? "You have a submission logged today."
                  : "No submission yet today. One row keeps your cadence visible."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.nextMilestone ? (
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>
                      Next milestone: {data.nextMilestone.tierLabel} at {data.nextMilestone.threshold} rows
                    </span>
                    <span>{data.nextMilestone.progress}%</span>
                  </div>
                  <Progress value={data.nextMilestone.progress} />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  All configured milestones are unlocked. Nice sprint.
                </p>
              )}

              <form action={submitRow} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="externalRowId">External row ID</Label>
                  <Input id="externalRowId" name="externalRowId" placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskType">Task type</Label>
                  <Input id="taskType" name="taskType" defaultValue="long-horizon" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tokenCount">Token count</Label>
                  <Input id="tokenCount" name="tokenCount" type="number" min="0" placeholder="1000000" />
                </div>
                <Button className="md:col-span-3" type="submit">
                  <Target className="mr-2 h-4 w-4" />
                  Record submitted row
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personal Earnings</CardTitle>
              <CardDescription>Only your own ledger is visible.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCurrency(data.totalEarnedCents)}</p>
              <div className="mt-4 space-y-2">
                {Object.entries(data.sourceBreakdown).length ? (
                  Object.entries(data.sourceBreakdown).map(([source, cents]) => (
                    <div key={source} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{formatSource(source)}</span>
                      <span>{formatCurrency(cents)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Earnings appear here as accepted rows and bonuses land.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
