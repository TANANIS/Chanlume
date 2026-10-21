# Chanlume state synchronization standard

## Source of truth

`chrome.storage.local.chanlumeState` is the durable source of truth. The background service worker is its only writer. Dashboard, popup, and YouTube content scripts may read state, but must never call `chrome.storage.local.set()` for `chanlumeState`.

The optional local development watcher is independent of this durable state: `extension/dev-reload.json` is a short-lived source-change heartbeat, and `chanlumeDevReloadPending` is a transient `chrome.storage.local` key used only to refresh the proper YouTube tabs after `chrome.runtime.reload()`. Neither is a channel/subscription record or a general-purpose state mutation. The pending key is cleared at the reload boundary; no personal data leaves the browser. Release packaging refuses an active watcher marker.

## Rename compatibility (1.19.3)

The background's serialized task queue copies missing `chanlumeState`, `chanlumeYouTubeApiKey` and `chanlumeScanStatus` values from the legacy `tubeShelfState`, `tubeShelfYouTubeApiKey` and `tubeShelfScanStatus` keys before performing a state task. Existing new keys always win, including empty credentials or a reset library. Legacy copies are retained for recovery and are never written again. Frontends use read-only fallback while migration is pending. Update normalization advances revision without opening onboarding or resetting data.

New messages use `CHANLUME_*`; the background accepts old `TUBESHELF_*` requests during updates. Old `#tubeshelf-group`, `#tubeshelf-view` and scan links map to Chanlume links. JSON backup content/schema remains unchanged; only new export filenames change.

## Mutation protocol

### Sidebar proximity preference (1.24.2)

`settings.sidebarAutoExpandOnHover` is a locally persisted boolean, defaulting to `true` when missing from older stored states or backups. The sidebar's mouse-only native-guide edge hover is enabled only when this setting and Chanlume's global power are both on. The setting lives alongside the existing five switches in **Reduce distractions** and uses the existing `set-setting` semantic mutation through the background queue; the UI and hover handler do not write storage directly.

Disabling the preference cancels pending hover-open/auto-close timers and prevents late delayed hover callbacks. It never disables YouTube's own guide hamburger button, replaces the drawer, or closes a manually opened drawer. The saved off state must survive normal YouTube navigation and a full page reload. Re-enabling restores the existing proximity behavior.

Frontends send a `CHANLUME_MUTATE` runtime message containing one semantic operation. Supported operations are implemented by `ChanlumeCore.applyStateOperation()`:

- `toggle-membership`
- `bulk-membership`
- `edit-memberships`
- `edit-favorites`
- `set-subscription`
- `coalesce-channel-identities`
- `set-setting`
- `set-language`
- `set-onboarding-complete`
- `save-group`
- `merge-groups`
- `delete-group`
- `apply-auto-suggestions`
- `auto-classify`
- `add-group-templates`
- `patch-channels`
- `reconcile-subscription-scan`
- `replace-state`
- `reset-state`

The background service worker serializes operations through one promise queue. For every operation it:

1. Reads the latest stored state.
2. Normalizes and validates the operation against that state.
3. Applies only the requested intent.
4. Increments `revision`.
5. Writes the complete normalized result once.
6. Returns that exact committed state to the caller.

Install/update schema migration uses the same queue and also advances `revision`, so already-open frontends cannot mistake a normalized migration for an old duplicate.

Only `runtime.onInstalled` with `reason: install` opens `dashboard/dashboard.html?view=settings`, after the initial state commit has completed. Update events do not open tabs or reset `settings.onboardingComplete`. The dashboard's existing onboarding-completion flag controls whether the welcome tutorial appears; skipping or finishing still uses `set-onboarding-complete` through the mutation queue. The initial Preferences URL is a presentation choice, not a persisted preference or a reason to force a completed tutorial to repeat.

Do not add a frontend code path that accepts a state snapshot and writes it back. Add a semantic operation instead.

## Staged selections and favorites (schema 15)

`favoriteChannelIds` is a separate, ordered list of existing channel record IDs. Normalization resolves aliases, removes duplicates/missing records, and defaults older backups to an empty list. Strong identity coalescing preserves favorites. Definitive channel removal also removes its favorite reference. Group membership and favorite membership are independent.

Dashboard member editing keeps temporary changes in memory; Cancel performs no mutation and Save sends one `edit-memberships` operation (with `groupId`). Favorites now apply immediately: the searchable group-filtered picker and channel/watch-page star each send `edit-favorites`. Both operations contain `changes: [{ channelId, enabled }]`. The queue applies only touched IDs against current state, preserving concurrent edits to other channels and never recreating a deleted channel. Failed favorite mutations retain the committed selection for retry; closing the picker does not undo successful changes.

Favorites use `/feed/subscriptions#chanlume-view=favorites` and mount in that page's `#primary`. Native children are hidden only while this view is active; navigation and disabling Chanlume restore them. The Favorites guide entry is inside the expandable subscription-channel section, which starts collapsed and must be expanded before using that entry.

`CHANLUME_FAVORITE_FEED` is a read-only background request restricted to existing favorites while enabled. Public YouTube channel metadata resolves the page owner when a stable ID is unavailable, then the YouTube Atom feed supplies video IDs, titles and publication dates. There is no API key requirement. Requests use a 20-second timeout, a three-request concurrency limit, per-channel request deduplication and an in-memory five-minute cache capped at 100 entries. Opening the view loads the list; refresh bypasses the cache. Individual failures keep previously loaded videos visible and expose retry. No polling or viewing history is added.

When `settings.hideShorts` is true, Favorites instead reads the selected channel Videos tab from public `ytInitialData`. Only recognized normal video cards are accepted; Shorts links/reel endpoints, shelves and playlists are excluded. Missing or unrecognized data produces a retryable error, never an RSS fallback. Cache and in-flight keys include the Shorts mode. A live mode change clears rendered video data and advances the request generation, so stale RSS replies cannot restore Shorts. Same-mode retry failures may retain previously verified normal videos.

Channel page parsing accepts inert `script#yt-initial-data` JSON and legacy `ytInitialData` assignments without executing page code. Favorite feed failures preserve NETWORK, HTTP and PARSE categories for localized retry guidance.

Subscription status reads the visible button in YouTube's retained dual-button layouts. A component-scoped observer tracks subscription animation/state changes; the general page observer keeps its narrow attribute filter. Synchronization marks the tracked state only after the semantic commit succeeds, and retries transient failures up to three attempts. Classification and Favorites continue using the existing mutation operations and alias resolution.

## Direct classification and starter groups

Classification folds common Traditional/Simplified variants in derived matching text only, removes contact/URL noise, matches English word boundaries, caps correlated phrase scores per field and deduplicates repeated titles and official topic groups. Specific subjects and explicit group-name aliases reuse existing IDs, names and memberships. Personal vocabulary still derives only from stored manual labels; model suggestions do not train themselves.

The Auto-organize button starts metadata enrichment immediately, then sends `auto-classify` with the original target `channelIds`. There is no review or confirmation stage. In the background mutation queue, IDs resolve through current aliases and only currently unfiled requested channels are classified. The strongest usable result becomes the sole initial destination, including low-confidence or tied results; no usable result goes into the existing Other/其他 group or a newly created localized fallback. Newly arriving channels outside the run are left untouched. Current manual classifications, deleted records and manual learning labels are preserved. Repeating the operation is idempotent.

The progress dialog closes after a successful commit. Failed metadata reads use available saved metadata; failed saves show a retry control. Cancellation during enrichment prevents the classification operation, including when cancellation arrives during the preceding metadata commit. Once the atomic classification commit is sent, close/cancel controls are disabled until it finishes. Subsequent corrections use the existing membership editor. The older `apply-auto-suggestions` operation remains compatible but is no longer used by this dashboard flow.

`add-group-templates` accepts known catalog `groupIds` and only adds missing empty groups. It resolves existing canonical IDs and explicit name aliases, ignores unknown/duplicate IDs and is idempotent. The optional picker is available in Preferences and onboarding; existing groups, manual labels, favorites and channel records are preserved. No schema reset or automatic group replacement occurs.

## Channel identity standard

YouTube may represent one channel as a readable `/@handle` URL on subscription cards and a `/channel/UC...` canonical URL elsewhere. Channel records keep an immutable local key, while `channelAliases` maps every strongly verified YouTube identity to that record. New records normally begin with the scanned handle as their local key; learning a stable channel ID adds an alias and never requires changing an already unambiguous key.

The scan-page Main-world bridge reads `browseId` and `canonicalBaseUrl` from the same YouTube renderer and sends only validated identity pairs to the isolated Chanlume content script. Channel and watch pages submit their canonical path as another strong alias source. `coalesce-channel-identities` merges duplicate channel records, group memberships, manual learning labels, and the newest cached metadata. Membership and subscription operations carry the same alias context so a user action cannot recreate the split identity. Display names are never identity evidence.

## Frontend refresh standard

### Subscription UI preview (2026-10-20)

`navigation.js` owns the existing guide/group toolbar. `subscriptions.js` owns the subscription header, loaded-content views, and `/feed/subscriptions#chanlume-view=collections`. The main content integration supplies read-only state and native-card adapters; it calls the page module after card filtering, including incremental YouTube arrivals. Favorites and legacy group links retain their routes.

Collections reads the existing groups/channels. Create/rename sends `save-group`; the member dialog records only touched IDs and sends one `edit-memberships` delta. Cancel writes nothing. Failed commits retain the draft; incoming revisions do not replace draft choices. No new state schema, direct storage writer, remote feed service or watching history is introduced.

All/Feed/grid keeps YouTube's native cards. Since 1.23.0, Feed (including group-filtered Feed), Timeline, and Channels' video previews read only **currently loaded native subscription cards**; they do not request public video feeds per channel. Channels' directory itself still uses the complete synchronized local channel map. No view claims a complete video archive. Presentation options such as view, layout, directory-name sort, scope and search live in the URL hash; disclosure state is temporary UI state. Timeline automatically orders loaded videos newest-first from YouTube metadata; the former Newest date, Oldest date and Date range controls are removed. Old `sort=oldest|newest`, `from` and `to` hash parameters are ignored and cleaned on entering Subscriptions. Native source nodes are not moved or cloned with event bindings. Leaving the route or disabling removes custom hiding/search classes and UI. The existing scheduler remains the shared DOM refresh path; the page module adds no observers, and generated module UI is excluded from observation work.

Each frontend keeps a read-only in-memory cache. A committed state may arrive through the mutation response or `chrome.storage.onChanged`; the frontend accepts it only when its `revision` is newer than the cached revision. The first accepted copy renders the UI and a duplicate copy is ignored.

YouTube SPA navigation is separate from state synchronization. Page navigation reapplies controls and card filters from the current cache. Subscription group selection is mirrored to `#chanlume-group=...` and reparsed after navigation or hash changes.

### Watch-page Figma phase 01 (local, unreleased)

`content/watch.js` and `watch.css` handle **only** `/watch`, independently of the Subscriptions page's native-feed data pipeline. When both native `ytd-watch-info-text #view-count` and `#date-text` expose accessible `aria-label` values, the adapter presents those exact labels with eye/calendar indicators in `ytd-watch-metadata #top-row`. YouTube's original title, player, owner/subscription UI and action buttons remain mounted with their own handlers; only the duplicate facts in the description are visually hidden. Publication ages are not converted to calendar dates, and numbers are never parsed from the animated rolling-digit text. A page-scoped observer follows asynchronous native fact changes, including labels arriving after the container; it disconnects when navigating away or turning off Chanlume. If native evidence disappears, the native description facts are revealed again. This is read-only presentation: no new permission, state operation, history cache, host request or storage write. The later Figma suggestions/transcript/live-chat and comment-search concepts are not part of phase 01.

## Long-running metadata work

`settings.enabled` is the persistent global YouTube integration power state (missing values default to `true`). The popup changes it using `set-setting` through the background queue. Turning off retains channels, aliases, groups and individual settings, tears down filtering/UI/observers in every content tab, and stops identity inspection. Disabled tabs still accept storage revisions so enabling restores current state without a reload. Automatic subscription and identity operations are rejected while disabled; an interrupted full scan must not reconcile a partial list. Already-completed navigation is not reversed; a Chanlume-disabled autoplay toggle is restored only when its original element remains connected and the user has not manually changed it.

Network work must run against cloned channel objects. On completion it sends `patch-channels`; it must not save the snapshot used to start the work. Local profile data and official metadata are merged only when their timestamps are at least as new as the stored values.

## Subscription scan reconciliation

`reconcile-subscription-scan` is reserved for a completed full subscription scan. It resolves and coalesces all strong identities first, upserts the observed subscriptions as one batch, then removes records that are definitively absent. Canonical-only legacy records without enough identity evidence are preserved until they can be resolved; they are never deleted merely because the scan returned only handles.

The whole batch normalizes once before reconciliation and once before commit. Do not normalize once per channel. If more than 15 percent of an existing shelf, or more than ten channels, would be definitively removed, the operation fails with `SCAN_SHRINK_GUARD`. The old state remains untouched. A large removal requires explicit user confirmation before resubmitting with `allowLargeRemoval`.

Import and reset use explicit `replace-state` and `reset-state` operations. Imported data always passes through the strict persisted-state schema before commit.

### Subscription center presentation (1.21.0)

The synced channel map supplies the full Channels directory, independent of loaded video cards. Group membership only narrows its scope; no video arrival is required for a channel to remain listed. Collections uses the existing semantic member/group mutations. Feed/Timeline content still comes only from currently loaded subscription cards.

Presentation parameters live in the hash (`chanlume-view`, `chanlume-group`, `layout`, `sort`, `q`, `channel-q`, `from`, `to`), not in the persisted schema. Search edits replace the current history entry; explicit view/scope changes create entries. Collection content navigation creates one history entry. Popstate/hash changes reparse scope and presentation and use the existing refresh scheduler. Unknown dates are never converted from relative labels. This adds no account mutation, playback history or background feed request.

### Early rendering lifecycle (1.21.1)

startup.js reads new/legacy state once at document_start; the main adapter awaits that same promise. It does not write state or create a persistence cache. Content initialization waits for body while state is read concurrently. Narrow startup gates reserve only enhanced surfaces, and disabled/error/watchdog paths reveal native content. **On successful initialization, the startup guide mask must be removed permanently; subsequent enabled-state syncs must not reactivate it.** This permits native guide entries to remain visible when YouTube mounts them later than the Chanlume integration. The shared DOM reconciler updates presentation in place without changing the background authority, semantic mutation protocol, or durable schema. Microtask refreshes bail out while disabled or hidden.

### Recent channel content (1.22.0)

`CHANLUME_CHANNEL_FEED` is a read-only background request for any currently stored, enabled subscription channel. It is not a state operation. The reader verifies public channel ownership, limits/sanitizes entries and returns normal uploads plus matched Atom publication dates. The frontend rechecks current channel identity, Shorts mode and scope before showing results. Current membership remains authoritative; neither a feed nor its cache can add channels, resurrect deleted members, mark watched state or change groups/favorites. No credentialed fetch, direct state write, persistent feed history or new schema is introduced.

Historically, `content/recent.js` owned per-tab scope, bounded public-video request scheduling, presentation cache and retries. **It is no longer injected or called by Subscriptions since 1.23.0.** Its source and the background `CHANLUME_CHANNEL_FEED` service remain dormant/available for compatibility; neither is part of the current subscription presentation path. See the 1.22.0 validation report for the historical data source and its limits.

### Figma page responsibilities (1.22.3)

The four presentation frames map to separate responsibilities: Subscriptions/Timeline (`96:3679`), complete Channels directory (`97:4644`), Collections management (`97:5429`), and a single Collection's video content (`254:10735`). Collection content intentionally omits the global Subscriptions/Collections tabs and filter toolbar, leaving the Collection title, Manage Collection entry and content grid. Return to Collections uses normal browser history. Collections' name sort and layout are presentation-only; creating or editing a collection still sends the existing semantic operations. No new state schema, host permissions or frontend persistence writer were added.

Video cards show only verified metadata. Missing exact dates, avatars, view counts and unsupported post/live/notification actions are not inferred or represented as working functions. Fetch status and retry information reside in an on-demand menu instead of the ordinary reading flow. The original All/Feed native renderer remains structurally separate from the custom video grid, and live installed-extension/author visual acceptance remains a distinct gate.

### Scoped subscriptions category strip (1.22.4)

The Subscriptions header renders a horizontally scrollable, locally collapsible category strip between the global Subscriptions/Collections tabs and view/format/search controls. It contains All, Unclassified, and current user-defined groups. The selected category uses the existing `chanlume-group` URL hash; it is not a new persistent setting or a parallel channel taxonomy. Toggling expansion is transient presentation state and sends no mutation.

Selecting a category does not force a separate collection-content route or discard `chanlume-view`, `layout`, `sort`, `q`, `channel-q`, `from`, or `to`. Since 1.23.0 all video modes filter the native loaded subscription cards by current group membership; Unclassified is derived from existing channel IDs minus all group members. Channels uses the same membership scope for the complete local channel directory, independently of loaded videos. No category or view switch launches per-channel video requests. Feed remains YouTube's native subscription feed, including when a category is selected.

The quiet content page with a collection heading and Manage Collection action is now explicit `chanlume-view=collection`, reached from the Collections manager. It does not render the global category strip/toolbar. Legacy hashes without that explicit view open the scoped Subscriptions interface. Group metadata, aliases, permissions and schema 15 remain unchanged; the background remains the only state writer.

### Left guide distraction controls (1.22.5)

The existing YouTube left guide's Chanlume disclosure now contains a nested, locally collapsible distraction-settings list and a direct Support & feedback link. Each of the five switches (`blockHome`, `hideShorts`, `hideSecondary`, `disableAutoplay`, `hideWatched`) reads the latest accepted `state.settings` and uses the existing `changeSetting` callback → `CHANLUME_MUTATE` / `set-setting`. The background still owns durable persistence and `hideSecondary`/autoplay coupling. Failed commits retain the previous checked state and show feedback; new revisions refresh switches without collapsing the keyed disclosure elements. Opening/closing either disclosure does not persist a preference or modify memberships.

The YouTube right floating panel no longer duplicates distraction controls or support. It continues to show collection shortcuts and Update/Manage actions; for a small library it shrinks to content height, and with many collections its list scrolls within the viewport while retaining the footer. The standalone browser-action popup still offers its separate support link. No state schema, permissions or migrations changed.

### Sticky subscription navigation and guide consolidation (1.22.6)

The former right-side floating launcher, overlay and panel have been removed from the YouTube content script and styles. The left guide's Chanlume disclosure is the sole in-page entry for updating subscriptions, opening the full group/settings dashboard, adjusting the existing five distraction switches and accessing Support & feedback. The `manage` action sends the existing `OPEN_DASHBOARD` runtime message; the subscription scan and switch actions keep their existing background operations. There is no new frontend state writer, mutation type, permission, migration or storage key.

The Subscriptions/Collections tab bar is `#chanlume-shelf-sticky` mounted directly under `document.body` with `position:fixed` below the YouTube masthead. Its `#chanlume-shelf-slot` sibling remains before `#chanlume-subscriptions-page` under `#primary`, occupying the normal 55px flow height and supplying the exact horizontal position and width. This avoids real YouTube's `ytd-browse` and `ytd-page-manager` overflow ancestors, which previously prevented sticky behavior and overlaid the category row on first paint. The slot is measured on resize, its visibility matches the nav, and both are removed with observers during cleanup. The category strip and view/search/date controls remain inside the ordinary subscription header and scroll away. Group scope/retrieval and hash navigation are unchanged.

Content page and sticky bar share a symmetric compact gutter. Left guide parent/child labels are rebalanced to 14px main entries and 13px switch labels, with matching row heights, focus feedback and independent mobile layouts. Tests verify the removed panel, dashboard routing, theme/typography, sticky scrolling in both feed modes, group selection, mobile overflow, and cleanup.

In 1.22.7 the pre-existing browser-action popup `OPEN_CHANLUME` request also follows the new navigation model: with a valid `groupId` it calls `openSubscriptionGroup` to update URL scope and render the matching channel feed; off Subscriptions it opens that route, and with no group it opens the All subscriptions route when needed. Already-on-Subscriptions requests focus the sticky tab area. Invalid IDs fall back to All. This message remains UI-only and has no write path. The old floating-panel opener is not recreated.

### Subscription controls / pinned category order (1.22.9)

The current Subscriptions header order is **view/date/layout/search controls first, expandable category rail second**. Controls remain in normal flow. The rail starts inside `#chanlume-category-slot`, then moves as the same live element under `document.body` only after the slot scrolls beneath the fixed tabs. Its `position:fixed` top is the actual `#chanlume-shelf-sticky` bottom; its left/width follow its placeholder, avoiding YouTube's overflow ancestors and wrapper containment. Reverse scrolling restores the rail to its slot; route changes restore before keyed diffing. Category chip events and horizontal scroll work in both positions. Collection management and dedicated collection-content pages have no category strip. This is layout only: category selection still drives the existing `chanlume-group` hash and scoped native-card filtering, with no settings/storage/mutation changes. The earlier 1.22.4 and 1.22.6 sections describe their historical layouts, not the current order.

### Native subscription feed as the only video source (1.23.0)

The app intercepts the **already-rendered YouTube subscription feed**, not the subscription API or each channel's public Videos/Atom source. In group-filtered Feed, the original YouTube cards and continuation remain active and Chanlume only hides out-of-scope cards. Timeline reformats currently loaded native cards into dated/native-section groups without inventing publication dates; `Oldest` reverses the loaded order, not an unbounded history. Channels retains every locally synced subscribed channel but only shows video previews found in the loaded native feed; missing previews are labelled **not yet loaded**, never **no uploads**. `#primary` keeps its original native feed subtree and `ytd-continuation-item-renderer` laid out beneath the custom views, permitting the same YouTube infinite-scroll mechanism to append older cards. The regular content observer updates the custom representation when those cards arrive. No extra data writer, schema, permission, new network endpoint or video-history cache is involved. Tests simulate incremental cards and the continuation sentinel; real signed-in Helium scrolling remains a separate acceptance gate.

### Live continuation and relative timeline labels (1.23.1)

Live Helium inspection found the custom view's native rich-grid subtree computed as `display:none` despite `cl-native-feed-source`; its continuation sentinel had zero height. While custom native-backed views are active, the page module now saves each source child's original inline `display` value/priority and forces `display:block!important` so YouTube's continuation remains in layout. Returning to native Feed, leaving the page, or disabling Chanlume restores the original inline value and classes. CSS still hides the native video cards while the custom view renders its own cards. Synthetic regression recreates a competing `display:none!important` stylesheet.

Timeline now reads YouTube-supplied relative ages from native metadata (`aria-label` or its visible metadata row), compares approximate durations for Newest/Oldest, and uses the original relative label as a section heading when no exact date exists. Live cards without date/age keep their native order at the end. Relative ages are **not** converted into exact `YYYY-MM-DD` dates; date-range filters continue to require independently verified exact dates. Native video IDs, not full query-string URLs, deduplicate watch links. All changes are ephemeral presentation logic only: no feed requests, state writes, schema, permission or history-cache changes. The 1.23.0 paragraph above is preserved as its historical decision record; relative-age sorting supersedes its oldest-order limitation.

### Empty first-load native grid and signed-in Helium verification (1.23.2)

Live 1.23.1 testing showed a restored Timeline could start with an **empty** native `ytd-rich-grid-renderer`, no continuation, and the root forced to `display:none` because `keepNativePaging` previously classified only descendants already containing videos/continuation. Switching to native Feed made YouTube populate its initial grid; switching back to Timeline then worked. In 1.23.2, the structural YouTube native grid/list renderer is recognized as a source even before its first item is mounted, retaining `display:block!important` and allowing later DOM arrivals. Regression now exercises empty structural grid -> later native card -> Channels preview; the Feed restoration path is retained. No state or background protocol changes.

In the live 1.23.1 session, switching to native Feed populated 107 cards, then Timeline started with 102 native video cards and 80 custom video links. Several native continuation boundaries were reached via real browser scrolling, increasing to 407 native card instances and 298 custom video links, each mapped to a native video ID with zero duplicate custom IDs. Native continuation stayed 140px high and the source renderer computed `display:block` with the preserved important override. The pinned tabs occupied y=56–111px and category rail y=111–166px. Channels retained the complete **410-channel** local directory, regardless of the smaller loaded set; returning to Feed cleared the inline override/classes and restored visible native cards. This is **live verification of 1.23.1**, not yet a fresh installed 1.23.2 acceptance; the empty-grid fix is covered synthetically pending user reload.

### Native-first cold-start handshake (1.23.3)

Signed-in Helium 1.23.2 still exhibited a reproducible difference on **full page reload**: a direct Timeline URL left `#primary > ytd-rich-grid-renderer` at zero children, zero cards and zero continuation, despite the new `display:block!important` inline override; reloading the same page in native Feed produced 308 cards and continuation, and switching to Timeline then worked. The remaining timing hazard was the document-start `chanlume-early-custom` CSS using `display:none` on the entire native grid, plus activating `chanlume-shelf-custom` before any native source contents existed. Either can suppress YouTube's first native mount.

1.23.3 changes that startup visual gate to `visibility:hidden` (never `display:none`), releases the early-custom class upon initialization, and defers `chanlume-shelf-custom` / `keepNativePaging` until native grid contents or continuation exist. While waiting, the original grid keeps its YouTube-managed native layout, concealed via `opacity:0` without removing layout or pointer-event-safe controls; the custom area presents a localized loading state. The existing mutation observer then activates Timeline/Channels once YouTube appends contents. Channels still derives its complete directory from local subscription state, not from the feed. No background reads, storage writes, permissions, schemas or remote fetches were added. Synthetic startup and empty-grid tests cover late native arrival. **Installed signed-in Helium acceptance subsequently passed (2026-10-20):** a full reload directly in Timeline produced 206 native cards and active continuation without switching to Feed, scrolling advanced to 308 and 506 cards, All Timeline showed 367 unique video IDs, Channels retained all 410 channels, and returning through Feed worked. Further scrolling reached 2,606 native cards and 40 distinct matches in the selected `生活與解壓` group. No false empty-state appeared. These are loaded-range counts, not a claim of complete history.
