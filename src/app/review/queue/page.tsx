import { ArrowRight, CheckCircle2, Clock, ListChecks, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";

import { reserveReviewRow } from "@/app/actions";
import { ReviseDecisionForm } from "@/app/review/queue/revise-decision-form";
import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReviewerShellProps, requireReviewerGameContext } from "@/lib/admin-game-mode";
import { getReviewerDashboard, type ReviewerDashboardRow } from "@/lib/data";

export const dynamic = "force-dynamic";

function problemId(row: ReviewerDashboardRow) {
  return String(row.metadata.problem_id ?? row.metadata.external_row_id ?? row.id);
}

function taskType(row: ReviewerDashboardRow) {
  return String(row.metadata.task_type ?? "long-horizon");
}

function tokenCount(row: ReviewerDashboardRow) {
  return Number(row.metadata.token_count ?? 0).toLocaleString();
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function OutcomeBadge({ status }: { status: string }) {
  if (status === "accepted_clean") {
    return (
      <Badge variant="default">
        <CheckCircle2 className="h-3 w-3" />
        Passed
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

function AvailableRowsTable({ rows }: { rows: ReviewerDashboardRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tasker</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Problem ID</TableHead>
          <TableHead>Task type</TableHead>
          <TableHead>Token count</TableHead>
          <TableHead>Streak if accepted</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{row.tasker_display_name}</p>
                  <p className="font-mono text-xs">{row.tasker_current_streak_days} days now</p>
                </div>
              </TableCell>
              <TableCell>{formatDateTime(row.submitted_at)}</TableCell>
              <TableCell>{problemId(row)}</TableCell>
              <TableCell>{taskType(row)}</TableCell>
              <TableCell>{tokenCount(row)}</TableCell>
              <TableCell>
                <span className="font-mono text-arena-gold">{row.tasker_potential_streak_days} days</span>
              </TableCell>
              <TableCell className="text-right">
                <form action={reserveReviewRow.bind(null, row.id)}>
                  <Button type="submit" size="sm">
                    Reserve
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyTableRow colSpan={7} message="No unreserved tasks are waiting right now." />
        )}
      </TableBody>
    </Table>
  );
}

function ReservedRowsTable({ rows, reviewerId }: { rows: ReviewerDashboardRow[]; reviewerId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tasker</TableHead>
          <TableHead>Problem ID</TableHead>
          <TableHead>Reserved by</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Streak if accepted</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => {
            const isMine = row.reserved_by === reviewerId;

            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{row.tasker_display_name}</p>
                    <p className="font-mono text-xs">{row.tasker_current_streak_days} days now</p>
                  </div>
                </TableCell>
                <TableCell>{problemId(row)}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{row.reserved_by_display_name ?? "Reviewer"}</p>
                    {isMine ? <p className="font-mono text-xs text-arena-cyan">Your reservation</p> : null}
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(row.reserved_until)}</TableCell>
                <TableCell>
                  <span className="font-mono text-arena-gold">{row.tasker_potential_streak_days} days</span>
                </TableCell>
                <TableCell className="text-right">
                  {isMine ? (
                    <form action={reserveReviewRow.bind(null, row.id)}>
                      <Button type="submit" size="sm">
                        Resume
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <Badge variant="secondary">In progress</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <EmptyTableRow colSpan={6} message="No tasks are actively reserved by reviewers." />
        )}
      </TableBody>
    </Table>
  );
}

function ReviewedRowsTable({ rows }: { rows: ReviewerDashboardRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tasker</TableHead>
          <TableHead>Reviewed</TableHead>
          <TableHead>Problem ID</TableHead>
          <TableHead>Task type</TableHead>
          <TableHead>Token count</TableHead>
          <TableHead>Reviewer</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead className="text-right">Revise</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium text-foreground">{row.tasker_display_name}</p>
              </TableCell>
              <TableCell>{formatDateTime(row.reviewed_at)}</TableCell>
              <TableCell>{problemId(row)}</TableCell>
              <TableCell>{taskType(row)}</TableCell>
              <TableCell>{tokenCount(row)}</TableCell>
              <TableCell>{row.reviewer_display_name ?? "Reviewer"}</TableCell>
              <TableCell>
                <OutcomeBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <ReviseDecisionForm rowId={row.id} currentStatus={row.status} />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyTableRow colSpan={8} message="No reviewed tasks yet." />
        )}
      </TableBody>
    </Table>
  );
}

export default async function ReviewQueuePage() {
  const context = await requireReviewerGameContext();
  const dashboard = await getReviewerDashboard();

  return (
    <AppShell {...getReviewerShellProps(context)}>
      <RealtimeRefresh subscriptions={[{ table: "rows" }, { table: "streaks" }]} pollIntervalMs={10_000} />
      <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Moderator Console</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Reviewer Dashboard</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Reserve new work, resume your active reviews, and audit completed decisions in one place. Holds expire after 5 minutes.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/review/queue">Refresh dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Available" value={dashboard.availableRows.length} />
          <MetricCard label="Reserved" value={dashboard.reservedRows.length} />
          <MetricCard label="Reviewed" value={dashboard.reviewedRows.length} />
        </div>

        <Tabs defaultValue="available">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Available
            </TabsTrigger>
            <TabsTrigger value="reserved">
              <Clock className="mr-2 h-4 w-4" />
              Reserved
            </TabsTrigger>
            <TabsTrigger value="reviewed">
              <ListChecks className="mr-2 h-4 w-4" />
              Reviewed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <Card>
              <CardHeader>
                <CardTitle>Available Tasks</CardTitle>
                <CardDescription>Unreserved pending tasks. Reserve one to start reviewing.</CardDescription>
              </CardHeader>
              <CardContent>
                <AvailableRowsTable rows={dashboard.availableRows} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reserved">
            <Card>
              <CardHeader>
                <CardTitle>Reserved Tasks</CardTitle>
                <CardDescription>Active holds across the review team. You can resume only your own reservations.</CardDescription>
              </CardHeader>
              <CardContent>
                <ReservedRowsTable rows={dashboard.reservedRows} reviewerId={context.reviewer.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviewed">
            <Card>
              <CardHeader>
                <CardTitle>Reviewed Tasks</CardTitle>
                <CardDescription>Completed pass/fail decisions across reviewers. Flip an outcome to revise a decision.</CardDescription>
              </CardHeader>
              <CardContent>
                <ReviewedRowsTable rows={dashboard.reviewedRows} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
