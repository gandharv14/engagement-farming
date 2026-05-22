import Link from "next/link";
import { Filter, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getReviewQueue } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const user = await requireRole("reviewer");
  const rows = await getReviewQueue();

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Reviewer"}>
      <RealtimeRefresh subscriptions={[{ table: "rows", filter: "status=eq.pending_review" }]} />
      <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Moderator Console</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review Queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">FIFO pending rows. Reviewer notes stay off tasker surfaces.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Awaiting Review
            </CardTitle>
            <CardDescription>Use the task type filter to narrow the queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:max-w-xs">
              <Label htmlFor="taskTypeFilter" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Task type filter
              </Label>
              <Input id="taskTypeFilter" placeholder="Filter is ready for client-side enhancement" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Task type</TableHead>
                  <TableHead>Token count</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.submitted_at).toLocaleString()}</TableCell>
                      <TableCell>{String(row.metadata.task_type ?? "long-horizon")}</TableCell>
                      <TableCell>{Number(row.metadata.token_count ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm">
                          <Link href={`/review/${row.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Queue is clear. New submissions will land here automatically.
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
