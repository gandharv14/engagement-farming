import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase";
import { promoteTaskerToReviewer, removeTasker } from "../role-actions";

export const dynamic = "force-dynamic";

type AdminTaskersSearchParams = {
  sort?: string;
};

type Tasker = {
  id: string;
  auth0_sub: string;
  display_name: string | null;
  email: string | null;
};

export default async function AdminTaskersPage({ searchParams }: { searchParams?: Promise<AdminTaskersSearchParams> }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const isSortedByPendingTasks = resolvedSearchParams.sort === "pending-tasks";
  const supabase = await createSupabaseServerClient();
  const [{ data: users }, { data: rows }, { data: earnings }, { data: streaks }] = supabase
    ? await Promise.all([
        supabase.from("users").select("id, auth0_sub, display_name, email").eq("role", "tasker"),
        supabase.from("rows").select("tasker_id, status"),
        supabase.from("earnings").select("user_id, amount_cents"),
        supabase.from("streaks").select("user_id, current_streak_days"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const rowList = (rows ?? []) as { tasker_id: string; status: string }[];
  const earningList = (earnings ?? []) as { user_id: string; amount_cents: number }[];
  const streakList = (streaks ?? []) as { user_id: string; current_streak_days: number }[];
  const taskers = ((users ?? []) as Tasker[]).map((tasker) => {
    const taskerRows = rowList.filter((row) => row.tasker_id === tasker.id);
    const pendingRows = taskerRows.filter((row) => row.status === "pending_review").length;
    const reviewedRows = taskerRows.filter((row) => row.status === "accepted_clean" || row.status === "rejected");
    const accepted = taskerRows.filter((row) => row.status === "accepted_clean").length;
    const cost = earningList
      .filter((earning) => earning.user_id === tasker.id)
      .reduce((sum, earning) => sum + earning.amount_cents, 0);
    const streak = streakList.find((item) => item.user_id === tasker.id)?.current_streak_days ?? 0;
    const taskerName = tasker.display_name ?? tasker.email ?? "Tasker";

    return {
      ...tasker,
      accepted,
      cost,
      pendingRows,
      reviewedRows,
      streak,
      taskerName,
      taskerRows,
    };
  });
  const displayedTaskers = isSortedByPendingTasks
    ? [...taskers].sort((a, b) => b.pendingRows - a.pendingRows || a.taskerName.localeCompare(b.taskerName))
    : taskers;

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Roster Intel</p>
        <CardTitle>Taskers</CardTitle>
        <CardDescription>Admin-only per-tasker cost and acceptance visibility.</CardDescription>
        <CardAction>
          <Button asChild size="sm" variant={isSortedByPendingTasks ? "outline" : "secondary"}>
            <Link href={isSortedByPendingTasks ? "/admin/taskers" : "/admin/taskers?sort=pending-tasks"}>
              {isSortedByPendingTasks ? "Clear pending sort" : "Sort by pending tasks"}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tasker</TableHead>
              <TableHead>Pending review</TableHead>
              <TableHead>Total submitted</TableHead>
              <TableHead>Acceptance rate</TableHead>
              <TableHead>Streak</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedTaskers.map((tasker) => {
              const isAdminGameProfile = tasker.auth0_sub.startsWith("admin-game|");

              return (
                <TableRow key={tasker.id}>
                  <TableCell>{tasker.taskerName}</TableCell>
                  <TableCell>{tasker.pendingRows}</TableCell>
                  <TableCell>{tasker.taskerRows.length}</TableCell>
                  <TableCell>
                    {tasker.reviewedRows.length
                      ? `${Math.round((tasker.accepted / tasker.reviewedRows.length) * 100)}%`
                      : "0%"}
                  </TableCell>
                  <TableCell>{tasker.streak} days</TableCell>
                  <TableCell className="text-right">{formatCurrency(tasker.cost)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={promoteTaskerToReviewer.bind(null, tasker.id)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="secondary"
                          disabled={isAdminGameProfile}
                          aria-label={`Promote ${tasker.taskerName} to Reviewer`}
                        >
                          Promote to Reviewer
                        </Button>
                      </form>
                      <form action={removeTasker.bind(null, tasker.id)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          disabled={isAdminGameProfile}
                          aria-label={`Remove ${tasker.taskerName}`}
                        >
                          Remove
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
