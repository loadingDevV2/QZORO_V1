const FALLBACK = "/";

/** Only allow same-origin, root-relative paths as post-login destinations. */
export function safeNextPath(value: unknown, fallback = FALLBACK): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return fallback;
  }

  // Catch encoded protocol-relative or backslash paths before handing the value
  // to redirect(). Malformed escape sequences are not valid destinations.
  try {
    const decoded = decodeURIComponent(path);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) {
    return fallback;
  }
  return path;
}
