import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminReviewersPage() {
  const user = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const [{ data: reviewers }, { data: rows }] = supabase
    ? await Promise.all([
        supabase.from("users").select("id, display_name, email").eq("role", "reviewer"),
        supabase.from("rows").select("reviewer_id, status, review_score").not("reviewer_id", "is", null),
      ])
    : [{ data: [] }, { data: [] }];

  const reviewedRows = (rows ?? []) as { reviewer_id: string; status: string; review_score: number | null }[];

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <Card>
        <CardHeader>
          <CardTitle>Reviewers</CardTitle>
          <CardDescription>Throughput and score spread for review operations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewer</TableHead>
                <TableHead>Reviewed rows</TableHead>
                <TableHead>Clean pass rate</TableHead>
                <TableHead>Avg score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((reviewers ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((reviewer) => {
                const reviewerRows = reviewedRows.filter((row) => row.reviewer_id === reviewer.id);
                const clean = reviewerRows.filter((row) => row.status === "accepted_clean").length;
                const scores = reviewerRows.map((row) => row.review_score).filter((score): score is number => score !== null);
                const avgScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

                return (
                  <TableRow key={reviewer.id}>
                    <TableCell>{reviewer.display_name ?? reviewer.email ?? "Reviewer"}</TableCell>
                    <TableCell>{reviewerRows.length}</TableCell>
                    <TableCell>{reviewerRows.length ? `${Math.round((clean / reviewerRows.length) * 100)}%` : "0%"}</TableCell>
                    <TableCell>{avgScore.toFixed(2)}</TableCell>
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
