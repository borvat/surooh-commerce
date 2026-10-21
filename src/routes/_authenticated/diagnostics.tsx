import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Hint } from "@/components/app/ui-bits";
import { AcceptancePanel } from "@/components/app/acceptance";

export const Route = createFileRoute("/_authenticated/diagnostics")({
  head: () => ({
    meta: [
      { title: "Acceptance test · QNAN Inventory Core" },
      {
        name: "description",
        content: "Verify shared BOM stock, reservations and FBR/FBB behaviour.",
      },
      { property: "og:title", content: "Acceptance test · QNAN Inventory Core" },
      {
        property: "og:description",
        content: "Verify shared BOM stock, reservations and FBR/FBB behaviour.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  return (
    <div>
      <PageHeader
        title="Acceptance test"
        description="Proves the shared-stock rules with the demo data from the brief."
      />
      <Hint title="Safe to run — nothing is kept">
        The test runs inside the database on a sandbox copy: it sets GAS-001 3000 / BURNER-001 500 /
        STOVE-001 200 (safety 50/10/5), checks every product's capacity, places an FBR order for 2×
        GAS-10, cancels it, places and fulfils it again, then places an FBB order. Afterwards{" "}
        <b>every change is rolled back</b> — your real stock, orders and history stay exactly as
        they were.
      </Hint>
      <Panel className="mt-3 p-4">
        <AcceptancePanel />
      </Panel>
    </div>
  );
}
