import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runImport, errMsg, type ImportKind, type ImportResult } from "@/lib/inventory";
import { parseCsv, CSV_TEMPLATES, downloadTemplate } from "@/lib/csv";
import { usePermissions } from "@/lib/auth";
import { PageHeader, Panel, Hint, StatusPill } from "@/components/app/ui-bits";

type Search = { kind?: ImportKind };
export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "CSV import · QNAN Inventory Core" },
      {
        name: "description",
        content: "Bulk import components, products, BOMs and listing mappings.",
      },
      { property: "og:title", content: "CSV import · QNAN Inventory Core" },
      {
        property: "og:description",
        content: "Bulk import components, products, BOMs and listing mappings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search =>
    ["components", "products", "bom", "listings"].includes(String(s["kind"]))
      ? { kind: s["kind"] as ImportKind }
      : {},
  component: ImportPage,
});

function ImportPage() {
  const { kind: initial } = Route.useSearch();
  const [kind, setKind] = useState<ImportKind>(initial ?? "components");
  const { canOperate, isAdmin } = usePermissions();
  const allowed = kind === "components" ? canOperate : isAdmin;
  return (
    <div>
      <PageHeader
        title="CSV import"
        description="Load many items at once. Import in this order: components → products → BOM → listing mappings."
      />
      <Hint title="Safe two-step import">
        1) Upload a file and press <b>Check file</b> — nothing is saved, every row is validated. 2)
        Only when there are zero errors can you press <b>Apply</b>. The whole file is saved in one
        go, or not at all.
      </Hint>
      <div className="flex flex-wrap gap-2 px-6 pt-4">
        {(Object.keys(CSV_TEMPLATES) as ImportKind[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={k === kind ? "default" : "outline"}
            onClick={() => setKind(k)}
          >
            {CSV_TEMPLATES[k].title}
          </Button>
        ))}
      </div>
      {allowed ? (
        <Importer key={kind} kind={kind} />
      ) : (
        <p className="px-6 py-4 text-sm text-muted-foreground">
          Your role cannot import this type of data.
        </p>
      )}
    </div>
  );
}

function Importer({ kind }: { kind: ImportKind }) {
  const t = CSV_TEMPLATES[kind];
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const missing = rows ? t.columns.filter((c) => !(c in (rows[0] ?? {}))) : [];
  const check = useMutation({
    mutationFn: () => runImport(kind, rows!, false),
    onSuccess: setResult,
    onError: (e) => toast.error(errMsg(e)),
  });
  const apply = useMutation({
    mutationFn: () => runImport(kind, rows!, true),
    onSuccess: (r) => {
      setResult(r);
      if (r.applied) {
        toast.success(`Imported ${r.rows} rows`);
        qc.invalidateQueries();
      } else toast.error("Nothing was saved — fix the errors first");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Panel className="mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{t.title}</div>
          <div className="num mt-1 text-xs text-muted-foreground">{t.columns.join(",")}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t.help}</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => downloadTemplate(kind)}>
          Download template
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name);
            setResult(null);
            setRows(parseCsv(await f.text()));
          }}
        />
        {rows && (
          <span className="text-sm text-muted-foreground">
            {fileName}: {rows.length} rows
          </span>
        )}
      </div>
      {missing.length > 0 && (
        <p className="mt-2 text-sm text-destructive">Missing columns: {missing.join(", ")}</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!rows?.length || missing.length > 0 || check.isPending}
          onClick={() => check.mutate()}
        >
          Check file
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={!result?.ok || result.applied || apply.isPending}
          onClick={() =>
            confirm(`Apply ${rows?.length} rows? This saves all of them in one go.`) &&
            apply.mutate()
          }
        >
          Apply import
        </Button>
      </div>
      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={result.applied ? "success" : result.ok ? "info" : "danger"}>
              {result.applied
                ? "Applied"
                : result.ok
                  ? "Valid — ready to apply"
                  : `${result.errors.length} errors — nothing saved`}
            </StatusPill>
            <span className="text-muted-foreground">
              {result.rows} rows
              {result.creates !== undefined &&
                ` · ${result.creates} new · ${result.updates} updated`}
            </span>
          </div>
          {[
            ...result.errors.map((e) => ({ ...e, kind: "error" })),
            ...(result.warnings ?? []).map((e) => ({ ...e, kind: "warning" })),
          ].length > 0 && (
            <table className="w-full text-xs">
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={"e" + i} className="border-t">
                    <td className="num w-16 py-1 text-destructive">row {e.row}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
                {(result.warnings ?? []).map((e, i) => (
                  <tr key={"w" + i} className="border-t">
                    <td className="num w-16 py-1 text-warning-foreground">row {e.row}</td>
                    <td>Warning: {e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Panel>
  );
}
