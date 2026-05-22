import { existsSync } from "node:fs";
import path from "node:path";

export type E2ERole = "admin" | "reviewer" | "tasker";

export function storageStatePath(role: E2ERole) {
  return path.join(process.cwd(), "e2e", ".auth", `${role}.json`);
}

export function hasStorageState(role: E2ERole) {
  return existsSync(storageStatePath(role));
}
