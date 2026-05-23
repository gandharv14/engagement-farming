import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  return (
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
  );
}
