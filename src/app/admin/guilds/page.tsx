import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createSupabaseServerClient } from "@/lib/supabase";
import { assignGuildMember, autoAssignGuildMembers, createGuild, deleteGuild, removeGuildMember, renameGuild } from "./actions";

export const dynamic = "force-dynamic";

type GuildRow = {
  id: string;
  name: string;
};

type TaskerRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type MembershipRow = {
  user_id: string;
  guild_id: string;
  users?: TaskerRow | TaskerRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function displayName(user?: Pick<TaskerRow, "display_name" | "email"> | null) {
  return user?.display_name ?? user?.email ?? "Tasker";
}

export default async function AdminGuildsPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: guilds }, { data: memberships }, { data: taskers }] = supabase
    ? await Promise.all([
        supabase.from("guilds").select("*").order("name"),
        supabase.from("guild_memberships").select("user_id, guild_id, users(id, display_name, email)").order("guild_id"),
        supabase.from("users").select("id, display_name, email").eq("role", "tasker").order("display_name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const guildRows = (guilds ?? []) as GuildRow[];
  const membershipRows = (memberships ?? []) as unknown as MembershipRow[];
  const taskerRows = (taskers ?? []) as TaskerRow[];
  const assignedTaskerIds = new Set(membershipRows.map((membership) => membership.user_id));
  const unassignedTaskerCount = taskerRows.filter((tasker) => !assignedTaskerIds.has(tasker.id)).length;

  return (
    <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-purple">Team Builder</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Guilds</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create teams, reassign taskers, and keep the tasker-facing Guild page current.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Create Guild</CardTitle>
              <CardDescription>Guild names are visible to all roles.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createGuild} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Guild name</Label>
                  <Input id="name" name="name" placeholder="Night Owls" required />
                </div>
                <Button type="submit" className="w-full">
                  Create guild
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Assign Tasker</CardTitle>
              <CardDescription>Assigning a tasker moves them out of any previous guild.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={assignGuildMember} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="userId">Tasker</Label>
                  <select
                    id="userId"
                    name="userId"
                    className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                    required
                    disabled={!taskerRows.length}
                  >
                    <option value="">Choose a tasker</option>
                    {taskerRows.map((tasker) => (
                      <option key={tasker.id} value={tasker.id}>
                        {displayName(tasker)}
                        {assignedTaskerIds.has(tasker.id) ? " (assigned)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="guildId">Guild</Label>
                  <select
                    id="guildId"
                    name="guildId"
                    className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                    required
                    disabled={!guildRows.length}
                  >
                    <option value="">Choose a guild</option>
                    {guildRows.map((guild) => (
                      <option key={guild.id} value={guild.id}>
                        {guild.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full md:w-auto" disabled={!guildRows.length || !taskerRows.length}>
                  Assign
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0 lg:col-span-2">
            <CardHeader>
              <CardTitle>Auto Assign</CardTitle>
              <CardDescription>Assign only taskers without a guild, filling the smallest guilds first.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={autoAssignGuildMembers} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {unassignedTaskerCount
                    ? `${unassignedTaskerCount} unassigned tasker${unassignedTaskerCount === 1 ? "" : "s"} ready to place.`
                    : "All taskers are assigned to a guild."}
                </p>
                <Button type="submit" className="w-full sm:w-auto" disabled={!guildRows.length || !unassignedTaskerCount}>
                  Auto assign unassigned taskers
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Guild Roster</CardTitle>
            <CardDescription>Rename guilds, remove members, or delete empty teams.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guild</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guildRows.length ? (
                  guildRows.map((guild) => {
                    const guildMemberships = membershipRows.filter((membership) => membership.guild_id === guild.id);

                    return (
                      <TableRow key={guild.id}>
                        <TableCell className="min-w-64 align-top">
                          <form action={renameGuild.bind(null, guild.id)} className="flex gap-2">
                            <Input aria-label={`Name for ${guild.name}`} name="name" defaultValue={guild.name} required />
                            <Button type="submit" variant="secondary" size="sm" aria-label={`Save ${guild.name}`}>
                              Save
                            </Button>
                          </form>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-2">
                            {guildMemberships.length ? (
                              guildMemberships.map((membership) => (
                                <div key={membership.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                                  <span>{displayName(firstRelation(membership.users))}</span>
                                  <form action={removeGuildMember.bind(null, membership.user_id, guild.id)}>
                                    <Button
                                      type="submit"
                                      variant="outline"
                                      size="sm"
                                      aria-label={`Remove ${displayName(firstRelation(membership.users))} from ${guild.name}`}
                                    >
                                      Remove
                                    </Button>
                                  </form>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">No members yet</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <form action={deleteGuild.bind(null, guild.id)}>
                            <Button type="submit" variant="destructive" size="sm" aria-label={`Delete ${guild.name}`}>
                              Delete
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No guilds yet. Create one to start drafting teams.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  );
}
