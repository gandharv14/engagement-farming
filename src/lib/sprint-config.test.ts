import { describe, expect, it } from "vitest";

import { formatDateOnly, getSprintEndDateFromDuration, parseDateOnly } from "./sprint-config";

describe("sprint config helpers", () => {
  it("parses date-only values as UTC calendar days", () => {
    const date = parseDateOnly("2026-05-22", "Sprint start date");

    expect(date.toISOString()).toBe("2026-05-22T00:00:00.000Z");
    expect(formatDateOnly(date)).toBe("2026-05-22");
  });

  it("rejects malformed or impossible date-only values", () => {
    expect(() => parseDateOnly("2026-5-22", "Sprint start date")).toThrow("Sprint start date must be a valid date.");
    expect(() => parseDateOnly("2026-02-30", "Sprint end date")).toThrow("Sprint end date must be a valid date.");
  });

  it("calculates inclusive sprint end dates from duration", () => {
    const start = parseDateOnly("2026-05-22", "Sprint start date");

    expect(formatDateOnly(getSprintEndDateFromDuration(start, 1))).toBe("2026-05-22");
    expect(formatDateOnly(getSprintEndDateFromDuration(start, 12))).toBe("2026-06-02");
  });

  it("rejects invalid sprint durations", () => {
    const start = parseDateOnly("2026-05-22", "Sprint start date");

    expect(() => getSprintEndDateFromDuration(start, 0)).toThrow("Sprint duration must be at least 1 day.");
    expect(() => getSprintEndDateFromDuration(start, 1.5)).toThrow("Sprint duration must be at least 1 day.");
  });
});
