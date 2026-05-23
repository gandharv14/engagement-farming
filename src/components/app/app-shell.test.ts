import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/game-mode/actions", () => ({
  exitAdminGameMode: vi.fn(),
}));

vi.mock("@/components/app/game-rules-dialog", () => ({
  GameRulesDialog: () => null,
}));

import { AppShell } from "./app-shell";

const adminTabs = [
  ["/admin", "Operations"],
  ["/admin/game-mode", "Admin Mode"],
  ["/admin/reviewers", "Reviewers"],
  ["/admin/taskers", "Taskers"],
  ["/admin/config", "Config"],
  ["/admin/economics", "Economics"],
  ["/admin/goodies", "Goodies"],
  ["/admin/guilds", "Guilds"],
  ["/admin/payouts", "Payouts"],
] as const;

describe("AppShell", () => {
  it("renders every admin tab", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        {
          role: "admin",
          name: "Admin",
        },
        React.createElement("div", null, "Admin content"),
      ),
    );

    for (const [href, label] of adminTabs) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(label);
    }
  });

  it("renders only tasker links while an admin is in tasker game mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        {
          role: "admin",
          name: "Ada",
          navigationRole: "tasker",
          gameMode: { label: "Impersonating", targetName: "Tara Tasker" },
        },
        React.createElement("div", null, "Tasker content"),
      ),
    );

    for (const [href, label] of [
      ["/", "Dashboard"],
      ["/leaderboards", "Leaderboards"],
      ["/guild", "Guild"],
      ["/goodies", "Goodies"],
      ["/earnings", "Earnings"],
      ["/profile", "Profile"],
    ]) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(label);
    }

    for (const [href, label] of adminTabs) {
      expect(html).not.toContain(`href="${href}"`);
      if (label !== "Goodies") {
        expect(html).not.toContain(label);
      }
    }

    expect(html).toContain("tasker");
    expect(html).not.toContain("Admin Ops");
  });

  it("renders only reviewer links while an admin is in reviewer game mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        {
          role: "admin",
          name: "Ada",
          navigationRole: "reviewer",
          gameMode: { label: "Impersonating", targetName: "Rina Reviewer" },
        },
        React.createElement("div", null, "Reviewer content"),
      ),
    );

    expect(html).toContain('href="/review/queue"');
    expect(html).toContain("Reviewer Dashboard");

    for (const [href, label] of adminTabs) {
      expect(html).not.toContain(`href="${href}"`);
      expect(html).not.toContain(label);
    }

    expect(html).toContain("reviewer");
    expect(html).not.toContain("Admin Ops");
  });
});
