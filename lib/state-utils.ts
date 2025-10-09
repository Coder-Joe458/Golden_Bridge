const stateMap: Record<string, string> = {
  ca: "CA",
  california: "CA",
  "san francisco": "CA",
  "los angeles": "CA",
  ny: "NY",
  "new york": "NY",
  "new york city": "NY",
  wa: "WA",
  washington: "WA",
  seattle: "WA",
  ma: "MA",
  massachusetts: "MA",
  boston: "MA",
  va: "VA",
  virginia: "VA",
  tx: "TX",
  texas: "TX",
  dallas: "TX",
  austin: "TX",
  fl: "FL",
  florida: "FL",
  miami: "FL",
  nc: "NC",
  "north carolina": "NC",
  charlotte: "NC",
  co: "CO",
  colorado: "CO",
  denver: "CO",
  il: "IL",
  illinois: "IL",
  chicago: "IL"
};

export function normalizeState(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!cleaned.length) return null;
  return stateMap[cleaned] ?? (cleaned.length === 2 ? cleaned.toUpperCase() : null);
}

export function extractStateFromLocation(location?: string | null): string | null {
  if (!location) return null;
  const parts = location.split(/[,\s]/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts.reverse()) {
    const normalized = normalizeState(part);
    if (normalized) {
      return normalized;
    }
  }
  return normalizeState(location);
}
