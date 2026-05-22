import { updateEconomics } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHelpLabel } from "@/components/ui/field-help-label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminEconomicsPage() {
  const user = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const [{ data: economics }, { data: internalGoodies }] = supabase
    ? await Promise.all([
        supabase.from("program_economics").select("*").eq("id", 1).maybeSingle(),
        supabase.from("goodies_internal").select("unit_cost_cents, vendor, notes, goodies(name, tier_label)"),
      ])
    : [{ data: null }, { data: [] }];
  const econ = (economics ?? {}) as { budget_cents?: number; revenue_cents?: number; notes?: string };

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Program Economics</CardTitle>
            <CardDescription>Admin-only budget and revenue controls.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateEconomics} className="grid gap-4 md:max-w-xl">
              <div className="grid gap-2">
                <FieldHelpLabel
                  htmlFor="budgetCents"
                  label="Budget, cents"
                  definition="Total internal budget for this sprint, entered in cents. This feeds admin-only economics reporting and budget tracking."
                />
                <Input id="budgetCents" name="budgetCents" type="number" min="0" defaultValue={econ.budget_cents ?? 0} />
              </div>
              <div className="grid gap-2">
                <FieldHelpLabel
                  htmlFor="revenueCents"
                  label="Revenue, cents"
                  definition="Total program revenue, entered in cents. Gross margin is calculated from this value minus accepted earning spend."
                />
                <Input id="revenueCents" name="revenueCents" type="number" min="0" defaultValue={econ.revenue_cents ?? 0} />
              </div>
              <div className="grid gap-2">
                <FieldHelpLabel
                  htmlFor="notes"
                  label="Notes"
                  definition="Private admin context for assumptions, vendor details, or economics decisions. These notes are saved with program economics."
                />
                <Textarea id="notes" name="notes" defaultValue={econ.notes ?? ""} />
              </div>
              <Button type="submit">Save economics</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Goodie Internal Costs</CardTitle>
            <CardDescription>Never readable by taskers or reviewers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((internalGoodies ?? []) as { unit_cost_cents: number; vendor: string | null; goodies?: { name?: string; tier_label?: string } }[]).map(
                  (item) => (
                    <TableRow key={`${item.goodies?.name}-${item.vendor}`}>
                      <TableCell>{item.goodies?.name ?? "Goodie"}</TableCell>
                      <TableCell>{item.goodies?.tier_label ?? "Tier"}</TableCell>
                      <TableCell>{item.vendor ?? "Not set"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_cost_cents)}</TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
