"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { loanDirectory } from "@/lib/loan-data";
import {
  buildFallbackResponse,
  chatQuestions,
  computeQuestionPointer,
  determinePriority,
  extractInformation,
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

const introMessages: Message[] = [
  {
    id: "msg-ai-0",
    author: "ai",
    content:
      "Welcome to Golden Bridge Loan. I'm your AI lending guide - let's map out the perfect financing game plan for you."
  },
  {
    id: "msg-ai-1",
    author: "ai",
    content: chatQuestions[0]
  }
];

export function HomePage(): JSX.Element {
  const { data: session } = useSession();

  const [messages, setMessages] = useState<Message[]>(introMessages);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [questionIndex, setQuestionIndex] = useState<number>(1);
  const [hasRecapped, setHasRecapped] = useState<boolean>(false);
  const [summary, setSummary] = useState<Summary>({});
  const [input, setInput] = useState<string>("");
  const [voiceStatus, setVoiceStatus] = useState<string>("Ready for voice capture...");
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
  }, []);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!ctor) {
      setVoiceSupported(false);
      setVoiceStatus("Voice capture is unavailable in this browser.");
      return;
    }

    const recognition = new ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    const handleStart = () => setVoiceStatus("Listening...");
    const handleEnd = () => setVoiceStatus("Ready for voice capture...");
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
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setSessionId(null);
      setMessages(introMessages);
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
          setMessages(introMessages);
        }

        if (data.summary) {
          setSummary(data.summary);
          const pointer = computeQuestionPointer(data.summary);
          setQuestionIndex(pointer >= chatQuestions.length ? chatQuestions.length : pointer);
          const hasCompleted = pointer >= chatQuestions.length;
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
          setMessages(introMessages);
        }
      } finally {
        setLoadingChat(false);
      }
    };

    loadSession();

    return () => {
      controller.abort();
    };
  }, [session?.user?.id]);

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
        setRecommendationError(error.message ?? "Unable to fetch recommendations.");
        setRecommendations([]);
      })
      .finally(() => {
        setRecommendationsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [summary.location, summary.priority, summary.credit, summary.amount, profile.city, profile.priority, profile.credit, profile.amount, refreshKey]);


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

    const nextPointer = computeQuestionPointer(mergedSummary);
    const shouldRefresh = nextPointer === chatQuestions.length && !hasRecapped;

    setSummary(mergedSummary);
    setQuestionIndex(nextPointer >= chatQuestions.length ? chatQuestions.length : nextPointer);
    setHasRecapped(nextPointer >= chatQuestions.length);
    if (shouldRefresh) {
      setRefreshKey((prev) => prev + 1);
    }

    const loadingId = `msg-ai-${Date.now() + 1}`;
    const loadingMessage: Message = {
      id: loadingId,
      author: "ai",
      content: "Analyzing your profile..."
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
          shouldRecap: shouldRefresh
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
        body.message ?? buildFallbackResponse(mergedSummary, nextPointer, shouldRefresh);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId ? { ...message, content: aiContent } : message
        )
      );
      setSessionId(body.sessionId ?? sessionId ?? null);
      setSummary(body.summary ?? mergedSummary);
    } catch (error) {
      console.error("AI chat error", error);
      const fallback = buildFallbackResponse(mergedSummary, nextPointer, shouldRefresh);
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
    setMessages(introMessages);
    setSummary({});
    setQuestionIndex(1);
    setHasRecapped(false);
    setRefreshKey((prev) => prev + 1);
    setInput("");
  };

  const handleVoiceClick = () => {
    if (!voiceSupported || !recognitionRef.current) {
      setVoiceStatus("Voice capture is unavailable in this browser.");
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (error) {
      setVoiceStatus("Voice capture is already running. Wrap up your phrase.");
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
    displayStatus(setProfileStatus, "Profile saved locally.");
  };

  const handleRefreshRecommendations = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleAgentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    displayStatus(
      setAgentStatus,
      "Thanks for joining the Golden Bridge broker network. We'll notify you when we have a qualified borrower."
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
        ? `Invitation is ready and queued to email ${recipient}.`
        : "Share the link with your colleague to start their journey."
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
              <p className="text-sm text-slate-300">AI-native mortgage intelligence</p>
            </div>
            <div className="flex items-center gap-3">
              {session ? (
                <>
                  <span className="hidden text-sm text-slate-200 sm:inline">
                    {session.user.name ?? session.user.email} · {session.user.role ?? "Borrower"}
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
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => signIn(undefined, { callbackUrl: "/" })}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-primary/60 hover:text-brand-primary"
                  >
                    Sign in
                  </button>
                  <a
                    href="/signup"
                    className="hidden rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:shadow-brand-primary/50 sm:inline"
                  >
                    Create account
                  </a>
                </>
              )}
            </div>
          </nav>

          <div className="grid items-center gap-16 md:grid-cols-[1.2fr,1fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                AI concierge powering borrowers and brokers
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                One platform. Tailored lending clarity. <span className="text-brand-primary">In minutes.</span>
              </h1>
              <p className="max-w-xl text-lg text-slate-300">
                Capture borrower intent with conversational intelligence, surface the best-fit loan products instantly, and
                rally top-performing brokers under one secure workspace.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#borrower-hub"
                  className="rounded-full bg-brand-primary px-6 py-3 font-semibold text-brand-dark shadow-xl shadow-brand-primary/30 transition hover:-translate-y-0.5"
                >
                  Start the discovery
                </a>
                <a
                  href="#network"
                  className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white transition hover:border-brand-accent/60 hover:text-brand-accent"
                >
                  Explore lender network
                </a>
              </div>
              <dl className="grid max-w-lg grid-cols-2 gap-6 text-sm text-slate-300">
                <div>
                  <dt className="font-semibold text-white">Conversational onboarding</dt>
                  <dd>English-first guidance, voice or text input, zero friction.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Intelligent matching engine</dt>
                  <dd>Filters by state licensing, product fit, rate, and velocity.</dd>
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
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Borrower Discovery Hub</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              Capture the complete lending brief once. Golden Bridge stores the context securely so your next conversation or lender
              intake begins with instant momentum.
            </p>
          </header>

          <div className="grid gap-10 lg:grid-cols-[1.5fr,1fr]">
            <div className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Conversation with Golden Bridge AI</h3>
                  <p className="text-sm text-slate-400">English-first dialogue. Share details by typing or speaking.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleVoiceClick}
                    className="rounded-full border border-brand-accent/50 px-4 py-2 text-sm text-brand-accent transition hover:bg-brand-accent/10"
                  >
                    {voiceSupported ? "Start voice capture" : "Voice unsupported"}
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
                  Tell us more about your financing goals
                </label>
                <textarea
                  id="borrower-input"
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/40"
                  placeholder="Example: Buying in Austin, TX this summer. Credit score 720, aiming for $700k, top priority is keeping the interest rate as low as possible."
                />
                <div className="flex flex-wrap justify-end gap-3 text-sm">
                  <button
                    type="button"
                    onClick={handleChatReset}
                    className="rounded-full border border-white/15 px-4 py-2 text-slate-300 transition hover:border-brand-accent/60 hover:text-brand-accent"
                  >
                    Reset conversation
                  </button>
                  <button
                    type="submit"
                    disabled={loadingChat}
                    className="rounded-full bg-brand-primary px-6 py-2 font-semibold text-brand-dark shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send to AI
                  </button>
                </div>
              </form>
            </div>

            <aside className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-2xl shadow-black/20">
              <div>
                <h3 className="text-xl font-semibold text-white">Borrower Snapshot</h3>
                <p className="text-sm text-slate-400">
                  Stored locally in your browser. Reuse across every lender handshake - no repeated paperwork.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <InputField
                  id="name"
                  label="Full name"
                  placeholder="Alex Morgan"
                  value={profile.name}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="city"
                  label="Property location (City, State)"
                  placeholder="Seattle, WA"
                  value={profile.city}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="credit"
                  type="number"
                  label="Credit score"
                  placeholder="720"
                  value={profile.credit}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="amount"
                  type="number"
                  label="Target loan amount (USD)"
                  placeholder="700000"
                  value={profile.amount}
                  onChange={handleProfileChange}
                />
                <InputField
                  id="priority"
                  label="Top priority"
                  placeholder="Low rate, max leverage, fast close, or minimal documents"
                  value={profile.priority}
                  onChange={handleProfileChange}
                />
              </div>
              <button
                type="button"
                onClick={handleProfileSave}
                className="rounded-full bg-brand-accent/20 px-6 py-2 text-sm font-semibold text-brand-accent transition hover:bg-brand-accent/30"
              >
                Save borrower profile
              </button>
              {profileStatus && <p className="text-xs text-emerald-300">{profileStatus}</p>}
            </aside>
          </div>
        </section>

        <section className="space-y-8">
          <header className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Golden Bridge Picks - Top 3 Matches</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              AI curation weighs licensing coverage, product fit, interest rate, and close-rate velocity. Refresh to explore alternative
              matches without losing your saved profile.
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
                  return `${broker.maxRate.toFixed(2)}% cap`;
                }
                return "Rate info on request";
              })();

              return (
                <article
                  key={broker.id}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-6 shadow-xl shadow-black/20"
                >
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">
                      {broker.licenseStates.length ? broker.licenseStates.join(", ") : "Nationwide availability"}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {broker.company ?? broker.lenderName}
                    </h3>
                    {broker.headline && <p className="mt-1 text-sm text-slate-300">{broker.headline}</p>}
                  </div>
                  <ul className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <li className="rounded-full bg-white/5 px-3 py-1">Rate: {rateLabel}</li>
                    {broker.maxLoanToValue !== null && (
                      <li className="rounded-full bg-white/5 px-3 py-1">LTV up to {broker.maxLoanToValue}%</li>
                    )}
                    {broker.minCreditScore !== null && (
                      <li className="rounded-full bg-white/5 px-3 py-1">Credit {broker.minCreditScore}+</li>
                    )}
                    {broker.yearsExperience !== null && (
                      <li className="rounded-full bg-white/5 px-3 py-1">{broker.yearsExperience}+ yrs experience</li>
                    )}
                  </ul>
                  {broker.loanPrograms.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      {broker.loanPrograms.map((program) => (
                        <span key={program} className="rounded-full border border-white/10 px-3 py-1">
                          {program}
                        </span>
                      ))}
                    </div>
                  )}
                  {broker.notes && (
                    <p className="text-xs text-slate-400">
                      {broker.notes.length > 220 ? `${broker.notes.slice(0, 220)}…` : broker.notes}
                    </p>
                  )}
                  {broker.website && (
                    <a
                      href={broker.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-primary hover:underline"
                    >
                      Visit broker site
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      displayStatus(
                        setMatchStatus,
                        `${broker.lenderName} 已收到通知，平台将协助后续对接。`
                      )
                    }
                    className="mt-auto rounded-full border border-brand-primary/60 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10"
                  >
                    Notify the platform broker
                  </button>
                </article>
              );
            })}
          </div>
          {recommendationsLoading && <p className="text-sm text-slate-400">Updating recommendations…</p>}
          {recommendationError && <p className="text-sm text-red-300">{recommendationError}</p>}
          {matchStatus && <p className="text-sm text-emerald-300">{matchStatus}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRefreshRecommendations}
              className="rounded-full border border-white/20 px-6 py-2 text-sm text-slate-300 transition hover:border-brand-accent/60 hover:text-brand-accent"
            >
              Refresh the lineup
            </button>
          </div>
        </section>

        <section id="network" className="space-y-6">
          <header className="space-y-3">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Golden Bridge Lender Network</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              A curated data spine of ten high-performing &quot;Smile Curve&quot; states. Products and brokers update continuously - ready
              for instant borrower matchmaking.
            </p>
          </header>

          <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/80 shadow-xl shadow-black/20">
            <table className="min-w-full divide-y divide-white/5 text-left text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-6 py-4">State</th>
                  <th className="px-6 py-4">Lender</th>
                  <th className="px-6 py-4">Product spotlight</th>
                  <th className="px-6 py-4">Featured broker</th>
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
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Broker Studio</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              Showcase your lending edge, upload marketing assets, and receive deal-ready introductions with privacy safeguards baked in.
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-xl shadow-black/20">
              <h3 className="text-2xl font-semibold text-white">Brand Showcase</h3>
              <p className="text-sm text-slate-300">
                Upload product spotlights, niche vertical wins, and testimonials. Golden Bridge packages your story directly inside borrower
                journeys.
              </p>
              <button
                type="button"
                onClick={() =>
                  displayStatus(
                    setAgentStatus,
                    "Upload portal unlocked in your broker dashboard. Our team will reach out to help tailor the reveal."
                  )
                }
                className="rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-brand-dark transition hover:-translate-y-0.5"
              >
                Submit showcase assets
              </button>
              {agentStatus && <p className="text-xs text-emerald-300">{agentStatus}</p>}
            </div>

            <form
              onSubmit={handleAgentSubmit}
              className="flex flex-col gap-5 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-xl shadow-black/20"
            >
              <div>
                <h3 className="text-2xl font-semibold text-white">Ready-to-Engage Alerts</h3>
                <p className="text-sm text-slate-300">
                  Enter your coverage zones and we&apos;ll ping you the moment a fit borrower confirms interest.
                </p>
              </div>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Work email
                <input
                  required
                  name="agent-email"
                  type="email"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                  placeholder="you@brokerage.com"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Licensed states
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
                Join the broker network
              </button>
              {agentStatus && <p className="text-xs text-emerald-300">{agentStatus}</p>}
            </form>
          </div>
        </section>

        <section className="space-y-6">
          <header className="space-y-3">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Share Golden Bridge</h2>
            <p className="max-w-2xl text-lg text-slate-300">
              Invite partners and friends. Every referral enters with your curated borrower intelligence preloaded.
            </p>
          </header>

          <form
            onSubmit={handleReferralSubmit}
            className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/80 p-8 shadow-xl shadow-black/20 md:flex-row md:items-end"
          >
            <label className="flex-1 text-sm text-slate-300">
              Your name
              <input
                type="text"
                name="referral-name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                placeholder="Golden Bridge Advisor"
              />
            </label>
            <label className="flex-1 text-sm text-slate-300">
              Friend or partner email
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
              Generate invite link
            </button>
          </form>
          {referralLink && (
            <div className="rounded-2xl border border-brand-primary/40 bg-brand-primary/5 p-6 text-sm text-brand-primary">
              <p className="font-semibold">Referral link ready:</p>
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
            <p>Copyright {new Date().getFullYear()} All rights reserved.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">Contact</p>
            <p>info@goldenbridge.ai</p>
          </div>
          <div className="max-w-md">
            <p className="font-semibold text-slate-200">Compliance</p>
            <p>
              Golden Bridge Loan surfaces intelligence and introductions. Final approvals and disclosures are completed by licensed lending
              partners.
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

