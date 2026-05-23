import { DollarSign, Gauge, Target, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/app/stat-card";
import { AdminCharts } from "@/components/charts/admin-charts";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, getAdminDashboard } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getAdminDashboard();
  const goalProgress = data.targetRows ? Math.min(100, Math.round((data.acceptedRows / data.targetRows) * 100)) : 0;
  const budgetProgress = data.budgetCents ? Math.min(100, Math.round((data.spendCents / data.budgetCents) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="arena-panel rounded-3xl p-5">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Admin Control</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Program Operations</h1>
        <p className="mt-2 text-sm text-muted-foreground">Admin-only economics, spend, margin, and full-labeler visibility.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Accepted rows" value={`${data.acceptedRows} / ${data.targetRows}`} helper={`${goalProgress}% of target`} icon={Target} />
        <StatCard title="Spend to date" value={formatCurrency(data.spendCents)} helper={`${budgetProgress}% of budget`} icon={DollarSign} />
        <StatCard title="Revenue" value={formatCurrency(data.revenueCents)} helper="Admin-only economics" icon={TrendingUp} />
        <StatCard title="Gross margin" value={`${data.grossMarginPercent}%`} helper="Revenue less awarded COGS" icon={Gauge} />
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="arena-panel rounded-2xl p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>Goal progress</span>
            <span className="font-mono text-arena-cyan">{goalProgress}%</span>
          </div>
          <Progress value={goalProgress} />
        </div>
        <div className="arena-panel rounded-2xl p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>Budget consumed</span>
            <span className="font-mono text-arena-gold">{budgetProgress}%</span>
          </div>
          <Progress value={budgetProgress} />
        </div>
      </section>
      <AdminCharts data={data} />
    </div>
  );
}
