import { describe, expect, it } from "vitest";

import {
  getAppUserDisplayName,
  getShadowAuth0Sub,
  parseAdminGameModeCookieValue,
  toShadowEmail,
  type ReviewerGameContext,
  type TaskerGameContext,
} from "./admin-game-mode";

const admin = {
  id: "admin-id",
  auth0_sub: "auth0|admin",
  email: "admin@example.com",
  display_name: "Ada Admin",
  role: "admin",
} as const;

describe("admin game mode helpers", () => {
  it("parses own and tasker impersonation cookie values", () => {
    expect(parseAdminGameModeCookieValue("own")).toEqual({ mode: "own" });
    expect(parseAdminGameModeCookieValue("tasker:tasker-id")).toEqual({
      mode: "tasker",
      taskerId: "tasker-id",
    });
    expect(parseAdminGameModeCookieValue("reviewer:reviewer-id")).toEqual({
      mode: "reviewer",
      reviewerId: "reviewer-id",
    });
  });

  it("rejects empty or malformed game mode cookie values", () => {
    expect(parseAdminGameModeCookieValue(undefined)).toBeNull();
    expect(parseAdminGameModeCookieValue("tasker:")).toBeNull();
    expect(parseAdminGameModeCookieValue("reviewer:")).toBeNull();
  });

  it("builds stable shadow user identifiers for admin-owned game profiles", () => {
    expect(getShadowAuth0Sub(admin)).toBe("admin-game|admin-id");
    expect(toShadowEmail("admin@example.com")).toBe("admin+game-mode@example.com");
    expect(toShadowEmail("not-an-email")).toBeNull();
  });

  it("prefers display name, then email, then fallback for tasker labels", () => {
    expect(getAppUserDisplayName(admin)).toBe("Ada Admin");
    expect(getAppUserDisplayName({ display_name: null, email: "tasker@example.com" })).toBe("tasker@example.com");
    expect(getAppUserDisplayName({ display_name: null, email: null }, "Anonymous")).toBe("Anonymous");
  });

  it("keeps tasker shell props tasker-facing while preserving the admin session role", async () => {
    const { getTaskerShellProps } = await import("./admin-game-mode");
    const context: TaskerGameContext = {
      sessionUser: { sub: "auth0|admin", role: "admin", email: "admin@example.com", name: "Ada Admin" },
      tasker: {
        id: "tasker-id",
        auth0_sub: "auth0|tasker",
        email: "tasker@example.com",
        display_name: "Tara Tasker",
        role: "tasker",
      },
      isAdminGameMode: true,
      gameModeLabel: "Impersonating",
    };

    expect(getTaskerShellProps(context)).toEqual({
      role: "admin",
      name: "Ada Admin",
      navigationRole: "tasker",
      gameMode: {
        label: "Impersonating",
        targetName: "Tara Tasker",
      },
    });
  });

  it("keeps reviewer shell props reviewer-facing while preserving the admin session role", async () => {
    const { getReviewerShellProps } = await import("./admin-game-mode");
    const context: ReviewerGameContext = {
      sessionUser: { sub: "auth0|admin", role: "admin", email: "admin@example.com", name: "Ada Admin" },
      reviewer: {
        id: "reviewer-id",
        auth0_sub: "auth0|reviewer",
        email: "reviewer@example.com",
        display_name: "Rina Reviewer",
        role: "reviewer",
      },
      isAdminGameMode: true,
      gameModeLabel: "Impersonating",
    };

    expect(getReviewerShellProps(context)).toEqual({
      role: "admin",
      name: "Ada Admin",
      navigationRole: "reviewer",
      gameMode: {
        label: "Impersonating",
        targetName: "Rina Reviewer",
      },
    });
  });
});
