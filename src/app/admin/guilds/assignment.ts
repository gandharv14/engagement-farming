export type GuildAssignmentGuild = {
  id: string;
};

export type GuildAssignmentTasker = {
  id: string;
};

export type GuildAssignmentMembership = {
  user_id: string;
  guild_id: string;
};

export type GuildAssignmentInsert = {
  user_id: string;
  guild_id: string;
};

export function computeBalancedGuildAssignments({
  guilds,
  taskers,
  memberships,
}: {
  guilds: GuildAssignmentGuild[];
  taskers: GuildAssignmentTasker[];
  memberships: GuildAssignmentMembership[];
}): GuildAssignmentInsert[] {
  const assignedTaskerIds = new Set(memberships.map((membership) => membership.user_id));
  const unassignedTaskers = taskers.filter((tasker) => !assignedTaskerIds.has(tasker.id));

  if (!guilds.length) {
    if (unassignedTaskers.length) {
      throw new Error("Create at least one guild before auto-assigning taskers.");
    }

    return [];
  }

  const membershipCounts = new Map(guilds.map((guild) => [guild.id, 0]));

  for (const membership of memberships) {
    const currentCount = membershipCounts.get(membership.guild_id);

    if (currentCount !== undefined) {
      membershipCounts.set(membership.guild_id, currentCount + 1);
    }
  }

  return unassignedTaskers.map((tasker) => {
    const guild = guilds.reduce((smallest, candidate) =>
      membershipCounts.get(candidate.id)! < membershipCounts.get(smallest.id)! ? candidate : smallest,
    );

    membershipCounts.set(guild.id, membershipCounts.get(guild.id)! + 1);

    return {
      guild_id: guild.id,
      user_id: tasker.id,
    };
  });
}
