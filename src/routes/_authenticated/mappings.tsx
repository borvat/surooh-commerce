import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listListingSync,
  listChannels,
  allProducts,
  saveListing,
  errMsg,
  type ListingSyncRow,
  type MappingStatus,
  type FulfillmentMethod,
} from "@/lib/inventory";
import { usePermissions } from "@/lib/auth";
import {
  PageHeader,
  Panel,
  Hint,
  StatusPill,
  Num,
  EmptyRow,
  Toolbar,
} from "@/components/app/ui-bits";
import { Field, selectCls } from "@/components/app/forms";

export const Route = createFileRoute("/_authenticated/mappings")({
  head: () => ({
    meta: [
      { title: "Listing Mapping · QNAN Inventory Core" },
      {
        name: "description",
        content: "Map bol offers to sellable SKUs with explicit FBR/FBB ownership.",
      },
      { property: "og:title", content: "Listing Mapping · QNAN Inventory Core" },
      {
        property: "og:description",
        content: "Map bol offers to sellable SKUs with explicit FBR/FBB ownership.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MappingsPage,
});

const msTone: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  CONFIRMED: "success",
  SUGGESTED: "info",
  UNMAPPED: "warning",
  EXCEPTION: "danger",
};
const recTone: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  in_sync: "success",
  pending_push: "warning",
  remote_mismatch: "danger",
  never_pushed: "neutral",
  not_mapped: "neutral",
  remote_only: "info",
  inactive: "neutral",
};

function MappingsPage() {
  const { isAdmin } = usePermissions();
  const q = useQuery({ queryKey: ["listing-sync"], queryFn: listListingSync });
  const [chan, setChan] = useState("all");
  const [ms, setMs] = useState("all");
  const [edit, setEdit] = useState<Partial<ListingSyncRow> | null>(null);
  const chans = useQuery({ queryKey: ["channels"], queryFn: listChannels });
  const rows = (q.data ?? []).filter(
    (l) =>
      (chan === "all" || l.channel_id === chan) &&
      (ms === "all" ||
        (ms === "queue"
          ? l.mapping_status === "UNMAPPED" || l.mapping_status === "EXCEPTION"
          : l.mapping_status === ms)),
  );
  const queue = (q.data ?? []).filter(
    (l) => l.mapping_status === "UNMAPPED" || l.mapping_status === "EXCEPTION",
  ).length;
  return (
    <div>
      <PageHeader
        title="Listing Mapping"
        description="Link each bol offer to one of your sellable SKUs, and say who owns the stock."
        actions={
          isAdmin && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to="/import" search={{ kind: "listings" }}>
                  Import CSV
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setEdit({ fulfillment_method: "FBR", mapping_status: "SUGGESTED", active: true })
                }
              >
                Add listing
              </Button>
            </>
          )
        }
      />
      <Hint title="How ownership works">
        <b>FBR</b> (you ship): stock is <b>INTERNAL</b> — calculated from your parts and can be
        published to bol. <b>FBB</b> (bol ships): stock is owned by <b>BOL</b> — shown only, never
        taken from your warehouse. The EAN is only a hint for matching; a listing is only used for
        stock sync once it is <b>CONFIRMED</b> by a person.
      </Hint>
      <Toolbar>
        <select className={selectCls} value={chan} onChange={(e) => setChan(e.target.value)}>
          <option value="all">All accounts</option>
          {(chans.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={ms} onChange={(e) => setMs(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="queue">Exception queue ({queue})</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="SUGGESTED">Suggested</option>
          <option value="UNMAPPED">Unmapped</option>
          <option value="EXCEPTION">Exception</option>
        </select>
      </Toolbar>
      <Panel>
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left">Account</th>
              <th className="text-left">SKU</th>
              <th className="text-left">Offer ID / EAN</th>
              <th className="text-left">Method · Owner</th>
              <th className="text-left">Mapping</th>
              <th className="text-right" title="From the BOM and internal stock">
                Calculated
              </th>
              <th className="text-right" title="What would be published after buffer/cap">
                Desired
              </th>
              <th className="text-right">Last pushed</th>
              <th className="text-right" title="What bol reports">
                bol reports
              </th>
              <th className="pl-3 text-left">Reconciliation</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow cols={11} text={q.isLoading ? "Loading…" : "No listings"} />
            )}
            {rows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-1.5 text-xs">{l.channel_name}</td>
                <td className="num">
                  {l.product_sku ?? <span className="text-destructive">unmapped</span>}
                </td>
                <td className="num text-xs text-muted-foreground">
                  {l.external_offer_id ?? "—"} / {l.external_ean ?? l.product_ean ?? "—"}
                </td>
                <td>
                  <StatusPill tone={l.fulfillment_method === "FBB" ? "info" : "neutral"}>
                    {l.fulfillment_method} · {l.inventory_owner}
                  </StatusPill>
                </td>
                <td>
                  <StatusPill tone={msTone[l.mapping_status ?? ""] ?? "neutral"}>
                    {l.mapping_status}
                  </StatusPill>
                </td>
                <td className="text-right">
                  {l.inventory_owner === "BOL" ? (
                    <span className="text-xs text-muted-foreground">bol-owned</span>
                  ) : (
                    <Num v={l.derived_available} tone="available" />
                  )}
                </td>
                <td className="text-right">
                  {l.computed_desired_qty == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Num v={l.computed_desired_qty} />
                  )}
                </td>
                <td className="text-right">
                  {l.last_pushed_qty == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Num v={l.last_pushed_qty} tone="muted" />
                  )}
                </td>
                <td className="text-right">
                  {l.remote_reported_qty == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Num v={l.remote_reported_qty} tone="muted" />
                  )}
                </td>
                <td className="pl-3">
                  <StatusPill tone={recTone[l.reconciliation_state ?? ""] ?? "neutral"}>
                    {(l.reconciliation_state ?? "").replace("_", " ")}
                  </StatusPill>
                </td>
                <td className="whitespace-nowrap px-3 text-right">
                  {isAdmin && (
                    <>
                      {l.mapping_status === "SUGGESTED" && <ConfirmBtn l={l} />}
                      <Button variant="ghost" size="sm" onClick={() => setEdit(l)}>
                        Edit
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {edit && <ListingDialog initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function toInput(l: Partial<ListingSyncRow>, patch: { mapping_status?: MappingStatus } = {}) {
  return {
    id: l.id ?? undefined,
    channel_id: l.channel_id ?? "",
    product_id: l.product_id ?? null,
    external_offer_id: l.external_offer_id ?? null,
    external_ean: l.external_ean ?? null,
    fulfillment_method: (l.fulfillment_method ?? "FBR") as FulfillmentMethod,
    mapping_status: (patch.mapping_status ?? l.mapping_status ?? "SUGGESTED") as MappingStatus,
    active: l.active ?? true,
    note: l.note ?? null,
  };
}

function ConfirmBtn({ l }: { l: ListingSyncRow }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => saveListing(toInput(l, { mapping_status: "CONFIRMED" })),
    onSuccess: () => {
      toast.success("Mapping confirmed");
      qc.invalidateQueries({ queryKey: ["listing-sync"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Button variant="ghost" size="sm" disabled={m.isPending} onClick={() => m.mutate()}>
      Confirm
    </Button>
  );
}

function ListingDialog({
  initial,
  onClose,
}: {
  initial: Partial<ListingSyncRow>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const chans = useQuery({ queryKey: ["channels"], queryFn: listChannels });
  const prods = useQuery({ queryKey: ["products-all"], queryFn: allProducts });
  const [f, setF] = useState(toInput(initial));
  const m = useMutation({
    mutationFn: () =>
      saveListing({
        ...f,
        external_offer_id: f.external_offer_id?.trim() || null,
        external_ean: f.external_ean?.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Listing saved");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const needsProduct = f.mapping_status === "CONFIRMED" || f.mapping_status === "SUGGESTED";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Edit listing" : "New listing"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="bol account">
            <select
              className={selectCls}
              value={f.channel_id}
              disabled={!!f.id}
              onChange={(e) => setF({ ...f, channel_id: e.target.value })}
            >
              <option value="">Select…</option>
              {(chans.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sellable SKU">
            <select
              className={selectCls}
              value={f.product_id ?? ""}
              onChange={(e) => setF({ ...f, product_id: e.target.value || null })}
            >
              <option value="">— none (unmapped) —</option>
              {(prods.data ?? [])
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id!}>
                    {p.sku}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="bol offer ID">
            <Input
              value={f.external_offer_id ?? ""}
              onChange={(e) => setF({ ...f, external_offer_id: e.target.value })}
            />
          </Field>
          <Field label="EAN on bol (hint only)">
            <Input
              value={f.external_ean ?? ""}
              onChange={(e) => setF({ ...f, external_ean: e.target.value })}
            />
          </Field>
          <Field label="Fulfilment">
            <select
              className={selectCls}
              value={f.fulfillment_method}
              onChange={(e) =>
                setF({ ...f, fulfillment_method: e.target.value as FulfillmentMethod })
              }
            >
              <option value="FBR">FBR — you ship · stock INTERNAL</option>
              <option value="FBB">FBB — bol ships · stock BOL</option>
            </select>
          </Field>
          <Field label="Mapping status">
            <select
              className={selectCls}
              value={f.mapping_status}
              onChange={(e) => setF({ ...f, mapping_status: e.target.value as MappingStatus })}
            >
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="SUGGESTED">SUGGESTED</option>
              <option value="UNMAPPED">UNMAPPED</option>
              <option value="EXCEPTION">EXCEPTION</option>
            </select>
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Active
          </label>
        </div>
        {needsProduct && !f.product_id && (
          <p className="text-xs text-destructive">
            Suggested or confirmed listings need a sellable SKU.
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={m.isPending || !f.channel_id || (needsProduct && !f.product_id)}
            onClick={() => m.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
