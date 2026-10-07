# Chanlume Privacy Policy / 隱私權政策

Last updated / 最後更新：2026-09-09

## 繁體中文

Chanlume 的單一用途是協助使用者在 YouTube 上整理、篩選與管理自己的訂閱內容。

### Chanlume 處理哪些資料

為了提供訂閱整理功能，Chanlume 會處理 YouTube 上公開可見的網站內容，包括訂閱頻道名稱、頻道網址與 ID、公開頭像、公開頻道簡介、近期影片標題、公開主題與影片類別，以及訂閱／取消訂閱狀態。Chanlume 也會處理使用者自行建立或選擇的群組、手動分類、偏好設定、介面語言與本機分類學習資料。

Chanlume 不會建立一般網頁瀏覽紀錄，也不會記錄使用者造訪過的其他網站、滑鼠位置、按鍵輸入、一般點擊歷史或其他與 Chanlume 核心功能無關的瀏覽活動。

### 本機儲存

「最關注頻道」名單也儲存在本機。開啟關注頁或更新影片時，Chanlume 會直接向 YouTube 取得所選頻道的公開頁面及影片 RSS／Atom 資料，並從 YouTube 圖片服務顯示影片縮圖。關閉 Shorts 時，會改用頻道的一般影片分頁。影片資料只做短期記憶體快取，不會建立觀看紀錄，也不需要 API Key。

上述 Chanlume 資料預設只儲存在使用者瀏覽器的 `chrome.storage.local`。Chanlume 不經營開發者伺服器，不傳送遙測或分析資料，不出售使用者資料，也不將資料用於廣告、信用評估、保險或其他與 Chanlume 單一用途無關的目的。

Chanlume 的開發者無法透過 Chanlume 讀取使用者儲存在本機的訂閱資料、群組、偏好設定或分類紀錄。

### 選用的 YouTube Data API Key

使用者可自行選擇提供 YouTube Data API Key。此 API Key 屬於使用者主動提供的驗證資訊（credential），僅用於呼叫 Google YouTube Data API，以取得 Chanlume 分類功能所需的公開頻道主題、標籤與影片類別。

啟用此功能時，Chanlume 會透過 HTTPS 將 API Key 與必要的公開 YouTube channel ID／video ID 直接傳送至 Google YouTube Data API。API Key 只儲存在使用者裝置的 `chrome.storage.local`，不會傳送給 Chanlume 開發者，不會用於其他目的，也不會包含在 Chanlume JSON 備份中。

Chanlume 的核心功能不需要 YouTube Data API Key。除了這項由使用者主動啟用、直接與 Google API 通訊的功能外，Chanlume 不會把使用者資料傳送至開發者所營運的伺服器或其他第三方服務。

### 資料用途

Chanlume 所處理的資料僅用於提供使用者要求的核心功能，包括：

- 掃描與顯示 YouTube 訂閱頻道；
- 建立、管理與套用頻道群組；
- 在 YouTube 介面中篩選與整理訂閱內容；
- 提供可由使用者確認後再套用的本機分類建議；
- 儲存 Chanlume 偏好設定與介面狀態；
- 在使用者啟用時，透過 YouTube Data API 取得額外的公開分類訊號。

Chanlume 不會將這些資料用於廣告、行銷、使用者追蹤、行為分析或與上述功能無關的用途。

### 備份與刪除

使用者可在偏好設定中手動匯出或匯入自己的 JSON 備份。匯出只由使用者主動觸發，備份檔案不會自動上傳給 Chanlume 開發者或其他服務。

使用者可使用「清除本機資料」刪除 Chanlume 儲存的頻道、群組、分類資料與設定，也可以解除安裝擴充套件以移除其本機擴充功能資料。

Chanlume 對從 Google API 收到之資訊的使用，將遵守 Chrome Web Store User Data Policy，包括 Limited Use requirements。

如對本政策有疑問，請透過 Chanlume 的 Chrome Web Store 支援頁面聯絡開發者。

## English

Chanlume has one purpose: helping users organize, filter, and manage their YouTube subscription content.

### Data Chanlume processes

To provide subscription organization features, Chanlume processes publicly visible website content on YouTube, including subscribed channel names, channel URLs and IDs, public avatars, public channel descriptions, recent video titles, public topics and video categories, and subscribe/unsubscribe state. Chanlume also processes groups, manual classifications, preferences, interface language, and locally learned classification data created or selected by the user.

Chanlume does not create a general browsing history and does not record websites visited outside its YouTube functionality, mouse position, keystrokes, general click history, or other browsing activity unrelated to Chanlume's core functionality.

### Local storage

The Favorites list is also stored locally. Opening Favorites or refreshing videos retrieves selected channels' public pages and RSS/Atom feeds directly from YouTube, and displays thumbnails from YouTube's image service. When Shorts are hidden, the normal Videos tab is used instead of RSS/Atom. Video data is cached briefly in memory; this feature does not create viewing history or require an API key.

Chanlume data is stored locally in the user's browser using `chrome.storage.local` by default. Chanlume operates no developer-controlled server, sends no telemetry or analytics, does not sell user data, and does not use user data for advertising, credit decisions, insurance, or other purposes unrelated to Chanlume's single purpose.

The Chanlume developer cannot use Chanlume to read subscription data, groups, preferences, or classification history stored locally in a user's browser.

### Optional YouTube Data API key

Users may optionally provide their own YouTube Data API key. This API key is authentication information (a credential) voluntarily provided by the user and is used only to call the Google YouTube Data API for public channel topics, tags, and video categories used by Chanlume's classification features.

When this feature is enabled, Chanlume sends the API key together with the necessary public YouTube channel IDs and video IDs directly to the Google YouTube Data API over HTTPS. The API key is stored only on the user's device in `chrome.storage.local`, is not sent to the Chanlume developer, is not used for unrelated purposes, and is excluded from Chanlume JSON backups.

Chanlume's core functionality does not require a YouTube Data API key. Except for this user-enabled direct communication with the Google API, Chanlume does not transfer user data to developer-operated servers or other third-party services.

### How data is used

Chanlume processes data only to provide the core functionality requested by the user, including:

- scanning and displaying YouTube subscriptions;
- creating, managing, and applying channel groups;
- filtering and organizing subscription content within YouTube;
- providing local classification suggestions that the user can review before applying;
- storing Chanlume preferences and interface state; and
- when enabled by the user, retrieving additional public classification signals from the YouTube Data API.

Chanlume does not use this data for advertising, marketing, user tracking, behavioral analytics, or purposes unrelated to these features.

### Backup and deletion

Users may manually export or import their own JSON backup in Preferences. Exports are initiated only by the user and are not automatically uploaded to the Chanlume developer or another service.

Users can delete Chanlume's stored channels, groups, classification data, and settings with Clear local data, or remove local extension data by uninstalling the extension.

Chanlume's use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

For questions about this policy, contact the developer through Chanlume's Chrome Web Store support page.
