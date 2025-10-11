import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import OpenAI from "openai";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  appendMessage,
  fetchRecentMessages,
  getOrCreateActiveSession,
  updateSessionContext
} from "@/lib/chat-service";
import { buildFallbackResponse, buildSystemPrompt, getChatQuestions, Locale, Summary } from "@/lib/chat/logic";
import { ChatMessageSender } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const summarySchema = z
  .object({
    location: z.string().optional(),
    timeline: z.string().optional(),
    priority: z.enum(["rate", "ltv", "speed", "documents"]).optional(),
    credit: z.string().optional(),
    amount: z.number().finite().optional()
  })
  .optional()
  .default({});

const requestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  summary: summarySchema,
  pointer: z.number().int().min(0).optional().default(0),
  shouldRecap: z.boolean().optional().default(false),
  locale: z.enum(["en", "zh"]).optional().default("en")
});

type OpenAIRole = "system" | "user" | "assistant";

function mapSenderToRole(sender: ChatMessageSender): OpenAIRole {
  switch (sender) {
    case ChatMessageSender.AI:
      return "assistant";
    case ChatMessageSender.USER:
      return "user";
    default:
      return "system";
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 });
  }

  const { sessionId, message, summary, pointer, shouldRecap, locale } = parsed.data as {
    sessionId?: string;
    message: string;
    summary: Summary;
    pointer: number;
    shouldRecap: boolean;
    locale: Locale;
  };
  const summaryContext = summary as Summary;
  const questions = getChatQuestions(locale);

  const chatSession = await getOrCreateActiveSession(session.user.id, sessionId);

  await appendMessage(chatSession.id, ChatMessageSender.USER, message);

  const recentMessages = await fetchRecentMessages(chatSession.id, 12);

  const openAiMessages = [
    {
      role: "system" as OpenAIRole,
      content: buildSystemPrompt(summaryContext, pointer, shouldRecap, locale, questions)
    },
    ...recentMessages.map((msg) => ({
      role: mapSenderToRole(msg.sender),
      content: msg.content
    }))
  ];

  let aiResponse = "";

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAiMessages,
      temperature: 0.5,
      max_tokens: 600
    });

    aiResponse = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    console.error("Chat API error", error);
  }

  if (!aiResponse) {
    aiResponse = buildFallbackResponse(summaryContext, pointer, shouldRecap, locale, questions);
  }

  await appendMessage(chatSession.id, ChatMessageSender.AI, aiResponse);
  await updateSessionContext(chatSession.id, summaryContext);

  return NextResponse.json({
    message: aiResponse,
    sessionId: chatSession.id,
    summary: summaryContext
  });
}
