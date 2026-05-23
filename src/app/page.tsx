import { ExternalLink, Flame, Gift, Hourglass, Target, Trophy } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";
import { formatCurrency, formatSource, getTaskerDashboard } from "@/lib/data";
import { TASK_TYPE_OPTIONS } from "@/lib/task-types";

export const dynamic = "force-dynamic";

const taskerRowStatusLabels: Record<string, string> = {
  pending_review: "Pending review",
  accepted_clean: "Passed",
  rejected: "Rejected",
};

function formatTaskerRowStatus(status: string) {
  return taskerRowStatusLabels[status] ?? formatSource(status);
}

function taskerRowStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "rejected") {
    return "destructive";
  }

  return status === "accepted_clean" ? "default" : "outline";
}

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
                accepted problems.
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
          <StatCard
            title="Pending review"
            value={data.pendingRows}
            helper={data.pendingRows ? `Potential: ${data.potentialStreak} days` : "FIFO reviewer queue"}
            icon={Hourglass}
          />
          <StatCard
            title="Current streak"
            value={`${data.currentStreak} days`}
            helper={data.pendingStreakDelta ? `+${data.pendingStreakDelta} pending` : "Accepted submissions"}
            icon={Flame}
          />
          <StatCard
            title="Milestones"
            value={`${data.milestonesUnlocked} / ${data.milestoneRoadmap.length}`}
            helper="Tier roadmap unlocked"
            icon={Gift}
          />
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
              <form
                action={submitRow}
                className="grid gap-3 rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-4 md:grid-cols-2 xl:grid-cols-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="problemId">Problem ID</Label>
                  <Input id="problemId" name="problemId" placeholder="live-compare-**" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskType">Task type</Label>
                  <Select name="taskType" required>
                    <SelectTrigger id="taskType" className="w-full bg-background/35 font-mono">
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {TASK_TYPE_OPTIONS.map((taskType) => (
                        <SelectItem key={taskType} value={taskType}>
                          {taskType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tokenCount">Token count</Label>
                  <Input id="tokenCount" name="tokenCount" type="number" min="0" placeholder="1000000" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taigaProblemUrl">Taiga problem link</Label>
                  <Input id="taigaProblemUrl" name="taigaProblemUrl" type="url" placeholder="https://taiga..." required />
                </div>
                <Button
                  className="md:col-span-2 xl:col-span-4"
                  size="lg"
                  type="submit"
                  disabled={data.submissionsToday >= data.maxDailySubmissions}
                >
                  <Target className="mr-2 h-4 w-4" />
                  {data.submissionsToday >= data.maxDailySubmissions ? "Daily limit reached" : "Record submitted row"}
                </Button>
              </form>

              {data.milestoneRoadmap.length ? (
                <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-arena-cyan">Milestone Roadmap</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        You have {data.acceptedRows.toLocaleString()} accepted rows. Each tier unlocks when you hit its threshold.
                      </p>
                    </div>
                    <Badge variant="outline">
                      {data.milestonesUnlocked} / {data.milestoneRoadmap.length} unlocked
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {data.milestoneRoadmap.map((milestone) => {
                      const statusLabel =
                        milestone.status === "unlocked" ? "Unlocked" : milestone.status === "current" ? "You are here" : "Locked";

                      return (
                        <div
                          key={milestone.tierLabel}
                          className={`rounded-2xl border p-4 ${
                            milestone.status === "current"
                              ? "border-arena-gold/40 bg-arena-gold/10"
                              : milestone.status === "unlocked"
                                ? "border-arena-cyan/25 bg-background/50"
                                : "border-border bg-background/35"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{milestone.tierLabel}</p>
                              <p className="mt-1 text-2xl font-semibold">{milestone.threshold.toLocaleString()} rows</p>
                            </div>
                            <Badge
                              variant={
                                milestone.status === "unlocked" ? "secondary" : milestone.status === "current" ? "default" : "outline"
                              }
                            >
                              {statusLabel}
                            </Badge>
                          </div>
                          <Progress value={milestone.progress} className="mt-4" />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {milestone.status === "unlocked"
                              ? "Tier unlocked."
                              : `${milestone.remainingRows.toLocaleString()} accepted rows to unlock.`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Milestone tiers are not configured yet.
                </p>
              )}

              {data.pendingRows ? (
                <div className="rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-arena-gold">Pending Upside</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Potential streak if pending rows pass:{" "}
                        <span className="font-mono font-medium text-arena-gold">{data.potentialStreak} days</span>
                      </p>
                    </div>
                    <Badge variant="outline">
                      {data.pendingStreakDelta ? `+${data.pendingStreakDelta} possible` : "Awaiting review"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {data.pendingRowSummaries.map((row) => (
                      <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/35 p-3 text-sm">
                        <div>
                          <p className="font-mono text-foreground">{row.problemId}</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted {new Date(row.submitted_at).toLocaleString()} - {row.taskType}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-arena-cyan">{row.tokenCount.toLocaleString()} tokens</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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

        <Card>
          <CardHeader>
            <CardTitle>Submitted Rows</CardTitle>
            <CardDescription>Every row you have logged, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Problem ID</TableHead>
                  <TableHead>Task type</TableHead>
                  <TableHead>Token count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Taiga problem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.submittedRowSummaries.length ? (
                  data.submittedRowSummaries.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.submitted_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-foreground">{row.problemId}</TableCell>
                      <TableCell>{row.taskType}</TableCell>
                      <TableCell>{row.tokenCount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={taskerRowStatusVariant(row.status)}>{formatTaskerRowStatus(row.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.taigaProblemUrl ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={row.taigaProblemUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              Open
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Submitted rows will appear here after you record them.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
