"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { loanDirectory } from "@/lib/loan-data";
import {
  buildFallbackResponse,
  buildSystemPrompt,
  computeQuestionPointer,
  determinePriority,
  extractInformation,
  getChatQuestions,
  type Locale,
  type Summary
} from "@/lib/chat/logic";

type Message = {
  id: string;
  author: "ai" | "user";
  content: string;
};

type RecommendedBroker = {
  id: string;
  lenderName: string;
  company: string | null;
  headline: string | null;
  notes: string | null;
  licenseStates: string[];
  minRate: number | null;
  maxRate: number | null;
  loanPrograms: string[];
  minCreditScore: number | null;
  maxLoanToValue: number | null;
  yearsExperience: number | null;
  website: string | null;
  contactEmail: string | null;
  closingSpeedDays: number | null;
  category: "lowestRate" | "highestLtv" | "fastestClosing" | "additional";
};

type ProfileFormState = {
  name: string;
  city: string;
  credit: string;
  amount: string;
  priority: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  addEventListener: (type: string, listener: (event: any) => void) => void;
  removeEventListener: (type: string, listener: (event: any) => void) => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const profileStorageKey = "golden-bridge-profile";
const initialProfile: ProfileFormState = {
  name: "",
  city: "",
  credit: "",
  amount: "",
  priority: ""
};

const createIntroMessages = (locale: Locale): Message[] => {
  const questions = getChatQuestions(locale);
  return [
    {
      id: "msg-ai-0",
      author: "ai",
      content:
        locale === "zh"
          ? "您好，我是金桥 AI 信贷顾问，我们会一步步梳理您的贷款需求。"
          : "Welcome to Golden Bridge Loan. I'm your AI lending guide - let's map out the perfect financing game plan for you."
    },
    {
      id: "msg-ai-1",
      author: "ai",
      content: questions[0]
    }
  ];
};

function translateText(text: string): string {
  const dictionary: Record<string, string> = {
    "Tech professional and startup-friendly jumbo lending across Northern California": "专注北加州科技及创业客户的大额贷款团队",
    "SoCal purchase and refinance specialist with investor solutions": "南加州购房与再融资专家，兼顾投资需求",
    "Specialist in coastal condos and vacation homes": "擅长海岸公寓与度假房贷项目",
    "Focus on RSU and stock-comp borrowers. Rapid underwriting lanes for purchase contingencies.": "聚焦 RSU/股票薪酬客户，购房审批快速通道。",
    "Focus on RSU and stock-comp borrowers. Rapid underwriting lanes for purchase contingencies": "聚焦 RSU/股票薪酬客户，购房审批快速通道。",
    "Dedicated jumbo desk. Expedited underwriting for RSU-heavy borrowers. Low-doc options available.": "设有大额贷款专席，RSU 客户审批提速，并提供低文件方案。",
    "Fast closing team focused on vacation rentals; streamlined documentation for DSCR products.": "度假短租团队放款迅速，针对 DSCR 产品提供简化资料流程。",
    "Handles complex income structures, SBA transitions, and 7-day document prep. Bilingual support (EN/ES).": "处理复杂收入结构、SBA 转贷及 7 天材料准备，提供英/西双语服务。",
    "Handles complex income structures, SBA transitions, and 7-day document prep. Bilingual support (EN/ES)": "处理复杂收入结构、SBA 转贷及 7 天材料准备，提供英/西双语服务。"
  };

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return text;

  return dictionary[normalized] ?? dictionary[normalized.replace(/\.+$/, "")] ?? text;
}

function translateLoanProgram(program: string): string {
  const normalized = program.replace(/\s+/g, " ").trim();
  if (!normalized) return program;

  const dictionary: Record<string, string> = {
    "jumbo": "大额贷款",
    "arm hybrid": "混合 ARM 方案",
    "arm": "可调利率贷款 ARM",
    "bridge": "过桥贷款",
    "conforming": "合规贷款",
    "investor dscr": "投资型 DSCR",
    "dscr": "DSCR 现金流贷款",
    "bank statement": "银行流水贷款",
    "fha/va": "FHA/VA 政府贷款",
    "va/fha": "FHA/VA 政府贷款",
    "vacation rental": "度假/短租贷款",
    "rental": "投资出租贷款",
    "construction": "建房贷款"
  };

  const direct = dictionary[normalized.toLowerCase()];
  if (direct) return direct;

  if (/jumbo/i.test(normalized)) return "大额贷款";
  if (/bridge/i.test(normalized)) return "过桥贷款";
  if (/arm/i.test(normalized) && /hybrid/i.test(normalized)) return "混合 ARM 方案";
  if (/arm/i.test(normalized)) return "可调利率贷款 ARM";
  if (/conform/i.test(normalized)) return "合规贷款";
  if (/bank\s*statement/i.test(normalized)) return "银行流水贷款";
  if (/dscr/i.test(normalized) && /investor/i.test(normalized)) return "投资型 DSCR";
  if (/dscr/i.test(normalized)) return "DSCR 现金流贷款";
  if (/(fha|va)/i.test(normalized)) return "FHA/VA 政府贷款";
  if (/vacation/i.test(normalized) || /rental/i.test(normalized)) return "度假/短租贷款";
  if (/construction/i.test(normalized)) return "建房贷款";

  return normalized;
}

export function HomePage(): JSX.Element {

  const { data: session } = useSession();
  const [locale, setLocale] = useState<Locale>("en");
  const questions = useMemo(() => getChatQuestions(locale), [locale]);

  const t = useCallback((en: string, zh: string) => (locale === "zh" ? zh : en), [locale]);

  const [messages, setMessages] = useState<Message[]>(() => createIntroMessages(locale));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [questionIndex, setQuestionIndex] = useState<number>(1);
  const [hasRecapped, setHasRecapped] = useState<boolean>(false);
  const [summary, setSummary] = useState<Summary>({});
  const [input, setInput] = useState<string>("");
  const [voiceStatus, setVoiceStatus] = useState<string>(t("Ready for voice capture...", "语音输入待命…"));
  const [profile, setProfile] = useState<ProfileFormState>(initialProfile);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string>("");
  const [referralStatus, setReferralStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [voiceSupported, setVoiceSupported] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<RecommendedBroker[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState<boolean>(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMessages(createIntroMessages(locale));
    setQuestionIndex(1);
    setHasRecapped(false);
    setSummary({});
    setRefreshKey((prev) => prev + 1);
    setVoiceStatus(locale === "zh" ? "语音输入待命…" : "Ready for voice capture...");
  }, [locale, t]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(profileStorageKey);
      if (saved) {
        const parsed: ProfileFormState = JSON.parse(saved);
        setProfile({ ...initialProfile, ...parsed });
        const profileSummary = summaryFromProfile(parsed);
        if (Object.keys(profileSummary).length > 0) {
          setSummary((prev) => ({ ...prev, ...profileSummary }));
          setHasRecapped(false);
        }
      }
    } catch (error) {
      console.warn("Failed to load stored profile", error);
    }
  }, [locale, t]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!ctor) {
      setVoiceSupported(false);
      setVoiceStatus(t("Voice capture is unavailable in this browser.", "当前浏览器暂不支持语音输入。"));
      return;
    }

    const recognition = new ctor();
    recognition.lang = locale === "zh" ? "zh-CN" : "en-US";
    recognition.interimResults = false;

    const handleStart = () => setVoiceStatus(t("Listening...", "正在倾听…"));
    const handleEnd = () => setVoiceStatus(t("Ready for voice capture...", "语音输入待命…"));
    const handleResult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(" ");
      setInput((prev) => [prev, transcript].filter(Boolean).join(" ").trim());
      textareaRef.current?.focus();
    };

    recognition.addEventListener("start", handleStart);
    recognition.addEventListener("end", handleEnd);
    recognition.addEventListener("result", handleResult);

    recognitionRef.current = recognition;

    return () => {
      recognition.removeEventListener("start", handleStart);
      recognition.removeEventListener("end", handleEnd);
      recognition.removeEventListener("result", handleResult);
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [locale, t]);

  useEffect(() => {
    if (!session?.user?.id) {
      setSessionId(null);
      setMessages(createIntroMessages(locale));
      setQuestionIndex(1);
      setHasRecapped(false);
      setRecommendations([]);
      return;
    }

    const controller = new AbortController();
    setLoadingChat(true);

    const loadSession = async () => {
      try {
        const response = await fetch("/api/chat/session", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Failed to load chat session");
        }

        const data = (await response.json()) as {
          sessionId?: string;
          summary?: Summary | null;
          messages?: Message[];
        };

        setSessionId(data.sessionId ?? null);

        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages(createIntroMessages(locale));
        }

        if (data.summary) {
          setSummary(data.summary);
          const pointer = computeQuestionPointer(data.summary ?? {}, questions);
          setQuestionIndex(pointer >= questions.length ? questions.length : pointer);
          const hasCompleted = pointer >= questions.length;
          setHasRecapped(hasCompleted);
          if (hasCompleted) {
            setRefreshKey((prev) => prev + 1);
          }
        } else {
          setSummary({});
          setQuestionIndex(1);
          setHasRecapped(false);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.warn("Failed to load chat session", error);
          setMessages(createIntroMessages(locale));
        }
      } finally {
        setLoadingChat(false);
      }
    };

    loadSession();

    return () => {
      controller.abort();
    };
  }, [session?.user?.id, locale, questions]);

  useEffect(() => {
    const controller = new AbortController();
    setRecommendationsLoading(true);
    setRecommendationError(null);

    const payloadSummary = {
      location: summary.location ?? profile.city ?? null,
      priority: summary.priority ?? determinePriority(profile.priority) ?? null,
      credit: summary.credit ?? (profile.credit ? profile.credit.toString() : null),
      amount:
        summary.amount !== undefined
          ? summary.amount
          : profile.amount
          ? Number(profile.amount)
          : null
    };

    const hasMeaningfulInput =
      payloadSummary.location || payloadSummary.priority || payloadSummary.credit || payloadSummary.amount;

    const requestBody = {
      summary: hasMeaningfulInput ? payloadSummary : {},
      variant: refreshKey
    };

    fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Unable to fetch recommendations" }));
          throw new Error(body.error ?? "Unable to fetch recommendations");
        }
        return response.json() as Promise<{ recommendations: RecommendedBroker[] }>;
      })
      .then((data) => {
        setRecommendations(data.recommendations ?? []);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Recommendation fetch error", error);
        setRecommendationError(error.message ?? t("Unable to fetch recommendations.", "暂时无法获取推荐，请稍后再试。"));
        setRecommendations([]);
      })
      .finally(() => {
        setRecommendationsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [summary.location, summary.priority, summary.credit, summary.amount, profile.city, profile.priority, profile.credit, profile.amount, refreshKey, locale, t]);


  const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) {
      await signIn(undefined, { callbackUrl: "/" });
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: `msg-user-${Date.now()}`,
      author: "user",
      content: trimmed
    };

    const info = extractInformation(trimmed);
    const mergedSummary: Summary = { ...summary, ...info };

    const nextPointer = computeQuestionPointer(mergedSummary, questions);
    const shouldRefresh = nextPointer === questions.length && !hasRecapped;

    setSummary(mergedSummary);
    setQuestionIndex(nextPointer >= questions.length ? questions.length : nextPointer);
    setHasRecapped(nextPointer >= questions.length);
    if (shouldRefresh) {
      setRefreshKey((prev) => prev + 1);
    }

    const loadingId = `msg-ai-${Date.now() + 1}`;
    const loadingMessage: Message = {
      id: loadingId,
      author: "ai",
      content: t("Analyzing your profile...", "正在分析您的资料…")
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInput("");

    setLoadingChat(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: trimmed,
          summary: mergedSummary,
          pointer: nextPointer,
          shouldRecap: shouldRefresh,
          locale
        })
      });

      if (!response.ok) {
        throw new Error("Chat service returned an error.");
      }

      const body = (await response.json()) as {
        message?: string;
        sessionId?: string;
        summary?: Summary;
      };

      const aiContent =
        body.message ?? buildFallbackResponse(mergedSummary, nextPointer, shouldRefresh, locale, questions);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId ? { ...message, content: aiContent } : message
        )
      );
      setSessionId(body.sessionId ?? sessionId ?? null);
      setSummary(body.summary ?? mergedSummary);
    } catch (error) {
      console.error("AI chat error", error);
      const fallback = buildFallbackResponse(mergedSummary, nextPointer, shouldRefresh, locale, questions);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId ? { ...message, content: fallback } : message
        )
      );
    } finally {
      setLoadingChat(false);
    }
  };

  const handleChatReset = async () => {
    if (session) {
      try {
        const response = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset" })
        });

        if (response.ok) {
          const data = (await response.json()) as { sessionId?: string };
          setSessionId(data.sessionId ?? null);
        }
      } catch (error) {
        console.warn("Failed to reset chat session", error);
      }
    }
    setMessages(createIntroMessages(locale));
    setSummary({});
    setQuestionIndex(1);
    setHasRecapped(false);
    setRefreshKey((prev) => prev + 1);
    setInput("");
  };

  const handleVoiceClick = () => {
    if (!voiceSupported || !recognitionRef.current) {
      setVoiceStatus(t("Voice capture is unavailable in this browser.", "当前浏览器暂不支持语音输入。"));
      return;
    }
    try {
      recognitionRef.current.lang = locale === "zh" ? "zh-CN" : "en-US";
      recognitionRef.current.start();
    } catch (error) {
      setVoiceStatus(t("Voice capture is already running. Wrap up your phrase.", "语音识别正在进行，请先完成当前输入。"));
    }
  };

  const handleProfileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setProfile((prev) => ({ ...prev, [id]: value }));
  };

  const handleProfileSave = () => {
    try {
      window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    } catch (error) {
      console.warn("Failed to persist profile", error);
    }

    const profileSummary = summaryFromProfile(profile);
    setSummary((prev) => ({ ...prev, ...profileSummary }));
    setHasRecapped(true);
    setRefreshKey((prev) => prev + 1);
    displayStatus(setProfileStatus, t("Profile saved locally.", "资料已保存在本地。"));
  };

  const handleRefreshRecommendations = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleAgentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    displayStatus(
      setAgentStatus,
      t("Thanks for joining the Golden Bridge broker network. We'll notify you when we have a qualified borrower.", "感谢加入金桥经纪人网络，有匹配客户时会第一时间通知您。")
    );
    event.currentTarget.reset();
  };

  const handleReferralSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const advisorName = ((formData.get("referral-name") as string) || "golden")
      .replace(/\s+/g, "")
      .toLowerCase();
    const recipient = (formData.get("referral-email") as string) || "";
    const inviteCode = `${advisorName}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const baseUrl =
      (typeof window !== "undefined" && window.location.origin)
        || process.env.NEXT_PUBLIC_APP_URL
        || "https://goldenbridge.ai";
    const link = `${baseUrl.replace(/\/$/, "")}/invite/${inviteCode}`;
    setReferralLink(link);
    setReferralStatus(
      recipient
        ? (locale === "zh"
            ? `邀请链接已生成，准备发送至 ${recipient}`
            : `Invitation is ready and queued to email ${recipient}.`)
        : t("Share the link with your colleague to start their journey.", "复制链接发送给同事或朋友即可使用。")
    );
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-slate-900 to-slate-950 pb-24">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-1/3 left-1/4 h-80 w-80 rounded-full bg-brand-primary/20 blur-3xl" />
          <div className="absolute top-1/4 right-1/3 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
        </div>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pt-10 md:px-10">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="rounded-full border border-brand-primary/40 px-4 py-1 text-sm uppercase tracking-widest text-brand-primary">
                Golden Bridge
              </span>
              <p className="text-sm text-slate-300">{t("AI-native mortgage intelligence", "AI 原生抵押贷款智能平台")}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "zh" : "en")}
                className="hidden rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-primary/60 hover:text-brand-primary sm:inline"
              >
                {locale === "zh" ? "English" : "中文"}
              </button>
              {session ? (
                <>
                  <span className="hidden text-sm text-slate-200 sm:inline">
                    {session.user.name ?? session.user.email} · {(() => {
                      switch (session.user.role) {
                        case "BROKER":
                          return t("Broker", "经纪人");
                        case "ADMIN":
                          return t("Admin", "管理员");
                        default:
                          return t("Borrower", "借款人");
                      }
                    })()}
                  </span>
                  {(session.user.role === "BROKER" || session.user.role === "ADMIN") && (
                    <Link
                      href="/dashboard/broker"
                      className="rounded-full border border-brand-primary/40 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:-translate-y-0.5 hover:bg-brand-primary/10"
                    >
                      Broker dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-primary/60 hover:text-brand-primary"
                  >
                    {t("Sign out", "退出登录")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => signIn(undefined, { callbackUrl: "/" })}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-primary/60 hover:text-brand-primary"
                  >
                    {t("Sign in", "登录")}
                  </button>
                  <a
                    href="/signup"
                    className="hidden rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:shadow-brand-primary/50 sm:inline"
                  >
                    {t("Create account", "注册账号")}
                  </a>
                </>
              )}
            </div>
          </nav>

          <div className="grid items-center gap-16 md:grid-cols-[1.2fr,1fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                {t("AI concierge powering borrowers and brokers", "AI 助力借款人与经纪人")}
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                {t("One platform. Tailored lending clarity.", "一站式平台，快速理清最优贷款方案。")}
                <span className="text-brand-primary"> {t("In minutes.", "几分钟内完成。")} </span>
              </h1>
              <p className="max-w-xl text-lg text-slate-300">
                {t(
                  "Capture borrower intent with conversational intelligence, surface the best-fit loan products instantly, and rally top-performing brokers under one secure workspace.",
                  "对话式智能迅速梳理借款需求，实时匹配合适贷款方，并在同一平台协调顶尖经纪人。"
                )}
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#borrower-hub"
                  className="rounded-full bg-brand-primary px-6 py-3 font-semibold text-brand-dark shadow-xl shadow-brand-primary/30 transition hover:-translate-y-0.5"
                >
                  {t("Start the discovery", "开启智能匹配")}
                </a>
                <a
                  href="#network"
                  className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white transition hover:border-brand-accent/60 hover:text-brand-accent"
                >
                  {t("Explore lender network", "查看贷款网络")}
                </a>
              </div>
              <dl className="grid max-w-lg grid-cols-2 gap-6 text-sm text-slate-300">
                <div>
                  <dt className="font-semibold text-white">{t("Conversational onboarding", "智能对话式引导")}</dt>
                  <dd>{t("English-first guidance, voice or text input, zero friction.", "支持中英文语音/文字输入，顺畅采集需求。")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">{t("Intelligent matching engine", "智能匹配引擎")}</dt>
                  <dd>{t("Filters by state licensing, product fit, rate, and velocity.", "综合执照覆盖、产品匹配、利率与放款速度评分。")}</dd>
                </div>
              </dl>
            </div>

            <div className="gradient-border">
              <div className="relative rounded-[22px] bg-slate-900/80 p-10 backdrop-blur">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
                  <span>Loan Fit Heatmap</span>
                  <span>Real-time</span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
                  {[
                    "Rate",
                    "Speed",
                    "Documentation",
                    "Broker Fit",
                    "Success",
                    "Closing Confidence"
                  ].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/5 bg-slate-900/60 p-4 text-center text-slate-300"
                    >
                      <p className="text-3xl font-semibold text-brand-primary">
                        {Math.floor(Math.random() * 15) + 85}%
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-widest">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs text-slate-400">
                  Scores update as borrowers share more context. Brokers only see qualified opportunities - no more cold leads.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 pb-24 pt-10 md:px-10">
        <section id="borrower-hub" className="space-y-10">
          <header className="space-y-4">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t("Borrower Discovery Hub", "借款人智能引导中心")}</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              {t(
                "Capture the complete lending brief once. Golden Bridge stores the context securely so your next conversation or lender intake begins with instant momentum.",
                "只需沟通一次就可完整记录贷款要点，后续对接和比较都能快速展开。"
              )}
            </p>
          </header>

          <div className="grid gap-10 lg:grid-cols-[1.5fr,1fr]">
            <div className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{t("Conversation with Golden Bridge AI", "与金桥 AI 对话")}</h3>
                  <p className="text-sm text-slate-400">{t("English-first dialogue. Share details by typing or speaking.", "支持中文/英文语音与文字输入，随时补充需求。")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleVoiceClick}
                    className="rounded-full border border-brand-accent/50 px-4 py-2 text-sm text-brand-accent transition hover:bg-brand-accent/10"
                  >
                    {voiceSupported ? t("Start voice capture", "开启语音输入") : t("Voice unsupported", "当前浏览器不支持语音")}
                  </button>
                  <span className="text-xs text-slate-400">{voiceStatus}</span>
                </div>
              </div>

              <div ref={chatContainerRef} className="flex h-80 flex-col gap-4 overflow-y-auto rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`w-full rounded-2xl border p-4 text-sm leading-relaxed ${
                      message.author === "ai"
                        ? "border-brand-primary/30 bg-brand-primary/5 text-brand-primary/90"
                        : "border-brand-accent/30 bg-brand-accent/10 text-slate-100"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-widest text-slate-400">
                      {message.author === "ai" ? "Golden Bridge AI" : "You"}
                    </p>
                    <p className="mt-2 whitespace-pre-line">{message.content}</p>
                  </div>
                ))}
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleChatSubmit}>
                <label className="text-sm font-semibold text-white" htmlFor="borrower-input">
                  {t("Tell us more about your financing goals", "请描述您的贷款需求")}
                </label>
                <textarea
                  id="borrower-input"
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/40"
                  placeholder={t(
                    "Example: Buying in Austin, TX this summer. Credit score 720, aiming for $700k, top priority is keeping the interest rate as low as possible.",
                    "示例：计划在洛杉矶购房，信用分 720，预算 70 万美金，希望利率越低越好。"
                  )}
                />
                <div className="flex flex-wrap justify-end gap-3 text-sm">
                  <button
                    type="button"
                    onClick={handleChatReset}
                    className="rounded-full border border-white/15 px-4 py-2 text-slate-300 transition hover:border-brand-accent/60 hover:text-brand-accent"
                  >
                    {t("Reset conversation", "重新开始")}
                  </button>
                  <button
                    type="submit"
                    disabled={loadingChat}
                    className="rounded-full bg-brand-primary px-6 py-2 font-semibold text-brand-dark shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("Send to AI", "发送给 AI")}
                  </button>
                </div>
              </form>
            </div>

            <aside className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-2xl shadow-black/20">
              <div>
                <h3 className="text-xl font-semibold text-white">{t("Borrower Snapshot", "借款人资料快照")}</h3>
                <p className="text-sm text-slate-400">
                  {t("Stored locally in your browser. Reuse across every lender handshake - no repeated paperwork.", "资料仅保存在本地，再次沟通或匹配可直接复用，免去重复提交。")}
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <InputField
                  id="name"
                  label={t("Full name", "姓名")}
                  placeholder={t("Alex Morgan", "张三")}
                  value={profile.name}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="city"
                  label={t("Property location (City, State)", "房产所在城市 / 州")}
                  placeholder={t("Seattle, WA", "Los Angeles, CA")}
                  value={profile.city}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="credit"
                  type="number"
                  label={t("Credit score", "信用分")}
                  placeholder="720"
                  value={profile.credit}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="amount"
                  type="number"
                  label={t("Target loan amount (USD)", "预计贷款金额 (USD)")}
                  placeholder="700000"
                  value={profile.amount}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="priority"
                  label={t("Top priority", "最看重的条件")}
                  placeholder={t("Low rate, max leverage, fast close, or minimal documents", "例如：利率低 / 成数高 / 放款快 / 资料最少")}
                  value={profile.priority}
                  onChange={handleProfileChange}
                />
              </div>
              <button
                type="button"
                onClick={handleProfileSave}
                className="rounded-full bg-brand-accent/20 px-6 py-2 text-sm font-semibold text-brand-accent transition hover:bg-brand-accent/30"
              >
                {t("Save borrower profile", "保存资料")}
              </button>
              {profileStatus && <p className="text-xs text-emerald-300">{profileStatus}</p>}
            </aside>
          </div>
        </section>

        <section className="space-y-8">
          <header className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t("Golden Bridge Picks - Top 3 Matches", "金桥精选——三家优选贷款方")}</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              {t(
                "AI curation weighs licensing coverage, product fit, interest rate, and close-rate velocity. Refresh to explore alternative matches without losing your saved profile.",
                "AI 依据执照覆盖、产品匹配度、利率与放款速度综合评分。若不满意可刷新查看其他候选。"
              )}
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((broker) => {
              const rateLabel = (() => {
                if (broker.minRate !== null && broker.maxRate !== null) {
                  return `${broker.minRate.toFixed(2)}% - ${broker.maxRate.toFixed(2)}%`;
                }
                if (broker.minRate !== null) {
                  return `${broker.minRate.toFixed(2)}%`;
                }
                if (broker.maxRate !== null) {
                  return `${broker.maxRate.toFixed(2)}% ${t("cap", "封顶")}`;
                }
                return t("Rate info on request", "利率信息可咨询");
              })();
              const noteText = (() => {
                if (!broker.notes) return null;
                const base = locale === "zh" ? translateText(broker.notes) : broker.notes;
                return base.length > 220 ? `${base.slice(0, 220)}…` : base;
              })();

              return (
                <article
                  key={broker.id}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-6 shadow-xl shadow-black/20"
                >
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">
                      {broker.licenseStates.length
                        ? broker.licenseStates.join(", ")
                        : t("Nationwide availability", "各州均可协助")}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {broker.company ?? broker.lenderName}
                    </h3>
                    <span className="inline-block rounded-full border border-brand-primary/40 px-2 py-1 text-xs text-brand-primary">{(() => {
                      switch (broker.category) {
                        case "lowestRate":
                          return t("Best for low rates", "低利率优选");
                        case "highestLtv":
                          return t("Max leverage pick", "最高成数") ;
                        case "fastestClosing":
                          return t("Fast closing", "放款最快");
                        default:
                          return t("Alternative match", "备选推荐");
                      }
                    })()}</span>
                  {broker.headline && (
                    <p className="mt-1 text-sm text-slate-300">
                      {locale === "zh"
                        ? translateText(broker.headline)
                        : broker.headline}
                    </p>
                  )}
                </div>
                  <ul className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <li className="rounded-full bg-white/5 px-3 py-1">{t("Rate:", "利率：")} {rateLabel}</li>
                    {broker.maxLoanToValue !== null && (
                      <li className="rounded-full bg-white/5 px-3 py-1">{t("LTV up to", "最高成数") } {broker.maxLoanToValue}%</li>
                    )}
                    {broker.minCreditScore !== null && (
                      <li className="rounded-full bg-white/5 px-3 py-1">{t("Credit", "信用分")} {broker.minCreditScore}+</li>
                    )}
                    {broker.yearsExperience !== null && (
                      <li className="rounded-full bg-white/5 px-3 py-1">{broker.yearsExperience}{t("+ yrs experience", " 年从业经验")}</li>
                    )}
                  </ul>
                  {broker.loanPrograms.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      {broker.loanPrograms.map((program) => (
                        <span key={program} className="rounded-full border border-white/10 px-3 py-1">
                          {locale === "zh" ? translateLoanProgram(program) : program}
                        </span>
                      ))}
                    </div>
                  )}
                  {noteText && <p className="text-xs text-slate-400">{noteText}</p>}
                  {broker.website && (
                    <a
                      href={broker.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-primary hover:underline"
                    >
                      {t("Visit broker site", "查看经纪人官网")}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      displayStatus(
                        setMatchStatus,
                        locale === "zh"
                          ? `${broker.lenderName} 已收到通知，平台将协助后续对接。`
                          : `${broker.lenderName} has been notified. The platform will coordinate follow-up.`
                      )
                    }
                    className="mt-auto rounded-full border border-brand-primary/60 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10"
                  >
                    {t("Notify the platform broker", "通知平台经纪人")}
                  </button>
                </article>
              );
            })}
          </div>
          {recommendationsLoading && <p className="text-sm text-slate-400">{t("Updating recommendations…", "正在刷新推荐…")}</p>}
          {recommendationError && <p className="text-sm text-red-300">{recommendationError}</p>}
          {matchStatus && <p className="text-sm text-emerald-300">{matchStatus}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRefreshRecommendations}
              className="rounded-full border border-white/20 px-6 py-2 text-sm text-slate-300 transition hover:border-brand-accent/60 hover:text-brand-accent"
            >
              {t("Refresh the lineup", "刷新推荐")}
            </button>
          </div>
        </section>

        <section id="network" className="space-y-6">
          <header className="space-y-3">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t("Golden Bridge Lender Network", "金桥精选贷款网络")}</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              {t(
                'A curated data spine of ten high-performing "Smile Curve" states. Products and brokers update continuously - ready for instant borrower matchmaking.',
                "覆盖美国“微笑曲线”十个核心州，持续更新优质贷款产品与经纪人，随时可对接。"
              )}
            </p>
          </header>

          <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/80 shadow-xl shadow-black/20">
            <table className="min-w-full divide-y divide-white/5 text-left text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-6 py-4">{t("State", "州")}</th>
                  <th className="px-6 py-4">{t("Lender", "贷款方")}</th>
                  <th className="px-6 py-4">{t("Product spotlight", "产品亮点")}</th>
                  <th className="px-6 py-4">{t("Featured broker", "推荐经纪人")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loanDirectory.map((entry) => (
                  <tr key={`${entry.state}-${entry.lender}`} className="hover:bg-white/5">
                    <td className="px-6 py-5 text-white">{entry.state}</td>
                    <td className="px-6 py-5 font-semibold text-white">{entry.lender}</td>
                    <td className="px-6 py-5 text-slate-300">
                      <p>{entry.product}</p>
                      <p className="mt-1 text-xs text-slate-400">{entry.highlight}</p>
                    </td>
                    <td className="px-6 py-5 text-slate-300">{entry.broker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="broker-hub" className="space-y-10">
          <header className="space-y-4">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t("Broker Studio", "经纪人工作台")}</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              {t(
                "Showcase your lending edge, upload marketing assets, and receive deal-ready introductions with privacy safeguards baked in.",
                "展示团队优势、上传宣传材料，并在平台保护下接收匹配成功的借款人线索。"
              )}
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-xl shadow-black/20">
              <h3 className="text-2xl font-semibold text-white">{t("Brand Showcase", "品牌展示位")}</h3>
              <p className="text-sm text-slate-300">
                {t(
                  "Upload product spotlights, niche vertical wins, and testimonials. Golden Bridge packages your story directly inside borrower journeys.",
                  "上传特色产品、成功案例与口碑，金桥会将这些亮点融入借款人旅程。"
                )}
              </p>
              <button
                type="button"
                onClick={() =>
                  displayStatus(
                    setAgentStatus,
                    t(
                      "Upload portal unlocked in your broker dashboard. Our team will reach out to help tailor the reveal.",
                      "已为您开启上传入口，团队将协助完善展示内容。"
                    )
                  )
                }
                className="rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-brand-dark transition hover:-translate-y-0.5"
              >
                {t("Submit showcase assets", "提交宣传资料")}
              </button>
              {agentStatus && <p className="text-xs text-emerald-300">{agentStatus}</p>}
            </div>

            <form
              onSubmit={handleAgentSubmit}
              className="flex flex-col gap-5 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-xl shadow-black/20"
            >
              <div>
                <h3 className="text-2xl font-semibold text-white">{t("Ready-to-Engage Alerts", "意向提醒")}</h3>
                <p className="text-sm text-slate-300">
                  {t("Enter your coverage zones and we'll ping you the moment a fit borrower confirms interest.", "填写执业范围后，一旦有匹配客户确认兴趣，会即时通知您。")}
                </p>
              </div>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                {t("Work email", "工作邮箱")}
                <input
                  required
                  name="agent-email"
                  type="email"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                  placeholder="you@brokerage.com"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                {t("Licensed states", "执业州")}
                <input
                  required
                  name="agent-state"
                  type="text"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                  placeholder="CA, NY, TX"
                />
              </label>
              <button
                type="submit"
                className="rounded-full border border-brand-accent/60 px-6 py-2 text-sm font-semibold text-brand-accent transition hover:bg-brand-accent/10"
              >
                {t("Join the broker network", "加入经纪人网络")}
              </button>
              {agentStatus && <p className="text-xs text-emerald-300">{agentStatus}</p>}
            </form>
          </div>
        </section>

        <section className="space-y-6">
          <header className="space-y-3">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t("Share Golden Bridge", "邀请好友体验金桥")}</h2>
            <p className="max-w-2xl text-lg text-slate-300">
              {t("Invite partners and friends. Every referral enters with your curated borrower intelligence preloaded.", "生成专属邀请链接，朋友接入即可沿用已有的借款资料。")}
            </p>
          </header>

          <form
            onSubmit={handleReferralSubmit}
            className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-xl shadow-black/20 md:flex-row md:items-end"
          >
            <label className="flex-1 text-sm text-slate-300">
              {t("Your name", "您的姓名")}
              <input
                type="text"
                name="referral-name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                placeholder="Golden Bridge Advisor"
              />
            </label>
            <label className="flex-1 text-sm text-slate-300">
              {t("Friend or partner email", "朋友或同事邮箱")}
              <input
                type="email"
                name="referral-email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                placeholder="friend@example.com"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-brand-primary px-6 py-3 font-semibold text-brand-dark transition hover:-translate-y-0.5"
            >
              {t("Generate invite link", "生成邀请链接")}
            </button>
          </form>
          {referralLink && (
            <div className="rounded-2xl border border-brand-primary/40 bg-brand-primary/5 p-6 text-sm text-brand-primary">
              <p className="font-semibold">{t("Referral link ready:", "邀请链接已生成：")}</p>
              <p className="mt-2 break-all text-brand-primary/90">{referralLink}</p>
              {referralStatus && <p className="mt-2 text-xs text-brand-primary/70">{referralStatus}</p>}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/80 py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <p className="font-semibold text-slate-200">Golden Bridge Loan</p>
            <p>
              {t("Copyright", "版权")} {new Date().getFullYear()} {t("All rights reserved.", "保留所有权利。")}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">{t("Contact", "联系方式")}</p>
            <p>info@goldenbridge.ai</p>
          </div>
          <div className="max-w-md">
            <p className="font-semibold text-slate-200">{t("Compliance", "合规提示")}</p>
            <p>
              {t(
                "Golden Bridge Loan surfaces intelligence and introductions. Final approvals and disclosures are completed by licensed lending partners.",
                "金桥平台仅提供智能匹配与引荐，最终审批与披露由持牌贷款机构完成。"
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

type InputFieldProps = {
  id: keyof ProfileFormState;
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function InputField({ id, label, placeholder, type = "text", value, onChange }: InputFieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300" htmlFor={id}>
      {label}
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
      />
    </label>
  );
}

function displayStatus(setter: (message: string | null) => void, message: string): void {
  setter(message);
  setTimeout(() => setter(null), 3200);
}

function summaryFromProfile(profile: ProfileFormState): Summary {
  const amountValue = profile.amount ? Number(profile.amount) : undefined;
  return {
    location: profile.city || undefined,
    credit: profile.credit || undefined,
    amount: Number.isFinite(amountValue) ? amountValue : undefined,
    priority: determinePriority(profile.priority)
  };
}
