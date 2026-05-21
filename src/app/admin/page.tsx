import { DollarSign, Gauge, Target, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { StatCard } from "@/components/app/stat-card";
import { AdminCharts } from "@/components/charts/admin-charts";
import { Progress } from "@/components/ui/progress";
import { requireRole } from "@/lib/auth";
import { formatCurrency, getAdminDashboard } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole("admin");
  const data = await getAdminDashboard();
  const goalProgress = data.targetRows ? Math.min(100, Math.round((data.acceptedRows / data.targetRows) * 100)) : 0;
  const budgetProgress = data.budgetCents ? Math.min(100, Math.round((data.spendCents / data.budgetCents) * 100)) : 0;

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Program Operations</h1>
          <p className="mt-2 text-sm text-muted-foreground">Admin-only economics, spend, margin, and full-labeler visibility.</p>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Accepted rows" value={`${data.acceptedRows} / ${data.targetRows}`} helper={`${goalProgress}% of target`} icon={Target} />
          <StatCard title="Spend to date" value={formatCurrency(data.spendCents)} helper={`${budgetProgress}% of budget`} icon={DollarSign} />
          <StatCard title="Revenue" value={formatCurrency(data.revenueCents)} helper="Admin-only economics" icon={TrendingUp} />
          <StatCard title="Gross margin" value={`${data.grossMarginPercent}%`} helper="Revenue less awarded COGS" icon={Gauge} />
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>Goal progress</span>
              <span>{goalProgress}%</span>
            </div>
            <Progress value={goalProgress} />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span>Budget consumed</span>
              <span>{budgetProgress}%</span>
            </div>
            <Progress value={budgetProgress} />
          </div>
        </section>
        <AdminCharts data={data} />
      </div>
    </AppShell>
  );
}
