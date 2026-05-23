import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";
import { demoteReviewerToTasker } from "../role-actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewersPage() {
  const user = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const [{ data: reviewers }, { data: rows }] = supabase
    ? await Promise.all([
        supabase.from("users").select("id, display_name, email").eq("role", "reviewer"),
        supabase.from("rows").select("reviewer_id, status").not("reviewer_id", "is", null),
      ])
    : [{ data: [] }, { data: [] }];

  const reviewedRows = (rows ?? []) as { reviewer_id: string; status: string }[];

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Review Squad</p>
          <CardTitle>Reviewers</CardTitle>
          <CardDescription>Throughput and pass rate for review operations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewer</TableHead>
                <TableHead>Reviewed rows</TableHead>
                <TableHead>Pass rate</TableHead>
                <TableHead className="text-right">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((reviewers ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((reviewer) => {
                const reviewerRows = reviewedRows.filter((row) => row.reviewer_id === reviewer.id);
                const clean = reviewerRows.filter((row) => row.status === "accepted_clean").length;

                return (
                  <TableRow key={reviewer.id}>
                    <TableCell>{reviewer.display_name ?? reviewer.email ?? "Reviewer"}</TableCell>
                    <TableCell>{reviewerRows.length}</TableCell>
                    <TableCell>{reviewerRows.length ? `${Math.round((clean / reviewerRows.length) * 100)}%` : "0%"}</TableCell>
                    <TableCell className="text-right">
                      <form action={demoteReviewerToTasker.bind(null, reviewer.id)}>
                        <Button type="submit" size="sm" variant="secondary">
                          Demote to Tasker
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
    </AppShell>
  );
}
