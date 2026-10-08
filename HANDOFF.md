# Chanlume Handoff

Updated: 2026-10-09
Current extension version: **1.19.4 (Chanlume)**
Current state schema: **15**

## 1.19.4 YouTube controls, Favorites and toolbar

Fixed subscription detection for YouTube Smartimation layouts that retain both button states. Controls use the visible button, observe subscription components directly and only mark synchronization complete after a successful semantic commit. Failed saves retry up to three attempts. Classification uses a fixed-position native popover to avoid container clipping; failed membership saves restore the committed checkbox state.

Favorites now parses inert `script#yt-initial-data` JSON in addition to legacy assignments without executing scripts. With Shorts hidden, the selected Videos tab remains the only source. NETWORK, HTTP and PARSE failures propagate to localized retry guidance. All 11 public channels in the reported failure case returned HTTP 200 and yielded recognized normal uploads.

The launcher stays visible while Chanlume is enabled outside fullscreen. Fullscreen closes the panel, backdrop and classification menu. The toolbar is a sticky single row with group colors, count badges, horizontal scrolling, active-group visibility and searchable group selection; dark/light themes and a 390 px viewport were checked.

Verification: **72/72** unit/static/background/parser tests, all extension JavaScript syntax checks, and seven browser harnesses (`ui`, `favorites`, `classification`, `onboarding`, `performance`, `power`, `youtube-regressions`) passed. Loopback HTTP was blocked in the test environment; `tests/local-fixture-preload.cjs` serves local fixture files through Playwright routing. The user reported completing the installed-extension reload/update check on 2026-10-09; this is user-reported verification, not an independently automated signed-in check.

Package: `outputs/Chanlume-1.19.4.zip`; SHA-256 `446118680dc3279d8e71814eab874d79ba7bec4263894c2030ef8ac98ed1d363`. All 19 source/mirror/ZIP entries match byte-for-byte. GitHub push was authorized on 2026-10-09. No 1.19.4 Chrome Web Store submission was performed.

## 1.19.3 Chanlume rename

Renamed active product copy, localized manifest titles, JavaScript globals, message types, storage keys, DOM/CSS and data-attribute namespaces, generated backup filenames, packaging, documentation and authoring scripts to Chanlume. Storage migration is queued in the background only, preserves legacy recovery copies, and never overwrites existing Chanlume data. Frontend reads fall back during migration. Old runtime mutation requests and saved group/Favorites/scan links remain compatible. Backup JSON schema remains 15.

Local package: `outputs/Chanlume-1.19.3.zip`; SHA-256 `6433d361fdf43637a47f665c3337b2f99d7dfb898e99465ba3b9ec7bb88e8cbb`. Source, unpacked mirror and ZIP are verified byte-for-byte by `scripts/package.py`.

Verification: 69 unit/manifest/background tests, all extension JavaScript syntax checks and six browser harnesses. Store assets were recaptured from the renamed interface using synthetic local demo data. Signed-in installed-extension update remains unverified. The developer reported manually uploading the store package on 2026-10-08; review/submission/publication status has not been independently verified. GitHub publication and the TANANIS/Chanlume repository rename are part of this change.

Historical release ZIPs, screenshots, videos and old verification records below retain their original names and contents. Current README uses regenerated Chanlume assets. Current GitHub links point to TANANIS/Chanlume. The simplified English and Traditional Chinese store descriptions from the conversation are saved in STORE_LISTING.md.

## 1.19.2 direct classification

User requested removal of the decision layer. Auto-organize now starts immediately, enriches available metadata, and commits all requested unfiled channels through the new background `auto-classify` operation. The strongest usable match becomes each channel's initial group; channels without a result go into Other/其他. Existing classifications stay intact, and users edit assignments afterward. The introductory confirmation and review UI/module/styles are removed. Cancellation during analysis prevents classification; failed saves offer retry; commit-time controls prevent misleading cancellation during the atomic write. Onboarding describes direct classification.

Verification: **64/64** unit/static/background tests, seven JavaScript syntax checks, and all six browser harnesses pass. New cases cover low-confidence automatic assignments, one initial group per channel, localized fallback reuse without ID collisions, alias resolution, idempotence, excluded newly arriving channels, concurrent manual edits in the background queue, cancellation, save failure/retry and persistence in both languages. Synthetic completed-library screenshots `work/classification-direct-en.png` and `work/classification-direct-zh-TW.png` were inspected. Real installed-dashboard verification and the broader live Favorites/Shorts checks remain blocked by the browser tooling described below. No store upload or submission has been completed.

Testing artifact: `outputs/TubeShelf-1.19.2.zip`; SHA-256 `eb414f8d4871ef435178e83e2b8937bdb37a6e812ec4ffec3a9904fc2522a385`. All 19 source, unpacked mirror, and ZIP entries match byte-for-byte. Earlier versioned archives remain intact.

## 1.19.1 classification review history (superseded)

Replaced repeated group-based checkbox cards with one row per unfiled channel, a primary destination selector, Leave unclassified, and a Use suggestion shortcut. Search retains selections outside the visible list. Reasons and extra group destinations are collapsed by default. The selected-channel/new-group count and save errors stay above the fixed Apply selections control. Incoming revisions and failed saves preserve pending choices; keyboard focus survives checkbox updates. Onboarding wording matches this flow.

Verification: 61 unit/static/background tests, eight JavaScript syntax checks, and all six browser harnesses pass (`classification-smoke`, `ui-smoke`, `favorites-smoke`, `onboarding-smoke`, `performance-smoke`, `power-smoke`). Classification fixtures cover both languages, 390 px viewport bounds, no-suggestion channels, adopting/skipping suggestions, multiple destinations, search, external revisions, keyboard focus, failed-save retry, and reload persistence. Synthetic review screenshots were inspected.

Live Edge: a full subscription scan populated the previously empty picker without a reload. Later, the current YouTube page showed 401 channels, 16 existing groups and Shorts hiding enabled. These observations do not complete live Favorites feed/Shorts or installed-dashboard validation. The browser connection subsequently failed with `Debugger unattached`. The dashboard URL was previously blocked by URL policy, and Chrome developer-console control reported `The extensions gallery cannot be scripted`. Do not claim store upload, draft save or submission. Finish signed-in runtime checks after browser control is restored; README continues to offer 1.18.7 as stable.

The sections below are historical verification records and refer to the source/package state at the time they were written.

Testing artifact: `outputs/TubeShelf-1.19.1.zip`; SHA-256 `db0d85faf18830710d4067895910b69ecc2cd647dfeffdd5b037bdc42ca9b820`. All 20 source, unpacked mirror, and ZIP entries match byte-for-byte. The prior 1.19.0 archive is preserved.

## 1.19.0 dashboard editing and favorites history

2026-09-10 follow-up: Favorites obeys the global Shorts setting. With Shorts hidden, the background parses only the selected public channel Videos tab, rejecting reel/Shorts cards and related shelves; failure never falls back to RSS. Mode-specific cache/pending keys and frontend generation invalidation prevent old RSS responses from reappearing after a toggle. The picker now supports search, group filtering and immediate follow/unfollow. A separate star beside Groups on channel/watch pages uses the same `edit-favorites` operation.

Classification now folds common script variants, strips contact noise, applies English boundaries, caps correlated phrases per field, deduplicates titles and official topic groups, and recognizes game development, science, stories, camping/survival and VTuber separately. Existing named groups and manual labels are retained. Suggestions are reviewed per channel, with only high confidence preselected and competing candidates available for multiple assignments. Optional starter groups are available from onboarding and Preferences through idempotent `add-group-templates`.

Read-only local replay used old backup metadata, current group definitions and no learned profiles. Several previously identified examples improved, but personal choices for comedy/documentary channels still differ from dictionary suggestions. This is a targeted regression replay, not a general accuracy benchmark; the original private backups remain outside the repository. `work/evaluate-classification.cjs` takes both backup paths and an optional name pattern, prints results locally and writes nothing.

Follow-up gates: **61/61** unit/static/background tests and seven JavaScript syntax checks pass. Browser harnesses `ui-smoke`, `favorites-smoke`, `classification-smoke`, `onboarding-smoke`, `performance-smoke` and `power-smoke` pass. Added coverage includes Shorts mode cache segregation, late RSS rejection, both star entrypoints, immediate picker mutations, multi-group per-channel review, revision-preserved choices, failed-save retry and idempotent onboarding templates. Synthetic English/Traditional Chinese screenshots were visually inspected, including corrected review-column widths and visible Apply controls. Real signed-in YouTube and live public Videos-tab compatibility remain unverified. Source and unpacked mirror are synchronized; versioned ZIPs and manifest version are unchanged.

First-install follow-up: after the initial state commit, `runtime.onInstalled` opens `dashboard/dashboard.html?view=settings` in an active tab only for `reason: install`. Dashboard honors this initial Preferences view and displays the existing welcome tutorial while onboarding is incomplete. Starting the tutorial continues the existing library/scan flow; skipping preserves the current view and commits completion. Normal dashboard URLs still open the library. Extension/browser updates only migrate state; they do not open tabs or reset onboarding.

Follow-up verification: **53/53** unit/static/background tests, seven script syntax checks, existing UI smoke, and `tests/onboarding-smoke.cjs` pass. The added background tests cover installation sequencing and update preservation. English and Traditional Chinese browser fixtures cover Preferences landing, tutorial navigation, skip, persisted completion across reloads, and normal dashboard visits. The Traditional Chinese first-install screenshot in `work/first-install-zh-TW.png` was visually inspected. A real fresh-install browser event has not been exercised; the existing installed extension and user data were preserved.

The current source and unpacked `outputs/extension/` mirror include unreleased changes; the manifest remains 1.18.7 and the existing versioned ZIP has not been rebuilt.

- Dashboard cards open channels on YouTube, with a separate Details button. Manage members opens searchable checkbox rows. Bulk actions stage changes; Save commits one delta operation, Cancel writes nothing, and failed saves retain the draft. Finish or cancel editing before switching groups.
- A single Favorites button sits above `ts-guide-heading`, outside the collapsed group list. It opens a dedicated view in YouTube subscriptions `#primary`, with a searchable picker for collected channels and up to six newest public videos per channel, publication dates, refresh and per-channel retry.
- Favorites persist separately from groups through schema 15 and the background mutation queue. Alias reconciliation, import normalization and channel deletion maintain valid references. Videos are fetched directly from YouTube's public Atom feeds or the normal Videos tab when Shorts are hidden, with bounded concurrent work and transient caching; no API key or additional permissions.
- Added `extension/content/favorites.js`, `tests/favorites-harness.html`, and `tests/favorites-smoke.cjs`.

Verification: **51/51** unit/static/background checks, seven script syntax checks, existing UI/performance/power browser harnesses, and the new favorites browser smoke pass. The new smoke covers staged editing/cancel/save, persistence, publication order, partial network failure/retry, failed-save recovery, route restoration, and disabling/re-enabling the integration. English/light and Traditional Chinese/dark screenshots use synthetic fixtures in `work/`; layouts were visually inspected.

Live YouTube feed verification and signed-in installed-extension validation are pending: an attempted public channel request from this environment failed to connect. Reload the existing unpacked extension and YouTube tabs to exercise the current source; preserve the installation and its storage. No publish, tag, push or store submission was performed.

## Current status

Version 1.18.7 widens the popup to 460 px and uses a fixed 600 px layout, with a scrollable group area measured at 237 px for a 416-channel/10-group Traditional Chinese fixture. Counts and YouTube destinations share one row; redundant per-group subtitles are hidden; the support section is a compact footer. The support link has been removed from `tubeshelf-toolbar` while remaining in the popup, dashboard and YouTube panel.

The popup header now has a single global power button backed by `settings.enabled` via the existing background `set-setting` queue. Missing values default to enabled. Turning off removes injected guide/toolbar/classifications, unhides native cards/Shorts/recommendations, closes the panel, cancels queued work/scanning, disconnects observers and suspends the MAIN identity bridge. Channels, memberships, aliases and individual preferences are preserved. Reopening or reloading keeps the saved power state. Turning back on reapplies the current state without a YouTube reload. Automatic identity/subscription/scan commits reject disabled state. Already completed redirects are not reversed; autoplay restoration only applies to the connected toggle previously changed by TubeShelf without a subsequent manual user click.

Verification: six JavaScript syntax checks, **46 unit/static/background tests**, existing UI smoke, performance smoke, and new `tests/power-smoke.cjs` pass. Power smoke exercises the popup semantic operation, live content cleanup, native Shorts visibility, autoplay restore, disabled reload, data retention, restored filtering and bridge suspension. English/Traditional Chinese and enabled/disabled screenshots were visually inspected. `work/popup-1.18.7-on.png` uses synthetic data, not the user's actual subscriptions.

Current artifact: `outputs/TubeShelf-1.18.7.zip`; SHA-256 `b012f4612c4dfbb29efb0acb1f21920c5ee77ae3c82fabd69df2bfc1d3e9a08e`. All 18 source/mirror/ZIP files match. Local only; no store/GitHub publication or installed-extension verification on signed-in YouTube in this task.

## 1.18.6 support entry history

Version 1.18.6 retains the 1.18.5 performance improvements and makes the Buy Me a Coffee entry visible in the subscription toolbar, YouTube panel, dashboard sidebar, and popup. All links target `https://buymeacoffee.com/tananis`, open in a new tab, and use `noopener noreferrer`. No embedded third-party scripts, new observers, or requests are added.

The bilingual call to action is **支持與回饋 ↗ / Support & feedback ↗**. Copy: 「有問題想回報，或有功能想許願？用一杯咖啡支持開發，也把你的想法留給我。」 / “Found an issue or have a feature wish? Support development with a coffee and share your ideas with me.” It makes no promise of paid priority, guaranteed fixes, or feature delivery.

The popup statistics are compact so the support card remains inside a 600 px viewport. Rendered English and Traditional Chinese popup heights are 589 px and 577 px; screenshots of the popup, dashboard, and subscription harness were visually inspected. The link's new-tab destination was checked with an intercepted local response, not a live payment flow. Syntax checks, all 44 unit/static/background tests, existing UI smoke, and performance smoke pass.

Current local artifact: `outputs/TubeShelf-1.18.6.zip`; SHA-256 `ab26ad5a7beb457518de13dba31acbf301722377437852e02eab92d96845c8c5`. All 18 source/mirror/ZIP files match byte-for-byte. Source and `outputs/extension/` are updated. GitHub/store publication and installed-extension verification on signed-in YouTube remain pending.

## 1.18.5 performance verification history

Version 1.18.5 optimizes the content-script rendering and refresh lifecycle. It is built locally only; GitHub and the store have not been updated by this task. README download links continue to point to the previously published 1.18.4.

- Normalized state builds a channel membership index once per accepted revision. Video badges no longer call the whole-library-normalizing `groupForChannel` for every card.
- Repeated or older revision notifications are discarded before normalization in content, dashboard, and popup.
- Dynamic card work is batched against a fixed 32 ms timer deadline instead of resetting a trailing 180 ms debounce. Ongoing page activity no longer postpones filtering indefinitely.
- TubeShelf-owned badge changes do not schedule another filtering pass. Non-subscription pages skip recommendation-card processing when Shorts hiding is off.
- Reused card links and watched-progress style changes are observed. Style observation is enabled only on subscriptions when watched-video filtering is active.
- Hidden content tabs accept current state but defer rendering, cancel pending timers, and release queued DOM nodes. Foregrounding refreshes from the latest accepted revision.
- The identity bridge pauses observation and retries while hidden, releases its identity caches on navigation away, and weakly references `ytInitialData`. Returning to cached channel renderers still republishes valid identities.
- Dashboard list avatars load lazily.

Verification: JavaScript syntax checks and all **44 unit/static/background tests pass**; existing UI smoke and `tests/performance-smoke.cjs` pass. A headless Edge synthetic comparison using 500 channels and 200 cards measured baseline filter calls of 1,046–1,974 ms versus 2.2–7.8 ms for 1.18.5. This measures the extension filter function, not total YouTube page load or installed-extension process memory. A synthetic GC probe confirmed the old initial-data object was retained by 1.18.4 after navigation and collectable with 1.18.5.

Local artifact: `outputs/TubeShelf-1.18.5.zip`; SHA-256 `8515f1717894cd6ac43155d28b1b988d46b51dc55640c3e8056e4cab29d648fe`. All 18 source, mirror, and ZIP files are byte-identical. Build/verification entrypoint: `scripts/package.py`. Findings and reproducible benchmark inputs/results: `PERFORMANCE.md`, `work/performance-audit.cjs`, `work/performance-baseline/`, and `work/performance-audit-results.json`.

Manual installed-extension testing against the signed-in YouTube account is still pending. Load/reload the existing unpacked installation from `outputs/extension/`, then reload existing YouTube tabs once to replace the old content script. Do not remove the existing installation or its local data.

## Previous 1.18.3 verification history

Version 1.18.3 retains the unified state mutation and scan-time channel identity reconciliation from 1.18.0, and adds the verified YouTube UI follow-up described below. The known split-identity failure—where a channel was categorized under `/channel/UC...` but the subscriptions card still resolved to `/@handle` and remained in Unfiled—has been addressed in source, automated tests, and browser harnesses.

The local release artifact is:

- `outputs/TubeShelf-1.18.3.zip`
- SHA-256: `78A4328422521EEE82763EE0CF1694CC53DE6ADC796A465350D5EC163A1C8485`
- Verified contents: 18 source files, 18 mirrored files, and 18 ZIP files; source, mirror, and ZIP hashes match exactly.

GitHub `main` and tag `v1.18.3` are published. The tag contains the verified ZIP at `outputs/TubeShelf-1.18.3.zip`, and README links directly to that tag artifact. The Chrome Web Store listing itself was not uploaded or changed in this task; README now links to the existing listing supplied by the user.

## Packaged 1.18.3 UI follow-up

The 1.18.3 source, `outputs/extension/` mirror, and ZIP include this YouTube UI follow-up:

- `tubeshelf-guide-section` starts collapsed, has an accessible expand/collapse control, and preserves manual changes during the current YouTube SPA session.
- `tubeshelf-toolbar` group chips wrap naturally onto additional rows instead of overflowing horizontally when many groups exist.
- The toolbar brand block has been removed so the group chips receive the full available width.
- YouTube live inspection showed the expected `--yt-spec-*` properties are empty in the current subscriptions UI. TubeShelf now follows YouTube's actual `html[dark]` marker with explicit light and dark tokens, so injected surfaces switch immediately without separate persisted theme state.
- The toolbar now uses `box-sizing: border-box` with a 52 px one-row minimum. Additional group rows still expand the toolbar naturally without the previous content-box minimum-height padding inflation.
- Subscription-page video previews now add a compact classification row immediately below each card's last `ytContentMetadataViewModelMetadataRow`. Stored categorized channels show every assigned group, stored unfiled channels show Unclassified, and channels absent from TubeShelf state receive no added row.
- Channel pages retain `tubeshelf-channel-classification`, but its insertion lookup is scoped to the page header so video-grid metadata elsewhere on the page cannot capture it.
- `ts-current-trigger` is rendered only for a stored channel that is not currently known to be unsubscribed. A newly subscribed channel still enters through the existing `set-subscription` semantic operation before the control appears.
- Metadata-row arrival uses the existing debounced YouTube structure observer. The added UI remains read-only; state changes still flow through the background single-writer queue and accepted revisions.

Verification for this follow-up: all JavaScript syntax checks pass, unit/static/background tests remain **43/43 passed**, and the browser smoke covers guide collapse/expand, brand-free wrapped toolbar rows, `html[dark]` light/dark changes, scoped channel-header classification, preview-card categorized/unfiled/no-data cases, alias-resolved membership, and removal of channel controls after a newer no-channel state revision. Manual installed-extension verification on live YouTube remains required.

## What changed

### Unified mutation flow

- `background.js` is the sole writer of `tubeShelfState`.
- Dashboard, popup, and content scripts send semantic operations rather than saving stale full-state snapshots.
- Mutations are serialized, applied to the latest state, assigned a new `revision`, written once, and broadcast.
- Frontends deduplicate renders by revision, so live updates and reloads follow the same state source.
- Async metadata enrichment uses timestamps and cannot overwrite newer user decisions.

### Stable channel identity

- Schema 14 adds `channelAliases`.
- `resolveChannelRecordId` maps `/@handle`, `/channel/UC...`, and other validated aliases to one record.
- `coalesceChannelIdentities` merges strongly linked duplicate records while retaining groups, manual labels, aliases, and newest metadata.
- `identity-bridge.js` runs in YouTube's MAIN world on `/feed/channels` and reads validated renderer identity pairs (`browseId` plus canonical URL). It sends only the minimal identity mapping to the isolated content script.
- `reconcile-subscription-scan` replaces blind channel-list replacement. It coalesces strong identities, upserts observed subscriptions, preserves unresolved canonical-only records, and applies the partial-scan shrink guard.
- Display names are never used to merge records.

### Original reproduced failure

The live evidence for Tenacious Trilobite was:

- subscriptions card: `/@TenaciousTrilobite`;
- channel page canonical identity: `/channel/UCNqVXfC231oVcZEcUKrW0DQ`;
- TubeShelf channel control identity: `/channel/ucnqvxfc231ovczecukrw0dq`.

The old flow could keep a handle record in Unfiled while the canonical record carried the selected group. The new scan bridge and reconciliation operation join those identities and preserve the categorized record.

## Current data flow

1. `/feed/channels` loads and the MAIN-world bridge observes YouTube channel renderers.
2. The bridge validates stable `UC...` IDs and canonical base URLs, then posts identity pairs to the isolated content script.
3. The scanner collects visible subscription cards, enriches them with bridge identities, and sends `reconcile-subscription-scan`.
4. The background queue reads the latest state and calls the shared reconciliation logic.
5. Reconciliation coalesces aliases, updates observed channels, protects uncertain records, increments `revision`, and commits once.
6. All open TubeShelf surfaces receive the committed revision and rerender from the same authoritative state.
7. Subscription filtering resolves every card identity through `channelAliases` before checking group membership.

## Verification completed

- JavaScript syntax checks pass, including the final renderer-data retry logic in `identity-bridge.js`.
- Unit/static/background tests: **43/43 passed**.
- Browser UI smoke passed: English UI, group merge, channel identity repair, channel-header and preview-card classification metadata, unsubscribed control removal, guide collapse, brand-free wrapped toolbar groups, `html[dark]` YouTube theme following, scan identity extraction, Unfiled filtering, synchronized group URL, and dynamic Shorts hiding.
- A 500-channel reconciliation benchmark completed in approximately 40 ms on the first reconciliation and 117 ms on a repeated pass in the current environment. This excludes YouTube page scrolling/network time.
- Package source/mirror/ZIP file sets and SHA-256 values match exactly.

## Manual verification still required

The newly built unpacked extension has not yet been reloaded and exercised against the user's live signed-in YouTube account after the final 1.18.3 changes. Before store submission:

1. Reload `outputs/extension/` in `edge://extensions` or `chrome://extensions`.
2. Run **Update subscriptions** and let `/feed/channels` finish loading all subscriptions.
3. Categorize a currently Unfiled channel from its channel page or watch page.
4. Return to `/feed/subscriptions#tubeshelf-group=unfiled` without reloading and confirm it disappears.
5. Reload the subscriptions page and confirm it remains absent from Unfiled and appears in the selected group.
6. Inspect the dashboard to confirm there is one effective record and the correct group membership.
7. Repeat with several handle/canonical combinations and with subscribe/unsubscribe actions.
8. Toggle YouTube between light and dark on `/feed/subscriptions` and confirm the guide, toolbar, panel, and preview classification badges switch immediately.

YouTube's internal renderer shape is not a public API and may change. The bridge currently checks `data`, `__data.data`, `__data`, and `__dataHost.data`, with bounded retries when data is assigned after element creation. If live scanning stops producing aliases, inspect the renderer payload before weakening validation.

## Important files

- `STATE_SYNC.md`: authoritative persistence, mutation, revision, and identity rules.
- `extension/shared.js`: schema 14, alias resolution, coalescing, reconciliation, and semantic operations.
- `extension/background.js`: serialized single-writer commit pipeline.
- `extension/content/identity-bridge.js`: YouTube MAIN-world identity extraction.
- `extension/content/content.js`: scanning, filtering, page controls, and bridge consumption.
- `tests/shared.test.js`: identity and reconciliation behavior.
- `tests/identity-scan-harness.html`: renderer identity extraction fixture.
- `tests/content-harness.html` and `tests/subscriptions-harness.html`: split-identity and filtering fixtures.
- `tests/ui-smoke.cjs`: browser-level regression checks.

## Next priority

Perform the live installed-extension verification above. If it passes, the synchronization and identity standard is ready for normal feature work and store-preparation review. If it fails, capture the affected subscription card URL, the channel page canonical URL, and the renderer's identity fields; do not add a display-name fallback.
