import { notFound } from "next/navigation";

import { reviewRow } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getReviewerShellProps, requireReviewerGameContext } from "@/lib/admin-game-mode";
import { getReviewDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ rowId: string }> }) {
  const context = await requireReviewerGameContext();
  const { rowId } = await params;
  const row = await getReviewDetail(rowId);

  if (!row) {
    notFound();
  }

  const problemId = String(row.metadata.problem_id ?? row.metadata.external_row_id ?? "Not set");
  const taigaProblemUrl =
    typeof row.metadata.taiga_problem_url === "string" && row.metadata.taiga_problem_url ? row.metadata.taiga_problem_url : null;
  const potentialDelta = Math.max(0, row.tasker_potential_streak_days - row.tasker_current_streak_days);

  return (
    <AppShell {...getReviewerShellProps(context)}>
      <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Score Check</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review Row</h1>
          <p className="mt-2 text-sm text-muted-foreground">Score the row. Bonus logic runs in Postgres on status change.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Submission Metadata</CardTitle>
            <CardDescription>{row.id}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Tasker</p>
              <p className="font-mono text-sm">{row.tasker_display_name}</p>
            </div>
            <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="font-mono text-sm">{new Date(row.submitted_at).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-3">
              <p className="text-xs text-muted-foreground">Potential streak if accepted</p>
              <p className="font-mono text-sm text-arena-gold">
                {row.tasker_potential_streak_days} days{potentialDelta ? ` (+${potentialDelta})` : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Problem ID</p>
              <p className="font-mono text-sm">{problemId}</p>
            </div>
            <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Task type</p>
              <p className="font-mono text-sm">{String(row.metadata.task_type ?? "long-horizon")}</p>
            </div>
            <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Token count</p>
              <p className="font-mono text-sm text-arena-cyan">{Number(row.metadata.token_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3">
              <p className="text-xs text-muted-foreground">Taiga problem</p>
              {taigaProblemUrl ? (
                <a className="font-mono text-sm text-arena-cyan underline-offset-4 hover:underline" href={taigaProblemUrl}>
                  Open link
                </a>
              ) : (
                <p className="font-mono text-sm">Not set</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
            <CardDescription>Notes are reviewer/admin only. Do not include economic or strategic commentary.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={reviewRow.bind(null, row.id)} className="space-y-4">
              <div className="grid gap-2 md:max-w-xs">
                <Label htmlFor="score">Reviewer score</Label>
                <Input id="score" name="score" type="number" min="1" max="5" defaultValue="5" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Optional notes</Label>
                <Textarea id="notes" name="notes" placeholder="Review notes for reviewers/admins only" />
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Button type="submit" name="status" value="accepted_clean">
                  Clean Pass
                </Button>
                <Button type="submit" name="status" value="accepted_with_edits" variant="secondary">
                  Accept with Edits
                </Button>
                <Button type="submit" name="status" value="rejected" variant="destructive">
                  Reject
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
