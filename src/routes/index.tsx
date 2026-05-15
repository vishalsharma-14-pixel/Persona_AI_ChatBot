import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, BookOpen, AlertTriangle, Loader2 } from "lucide-react";
import { supportAgent } from "@/lib/support-agent.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Persona-Adaptive Support Agent" },
      {
        name: "description",
        content:
          "AI customer support that detects persona, retrieves KB content, adapts tone, and escalates with handoff context.",
      },
    ],
  }),
  component: Index,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  meta?: {
    persona?: string;
    personaConfidence?: number;
    personaReason?: string;
    kb?: { id: string; title: string }[];
    escalate?: boolean;
    escalationReason?: string;
    handoffSummary?: string;
  };
};

const PERSONA_LABELS: Record<string, { label: string; color: string }> = {
  technical_expert: {
    label: "Technical Expert",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  frustrated_user: {
    label: "Frustrated User",
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  business_executive: {
    label: "Business Executive",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  general_user: { label: "General User", color: "bg-slate-100 text-slate-800 border-slate-200" },
};

const SAMPLES = [
  "Your API keeps returning 429 errors even when I respect Retry-After. What's the actual rate-limit window?",
  "I've been trying to log in for an HOUR. Nothing works. I'm done with this!!!",
  "As CFO, I need clarity on your enterprise SLA and credit policy for downtime this quarter.",
  "How do I export all my data?",
];

function Index() {
  const callAgent = useServerFn(supportAgent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await callAgent({
        data: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          meta: {
            persona: res.persona,
            personaConfidence: res.personaConfidence,
            personaReason: res.personaReason,
            kb: res.kb,
            escalate: res.escalate,
            escalationReason: res.escalationReason,
            handoffSummary: res.handoffSummary,
          },
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Persona-Adaptive Support Agent
            </h1>
            <p className="text-xs text-muted-foreground">
              Detects persona · Retrieves KB · Adapts tone · Escalates with context
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <div
          className="rounded-2xl border border-border bg-card overflow-hidden"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <div ref={scrollRef} className="h-[60vh] overflow-y-auto p-6 space-y-5">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-10">
                <Bot className="mx-auto h-10 w-10 mb-3 text-primary" />
                <p className="font-medium text-foreground mb-1">Start a conversation</p>
                <p className="text-sm mb-6">Try one of these sample messages:</p>
                <div className="grid gap-2 max-w-2xl mx-auto text-left">
                  {SAMPLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-sm rounded-lg border border-border px-4 py-3 hover:bg-accent hover:border-primary/40 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing persona & searching knowledge base…
              </div>
            )}
            {error && (
              <div className="text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-4 py-2">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border bg-secondary/40 p-3 flex gap-2"
          >
            <input
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Describe your issue…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </form>
        </div>

        <p className="mt-4 text-xs text-center text-muted-foreground">
          Powered by Lovable AI · KB articles cover password reset, API rate limits, billing,
          webhooks, enterprise SLA, and data export.
        </p>
      </section>
    </main>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const personaInfo = msg.meta?.persona ? PERSONA_LABELS[msg.meta.persona] : null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        {!isUser && personaInfo && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${personaInfo.color}`}>
              Persona: {personaInfo.label}
              {msg.meta?.personaConfidence != null
                ? ` · ${Math.round(msg.meta.personaConfidence * 100)}%`
                : ""}
            </span>
            {msg.meta?.kb && msg.meta.kb.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-secondary text-secondary-foreground inline-flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {msg.meta.kb.length} KB source{msg.meta.kb.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary text-secondary-foreground rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>

        {!isUser && msg.meta?.kb && msg.meta.kb.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Sources:{" "}
            {msg.meta.kb.map((k, i) => (
              <span key={k.id}>
                [{i + 1}] {k.title}
                {i < msg.meta!.kb!.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>
        )}

        {!isUser && msg.meta?.escalate && (
          <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-xs text-orange-900 max-w-full">
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Escalated to human agent
            </div>
            <p className="mb-2">
              <span className="font-medium">Reason:</span> {msg.meta.escalationReason}
            </p>
            {msg.meta.handoffSummary && (
              <details className="mt-1">
                <summary className="cursor-pointer font-medium">Handoff brief</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans">{msg.meta.handoffSummary}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
