"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type ConversationSummary = {
  id: string;
  lastMessageAt: string;
  status: "ACTIVE" | "CLOSED";
  viewerRole: "BORROWER" | "BROKER";
  borrower: {
    id: string;
    name: string | null;
    email: string | null;
  };
  broker: {
    id: string;
    name: string | null;
    email: string | null;
    brokerProfile?: {
      company: string | null;
      headline: string | null;
    } | null;
  };
  lastMessage: {
    id: string;
    senderType: "BORROWER" | "BROKER" | "SYSTEM";
    content: string;
    createdAt: string;
  } | null;
};

type ConversationDetail = {
  conversation: ConversationSummary;
  messages: BrokerMessage[];
  viewerRole: "BORROWER" | "BROKER";
};

type BrokerMessage = {
  id: string;
  senderId: string;
  senderType: "BORROWER" | "BROKER" | "SYSTEM";
  content: string;
  createdAt: string;
};

const fetchJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const errorMessage = (payload as { error?: string }).error ?? "Request failed";
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
};

const formatTime = (input: string): string => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(date);
};

export function BrokerConversationCenter(): JSX.Element {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setConversationError(null);
    try {
      const data = await fetchJson<{ conversations: ConversationSummary[] }>("/api/broker/conversations");
      const sorted = [...(data.conversations ?? [])].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
      setConversations(sorted);
      if (!selectedConversationId && sorted.length) {
        setSelectedConversationId(sorted[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load conversations";
      setConversationError(message);
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId]);

  const loadConversationDetail = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      setMessageError(null);
      try {
        const data = await fetchJson<ConversationDetail>(`/api/broker/conversations/${conversationId}/messages`);
        setActiveConversation(data);
        setSelectedConversationId(conversationId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load messages";
        setMessageError(message);
      } finally {
        setMessagesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadConversations().catch((error) => console.error(error));
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConversationId) {
      loadConversationDetail(selectedConversationId).catch((error) => console.error(error));
    } else {
      setActiveConversation(null);
    }
  }, [selectedConversationId, loadConversationDetail]);

  useEffect(() => {
    if (!messageEndRef.current) return;
    messageEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length]);

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversationId || !messageInput.trim()) return;

    setSending(true);
    setMessageError(null);

    try {
      const payload = await fetchJson<{ message: BrokerMessage }>(
        `/api/broker/conversations/${selectedConversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: messageInput.trim() })
        }
      );

      setMessageInput("");
      setActiveConversation((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, payload.message]
            }
          : prev
      );
      // refresh list to update last message preview
      loadConversations().catch((error) => console.error(error));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send";
      setMessageError(message);
    } finally {
      setSending(false);
    }
  };

  const activeMessages = activeConversation?.messages ?? [];
  const viewerRole = activeConversation?.viewerRole ?? "BROKER";

  const participantName = useMemo(() => {
    if (!activeConversation) return "";
    return activeConversation.conversation.borrower.name ?? activeConversation.conversation.borrower.email ?? "Borrower";
  }, [activeConversation]);

  return (
    <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 lg:grid-cols-[320px,1fr]">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:border-b-0 lg:border-r lg:pr-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Borrower Chats</p>
            <p className="text-xs text-slate-400">Respond directly to borrower enquiries.</p>
          </div>
          <button
            type="button"
            onClick={() => loadConversations().catch((error) => console.error(error))}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 transition hover:border-brand-primary/60 hover:text-brand-primary"
          >
            Refresh
          </button>
        </header>

        {conversationError && (
          <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">{conversationError}</div>
        )}

        <div className="flex flex-col gap-2 overflow-y-auto rounded-2xl border border-white/5 bg-slate-950/60 p-2">
          {loadingConversations && <p className="text-xs text-slate-400">Loading conversations…</p>}
          {!loadingConversations && conversations.length === 0 && (
            <p className="text-xs text-slate-400">No borrower chats yet.</p>
          )}
          {conversations.map((conversation) => {
            const isActive = selectedConversationId === conversation.id;
            const borrowerName =
              conversation.borrower.name ?? conversation.borrower.email ?? "Borrower";
            const lastMessagePreview = conversation.lastMessage?.content
              ? conversation.lastMessage.content.slice(0, 80)
              : "No messages yet.";
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={clsx(
                  "flex flex-col gap-1 rounded-xl px-3 py-2 text-left text-xs transition",
                  isActive
                    ? "border border-brand-primary/50 bg-brand-primary/10 text-brand-primary"
                    : "border border-transparent bg-white/5 text-slate-300 hover:border-white/15 hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={clsx("text-sm font-semibold", isActive ? "text-brand-primary" : "text-white")}>
                    {borrowerName}
                  </p>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                    {formatTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-[11px]">{lastMessagePreview}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-[480px] flex-col rounded-2xl border border-white/5 bg-slate-950/70">
        {activeConversation ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">{participantName}</p>
                <p className="text-xs text-slate-400">{activeConversation.conversation.borrower.email}</p>
              </div>
              <span className="rounded-full border border-emerald-400/50 px-3 py-1 text-[11px] uppercase tracking-widest text-emerald-300">
                {activeConversation.conversation.status === "ACTIVE" ? "Active" : "Closed"}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
              {messagesLoading && <p className="text-xs text-slate-400">Loading messages…</p>}
              {messageError && (
                <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs text-red-200">{messageError}</div>
              )}
              {activeMessages.map((message) => {
                if (message.senderType === "SYSTEM") {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400">
                        {message.content}
                      </div>
                    </div>
                  );
                }
                const isSelf =
                  viewerRole === "BROKER" ? message.senderType === "BROKER" : message.senderType === "BORROWER";
                return (
                  <div key={message.id} className={clsx("flex", isSelf ? "justify-end" : "justify-start")}>
                    <div
                      className={clsx(
                        "max-w-[70%] rounded-2xl px-4 py-2 text-xs leading-relaxed",
                        isSelf ? "bg-brand-primary text-brand-dark" : "bg-white/10 text-slate-100"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <span
                        className={clsx(
                          "mt-1 block text-[10px] uppercase tracking-widest",
                          isSelf ? "text-brand-dark/70" : "text-slate-400"
                        )}
                      >
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-white/5 px-5 py-3">
              <div className="flex items-end gap-3">
                <textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  rows={2}
                  placeholder="Type your response…"
                  className="max-h-32 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/30"
                />
                <button
                  type="submit"
                  disabled={sending || !messageInput.trim()}
                  className="rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-400">
            {loadingConversations ? "Loading conversations…" : "Select a borrower chat to view messages."}
          </div>
        )}
      </div>
    </section>
  );
}
