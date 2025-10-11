const stateMap: Record<string, string> = {
  ca: "CA",
  california: "CA",
  "san francisco": "CA",
  "los angeles": "CA",
  calif: "CA",
  "california state": "CA",
  "north california": "CA",
  "加州": "CA",
  "洛杉矶": "CA",
  "旧金山": "CA",
  ny: "NY",
  "new york": "NY",
  "new york city": "NY",
  "new york state": "NY",
  "纽约": "NY",
  "纽约州": "NY",
  "纽约市": "NY",
  wa: "WA",
  washington: "WA",
  seattle: "WA",
  "华盛顿": "WA",
  "华盛顿州": "WA",
  "西雅图": "WA",
  ma: "MA",
  massachusetts: "MA",
  boston: "MA",
  "马萨诸塞": "MA",
  "马萨诸塞州": "MA",
  "波士顿": "MA",
  va: "VA",
  virginia: "VA",
  "弗吉尼亚": "VA",
  "弗吉尼亚州": "VA",
  tx: "TX",
  texas: "TX",
  dallas: "TX",
  austin: "TX",
  "德州": "TX",
  "德克萨斯": "TX",
  "达拉斯": "TX",
  "奥斯汀": "TX",
  fl: "FL",
  florida: "FL",
  miami: "FL",
  "佛州": "FL",
  "佛罗里达": "FL",
  "迈阿密": "FL",
  nc: "NC",
  "north carolina": "NC",
  charlotte: "NC",
  "北卡": "NC",
  "北卡罗来纳": "NC",
  "夏洛特": "NC",
  co: "CO",
  colorado: "CO",
  denver: "CO",
  "科罗拉多": "CO",
  "科罗拉多州": "CO",
  "丹佛": "CO",
  il: "IL",
  illinois: "IL",
  chicago: "IL",
  "伊利诺伊": "IL",
  "伊利诺伊州": "IL",
  "芝加哥": "IL"
};

const keyPriority = Object.keys(stateMap).sort((a, b) => b.length - a.length);

export function normalizeState(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.toLowerCase().replace(/[^a-z\u4e00-\u9fa5]/g, "").trim();
  if (!cleaned.length) return null;

  if (/^[a-z]{2}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }

  if (stateMap[cleaned]) {
    return stateMap[cleaned];
  }

  for (const key of keyPriority) {
    if (cleaned.includes(key)) {
      return stateMap[key];
    }
  }

  return null;
}

export function extractStateFromLocation(location?: string | null): string | null {
  if (!location) return null;
  const cleaned = location.replace(/[，,]/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  for (const part of parts.reverse()) {
    const normalized = normalizeState(part);
    if (normalized) {
      return normalized;
    }
  }
  return normalizeState(cleaned);
}
