const apiBaseEnv = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
const normalizedBase = apiBaseEnv.replace(/\/$/, "");

const isAbsoluteUrl = (input: string): boolean => /^https?:\/\//i.test(input);

const ensureLeadingSlash = (input: string): string => (input.startsWith("/") ? input : `/${input}`);

/**
 * Builds an absolute URL for API requests using the configured base.
 * Falls back to relative paths when no public base URL is provided.
 */
export const buildApiUrl = (path: string): string => {
  if (isAbsoluteUrl(path)) return path;
  const normalizedPath = ensureLeadingSlash(path);
  if (!normalizedBase) return normalizedPath;
  return `${normalizedBase}${normalizedPath}`;
};

/**
 * Wrapper around fetch that respects NEXT_PUBLIC_API_BASE_URL for client-side calls.
 */
export const apiFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? buildApiUrl(input) : input;
  if (typeof input !== "string") {
    return fetch(input, init);
  }

  const headers = init?.headers ? new Headers(init.headers as HeadersInit) : undefined;
  return fetch(url, {
    ...init,
    headers
  });
};
