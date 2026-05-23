import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { intentionalNonSidebarRoutes, sidebarNavigationLinksByRole } from "./navigation";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const appDir = path.join(repoRoot, "src", "app");

function collectPageFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectPageFiles(entryPath);
    }

    return entry === "page.tsx" || entry === "page.ts" ? [entryPath] : [];
  });
}

function pageFileToRoutePattern(filePath: string) {
  const routeDir = path.relative(appDir, path.dirname(filePath));

  if (!routeDir) {
    return "/";
  }

  const routeSegments = routeDir.split(path.sep).filter((segment) => !segment.startsWith("("));
  return `/${routeSegments.join("/")}`;
}

describe("navigation coverage", () => {
  it("documents every page route as navigable or intentionally non-sidebar", () => {
    const pageRoutes = collectPageFiles(appDir).map(pageFileToRoutePattern).sort();
    const sidebarRoutes = Object.values(sidebarNavigationLinksByRole).flatMap((links) => links.map((link) => link.href));
    const documentedRoutes = intentionalNonSidebarRoutes.map((route) => route.route);
    const coveredRoutes = new Set([...sidebarRoutes, ...documentedRoutes]);

    expect(pageRoutes.filter((route) => !coveredRoutes.has(route))).toEqual([]);
  });
});
