import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase";
import { promoteTaskerToReviewer } from "../role-actions";

export const dynamic = "force-dynamic";

export default async function AdminTaskersPage() {
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

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Roster Intel</p>
        <CardTitle>Taskers</CardTitle>
        <CardDescription>Admin-only per-tasker cost and acceptance visibility.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tasker</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Acceptance rate</TableHead>
              <TableHead>Streak</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
              <TableHead className="text-right">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {((users ?? []) as { id: string; auth0_sub: string; display_name: string | null; email: string | null }[]).map((tasker) => {
              const taskerRows = rowList.filter((row) => row.tasker_id === tasker.id);
              const accepted = taskerRows.filter((row) => row.status === "accepted_clean").length;
              const cost = earningList
                .filter((earning) => earning.user_id === tasker.id)
                .reduce((sum, earning) => sum + earning.amount_cents, 0);
              const streak = streakList.find((item) => item.user_id === tasker.id)?.current_streak_days ?? 0;
              const isAdminGameProfile = tasker.auth0_sub.startsWith("admin-game|");

              return (
                <TableRow key={tasker.id}>
                  <TableCell>{tasker.display_name ?? tasker.email ?? "Tasker"}</TableCell>
                  <TableCell>{taskerRows.length}</TableCell>
                  <TableCell>{taskerRows.length ? `${Math.round((accepted / taskerRows.length) * 100)}%` : "0%"}</TableCell>
                  <TableCell>{streak} days</TableCell>
                  <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                  <TableCell className="text-right">
                    <form action={promoteTaskerToReviewer.bind(null, tasker.id)}>
                      <Button type="submit" size="sm" variant="secondary" disabled={isAdminGameProfile}>
                        Promote to Reviewer
                      </Button>
                    </form>
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
