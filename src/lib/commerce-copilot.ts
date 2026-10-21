/** Commerce Copilot intent guard. No model/provider/API calls.
 * Server authorization/RLS remains mandatory for every real data operation.
 */
export type CopilotIntent =
  | "orders_overview"
  | "account_summary"
  | "inventory_help"
  | "profitability_help"
  | "warehouse_help"
  | "unsupported";
export type CopilotDecision = {
  intent: CopilotIntent;
  readOnly: true;
  reply: string;
  suggestedPath?: string;
};
const blocked =
  /(?:احذف|الغ[ِِي]|اشحن|أشحن|غير السعر|غيّر السعر|حدّث المخزون|ابعث|ارسل|ادفع|اشتري|اصدر فاتورة|سدد|delete|cancel|fulfill|ship now|update price|buy label|send email|pay now)/i;
export function classifyCopilotMessage(message: string): CopilotDecision {
  const q = message.trim();
  if (!q || q.length > 500)
    return {
      intent: "unsupported",
      readOnly: true,
      reply: "اكتب سؤالاً مختصراً عن طلبات المنصة أو المخزون أو الربحية.",
    };
  if (blocked.test(q))
    return {
      intent: "unsupported",
      readOnly: true,
      reply:
        "حالياً المساعد للقراءة والتحليل فقط. العمليات التي تغيّر الطلبات أو المخزون أو المال ليست مفعّلة.",
    };
  if (/ربح|هامش|تكلف|عمول|ضريب|profit|margin|vat/i.test(q))
    return {
      intent: "profitability_help",
      readOnly: true,
      reply:
        "تحليل الربحية يتطلب سعر البيع بدون الضريبة، تكلفة الشراء، عمولة المنصة، الشحن والمرتجعات مع مصادرها. البيانات الناقصة لا تُعتبر ربحاً مؤكداً.",
      suggestedPath: "/orders",
    };
  if (/مستودع|تجهيز|ملصق|شحن|warehouse|label|pick/i.test(q))
    return {
      intent: "warehouse_help",
      readOnly: true,
      reply:
        "راجع الطلبات التي تشحنها من مستودعك. ورقة التجهيز داخلية وليست ملصق شحن رسمي؛ لا يتم تأكيد الشحن بمجرد الطباعة.",
      suggestedPath: "/orders",
    };
  if (/مخزون|نفد|ستوك|stock|inventory|bundle|بندل/i.test(q))
    return {
      intent: "inventory_help",
      readOnly: true,
      reply:
        "يمكنك مراجعة المخزون المتاح والبندلات. الربط الذكي بين حسابات البيع يحتاج تطابق المنتج وليس الاعتماد على EAN وحده.",
      suggestedPath: "/components",
    };
  if (/حساب|متجر|account|channel/i.test(q))
    return {
      intent: "account_summary",
      readOnly: true,
      reply:
        "يمكنك مراجعة حسابات bol.com المسجلة وحالة الاتصال. وجود حساب في قاعدة البيانات لا يعني أنه متصل فعلياً.",
      suggestedPath: "/channels",
    };
  if (/طلب|مبيع|order|sale/i.test(q))
    return {
      intent: "orders_overview",
      readOnly: true,
      reply:
        "من قسم الطلبات يمكن مراجعة الطلبات وفلاتر التاريخ والحساب والمرجع. لا أستطيع ادعاء أرقام حيّة من دون استعلام موثّق.",
      suggestedPath: "/orders",
    };
  return {
    intent: "unsupported",
    readOnly: true,
    reply:
      "أقدر أوجّهك للطلبات، الحسابات، المخزون، المستودع والربحية. الذكاء المتصل بالبيانات الفعلية قيد التطوير.",
  };
}
