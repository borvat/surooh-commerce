import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/app/page";
import { AccountCards } from "@/components/app/catalog";
import { AccountHealth } from "@/components/app/account-health";
import { ReadOnlyBanner } from "@/components/app/offer-card";

export const Route = createFileRoute("/_authenticated/channels")({
  head: () => ({
    meta: [
      { title: "حسابات bol · QNAN" },
      { name: "description", content: "ربط حسابات bol ومراجعة المنتجات والمتجر في QNAN." },
      { property: "og:title", content: "حسابات bol · QNAN" },
      { property: "og:description", content: "ربط حسابات bol ومراجعة المنتجات والمتجر في QNAN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Page title="حسابات bol" intro="اربط حساباتك على bol.com واسحب منتجاتك.">
      <div className="mb-4">
        <ReadOnlyBanner />
      </div>
      <AccountCards />
      <AccountHealth />
    </Page>
  ),
});
