import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/app/page";
import { classifyCopilotMessage } from "@/lib/commerce-copilot";
type Message = { role: "user" | "assistant"; text: string; suggestedPath?: string };
export const Route = createFileRoute("/_authenticated/assistant")({ component: CommerceAssistant });
function CommerceAssistant() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "أهلاً بك في مساعد Surooh Commerce التجريبي. حالياً أشرح الوظائف وأوجّهك للأقسام المناسبة فقط، ولا أقرأ بياناتك الحية أو أنفذ عمليات." }]);
  function send() {
    const input = draft.trim();
    if (!input || input.length > 500) return;
    const result = classifyCopilotMessage(input);
    setMessages(m => [...m, { role: "user", text: input }, { role: "assistant", text: result.reply, ...(result.suggestedPath !== undefined ? { suggestedPath: result.suggestedPath } : {}) }]);
    setDraft("");
  }
  return <Page title="مساعد التجارة" intro="نسخة أولية بدون اتصال بنموذج ذكاء أو MCP. لا تُنفَّذ أي تغييرات في الطلبات أو المخزون أو الشحن.">
    <div className="mx-auto max-w-3xl rounded-lg border p-4">
      <div role="log" aria-live="polite" className="mb-4 flex max-h-[65vh] min-h-72 flex-col gap-3 overflow-y-auto">
        {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ms-auto max-w-[85%] rounded-xl bg-primary p-3 text-primary-foreground" : "me-auto max-w-[85%] rounded-xl bg-muted p-3"}>
          <div className="whitespace-pre-wrap">{m.text}</div>
          {m.suggestedPath && <p className="mt-2 text-sm"><Link to={m.suggestedPath as "/orders"} className="underline">الانتقال إلى القسم</Link></p>}
        </div>)}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
        <input aria-label="رسالة إلى مساعد التجارة" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="اسأل عن الطلبات، المخزون، الشحن أو الربحية" className="min-w-0 flex-1 rounded-md border bg-background p-2" />
        <Button type="submit" disabled={!draft.trim()}>إرسال</Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">الرسائل محلية لهذه الصفحة ولا تُحفظ. هذا نموذج واجهة تجريبية وليس Agent تشغيلياً.</p>
    </div>
  </Page>;
}
