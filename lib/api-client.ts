const apiBaseEnv = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
const normalizedBase = apiBaseEnv.replace(/\/$/, "");

const isAbsoluteUrl = (input: string): boolean => /^https?:\/\//i.test(input);

const ensureLeadingSlash = (input: string): string => (input.startsWith("/") ? input : `/${input}`);

const shouldUseAbsoluteBase = (): boolean => {
  if (!normalizedBase) return false;
  return typeof window === "undefined";
};

/**
 * Builds an absolute URL for API requests using the configured base.
 * Falls back to relative paths when no public base URL is provided or it matches the current host.
 */
export const buildApiUrl = (path: string): string => {
  if (isAbsoluteUrl(path)) return path;
  const normalizedPath = ensureLeadingSlash(path);
  if (!shouldUseAbsoluteBase()) return normalizedPath;
  return `${normalizedBase}${normalizedPath}`;
};

/**
 * Wrapper around fetch that respects NEXT_PUBLIC_API_BASE_URL for client-side calls
 * and ensures credentials are sent by default.
 */
export const apiFetch: typeof fetch = (input, init) => {
  if (typeof input !== "string") {
    return fetch(input, {
      ...init,
      credentials: init?.credentials ?? "include"
    });
  }

  const url = buildApiUrl(input);
  const headers = init?.headers ? new Headers(init.headers as HeadersInit) : undefined;

  return fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include"
  });
};
