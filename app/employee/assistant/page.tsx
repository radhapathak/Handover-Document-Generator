"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2, User } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { Button, Card, PageHeader, Select, Textarea, cx } from "@/components/shared/ui";

interface Msg { role: "user" | "assistant"; content: string; html?: string }
interface ReqRow { id: string; number: string; title: string; documentId: string }

const SUGGESTIONS = [
  "Explain this business rule in simple terms.",
  "Explain the routing logic step by step.",
  "Identify missing conditions in this configuration.",
  "Generate test cases for the approval process.",
  "Explain the workflow for a new employee.",
  "Create a troubleshooting guide.",
  "Generate an exception-handling section.",
  "Simplify the technical explanation.",
];


export default function AssistantPage() {
  const reqs = useApi<{ items: ReqRow[] }>("/api/requests");
  const [ctx, setCtx] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("doc");
    if (id) setCtx(`doc:${id}`);
  }, []);
  useEffect(() => {
    void end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");
    setError("");
    setSending(true);
    try {
      const [kind, id] = ctx.split(":");
      const r = await api<{ reply: string; html: string }>("/api/ai/assistant", { body: { messages: next.map(({ role, content }) => ({ role, content })), ...(kind === "doc" ? { documentId: id } : kind === "req" ? { requestId: id } : {}) } });
      setMessages([...next, { role: "assistant", content: r.reply, html: r.html }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages(messages);
      setInput(t);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title="AI Documentation Assistant" subtitle="Ask questions about a module. The assistant uses the selected project’s configuration as context." crumbs={[{ label: "Employee Portal", href: "/employee/dashboard" }, { label: "AI Assistant" }]} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card padded={false} className="flex min-h-[560px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <label htmlFor="ctx" className="text-[13px] font-medium">Context</label>
            <Select id="ctx" className="w-auto min-w-[260px] flex-1" value={ctx} onChange={(e) => setCtx(e.target.value)}>
              <option value="">No project (general questions)</option>
              {reqs.data?.items.map((r) => <option key={r.id} value={r.documentId ? `doc:${r.documentId}` : `req:${r.id}`}>{r.number} — {r.title}{r.documentId ? " (with document)" : ""}</option>)}
            </Select>
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setMessages([])} disabled={!messages.length}>Clear</Button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="py-10 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-ai-600" />
                <p className="mt-2 text-sm font-medium">Ask anything about the selected module</p>
                <p className="text-[13px] text-muted">Answers are based only on the configuration you supplied. Missing details are flagged as Information Required.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cx("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-brand-100 text-brand-700" : "bg-ai-100 text-ai-700")}>{m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span>
                <div className={cx("max-w-[80%] rounded-lg px-3 py-2 text-[13.5px]", m.role === "user" ? "bg-brand-600 text-white" : "border border-line bg-white")}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <div className="chat-md" dangerouslySetInnerHTML={{ __html: m.html || "" }} />}
                </div>
              </div>
            ))}
            {sending && <p className="flex items-center gap-2 text-[13px] text-muted"><Sparkles className="h-4 w-4 animate-pulse text-ai-600" />Thinking…</p>}
            {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-[13px] text-red-700">{error}</p>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <Textarea aria-label="Message" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
            <Button type="submit" variant="ai" icon={Send} loading={sending} disabled={!input.trim()}>Send</Button>
          </form>
        </Card>
        <Card title="Suggested questions">
          <ul className="space-y-1.5">
            {SUGGESTIONS.map((s) => <li key={s}><button className="w-full rounded-md border border-line px-2.5 py-2 text-left text-[13px] hover:border-ai-600 hover:bg-ai-50" onClick={() => send(s)} disabled={sending}>{s}</button></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
