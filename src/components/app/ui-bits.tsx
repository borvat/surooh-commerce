import type { ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/inventory";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-card px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 px-6 py-3">{children}</div>;
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 pl-8 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
      />
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-6 mb-6 overflow-hidden rounded-md border bg-card", className)}>
      {children}
    </div>
  );
}

export function Pager({
  page,
  count,
  onPage,
}: {
  page: number;
  count: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="num">
        {count === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(count, (page + 1) * PAGE_SIZE)} of{" "}
        {count}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page + 1 >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function Num({
  v,
  tone,
  className,
}: {
  v: number | null | undefined;
  tone?: "physical" | "reserved" | "safety" | "available" | "muted";
  className?: string;
}) {
  const toneCls = {
    physical: "text-stock-physical",
    reserved: "text-stock-reserved",
    safety: "text-stock-safety",
    available: "text-stock-available font-semibold",
    muted: "text-muted-foreground",
  };
  return (
    <span className={cn("num", tone && toneCls[tone], className)}>
      {(v ?? 0).toLocaleString("en-US")}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  children: ReactNode;
}) {
  const map = {
    success: "bg-success/12 text-success border-success/30",
    warning: "bg-warning/15 text-warning-foreground border-warning/40",
    danger: "bg-destructive/10 text-destructive border-destructive/30",
    neutral: "bg-muted text-muted-foreground border-border",
    info: "bg-info/10 text-info border-info/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        map[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StockBar({
  physical,
  reserved,
  safety,
}: {
  physical: number;
  reserved: number;
  safety: number;
}) {
  const total = Math.max(physical, 1);
  const r = (reserved / total) * 100;
  const s = (Math.min(safety, Math.max(physical - reserved, 0)) / total) * 100;
  return (
    <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-stock-available/80">
      <div className="bg-stock-reserved" style={{ width: `${r}%` }} />
      <div className="bg-stock-safety" style={{ width: `${s}%` }} />
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

export const movementTone: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  receipt: "success",
  return: "success",
  adjustment: "info",
  reservation: "warning",
  release: "neutral",
  sale: "neutral",
  damaged: "danger",
};

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
}

export function Hint({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <div
      className={`mx-6 mt-3 mb-1 rounded border-s-4 px-3 py-2 text-xs ${tone === "warning" ? "border-warning bg-warning/10" : "border-primary bg-accent/40"}`}
    >
      <div className="font-semibold text-foreground">{title}</div>
      <div className="mt-0.5 text-muted-foreground">{children}</div>
    </div>
  );
}
