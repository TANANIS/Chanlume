# Chanlume Agent Guide

This file defines the working rules for agents and maintainers changing Chanlume. Read `README.md`, `STATE_SYNC.md`, and `HANDOFF.md` before making non-trivial changes.

## Product boundaries

- Chanlume is a local-first Chrome/Edge Manifest V3 extension for organizing YouTube subscriptions.
- Keep the YouTube recommendation home page separate from the subscription shelf. Group filtering belongs to `/feed/subscriptions`; do not reinterpret or reorganize the recommendation algorithm.
- Do not add telemetry, a remote backend, cloud AI, or upload browsing/subscription data unless the user explicitly changes that product decision.
- Preserve existing user data and imported backups. Schema migrations must be backward compatible and idempotent.
- Treat YouTube DOM and internal renderer data as unstable inputs: validate them, fail safely, and retain recoverable local records.

## Repository map

- `extension/shared.js`: state schema, normalization, channel identity, grouping, classification, and semantic state operations.
- `extension/background.js`: the only writer of `chanlumeState`; serializes mutations and broadcasts committed revisions.
- `extension/content/content.js`: YouTube integration, scanning, filtering, page controls, and DOM behavior.
- `extension/content/identity-bridge.js`: MAIN-world, read-only bridge for stable YouTube channel identity evidence.
- `extension/dashboard/`: full collection and settings UI.
- `extension/popup/`: compact extension UI.
- `tests/`: unit, manifest, background, harness, and browser smoke coverage.
- `outputs/extension/`: installable unpacked mirror.
- `outputs/Chanlume-<version>.zip`: store/release package.

## State and synchronization standard

Follow `STATE_SYNC.md` as the normative specification.

1. `background.js` is the sole writer of `chrome.storage.local.chanlumeState`.
2. Frontends send semantic operations; they must not read, modify, and save an entire stale state snapshot.
3. The background mutation queue reads the latest committed state, applies one operation, increments `revision`, writes once, and then broadcasts the commit.
4. Every frontend deduplicates rendering by `revision`. A full reload must produce the same visible result as a live commit notification.
5. All persisted state passes strict normalization. Unknown or malformed fields must not silently become authoritative state.
6. Async metadata enrichment must merge only metadata newer than the stored record. It must not overwrite newer membership or deletion decisions.

Prefer an existing semantic operation. When adding one, implement and test it in `shared.js`, route it through the background queue, and update `STATE_SYNC.md`.

## Channel identity standard

- A display name is never identity evidence.
- Prefer YouTube's stable channel ID (`UC...`) when available.
- Keep URL identities such as `/@handle` and `/channel/UC...` in `channelAliases` and resolve them through `resolveChannelRecordId`.
- Merge records only when strong evidence connects them, such as a validated `browseId` and canonical base URL from the same YouTube renderer or channel page.
- Full subscription scans use `reconcile-subscription-scan`; do not replace the channel map blindly.
- Reconciliation must preserve group membership, manual labels, the newest metadata, and aliases.
- Preserve unresolved canonical-only records during a scan. Removing uncertain records is worse than temporarily retaining one duplicate.
- Keep the scan shrink guard unless a replacement has equally strong protection against partial YouTube loads.

## UI, localization, and performance

- English is the default locale. Use Traditional Chinese only when the browser/user locale is Chinese. All visible and dynamically generated strings must go through the locale layer.
- Keep the popup shallow: common controls are directly accessible; the dashboard owns complete group/settings workflows.
- YouTube observers must be page-scoped, debounced where appropriate, and disconnected when no longer needed.
- Batch large mutations and normalize at the operation boundary rather than once per channel. Avoid quadratic scans across the subscription library.
- Do not retain unnecessary DOM nodes, full page payloads, or duplicate state snapshots.

## Required verification

Run these checks after relevant JavaScript or manifest changes:

```powershell
node --check extension/shared.js
node --check extension/background.js
node --check extension/content/content.js
node --check extension/content/identity-bridge.js
node --check extension/dashboard/dashboard.js
node --check extension/popup/popup.js
node --test tests/shared.test.js tests/manifest.test.js tests/background.test.js
```

For UI or YouTube integration changes, also run `tests/ui-smoke.cjs` against a local HTTP server. The smoke test needs Playwright available through `CHANLUME_NODE_MODULES` in this workspace environment.

Automated harnesses do not replace an installed-extension check. Report these separately:

- automated/static gates;
- browser harness smoke tests;
- manual verification on the signed-in YouTube account.

For identity changes, manually verify at minimum that a channel categorized from its channel/watch page leaves `#chanlume-group=unfiled` after returning to subscriptions, both live and after reload.

## Packaging and release

- Bump `extension/manifest.json` only when producing a new version.
- Mirror the exact `extension/` contents into `outputs/extension/`.
- The ZIP must contain `manifest.json` at its root and must match the source files byte-for-byte.
- Record the package SHA-256 in `HANDOFF.md` or the release notes.
- Do not publish, push, tag, or submit to a browser store unless the user explicitly requests it.
- Never describe a package as released when only a local artifact was built.

