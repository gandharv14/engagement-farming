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
  it("renders the reviewers tab for admins", () => {
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

    expect(html).toContain('href="/admin/reviewers"');
    expect(html).toContain("Reviewers");
  });
});
