export type PriorityKey = "rate" | "ltv" | "speed" | "documents";

export type Summary = {
  location?: string;
  timeline?: string;
  priority?: PriorityKey;
  credit?: string;
  amount?: number;
};

export const chatQuestions: string[] = [
  "Where is the property you plan to finance? Let me know the city, state, or zip code.",
  "What timeline are you targeting for closing? Have you already signed a purchase contract?",
  "Which loan factors matter the most to you? For example: rate, loan-to-value, speed to close, or document requirements."
];

export function determinePriority(input: string): PriorityKey | undefined {
  const text = input.toLowerCase();
  if (/(interest|rate|apr|pricing)/i.test(text)) return "rate";
  if (/(ltv|max leverage|loan amount|high leverage)/i.test(text)) return "ltv";
  if (/(speed|fast close|quick close|timeline|weeks|days)/i.test(text)) return "speed";
  if (/(docs|minimal|documentation|paperwork|no doc)/i.test(text)) return "documents";
  return undefined;
}

export function extractInformation(message: string): Summary {
  const info: Summary = {};
  const lower = message.toLowerCase();

  const locationMatch = message.match(/\bin\s+([A-Za-z\s]+(?:,\s*[A-Za-z]{2})?)/i);
  const zipMatch = message.match(/\b\d{5}\b/);
  if (locationMatch) {
    info.location = locationMatch[1].trim();
  } else if (zipMatch) {
    info.location = zipMatch[0];
  }

  const creditMatch = message.match(/credit(?: score)?\s*(?:is|of|around|about|=)?\s*(\d{3})/i);
  if (creditMatch) {
    info.credit = creditMatch[1];
  }

  const amountMatch = message.match(/\$?\s*([\d,.]+)\s*(k|m|million)?/i);
  if (amountMatch) {
    const digits = Number(amountMatch[1].replace(/,/g, ""));
    const unit = amountMatch[2]?.toLowerCase();
    if (!Number.isNaN(digits)) {
      let amount = digits;
      if (unit === "k") amount *= 1_000;
      if (unit === "m" || unit === "million") amount *= 1_000_000;
      if (amount >= 50_000) {
        info.amount = amount;
      }
    }
  }

  const timelineMatch = lower.match(
    /(next month|this month|in \d+\s*(?:weeks|months)|this quarter|next quarter|already signed|purchase agreement)/i
  );
  if (timelineMatch) {
    info.timeline = timelineMatch[0];
  }

  const priorityKey = determinePriority(message);
  if (priorityKey) {
    info.priority = priorityKey;
  }

  return info;
}

export function computeQuestionPointer(summary: Summary): number {
  let pointer = 0;
  if (summary.location) pointer = Math.max(pointer, 1);
  if (summary.timeline) pointer = Math.max(pointer, 2);
  if (summary.priority) pointer = Math.max(pointer, 3);
  return Math.min(pointer, chatQuestions.length);
}

export function buildRecap(summary: Summary, alreadyRecapped: boolean): string {
  if (alreadyRecapped) {
    return "Thanks for the update. Your borrower file is refreshed and synced with the recommendation engine.";
  }

  const parts: string[] = [];
  if (summary.location) parts.push(`Location: ${summary.location}`);
  if (summary.amount) {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(summary.amount);
    parts.push(`Target loan: ${formatted}`);
  }
  if (summary.credit) parts.push(`Credit score: ${summary.credit}`);
  if (summary.priority) parts.push(`Priority: ${priorityLabel(summary.priority)}`);
  if (summary.timeline) parts.push(`Timeline: ${summary.timeline}`);

  if (!parts.length) {
    return "I captured that. Keep sharing the details that matter and I'll refine the matches.";
  }
  return `Here is your current deal profile - ${parts.join(" / ")}.`;
}

export function priorityLabel(key: PriorityKey): string {
  switch (key) {
    case "rate":
      return "Locking the lowest rate";
    case "ltv":
      return "Maximising leverage";
    case "speed":
      return "Fastest time-to-close";
    case "documents":
      return "Streamlined documentation";
    default:
      return "Balanced factors";
  }
}

export function buildSystemPrompt(summary: Summary, pointer: number, shouldRecap: boolean): string {
  const pendingQuestion = pointer < chatQuestions.length ? chatQuestions[pointer] : null;
  const summarySegments = [
    summary.location ? `Location: ${summary.location}` : null,
    summary.amount
      ? `Loan amount: ${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0
        }).format(summary.amount)}`
      : null,
    summary.credit ? `Credit score: ${summary.credit}` : null,
    summary.priority ? `Priority: ${priorityLabel(summary.priority)}` : null,
    summary.timeline ? `Timeline: ${summary.timeline}` : null
  ].filter(Boolean);

  return [
    "You are Golden Bridge AI, an elite mortgage concierge for borrowers in the United States.",
    "Your job is to maintain a concise, forward-looking conversation, capture lending requirements, and prepare borrowers for broker hand-off.",
    "Use a professional yet encouraging tone. Keep replies under 110 words.",
    summarySegments.length
      ? `Current borrower profile: ${summarySegments.join(" | ")}.`
      : "No borrower profile captured yet.",
    pendingQuestion
      ? `You must ask the following question next to continue onboarding: ${pendingQuestion}`
      : "All required discovery questions have been captured. Provide a recap and invite the borrower to review the recommended matches below, highlighting that they can refresh if needed.",
    shouldRecap
      ? "Deliver a crisp recap before closing your message. Mention that recommendations on the page are now updated."
      : "Acknowledge the latest borrower input before asking the next required question."
  ].join(" ");
}

export function buildFallbackResponse(summary: Summary, pointer: number, shouldRecap: boolean): string {
  if (shouldRecap || pointer >= chatQuestions.length) {
    return `${buildRecap(summary, false)} Review the three highlighted loan scenarios below and let me know which one aligns best.`;
  }
  const question = chatQuestions[pointer] ?? "What should we clarify next?";
  return `Thanks for sharing! ${question}`;
}
