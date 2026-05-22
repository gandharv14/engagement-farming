import { describe, expect, it } from "vitest";

import {
  MAX_PROBLEMS_PER_TASKER_PER_DAY,
  TOKENS_PER_PROBLEM,
  formatDateOnly,
  getCollectiveProblemCapacity,
  getMaxProblemsPerTasker,
  getSprintDurationDays,
  getSprintEndDateFromDuration,
  parseDateOnly,
} from "./sprint-config";

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

  it("calculates sprint duration and challenge capacity from fixed game rules", () => {
    const start = parseDateOnly("2026-05-22", "Sprint start date");
    const end = parseDateOnly("2026-06-02", "Sprint end date");

    expect(MAX_PROBLEMS_PER_TASKER_PER_DAY).toBe(2);
    expect(TOKENS_PER_PROBLEM).toBe(1_000_000);
    expect(getSprintDurationDays(start, end)).toBe(12);
    expect(getMaxProblemsPerTasker(12)).toBe(24);
    expect(getCollectiveProblemCapacity(12, 42)).toBe(1008);
  });

  it("rejects invalid sprint durations", () => {
    const start = parseDateOnly("2026-05-22", "Sprint start date");

    expect(() => getSprintEndDateFromDuration(start, 0)).toThrow("Sprint duration must be at least 1 day.");
    expect(() => getSprintEndDateFromDuration(start, 1.5)).toThrow("Sprint duration must be at least 1 day.");
    expect(() => getSprintDurationDays(parseDateOnly("2026-06-02", "Sprint start date"), start)).toThrow(
      "Sprint end date cannot be before the start date.",
    );
  });
});
