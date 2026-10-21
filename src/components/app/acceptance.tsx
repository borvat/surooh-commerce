import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAcceptanceTest, errMsg } from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import { StatusPill } from "@/components/app/ui-bits";

export function AcceptancePanel() {
  const { isAdmin } = usePermissions();
  const m = useMutation({ mutationFn: runAcceptanceTest, onError: (e) => toast.error(errMsg(e)) });
  const r = m.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={!isAdmin || m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? "Running…" : "Run acceptance test"}
        </Button>
        {r && (
          <StatusPill tone={r.ok ? "success" : "danger"}>
            {r.ok
              ? `All ${r.checks.length} checks passed`
              : r.error
                ? "Test error"
                : `${r.checks.filter((c) => !c.pass).length} checks failed`}
          </StatusPill>
        )}
        {!isAdmin && <span className="text-xs text-muted-foreground">Admins only.</span>}
      </div>
      {r?.error && <p className="text-sm text-destructive">{r.error}</p>}
      {r && r.checks.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left">Step</th>
              <th className="text-left">Check</th>
              <th className="text-right">Expected</th>
              <th className="text-right">Actual</th>
              <th className="text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {r.checks.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="py-1 text-xs text-muted-foreground">{c.step}</td>
                <td className="num">{c.check}</td>
                <td className="num text-right">{c.expected}</td>
                <td className="num text-right">{c.actual}</td>
                <td className="text-right">
                  <StatusPill tone={c.pass ? "success" : "danger"}>
                    {c.pass ? "pass" : "fail"}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
