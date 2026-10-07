# Chanlume — Chrome Web Store submission sheet

Prepared for Chanlume v1.19.3. The developer reported manually uploading the package on 2026-10-08; submission and publication are not independently verified.

This file is the copy/reference sheet for the Chrome Web Store Developer Dashboard. Keep it aligned with the extension behavior, `manifest.json`, and `PRIVACY.md` before every submission.

## Rename the existing store item

Use the existing item `agnnbehkdkdkflknblhkmgciaekngole` in Developer Dashboard. Upload `outputs/Chanlume-1.19.3.zip` using Package → Upload New Package, update localized descriptions and the three regenerated `outputs/store-assets/` images, then submit the update for review. Product titles come from `_locales/en/messages.json` and `_locales/zh_TW/messages.json` through `manifest.json`; they cannot be edited independently in the dashboard. The package version must exceed the latest version already uploaded to this item.

Official guidance: https://developer.chrome.com/docs/webstore/prepare and https://developer.chrome.com/docs/webstore/update.

The GitHub repository is TANANIS/Chanlume. Use the homepage and privacy links below for the renamed project. Historical ZIPs and media still contain the former brand and must not be presented as Chanlume store assets.

## Recommended dashboard choices

- Primary language: English
- Additional locale: Traditional Chinese (`zh_TW`)
- Category: **Workflow & Planning**
- Visibility: Public
- Homepage / support URL: `https://github.com/TANANIS/Chanlume`
- Privacy policy URL: `https://github.com/TANANIS/Chanlume/blob/main/PRIVACY.md`

## Single purpose

> Chanlume gives users local control over how they organize and view their YouTube subscriptions, including optional controls that reduce recommendation-driven distractions while using YouTube.

The grouping, filtering, local classification suggestions, subscription synchronization, in-YouTube group controls, and distraction controls all support this same subscription-focused browsing experience.

## Store summary

The manifest supplies the localized summaries shown by Chrome.

### English

> Organize your YouTube subscriptions into groups. Your data stays on this device.

### 繁體中文

> 把 YouTube 訂閱頻道整理成自己的群組；資料只留在本機。

## English detailed description

Chanlume keeps your YouTube subscriptions organized with custom groups for music, gaming, art, or any topic you choose. Browse groups directly on YouTube’s Subscriptions page, and add channels to more than one group.

Auto-organize sorts unclassified channels using available channel information. Channels without enough information go into Other. You can change any assignment afterward.

Add channels to Favorites to catch up on their latest videos.

You can also:

• Search and manage channels in bulk
• Hide Shorts, recommendations, and watched videos
• Disable autoplay or open Subscriptions instead of the YouTube homepage
• Export and import JSON backups
• Pause Chanlume without losing your groups or settings

Your library stays in your browser. No account, ads, telemetry, or cloud AI. Chanlume runs without a YouTube API key; an optional key lets it use additional public channel information.

Available in English and Traditional Chinese.

Chanlume is open source and independently developed. It is not affiliated with or endorsed by YouTube, Google, or PocketTube.

## 繁體中文詳細說明

Chanlume 幫你把 YouTube 訂閱分成自己習慣的群組，例如遊戲、音樂、繪畫或程式開發。直接在「訂閱內容」頁面切換群組，同一個頻道也能加入多個分類。

「自動整理」會依頻道資訊分類，資訊不足的放進「其他」，之後都能手動調整。也可以把常看的頻道加入「最關注頻道」，集中查看最新影片。

其他功能：

• 搜尋與批次管理頻道
• 隱藏 Shorts、推薦內容與已看過的影片
• 關閉自動播放，或將首頁導向訂閱內容
• 匯出與匯入 JSON 備份
• 隨時暫停，保留群組與設定

訂閱資料儲存在你的瀏覽器中。不需註冊帳號，沒有廣告，不收集使用統計，也不使用雲端 AI。無需 YouTube API 金鑰即可使用；也能選擇提供自己的金鑰，取得更多公開頻道資訊。

支援繁體中文與英文。

Chanlume 是獨立開發的開放原始碼專案，與 YouTube、Google 或 PocketTube 無隸屬、合作或贊助關係。

## Permission justifications

### `storage`

Stores the user's Chanlume state locally: collected public YouTube channel metadata, custom groups, manual classification corrections, preferences, interface language, onboarding/scan state, Chanlume power state, and the optional user-provided YouTube Data API key.

### Host permission: `https://www.youtube.com/*`

Required for Chanlume's user-facing YouTube integration: reading visible subscription/channel metadata, displaying group controls and labels, filtering subscription cards, detecting subscribe/unsubscribe state, loading the user's subscribed-channels page during an explicit update, following YouTube theme state for integrated controls, and retrieving public YouTube channel/RSS metadata needed for organization suggestions.

### Host permission: `https://www.googleapis.com/youtube/v3/*`

Used only when the user explicitly provides their own YouTube Data API key. Chanlume sends that key plus public channel/video IDs directly to Google's YouTube Data API over HTTPS to retrieve public topics, tags, and video categories used by the advertised organization feature.

### Remote code

None. Chanlume does not download or execute remote JavaScript or WebAssembly.

## Privacy practices

Chanlume handles data because its advertised purpose requires reading and locally organizing information from YouTube pages.

Recommended dashboard data-type disclosures:

- **Website content: Yes.** Chanlume reads visible/public YouTube subscription and channel metadata needed to build, classify, label, and filter the user's local subscription library.
- **Authentication information: Yes.** A user may optionally provide a YouTube Data API key. Chanlume stores that key locally and uses it only for direct HTTPS requests to Google's YouTube Data API. The key is not sent to the Chanlume developer and is excluded from Chanlume JSON backups.
- **User activity: No.** Chanlume does not record clicks, mouse positions, keystrokes, general browsing activity, or persistent interaction logs. It reads the current subscribe/unsubscribe state only to keep the local subscription library synchronized.
- **Web history / browsing history: No.** Chanlume does not build or retain a history of websites visited or videos watched across browsing sessions. The watched-video filter inspects YouTube's visible progress markers only to decide what to hide on the current subscriptions page; it does not maintain its own watch-history database.
- **Personally identifiable information: No.** Chanlume does not intentionally collect names, addresses, email addresses, age, government identifiers, or similar PII.
- **Personal communications: No.**
- **Health information: No.**
- **Financial and payment information: No.**
- **Location information: No.**

In the current Chrome Web Store privacy form, the expected selected data types are therefore **Website content** and **Authentication information** only.

Data use certifications:

- Data is used only to provide Chanlume's disclosed single purpose and related user-facing functionality.
- Data is not sold.
- Data is not used or transferred for advertising, credit decisions, or unrelated purposes.
- Chanlume has no telemetry or developer-operated backend that receives the user's subscription library.
- Humans do not receive or read the user's locally stored Chanlume data.
- When the optional YouTube Data API feature is enabled, the only third-party transfer is directly to Google and is limited to the user-provided API key and public channel/video identifiers needed for that feature.

Privacy policy: `PRIVACY.md` contains collection, use, sharing, deletion, optional Google API transfer, and Limited Use disclosures.

## Reviewer test instructions

1. Install Chanlume and open `https://www.youtube.com/` while signed in to an account that has subscriptions.
2. Open the Chanlume toolbar popup and select **Update subscriptions**.
3. Chanlume opens YouTube's subscribed-channels page, scrolls it to load the user's subscriptions, saves the resulting public channel metadata locally, and closes the scan tab after completion.
4. Open **Manage groups**. Verify All channels, Unclassified, custom groups, manual membership changes, search/batch management, and local auto-organization.
5. Open YouTube's Subscriptions page. Verify group filters and the group labels shown with stored subscribed-channel videos.
6. Open a subscribed channel page or a video watch page. Verify the **Groups** control beside YouTube's Subscribe/Subscribed control and change the channel's local group membership.
7. Use the popup power button to pause Chanlume. Verify the YouTube-integrated Chanlume UI is disabled while groups and preferences remain stored, then re-enable Chanlume.
8. In Preferences, independently test Home blocking, Shorts blocking, recommendation-sidebar hiding, autoplay disabling, and watched-video filtering.
9. The YouTube Data API key field is optional. Core functionality and local classification work without a key.
10. No external Chanlume account or test credentials are required.

## Store assets

Required assets already present in the repository:

- Store icon: `extension/icons/icon-128.png`
- Screenshot: `outputs/store-assets/screenshot-library-1280x800.png`
- Screenshot: `outputs/store-assets/screenshot-settings-en-1280x800.png`
- Small promo tile: `outputs/store-assets/small-promo-440x280.png`

Recommended screenshot order:

1. Subscription library / group management
2. Groups and labels integrated into YouTube's Subscriptions page
3. The in-YouTube Groups control beside Subscribe
4. Local auto-organization suggestions/results
5. Preferences / distraction controls

The existing screenshots are enough for submission, but screenshots 2–4 would make the current in-YouTube experience clearer to store visitors.

## Pre-submit checklist

- [ ] Developer account registered and one-time registration fee paid
- [ ] Google account has 2-Step Verification enabled
- [ ] Upload ZIP contains the contents of `extension/` with `manifest.json` at ZIP root
- [ ] Upload ZIP contains only one `manifest.json`
- [ ] Version in `manifest.json` is higher than any previously uploaded package
- [ ] English store listing filled in
- [ ] Traditional Chinese localized listing filled in
- [ ] Category set to Workflow & Planning
- [ ] 128×128 icon uploaded / recognized
- [ ] At least one 1280×800 screenshot uploaded
- [ ] 440×280 small promo tile uploaded
- [ ] Privacy policy URL entered in the designated Privacy practices field
- [ ] Single-purpose text matches this file
- [ ] Permission justifications match the current manifest (`storage` only, plus declared host permissions)
- [ ] Data-use disclosures match `PRIVACY.md` and actual behavior
- [ ] Limited Use certifications completed
- [ ] Reviewer instructions supplied
- [ ] Distribution regions / visibility checked
- [ ] Final manual smoke test performed using the exact ZIP being submitted
