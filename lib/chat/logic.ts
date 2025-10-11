export type PriorityKey = "rate" | "ltv" | "speed" | "documents";
export type Locale = "en" | "zh";

export type Summary = {
  location?: string;
  timeline?: string;
  priority?: PriorityKey;
  credit?: string;
  amount?: number;
};

const chatQuestionBank: Record<Locale, string[]> = {
  en: [
    "Where is the property you plan to finance? Let me know the city, state, or zip code.",
    "What timeline are you targeting for closing? Have you already signed a purchase contract?",
    "Which loan factors matter the most to you? For example: rate, loan-to-value, speed to close, or document requirements."
  ],
  zh: [
    "您计划贷款购买的房产在哪里？请告诉我城市、州或邮编。",
    "预计什么时候完成贷款？是否已经签署购房合同？",
    "贷款中您最看重哪些条件？例如：利率、贷款成数、放款速度或资料要求。"
  ]
};

const copy = {
  recapIntro: {
    en: "Here is your current deal profile - ",
    zh: "以下是目前整理的贷款资料："
  },
  recapThanks: {
    en: "Thanks for the update. Your borrower file is refreshed and synced with the recommendation engine.",
    zh: "感谢补充信息，已同步更新您的资料，并刷新推荐结果。"
  },
  recapEmpty: {
    en: "I captured that. Keep sharing the details that matter and I'll refine the matches.",
    zh: "已记录。欢迎继续补充关键信息，我会继续优化推荐。"
  },
  fallbackRecapSuffix: {
    en: "Review the three highlighted loan scenarios below and let me know which one aligns best.",
    zh: "请查看下方推荐的三家贷款方，如需调整可以告诉我。"
  },
  fallbackPrompt: {
    en: "Thanks for sharing! ",
    zh: "收到，谢谢！"
  },
  systemPurpose: {
    en: "You are Golden Bridge AI, an elite mortgage concierge for borrowers in the United States.",
    zh: "你是金桥 AI 贷款顾问，需要以专业且亲和的语气帮助借款人。"
  },
  systemTone: {
    en: "Your job is to maintain a concise, forward-looking conversation, capture lending requirements, and prepare borrowers for broker hand-off.",
    zh: "请保持简洁、前瞻的对话，引导梳理借款需求，并为后续对接经纪人做准备。"
  },
  systemLength: {
    en: "Use a professional yet encouraging tone. Keep replies under 110 words.",
    zh: "语气专业但友好，回复控制在 110 个英文单词或对应长度内。"
  },
  systemNextQuestion: {
    en: "You must ask the following question next to continue onboarding: ",
    zh: "下一步请继续提问："
  },
  systemAllCaptured: {
    en: "All required discovery questions have been captured. Provide a recap and invite the borrower to review the recommended matches below, highlighting that they can refresh if needed.",
    zh: "核心问题已完成。请先总结资料，并提示借款人查看下方推荐的贷款方，必要时可再次刷新。"
  },
  systemRecapInstruction: {
    en: "Deliver a crisp recap before closing your message. Mention that recommendations on the page are now updated.",
    zh: "在结束前请先简明总结，并提醒页面推荐已更新。"
  },
  systemAcknowledge: {
    en: "Acknowledge the latest borrower input before asking the next required question.",
    zh: "先肯定借款人的输入，再继续提问下一项信息。"
  }
};

const priorityLabels: Record<Locale, Record<PriorityKey, string>> = {
  en: {
    rate: "Locking the lowest rate",
    ltv: "Maximising leverage",
    speed: "Fastest time-to-close",
    documents: "Streamlined documentation"
  },
  zh: {
    rate: "锁定最低利率",
    ltv: "争取最高成数",
    speed: "追求最快放款",
    documents: "简化资料要求"
  }
};

export function getChatQuestions(locale: Locale): string[] {
  return chatQuestionBank[locale];
}

export function determinePriority(input: string): PriorityKey | undefined {
  const text = input.toLowerCase();
  if (/(interest|rate|apr|pricing|利率|费率)/i.test(text)) return "rate";
  if (/(ltv|max leverage|loan amount|high leverage|贷款比例|成数|额度)/i.test(text)) return "ltv";
  if (/(speed|fast close|quick close|timeline|weeks|days|放款|速度|尽快|加急)/i.test(text)) return "speed";
  if (/(docs|minimal|documentation|paperwork|no doc|资料|材料|手续|证明)/i.test(text)) return "documents";
  return undefined;
}

export function extractInformation(message: string): Summary {
  const info: Summary = {};
  const lower = message.toLowerCase();

  const locationMatch = message.match(/(?:在|in)\s*([A-Za-z\u4e00-\u9fa5\s,]+)/);
  const zipMatch = message.match(/\b\d{5}\b/);
  if (locationMatch) {
    info.location = locationMatch[1].trim();
  } else if (zipMatch) {
    info.location = zipMatch[0];
  }

  const creditMatch = message.match(/(?:credit|信用)(?: score)?\s*(?:是|为|=|about|around)?\s*(\d{3})/i);
  if (creditMatch) {
    info.credit = creditMatch[1];
  }

  const amountMatch = message.replace(/[，,]/g, "").match(/\$?\s*(\d{4,7})\s*(k|m|million|万)?/i);
  if (amountMatch) {
    let amount = Number(amountMatch[1]);
    const unit = amountMatch[2]?.toLowerCase();
    if (!Number.isNaN(amount)) {
      if (unit === "k") amount *= 1_000;
      if (unit === "m" || unit === "million") amount *= 1_000_000;
      if (unit === "万") amount *= 10_000;
      if (amount >= 50_000) {
        info.amount = amount;
      }
    }
  }

  const timelineMatch = lower.match(
    /(next month|this month|in \d+\s*(?:weeks|months)|this quarter|next quarter|already signed|purchase agreement|下个月|这个月|\d+周|\d+个月|三个月|已签|签约|马上)/
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

export function computeQuestionPointer(summary: Summary, questions: string[]): number {
  let pointer = 0;
  if (summary.location) pointer = Math.max(pointer, 1);
  if (summary.timeline) pointer = Math.max(pointer, 2);
  if (summary.priority) pointer = Math.max(pointer, 3);
  return Math.min(pointer, questions.length);
}

export function buildRecap(summary: Summary, alreadyRecapped: boolean, locale: Locale): string {
  if (alreadyRecapped) {
    return copy.recapThanks[locale];
  }

  const parts: string[] = [];
  if (summary.location) parts.push(locale === "zh" ? `位置：${summary.location}` : `Location: ${summary.location}`);
  if (summary.amount) {
    const formatted = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(summary.amount);
    parts.push(locale === "zh" ? `目标贷款：${formatted}` : `Target loan: ${formatted}`);
  }
  if (summary.credit) {
    parts.push(locale === "zh" ? `信用分：${summary.credit}` : `Credit score: ${summary.credit}`);
  }
  if (summary.priority) {
    const label = priorityLabel(summary.priority, locale);
    parts.push(locale === "zh" ? `重点：${label}` : `Priority: ${label}`);
  }
  if (summary.timeline) {
    parts.push(locale === "zh" ? `时间线：${summary.timeline}` : `Timeline: ${summary.timeline}`);
  }

  if (!parts.length) {
    return copy.recapEmpty[locale];
  }
  return locale === "zh"
    ? `${copy.recapIntro[locale]}${parts.join("；")}。`
    : `${copy.recapIntro[locale]}${parts.join(" / ")}.`;
}

export function priorityLabel(key: PriorityKey, locale: Locale): string {
  return priorityLabels[locale][key];
}

export function buildSystemPrompt(
  summary: Summary,
  pointer: number,
  shouldRecap: boolean,
  locale: Locale,
  questions: string[]
): string {
  const pendingQuestion = pointer < questions.length ? questions[pointer] : null;
  const summarySegments = [
    summary.location ? (locale === "zh" ? `位置：${summary.location}` : `Location: ${summary.location}`) : null,
    summary.amount
      ? (locale === "zh"
          ? `贷款额度：${new Intl.NumberFormat("zh-CN", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0
            }).format(summary.amount)}`
          : `Loan amount: ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0
            }).format(summary.amount)}`)
      : null,
    summary.credit ? (locale === "zh" ? `信用：${summary.credit}` : `Credit score: ${summary.credit}`) : null,
    summary.priority ? (locale === "zh" ? `重点：${priorityLabel(summary.priority, locale)}` : `Priority: ${priorityLabel(summary.priority, locale)}`) : null,
    summary.timeline ? (locale === "zh" ? `时间：${summary.timeline}` : `Timeline: ${summary.timeline}`) : null
  ].filter(Boolean);

  return [
    copy.systemPurpose[locale],
    copy.systemTone[locale],
    copy.systemLength[locale],
    summarySegments.length
      ? locale === "zh"
        ? `当前资料：${summarySegments.join(" | ")}`
        : `Current borrower profile: ${summarySegments.join(" | ")}.`
      : locale === "zh"
      ? "目前还没有有效资料。"
      : "No borrower profile captured yet.",
    pendingQuestion
      ? copy.systemNextQuestion[locale] + pendingQuestion
      : copy.systemAllCaptured[locale],
    shouldRecap ? copy.systemRecapInstruction[locale] : copy.systemAcknowledge[locale]
  ].join(" ");
}

export function buildFallbackResponse(
  summary: Summary,
  pointer: number,
  shouldRecap: boolean,
  locale: Locale,
  questions: string[]
): string {
  if (shouldRecap || pointer >= questions.length) {
    return `${buildRecap(summary, false, locale)} ${copy.fallbackRecapSuffix[locale]}`;
  }
  const question = questions[pointer] ?? (locale === "zh" ? "我们接下来应该了解哪方面？" : "What should we clarify next?");
  return `${copy.fallbackPrompt[locale]}${question}`;
}
