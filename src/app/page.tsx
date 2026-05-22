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
        <section className="arena-panel relative overflow-hidden rounded-3xl p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-arena-cyan via-arena-blue to-arena-pink" />
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
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Live Token Sprint</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">Keep your streak online.</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Queue a clean row, defend your cadence, and push the arena toward{" "}
                <span className="font-mono text-arena-gold">{data.config.collective_goal_rows.toLocaleString()}</span>{" "}
                accepted long-horizon rows.
              </p>
            </div>
            <div className="arena-glow rounded-3xl border border-arena-gold/30 bg-arena-gold/10 p-5 text-center">
              <Flame className="mx-auto h-8 w-8 text-arena-gold" />
              <p className="arena-metric mt-2 text-5xl font-semibold text-arena-gold">{data.currentStreak}</p>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">day streak</p>
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
                {data.submissionsToday >= data.maxDailySubmissions
                  ? `Daily submission limit reached (${data.maxDailySubmissions} problems).`
                  : data.submittedToday
                    ? `${data.submissionsToday} of ${data.maxDailySubmissions} submissions logged today.`
                    : `No submission yet today. You can submit up to ${data.maxDailySubmissions} problems per day.`}
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

              <form action={submitRow} className="grid gap-3 rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-4 md:grid-cols-3">
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
                <Button
                  className="md:col-span-3"
                  size="lg"
                  type="submit"
                  disabled={data.submissionsToday >= data.maxDailySubmissions}
                >
                  <Target className="mr-2 h-4 w-4" />
                  {data.submissionsToday >= data.maxDailySubmissions ? "Daily limit reached" : "Record submitted row"}
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
              <p className="arena-metric text-4xl font-semibold text-arena-gold">{formatCurrency(data.totalEarnedCents)}</p>
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
