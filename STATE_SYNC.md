# Chanlume state synchronization standard

## Source of truth

`chrome.storage.local.chanlumeState` is the durable source of truth. The background service worker is its only writer. Dashboard, popup, and YouTube content scripts may read state, but must never call `chrome.storage.local.set()` for `chanlumeState`.

## Rename compatibility (1.19.3)

The background's serialized task queue copies missing `chanlumeState`, `chanlumeYouTubeApiKey` and `chanlumeScanStatus` values from the legacy `tubeShelfState`, `tubeShelfYouTubeApiKey` and `tubeShelfScanStatus` keys before performing a state task. Existing new keys always win, including empty credentials or a reset library. Legacy copies are retained for recovery and are never written again. Frontends use read-only fallback while migration is pending. Update normalization advances revision without opening onboarding or resetting data.

New messages use `CHANLUME_*`; the background accepts old `TUBESHELF_*` requests during updates. Old `#tubeshelf-group`, `#tubeshelf-view` and scan links map to Chanlume links. JSON backup content/schema remains unchanged; only new export filenames change.

## Mutation protocol

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

Favorites use `/feed/subscriptions#chanlume-view=favorites` and mount in that page's `#primary`. Native children are hidden only while this view is active; navigation and disabling Chanlume restore them. The guide entry stays visible above the collapsible group heading.

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

Each frontend keeps a read-only in-memory cache. A committed state may arrive through the mutation response or `chrome.storage.onChanged`; the frontend accepts it only when its `revision` is newer than the cached revision. The first accepted copy renders the UI and a duplicate copy is ignored.

YouTube SPA navigation is separate from state synchronization. Page navigation reapplies controls and card filters from the current cache. Subscription group selection is mirrored to `#chanlume-group=...` and reparsed after navigation or hash changes.

## Long-running metadata work

`settings.enabled` is the persistent global YouTube integration power state (missing values default to `true`). The popup changes it using `set-setting` through the background queue. Turning off retains channels, aliases, groups and individual settings, tears down filtering/UI/observers in every content tab, and stops identity inspection. Disabled tabs still accept storage revisions so enabling restores current state without a reload. Automatic subscription and identity operations are rejected while disabled; an interrupted full scan must not reconcile a partial list. Already-completed navigation is not reversed; a Chanlume-disabled autoplay toggle is restored only when its original element remains connected and the user has not manually changed it.

Network work must run against cloned channel objects. On completion it sends `patch-channels`; it must not save the snapshot used to start the work. Local profile data and official metadata are merged only when their timestamps are at least as new as the stored values.

## Subscription scan reconciliation

`reconcile-subscription-scan` is reserved for a completed full subscription scan. It resolves and coalesces all strong identities first, upserts the observed subscriptions as one batch, then removes records that are definitively absent. Canonical-only legacy records without enough identity evidence are preserved until they can be resolved; they are never deleted merely because the scan returned only handles.

The whole batch normalizes once before reconciliation and once before commit. Do not normalize once per channel. If more than 15 percent of an existing shelf, or more than ten channels, would be definitively removed, the operation fails with `SCAN_SHRINK_GUARD`. The old state remains untouched. A large removal requires explicit user confirmation before resubmitting with `allowLargeRemoval`.

Import and reset use explicit `replace-state` and `reset-state` operations. Imported data always passes through the strict persisted-state schema before commit.
