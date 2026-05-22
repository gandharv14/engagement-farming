import { describe, expect, it } from "vitest";

import { buildPayoutsCsv, csvEscape } from "./payouts";

describe("payout export helpers", () => {
  it("escapes CSV values with quotes", () => {
    expect(csvEscape('Ada "Token" Lovelace')).toBe('"Ada ""Token"" Lovelace"');
    expect(csvEscape(1250)).toBe('"1250"');
  });

  it("groups earnings by user and sums cents", () => {
    const csv = buildPayoutsCsv([
      {
        user_id: "user-1",
        amount_cents: 100,
        users: { email: "tasker@example.com", display_name: "Tasker One" },
      },
      {
        user_id: "user-2",
        amount_cents: 250,
        users: { email: "reviewer@example.com", display_name: "Reviewer Two" },
      },
      {
        user_id: "user-1",
        amount_cents: 325,
        users: { email: "tasker@example.com", display_name: "Tasker One" },
      },
    ]);

    expect(csv.split("\n")).toEqual([
      '"user_id","email","display_name","amount_cents"',
      '"user-1","tasker@example.com","Tasker One","425"',
      '"user-2","reviewer@example.com","Reviewer Two","250"',
    ]);
  });

  it("preserves safe defaults for missing related user data", () => {
    expect(buildPayoutsCsv([{ user_id: "orphaned-user", amount_cents: 500, users: null }])).toBe(
      '"user_id","email","display_name","amount_cents"\n"orphaned-user","","","500"',
    );
  });
});
