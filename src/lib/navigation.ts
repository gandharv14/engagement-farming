import type { AppRole } from "@/lib/roles";

export type NavigationIconName = "dashboard" | "flame" | "gamepad" | "gift" | "medal" | "shield" | "users";

export type NavigationLink = {
  href: string;
  label: string;
  icon: NavigationIconName;
};

export const sidebarNavigationLinksByRole = {
  tasker: [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/leaderboards", label: "Leaderboards", icon: "medal" },
    { href: "/guild", label: "Guild", icon: "users" },
    { href: "/goodies", label: "Goodies", icon: "gift" },
    { href: "/earnings", label: "Earnings", icon: "flame" },
    { href: "/profile", label: "Profile", icon: "shield" },
  ],
  reviewer: [{ href: "/review/queue", label: "Reviewer Dashboard", icon: "shield" }],
  admin: [
    { href: "/admin", label: "Operations", icon: "dashboard" },
    { href: "/admin/game-mode", label: "Admin Mode", icon: "gamepad" },
    { href: "/admin/reviewers", label: "Reviewers", icon: "shield" },
    { href: "/admin/taskers", label: "Taskers", icon: "users" },
    { href: "/admin/config", label: "Config", icon: "flame" },
    { href: "/admin/economics", label: "Economics", icon: "medal" },
    { href: "/admin/goodies", label: "Goodies", icon: "gift" },
    { href: "/admin/guilds", label: "Guilds", icon: "users" },
    { href: "/admin/payouts", label: "Payouts", icon: "gift" },
  ],
} as const satisfies Record<AppRole, readonly NavigationLink[]>;

export const intentionalNonSidebarRoutes = [
  {
    route: "/login",
    reason: "Public auth entry point with an explicit Auth0 sign-in action.",
  },
  {
    route: "/forbidden",
    reason: "Redirect-only route that sends users to login or their role home.",
  },
  {
    route: "/review/[rowId]",
    reason: "Review detail route reached from reservation and resume actions in the reviewer queue.",
  },
] as const;

export function getNavigationLinksForRole(role: AppRole) {
  return sidebarNavigationLinksByRole[role];
}

export function getShellNavigationLinks(role: AppRole, navigationRole?: AppRole) {
  const activeNavigationRole = navigationRole ?? role;
  return getNavigationLinksForRole(activeNavigationRole);
}

export function getNavigationHomeHref(role: AppRole) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "reviewer") {
    return "/review/queue";
  }

  return "/";
}
