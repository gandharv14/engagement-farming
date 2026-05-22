import { afterEach, describe, expect, it } from "vitest";

import { getDefaultAppRole } from "./app-user";

const originalDefaultRole = process.env.DEFAULT_APP_ROLE;

describe("app user defaults", () => {
  afterEach(() => {
    if (originalDefaultRole === undefined) {
      delete process.env.DEFAULT_APP_ROLE;
    } else {
      process.env.DEFAULT_APP_ROLE = originalDefaultRole;
    }
  });

  it("defaults new app users to tasker without an override", () => {
    delete process.env.DEFAULT_APP_ROLE;

    expect(getDefaultAppRole()).toBe("tasker");
  });

  it("accepts valid default role overrides case-insensitively", () => {
    process.env.DEFAULT_APP_ROLE = "Reviewer";

    expect(getDefaultAppRole()).toBe("reviewer");
  });

  it("falls back to tasker for unsupported default role overrides", () => {
    process.env.DEFAULT_APP_ROLE = "owner";

    expect(getDefaultAppRole()).toBe("tasker");
  });
});
