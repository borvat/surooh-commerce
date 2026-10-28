# Repository adoption review — 2026-10-28

Scope: repository metadata, README descriptions and licenses; selected CSS examples;
the Surooh Commerce application shell, shared table, and all three table callers.
This is an adoption review, not a full security audit or execution of all seven upstream projects.

The current application uses React 19, TanStack Start and Tailwind CSS 4, not Flutter.
No upstream repository was installed as a runtime dependency and no external API was enabled.

| Source                                                                                      | Verified activity / license                                                    | Decision for this application                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [phuocng/csslayout](https://github.com/phuocng/csslayout)                                   | Last push 2023-11-22; MIT                                                      | Adopt the scroll-contained table / sticky positioning idea in our existing shared table. No framework import.                                                                                                                    |
| [flutter/samples](https://github.com/flutter/samples)                                       | Last push 2026-10-20; source includes BSD-style terms, font and Apache notices | Reference for a future Flutter application; no Dart code in this React project. Check each selected sample and its assets before reuse.                                                                                          |
| [Solido/awesome-flutter](https://github.com/Solido/awesome-flutter)                         | Last push 2026-09-03; GitHub reports no detected repository license            | Discovery bookmark only. Evaluate each linked package independently; listing does not license its contents or dependencies.                                                                                                      |
| [realworld-apps/realworld](https://github.com/realworld-apps/realworld)                     | Last push 2026-08-26; MIT source with separate logo exclusions                 | Architecture reference. The existing application already has its own auth and organization isolation; do not replace these with demo auth or connect business data to its demo API.                                              |
| [public-apis/public-apis](https://github.com/public-apis/public-apis)                       | Last push 2026-10-27; MIT list                                                 | Discovery reference, not an API service. Add a provider only for a concrete requirement after checking that provider's documentation, limits and terms.                                                                          |
| [Chalarangelo/30-seconds-of-code](https://github.com/Chalarangelo/30-seconds-of-code)       | Last push 2026-10-26; snippets CC BY 4.0 unless otherwise stated               | Reference only; no snippet needed for this change. README reserves other content and website code. Preserve applicable attribution if a snippet is adopted later.                                                                |
| [mitesh77/Best-Flutter-UI-Templates](https://github.com/mitesh77/Best-Flutter-UI-Templates) | Last push 2025-12-16; modified license text                                    | Do not copy into this commercial application. LICENSE starts with MIT wording but changes the grant and adds a restriction concerning selling/earning. The README's “free” description is insufficient to resolve that conflict. |

Activity dates are repository push timestamps, not guarantees of maintenance or compatibility.
The CSS Layout screenshot does not identify its owner; phuocng/csslayout is the likely match assessed here.

## Implemented

The existing shared `Table` now confines long lists to 70% of the viewport height,
keeps opaque column headings visible while scrolling, and exposes a named region
that keyboard users can focus and scroll. All callers supply Arabic names:
orders, bundles and stock. A hidden caption names the table itself. Print media
removes the height limit and scrolling so rows are not clipped.

Rows, action handlers, queries, inventory calculations and permissions are unchanged.
No database, marketplace, accounting or production deployment was performed.

Upstream inspiration:

- https://github.com/phuocng/csslayout/blob/master/contents/sticky-table-headers.mdx
- https://github.com/phuocng/csslayout/blob/master/contents/sidebar.mdx

The upstream sticky-header example uses `left: 0` and omits a vertical offset.
Our adaptation uses `top: 0` inside a bounded scroll container with the existing theme tokens.
The source license is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Implementation references:

- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position#sticky
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow#accessibility
- https://tailwindcss.com/docs/position#sticky-positioning-elements
- https://tailwindcss.com/docs/overflow

## Verification

- Baseline production build and TypeScript check passed before implementation.
- Final production build and TypeScript check passed after implementation.
- Browser regression test first failed because the existing table had no named keyboard scroll region.
- After implementation: six browser cases passed (375/768/1440px, RTL and LTR), checking page-width containment, internal scrolling, keyboard scrolling, sticky headings and preservation of all 50 fixture rows/actions.
- Baseline full lint: 3,121 errors and 15 warnings, predominantly existing formatting errors; this change does not claim to make the repository lint-clean.
- Final full lint: 3,101 errors and 15 warnings; the repository still fails lint. No rules or thresholds were disabled.
- Build has pre-existing `inputValidator()` deprecation, Vite tsconfig-paths and bundle-size warnings.
- Secret scan: directory mode only; no findings. No custom Gitleaks configuration or ignore files found. Dependency and generated directories may be skipped by the scanner; Git history was not scanned.
- Live authenticated workflows and production data were not tested; browser tests use the real shared component and compiled application CSS with synthetic rows.

Run from the project root:

```sh
npm run build
npx tsc --noEmit
# Install Playwright separately in the test environment and its Chromium browser.
# This patch adds no application dependency.
node tests/table-scroll.mjs
```

The browser test also accepts `CODEX_PRIMARY_RUNTIME_NODE_MODULES` for an existing
Playwright installation and `CHROMIUM_EXECUTABLE_PATH` for an existing Chromium executable.
