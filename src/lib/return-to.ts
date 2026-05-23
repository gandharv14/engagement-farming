export function getSafeRelativePath(path: string | string[] | null | undefined) {
  const value = Array.isArray(path) ? path[0] : path;

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export function getSafeLoginReturnTo(path: string | string[] | null | undefined) {
  const safePath = getSafeRelativePath(path);

  if (!safePath || safePath === "/" || safePath.startsWith("/login")) {
    return "/";
  }

  return safePath;
}
