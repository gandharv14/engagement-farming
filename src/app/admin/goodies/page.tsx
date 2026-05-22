import { Gift, PackageCheck } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  archiveGoodie,
  clearGoodieFulfillment,
  createGoodie,
  markGoodieFulfilled,
  restoreGoodie,
  updateGoodie,
} from "./actions";

export const dynamic = "force-dynamic";

type GoodieRow = {
  id: string;
  tier_label: string;
  name: string;
  description: string | null;
  image_url: string | null;
  available: boolean;
};

type InternalGoodieRow = {
  goodie_id: string;
  unit_cost_cents: number;
  vendor: string | null;
  notes: string | null;
};

type FulfillmentRow = {
  id: string;
  goodie_id: string | null;
  achieved_at: string;
  fulfilled_at: string | null;
  users?: Relation<{ display_name: string | null; email: string | null }>;
  milestones?: Relation<{ tier_label: string | null }>;
  goodies?: Relation<{ name: string | null; tier_label: string | null }>;
};

type Relation<T> = T | T[] | null | undefined;

const tierLabels = ["Tier 1", "Tier 2", "Tier 3"] as const;

function firstRelation<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function displayName(user?: { display_name: string | null; email: string | null } | null) {
  return user?.display_name ?? user?.email ?? "Tasker";
}

function TierSelect({ defaultValue, id }: { defaultValue?: string; id: string }) {
  return (
    <select id={id} name="tierLabel" defaultValue={defaultValue ?? "Tier 1"} className="h-10 rounded-md border bg-background px-3 text-sm">
      {tierLabels.map((tierLabel) => (
        <option key={tierLabel} value={tierLabel}>
          {tierLabel}
        </option>
      ))}
    </select>
  );
}

export default async function AdminGoodiesPage() {
  const user = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const [{ data: goodies }, { data: internalGoodies }, { data: fulfillments }] = supabase
    ? await Promise.all([
        supabase.from("goodies").select("*").order("tier_label").order("name"),
        supabase.from("goodies_internal").select("*"),
        supabase
          .from("milestone_achievements")
          .select("id, goodie_id, achieved_at, fulfilled_at, users(display_name, email), milestones(tier_label), goodies(name, tier_label)")
          .not("goodie_id", "is", null)
          .order("achieved_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const goodieRows = (goodies ?? []) as GoodieRow[];
  const internalRows = (internalGoodies ?? []) as InternalGoodieRow[];
  const fulfillmentRows = (fulfillments ?? []) as unknown as FulfillmentRow[];
  const internalByGoodieId = new Map(internalRows.map((item) => [item.goodie_id, item]));

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Goodies</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage the tasker catalog, private cost fields, and fulfillment status for selected milestone rewards.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Create Goodie
            </CardTitle>
            <CardDescription>Available catalog items appear on tasker Goodie pages once their tier is unlocked.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createGoodie} className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="new-tier">Tier</Label>
                <TierSelect id="new-tier" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" name="name" required placeholder="Sticker pack" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-unit-cost">Unit cost, cents</Label>
                <Input id="new-unit-cost" name="unitCostCents" type="number" min="0" defaultValue="0" required />
              </div>
              <div className="grid gap-2 lg:col-span-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea id="new-description" name="description" placeholder="Shown to taskers" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-image-url">Image URL</Label>
                <Input id="new-image-url" name="imageUrl" type="url" placeholder="https://..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-vendor">Vendor</Label>
                <Input id="new-vendor" name="vendor" placeholder="Internal only" />
              </div>
              <div className="grid gap-2 lg:col-span-2">
                <Label htmlFor="new-internal-notes">Internal notes</Label>
                <Textarea id="new-internal-notes" name="internalNotes" placeholder="Private admin context" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="available" type="checkbox" defaultChecked />
                Available in catalog
              </label>
              <Button type="submit" className="lg:col-span-3">
                Create goodie
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>Archive instead of deleting to preserve historical milestone selections.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goodieRows.length ? (
                goodieRows.map((goodie) => {
                  const internal = internalByGoodieId.get(goodie.id);

                  return (
                    <form key={goodie.id} action={updateGoodie.bind(null, goodie.id)} className="rounded-xl border p-4">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor={`tier-${goodie.id}`}>Tier</Label>
                          <TierSelect id={`tier-${goodie.id}`} defaultValue={goodie.tier_label} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`name-${goodie.id}`}>Name</Label>
                          <Input id={`name-${goodie.id}`} name="name" defaultValue={goodie.name} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`unit-cost-${goodie.id}`}>Unit cost, cents</Label>
                          <Input
                            id={`unit-cost-${goodie.id}`}
                            name="unitCostCents"
                            type="number"
                            min="0"
                            defaultValue={internal?.unit_cost_cents ?? 0}
                            required
                          />
                        </div>
                        <div className="grid gap-2 lg:col-span-2">
                          <Label htmlFor={`description-${goodie.id}`}>Description</Label>
                          <Textarea id={`description-${goodie.id}`} name="description" defaultValue={goodie.description ?? ""} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`image-url-${goodie.id}`}>Image URL</Label>
                          <Input id={`image-url-${goodie.id}`} name="imageUrl" type="url" defaultValue={goodie.image_url ?? ""} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`vendor-${goodie.id}`}>Vendor</Label>
                          <Input id={`vendor-${goodie.id}`} name="vendor" defaultValue={internal?.vendor ?? ""} />
                        </div>
                        <div className="grid gap-2 lg:col-span-2">
                          <Label htmlFor={`internal-notes-${goodie.id}`}>Internal notes</Label>
                          <Textarea id={`internal-notes-${goodie.id}`} name="internalNotes" defaultValue={internal?.notes ?? ""} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input name="available" type="checkbox" defaultChecked={goodie.available} />
                          Available in catalog
                        </label>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={goodie.available ? "default" : "secondary"}>
                            {goodie.available ? "Available" : "Archived"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{formatCurrency(internal?.unit_cost_cents ?? 0)} internal cost</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" aria-label={`Save ${goodie.name}`}>
                            Save goodie
                          </Button>
                          {goodie.available ? (
                            <Button formAction={archiveGoodie.bind(null, goodie.id)} variant="secondary" aria-label={`Archive ${goodie.name}`}>
                              Archive
                            </Button>
                          ) : (
                            <Button formAction={restoreGoodie.bind(null, goodie.id)} variant="secondary" aria-label={`Restore ${goodie.name}`}>
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </form>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No Goodies yet. Create one to populate tasker catalogs.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Fulfillment Queue
            </CardTitle>
            <CardDescription>Selected milestone Goodies appear here after taskers choose a reward.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tasker</TableHead>
                  <TableHead>Goodie</TableHead>
                  <TableHead>Selected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fulfillmentRows.length ? (
                  fulfillmentRows.map((achievement) => {
                    const selectedGoodie = firstRelation(achievement.goodies);
                    const milestone = firstRelation(achievement.milestones);

                    return (
                      <TableRow key={achievement.id}>
                        <TableCell>{displayName(firstRelation(achievement.users))}</TableCell>
                        <TableCell>
                          <div className="font-medium">{selectedGoodie?.name ?? "Goodie"}</div>
                          <div className="text-xs text-muted-foreground">{selectedGoodie?.tier_label ?? milestone?.tier_label ?? "Tier"}</div>
                        </TableCell>
                        <TableCell>{new Date(achievement.achieved_at).toLocaleString()}</TableCell>
                        <TableCell>
                          {achievement.fulfilled_at ? (
                            <Badge variant="secondary">Fulfilled {new Date(achievement.fulfilled_at).toLocaleDateString()}</Badge>
                          ) : (
                            <Badge>Needs fulfillment</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {achievement.fulfilled_at ? (
                            <form action={clearGoodieFulfillment.bind(null, achievement.id)}>
                              <Button type="submit" variant="outline" size="sm">
                                Clear
                              </Button>
                            </form>
                          ) : (
                            <form action={markGoodieFulfilled.bind(null, achievement.id)}>
                              <Button type="submit" size="sm">
                                Mark fulfilled
                              </Button>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No selected Goodies yet.
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
