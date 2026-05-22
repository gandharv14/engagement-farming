import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";
import { formatCurrency, formatSource, getEarnings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const context = await requireTaskerGameContext();
  const data = await getEarnings(context.tasker.auth0_sub);

  return (
    <AppShell {...getTaskerShellProps(context)}>
      <RealtimeRefresh subscriptions={[{ table: "earnings" }]} />
      <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-gold">Private Score</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your Earnings Ledger</h1>
          <p className="mt-2 text-sm text-muted-foreground">No comparisons, percentiles, or other taskers&apos; payouts.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="arena-metric text-4xl text-arena-gold">{formatCurrency(data.totalCents)}</CardTitle>
            <CardDescription>Total awarded to you</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.earnings.length ? (
                  data.earnings.map((earning) => (
                    <TableRow key={earning.id}>
                      <TableCell>{new Date(earning.awarded_at).toLocaleDateString()}</TableCell>
                      <TableCell>{formatSource(earning.source)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(earning.amount_cents)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Earnings appear here after accepted work and bonuses land.
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
