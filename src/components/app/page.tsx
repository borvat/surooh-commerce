import type { ReactNode } from "react";

export function Page({ title, intro, actions, children }: { title: string; intro?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {intro && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-5 ${className}`}>{children}</div>;
}

export function Table({ label, head, children }: { label: string; head: string[]; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="max-h-[70vh] max-w-full overflow-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:max-h-none print:overflow-visible">
      <table className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="sticky top-0 z-10 bg-muted text-muted-foreground print:static">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 text-start font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="py-12 text-center text-muted-foreground">{text}</td></tr>;
}

export function Tag({ tone = "neutral", children }: { tone?: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  const m = {
    success: "bg-success/12 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${m[tone]}`}>{children}</span>;
}
