import { Download } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const user = await requireRole("admin");

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-gold">Finance Drop</p>
          <CardTitle>Payout Export</CardTitle>
          <CardDescription>CSV grouped by user for finance. Admin-only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/admin/payouts/export">
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </a>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
