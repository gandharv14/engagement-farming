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

    for (const [href, label] of [
      ["/admin", "Operations"],
      ["/admin/game-mode", "Admin Mode"],
      ["/admin/reviewers", "Reviewers"],
      ["/admin/taskers", "Taskers"],
      ["/admin/config", "Config"],
      ["/admin/economics", "Economics"],
      ["/admin/goodies", "Goodies"],
      ["/admin/guilds", "Guilds"],
      ["/admin/payouts", "Payouts"],
    ]) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(label);
    }
  });
});
