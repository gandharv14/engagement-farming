import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminGuildsPage() {
  const user = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const [{ data: guilds }, { data: memberships }] = supabase
    ? await Promise.all([
        supabase.from("guilds").select("*").order("name"),
        supabase.from("guild_memberships").select("guild_id, users(display_name, email)"),
      ])
    : [{ data: [] }, { data: [] }];
  const membershipRows = (memberships ?? []) as { guild_id: string; users?: { display_name?: string; email?: string } }[];

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <Card>
        <CardHeader>
          <CardTitle>Guilds</CardTitle>
          <CardDescription>Create and reassign guilds from Supabase or add admin actions here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guild</TableHead>
                <TableHead>Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((guilds ?? []) as { id: string; name: string }[]).map((guild) => (
                <TableRow key={guild.id}>
                  <TableCell>{guild.name}</TableCell>
                  <TableCell>
                    {membershipRows
                      .filter((membership) => membership.guild_id === guild.id)
                      .map((membership) => membership.users?.display_name ?? membership.users?.email ?? "Tasker")
                      .join(", ") || "No members yet"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
