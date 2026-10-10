import { describe, test, expect } from "bun:test";
import { classifyCopilotMessage } from "../src/lib/commerce-copilot";
describe("copilot operates as an unprivileged prototype", () => {
  test("directs questions to relevant sections without live claims", () => {
    const result = classifyCopilotMessage("شو عنا طلبات اليوم؟");
    expect(result.intent).toBe("orders_overview");
    expect(result.readOnly).toBe(true);
    expect(result.reply).not.toMatch(/\d+ طلبات اليوم/);
  });
  test("rejects direct shipping or order modifications", () => {
    for (const action of ["اشحن الطلب", "احذف الطلب", "update price", "buy label", "pay now"]) {
      const result = classifyCopilotMessage(action);
      expect(result.intent).toBe("unsupported");
      expect(result.readOnly).toBe(true);
    }
  });
  test("never invents profit from absent inputs", () => {
    const result = classifyCopilotMessage("كم هامش الربح؟");
    expect(result.intent).toBe("profitability_help");
    expect(result.reply).toContain("البيانات الناقصة");
  });
  test("rejects oversized input", () => {
    expect(classifyCopilotMessage("x".repeat(501)).intent).toBe("unsupported");
  });
});
