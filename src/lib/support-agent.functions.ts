import { createServerFn } from "@tanstack/react-start";
import OpenAI from "openai";
import { z } from "zod";
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---- Knowledge Base ----
const KB = [
  {
    id: "kb-reset-password",
    title: "Reset your password",
    tags: ["password", "login", "reset", "account", "forgot"],
    body: "To reset your password, go to Settings → Security → Reset Password. A reset link will be sent to your registered email and is valid for 30 minutes.",
  },
  {
    id: "kb-api-rate-limits",
    title: "API rate limits",
    tags: ["api", "rate", "limit", "429", "throttle", "developer"],
    body: "Free tier: 60 requests/minute. Pro tier: 600 rpm. Enterprise: custom. Use exponential backoff on HTTP 429.",
  },
  {
    id: "kb-billing-invoice",
    title: "Billing and invoices",
    tags: ["billing", "invoice", "payment", "refund", "subscription"],
    body: "Invoices are issued monthly on the 1st. Refund requests within 14 days are processed in 5–7 business days.",
  },
  {
    id: "kb-webhook-setup",
    title: "Configure webhooks",
    tags: ["webhook", "integration", "events", "developer", "callback"],
    body: "Create webhooks at Developer → Webhooks. Sign payloads using HMAC-SHA256.",
  },
  {
    id: "kb-enterprise-sla",
    title: "Enterprise SLA & uptime",
    tags: ["sla", "uptime", "enterprise", "contract", "downtime"],
    body: "Enterprise plans include 99.95% uptime SLA and dedicated support.",
  },
  {
    id: "kb-data-export",
    title: "Export your data",
    tags: ["export", "data", "gdpr", "download", "csv"],
    body: "Request a full data export from Settings → Privacy → Export Data.",
  },
];

function searchKB(query: string, max = 3) {
  const q = query.toLowerCase();

  return KB.map((a) => {
    let score = 0;

    for (const tag of a.tags) {
      if (q.includes(tag)) score += 2;
    }

    if (q.includes(a.title.toLowerCase())) {
      score += 3;
    }

    return { a, score };
  })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((s) => s.a);
}

const PERSONAS = {
  technical_expert:
    "Technical expert. Be precise, concise, technical. Use code examples when useful.",
  frustrated_user: "Frustrated user. Lead with empathy. Use short clear steps.",
  business_executive: "Business executive. Be formal, outcome-focused, avoid deep jargon.",
  general_user: "General user. Friendly, simple, step-by-step explanations.",
} as const;

type PersonaKey = keyof typeof PERSONAS;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});

type AgentResult = {
  reply: string;
  persona: PersonaKey;
  personaConfidence: number;
  personaReason: string;
  kb: { id: string; title: string }[];
  escalate: boolean;
  escalationReason?: string;
  handoffSummary?: string;
};

export const supportAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<AgentResult> => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const conversation = data.messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const persona: PersonaKey = "general_user";
    const personaConfidence = 0.9;
    const personaReason = "DeepSeek single-call mode";
    const escalate = false;
    const escalationReason = "";

    // KB Search
    const allText = data.messages.map((m) => m.content).join(" ");
    const kbHits = searchKB(allText);

    const kbContext = kbHits.length
      ? kbHits.map((k, i) => `[${i + 1}] ${k.title}\n${k.body}`).join("\n\n")
      : "No matching KB articles found.";

    // Main Reply
    const replyPrompt = `
You are a SaaS customer support assistant.

Persona:
${PERSONAS[persona]}

Rules:
- Use KB facts only for product-specific answers
- If KB doesn't cover something, say honestly
- Keep response concise and helpful
- Mention escalation if needed

KB:
${kbContext}

Escalation:
${escalate ? escalationReason : "No"}

Conversation:
${conversation}
`;

    const replyResponse = await client.chat.completions.create({
      model: "openai/gpt-oss-120b:free",
      messages: [
        {
          role: "system",
          content: "You are a SaaS customer support assistant.",
        },
        {
          role: "user",
          content: replyPrompt,
        },
      ],
      max_tokens: 500,
    });

    const reply =
      replyResponse.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

    // Handoff Summary
    const handoffSummary: string | undefined = undefined;

    return {
      reply,
      persona,
      personaConfidence,
      personaReason,
      kb: kbHits.map((k) => ({
        id: k.id,
        title: k.title,
      })),
      escalate,
      escalationReason: escalate ? escalationReason : undefined,
      handoffSummary,
    };
  });
