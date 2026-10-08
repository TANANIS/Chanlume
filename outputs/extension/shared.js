(function (root, factory) {
  const api = factory();
  root.ChanlumeCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 15;
  const LANGUAGES = ["zh-TW", "en"];
  // Read-only compatibility for installations predating the Chanlume rename.
  const LEGACY_STORAGE_KEYS = {
    chanlumeState: "tubeShelfState",
    chanlumeYouTubeApiKey: "tubeShelfYouTubeApiKey",
    chanlumeScanStatus: "tubeShelfScanStatus"
  };
  async function readStoredValues(storage, keys) {
    const requested = Array.isArray(keys) ? keys : [keys];
    const values = await storage.get([...requested, ...requested.map((key) => LEGACY_STORAGE_KEYS[key]).filter(Boolean)]);
    for (const key of requested) {
      if (values[key] === undefined && values[LEGACY_STORAGE_KEYS[key]] !== undefined) values[key] = values[LEGACY_STORAGE_KEYS[key]];
    }
    return values;
  }

  function canonicalHash(hash) {
    return String(hash).replace(/([#&])tubeshelf-(group|view|update-subscriptions)(?==|&|$)/g, "$1chanlume-$2");
  }
  const UI_TEXT_EN = {
    "點擊頻道可在 YouTube 開啟；使用詳細資料調整分類。": "Open a channel on YouTube; use Details to edit its groups.",
    "在 YouTube 開啟": "Open on YouTube", "詳細資料": "Details",
    "最關注頻道": "Favorites", "挑選你最想關注的頻道，集中查看最新影片。": "Choose the channels you care about and catch up on their latest videos.",
    "新增頻道": "Add channels", "管理關注頻道": "Manage favorites", "更新影片": "Refresh videos", "最新影片": "Latest videos",
    "搜尋群組": "Find group", "向左捲動群組": "Scroll groups left", "向右捲動群組": "Scroll groups right",
    "連線失敗或逾時，請稍後重試。": "Connection failed or timed out. Please retry shortly.",
    "YouTube 暫時拒絕讀取，請稍後重試。": "YouTube temporarily refused the request. Please retry shortly.",
    "無法辨識頻道影片資料，請重試或更新 Chanlume。": "Channel video data could not be recognized. Retry or update Chanlume.",
    "已關注": "Following", "取消關注": "Unfollow", "關注頻道": "Follow", "＋ 關注": "+ Follow", "依群組篩選": "Filter by group",
    "搜尋或選擇群組，按一下即可加入或取消關注。": "Search or choose a group, then click to follow or unfollow.",
    "科普知識": "Science", "故事": "Stories", "露營與生存": "Camping and survival", "遊戲開發": "Game development",
    "選擇起始群組": "Choose starter groups", "只新增你勾選的群組，保留目前所有分類。": "Add only the groups you select. Your current groups and memberships are preserved.",
    "新增所選群組": "Add selected groups", "請先勾選群組": "Select a group first", "群組已新增": "Groups added",
    "逐一確認頻道建議；僅高信心預先勾選。同一頻道可選多個群組。": "Review each channel. Only high-confidence suggestions are preselected. You can choose multiple groups for a channel.",
    "只有按下「套用建議」才會儲存已勾選的頻道分類。": "Selected channel assignments are saved only after you click Apply suggestions.",
    "每個頻道只出現一次。選擇要加入的群組，或保留待分類。": "Each channel appears once. Choose a destination group or leave it unclassified.",
    "保留待分類": "Leave unclassified", "採用": "Use suggestion", "加入群組": "Assign to", "套用選擇": "Apply selections",
    "查看原因": "Why this suggestion", "同時加入其他群組": "Also add to other groups",
    "先為每個待分類頻道選擇群組，或保留待分類；按下「套用選擇」才會儲存。": "Choose a group for each unclassified channel, or leave it unclassified. Changes are saved only after you click Apply selections.",
    "自動分類會直接整理所有待分類頻道；資訊不足的放入「其他」，之後都能編輯。": "Automatically sort all unclassified channels. Channels without enough information go into Other. You can edit any assignment later.",
    "自動分類失敗，請重試。": "Automatic classification failed. Please retry.",
    "正在儲存分類…": "Saving classifications…", "重試自動分類": "Retry automatic classification",
    "從已收集頻道中挑選": "Choose from your collected channels", "儲存變更": "Save changes", "取消編輯": "Cancel editing",
    "勾選頻道後按儲存；取消不會修改群組。": "Select channels, then save. Cancel leaves the group unchanged.",
    "點擊頻道可查看詳細資料與分類。": "Open a channel to view its details and groups.",
    "尚未加入關注頻道": "No favorite channels yet", "先更新訂閱內容，再回來挑選頻道。": "Update your subscriptions, then come back to choose channels.",
    "讀取最新影片中…": "Loading latest videos…", "目前沒有公開影片": "No public videos available", "影片讀取失敗，請重試。": "Could not load videos. Please retry.",
    "重試": "Retry", "移除關注": "Remove favorite", "已儲存變更": "Changes saved", "儲存失敗，請重試。": "Could not save changes. Please retry.",
    "尚未更新": "Not updated yet", "上次更新": "Last updated", "新增或移除頻道，儲存後套用。": "Add or remove channels, then save to apply.",
    "你的訂閱，照你的方式排好": "Your subscriptions, organized your way",
    "管理群組": "Manage groups", "管理 Chanlume 群組": "Manage Chanlume groups",
    "開啟 Chanlume": "Open Chanlume", "開啟 Chanlume 訂閱整理": "Open Chanlume subscription organizer",
    "開啟 Chanlume 群組與設定": "Open Chanlume groups and settings", "已整理": "Organized",
    "個頻道": "channels", "個已找到頻道": "channels found", "YouTube 內容來源": "YouTube content source",
    "首頁推薦": "Home recommendations", "YouTube 演算法": "YouTube algorithm", "訂閱內容": "Subscriptions",
    "Chanlume 群組": "Chanlume groups", "快速開啟": "Quick access", "＋ 新增群組": "+ New group",
    "支持 Chanlume｜請我喝杯咖啡 ↗": "Support Chanlume · Buy me a coffee ↗",
    "支持與回饋 ↗": "Support & feedback ↗",
    "關閉 Chanlume，恢復原本 YouTube": "Turn off Chanlume and restore YouTube",
    "啟用 Chanlume": "Turn on Chanlume",
    "Chanlume 已關閉": "Chanlume is off",
    "正在使用原本 YouTube，群組與設定已保留": "Original YouTube is active. Your groups and settings are saved.",
    "電源切換失敗，請再試一次": "Could not change power state. Please try again.",
    "回報問題・許願功能": "Report an issue · Suggest a feature",
    "有問題想回報，或有功能想許願？": "Found an issue or have a feature wish?",
    "用一杯咖啡支持開發，也把你的想法留給我。": "Support development with a coffee and share your ideas with me.",
    "正在確認 YouTube 頁面…": "Checking the YouTube page…", "請稍候": "Please wait",
    "更新訂閱內容": "Update subscriptions", "更新中…": "Updating…", "準備中…": "Starting…",
    "請重新載入擴充套件": "Reload the extension", "YouTube 群組": "YouTube group",
    "還沒有群組，先建立第一個書架吧。": "No groups yet. Create your first shelf.",
    "首頁已封鎖": "Home is blocked", "目前是首頁推薦": "YouTube Home", "目前是訂閱內容": "Subscriptions page",
    "目前是 YouTube 其他頁面": "Another YouTube page", "目前不是 YouTube 分頁": "Not a YouTube tab",
    "將自動前往訂閱內容": "You will be redirected to subscriptions", "首頁保留 YouTube 演算法": "Home uses YouTube's algorithm",
    "可以使用群組與畫面整理": "Groups and display filters are available", "前往訂閱內容即可使用群組": "Open subscriptions to use groups",
    "Chanlume 管理中心": "Chanlume Manager", "本機訂閱整理": "Local subscription organizer", "我的書架": "My shelf",
    "偏好設定": "Preferences", "只存在這台裝置": "Stored only on this device",
    "不會上傳你的訂閱與群組": "Your subscriptions and groups are never uploaded", "訂閱書架": "Subscription shelf",
    "把頻道放進不同群組，回到 YouTube 就能一鍵篩選。": "Put channels into groups, then filter them on YouTube with one click.",
    "✦ 自動整理群組（本機）": "✦ Auto-organize groups (local)", "已收集頻道": "Collected channels",
    "掃描 YouTube 頁面後會出現在這裡": "Channels appear here after an update", "自訂群組": "Custom groups",
    "同一頻道可放進多個群組": "A channel can belong to multiple groups", "整理進度": "Organization progress",
    "尚無待分類頻道": "No unclassified channels", "群組": "Group", "選擇一個書架": "Choose a shelf",
    "新增群組": "New group", "全部頻道": "All channels", "管理已收集的訂閱頻道": "Manage collected subscription channels",
    "編輯群組": "Edit group", "管理成員": "Manage members", "完成管理": "Done managing",
    "更新頻道資料": "Refresh channel data", "更新此群組資料": "Refresh this group", "更新未分類資料": "Refresh unclassified",
    "更新全部頻道資料": "Refresh all channels", "搜尋這個群組": "Search this group", "搜尋全部頻道": "Search all channels",
    "個頻道已加入": "channels added", "加入目前結果": "Add current results", "移出目前結果": "Remove current results",
    "減少 YouTube 干擾": "Reduce YouTube distractions",
    "以下設定套用到所有 YouTube 頁面，與訂閱群組分類互相獨立。": "These settings apply to all YouTube pages and are independent of subscription groups.",
    "封鎖首頁推薦": "Block Home recommendations", "進入首頁時跳到訂閱內容，並隱藏所有首頁入口。": "Redirect Home to subscriptions and hide every Home entry point.",
    "關閉 Shorts": "Block Shorts", "封鎖 Shorts 頁面，並隱藏左側入口與短影音內容。": "Block Shorts pages and hide navigation links and Shorts content.",
    "隱藏影片右側欄": "Hide the video sidebar", "點開影片後隱藏右側推薦內容（#secondary），並放大主要內容空間。": "Hide recommendations beside videos (#secondary) and expand the main content.",
    "隱藏觀看頁的推薦內容，並預設關閉自動播放": "Hide watch-page recommendations and turn autoplay off by default",
    "關閉自動播放": "Disable autoplay", "隱藏影片右側欄時會預設一併開啟，之後仍可單獨調整。": "Enabled by default when the video sidebar is hidden; you can change it separately.",
    "訂閱內容畫面整理": "Subscription display filters", "只套用在 YouTube 訂閱內容，不會拿來分類首頁推薦。": "Applied only to YouTube subscriptions, never to Home recommendations.",
    "隱藏已觀看影片": "Hide watched videos", "支援 YouTube 新舊版縮圖觀看進度標記。": "Supports both current and legacy YouTube watch-progress markers.",
    "YouTube 官方分類（選用）": "Official YouTube categories (optional)",
    "填入自己的 YouTube Data API Key 後，自動整理會讀取公開頻道主題與近期影片類別。Key 只存在本機，不會放進 JSON 備份。": "Add your YouTube Data API key to include public channel topics and recent video categories. The key stays local and is excluded from JSON backups.",
    "尚未設定，仍會使用完整的本機字典。": "Not configured; the full local dictionary is still used.", "貼上 API Key": "Paste API key",
    "儲存 Key": "Save key", "清除": "Clear", "備份與搬移": "Backup and transfer",
    "匯出檔包含群組與頻道網址，不含觀看紀錄。": "Exports include groups and channel URLs, but not watch history.",
    "匯出 JSON": "Export JSON", "匯入 JSON": "Import JSON", "重新開始": "Start over",
    "清除 Chanlume 儲存的頻道與群組，不會取消 YouTube 訂閱。": "Clear Chanlume channels and groups without unsubscribing on YouTube.",
    "清除本機資料": "Clear local data", "介面語言": "Interface language",
    "選擇 Chanlume 的顯示語言。群組與頻道名稱不會被改寫。": "Choose Chanlume's display language. Group and channel names are not changed.",
    "群組名稱": "Group name", "例如：遊戲精華": "For example: Gaming highlights", "圖示": "Icon", "顏色": "Color",
    "刪除群組": "Delete group", "取消": "Cancel", "儲存群組": "Save group", "關閉": "Close",
    "自動整理群組": "Auto-organize groups", "只分析尚未分類的頻道": "Analyze only unclassified channels",
    "Chanlume 會讀取公開頻道簡介與近期影片，透過細分類字典、重複主題與你之後的手動修正產生建議；若已設定 YouTube API Key，也會加入官方分類。既有群組不會被覆寫。": "Chanlume uses public channel descriptions, recent videos, a detailed local taxonomy, repeated topics, and your later corrections. If an API key is configured, official YouTube categories are included. Existing groups are never overwritten.",
    "不使用雲端 AI": "No cloud AI", "低信心也列入建議": "Low-confidence results included", "確認後才套用": "Applied only after confirmation",
    "正在準備本機分析": "Preparing local analysis", "檢查已儲存的頻道資料…": "Checking saved channel data…",
    "個頻道有分類建議": "channels have suggestions", "取消勾選不想建立的群組。只有按下「套用建議」才會修改群組。": "Uncheck groups you do not want. Groups change only after you select Apply suggestions.",
    "開始本機分析": "Start local analysis", "套用建議": "Apply suggestions", "頻道詳細資料": "Channel details",
    "目前所屬群組": "Current groups", "分類判斷": "Classification", "頻道簡介": "Channel description",
    "近期影片標題": "Recent video titles", "在 YouTube 開啟 ↗": "Open on YouTube ↗", "更新資料": "Refresh data",
    "新手教學": "Getting started", "跳過教學": "Skip tutorial", "上一步": "Back", "下一步": "Next",
    "全部訂閱": "All subscriptions", "未分類": "Unclassified", "目前已收集": "Collected", "等待整理": "Needs organizing", "已分類": "Organized",
    "減少干擾": "Reduce distractions", "封鎖首頁": "Block Home",
    "首頁推薦目前已封鎖，將直接前往訂閱內容。": "Home recommendations are blocked; opening Home redirects to subscriptions.",
    "首頁由 YouTube 演算法決定，不套用訂閱群組。": "YouTube's algorithm controls Home; subscription groups do not apply there.",
    "只有訂閱內容會套用群組與已觀看影片篩選。": "Groups and watched-video filters apply only to subscriptions.",
    "這個頁面不套用訂閱群組；減少干擾設定仍然有效。": "Subscription groups do not apply here; distraction settings still do.",
    "顯示全部訂閱": "Showing all subscriptions", "只顯示未分類頻道": "Showing unclassified channels only",
    "已隱藏影片右側欄，並關閉自動播放": "Video sidebar hidden and autoplay disabled",
    "即將更新全部訂閱內容…": "Starting a full subscription update…", "無法啟動訂閱更新": "Could not start the subscription update",
    "無法更新訂閱內容，請重新載入擴充套件": "Could not update subscriptions. Reload the extension.",
    "訂閱內容已更新": "Subscriptions updated", "正在更新訂閱內容": "Updating subscriptions",
    "這個分頁即將自動關閉。": "This tab will close automatically.",
    "Chanlume 正在自動向下載入所有訂閱頻道，請暫時不要關閉這個分頁。": "Chanlume is loading every subscribed channel. Please keep this tab open for now.",
    "更新未完成": "Update incomplete", "請確認 YouTube 的所有訂閱頻道頁能正常顯示，再重新執行。": "Make sure YouTube's subscribed-channels page loads correctly, then try again.",
    "本次找到的頻道比現有書架少太多，已保留原資料以避免分類遺失。請確認清單完整，或手動確認使用本次結果。": "This scan found far fewer channels than the current shelf. Existing data was preserved to prevent classification loss. Check that the list is complete or manually confirm this result.",
    "仍以本次清單更新": "Use this scan anyway",
    "你的 YouTube 訂閱書架": "Your YouTube subscription shelf", "訂閱群組": "Subscription groups",
    "控制 YouTube 頁面上的顯示方式與本機資料。": "Control YouTube display options and local data.",
    "所有已收集頻道": "All collected channels", "等待手動或自動整理": "Waiting for manual or automatic organization",
    "查看全部頻道並用開關加入或移出；也可以一次處理目前搜尋結果": "View all channels and use switches to add or remove them, or update all current search results at once.",
    "等待手動加入群組，或使用本機自動整理": "Waiting for a group or local auto-organization",
    "只顯示這個群組的頻道；點擊頻道可調整分類": "Showing this group's channels; select a channel to adjust its groups.",
    "查看所有已從 YouTube 收集的頻道": "View every channel collected from YouTube",
    "找不到符合的頻道": "No matching channels", "這裡目前沒有頻道": "There are no channels here yet", "書架還是空的": "Your shelf is empty",
    "換個關鍵字再試一次。": "Try another search term.",
    "可從頻道詳細資料調整群組，或執行本機自動整理。": "Adjust groups in channel details or run local auto-organization.",
    "按「更新訂閱內容」，Chanlume 就會自動載入全部 YouTube 訂閱頻道。": "Select Update subscriptions and Chanlume will load every subscribed YouTube channel.",
    "尚未分類": "Unclassified", "待": "Pending", "尚未建立群組": "No groups created yet",
    "高信心": "High confidence", "中等信心": "Medium confidence", "低信心": "Low confidence", "建議": "Suggestion",
    "目前沒有明確建議": "No clear suggestion", "沒有足夠且唯一的主題訊號": "Not enough distinct topic signals",
    "尚未取得頻道簡介；執行自動整理後會補齊公開資料。": "No channel description yet; auto-organization will fetch public data.",
    "尚未取得近期影片標題": "No recent video titles yet", "正在取得頻道分類線索": "Collecting channel classification signals",
    "正在本機產生分類建議": "Generating local suggestions", "所有文字只在這台裝置上分析。": "All text is analyzed only on this device.",
    "所有待分類頻道都有分類建議": "Every unclassified channel has a suggestion",
    "高信心": "High confidence", "中信心": "Medium confidence", "低信心建議": "Low-confidence suggestions",
    "本機字典": "Local dictionary", "YouTube 官方訊號": "Official YouTube signals", "個人詞彙": "Personal vocabulary",
    "目前沒有足夠明確的分類建議": "No sufficiently clear suggestions", "既有群組不會受到影響；資訊不足的頻道會繼續留在待分類。": "Existing groups are unchanged; channels with insufficient information remain unclassified.",
    "請先更新訂閱內容": "Update subscriptions first", "目前沒有尚未分類的頻道": "There are no unclassified channels",
    "預覽模式無法啟動掃描": "Preview mode cannot start an update", "訂閱內容正在更新": "Subscriptions are being updated",
    "正在更新全部訂閱內容": "Updating all subscriptions", "設定已儲存": "Settings saved",
    "請至少選擇一個分類建議": "Select at least one suggestion", "請輸入有效的 YouTube Data API Key": "Enter a valid YouTube Data API key",
    "API Key 已儲存在本機，且不會匯出到備份": "API key saved locally and excluded from backups", "YouTube API Key 已清除": "YouTube API key cleared",
    "備份已匯出": "Backup exported", "備份已匯入": "Backup imported", "這不是有效的 Chanlume 備份": "This is not a valid Chanlume backup",
    "本機資料已清除": "Local data cleared", "已跳過新手教學，可直接開始使用": "Tutorial skipped; Chanlume is ready to use",
    "訂閱內容更新未完成，請再試一次": "Subscription update incomplete. Try again.",
    "歡迎使用 Chanlume": "Welcome to Chanlume", "開始教學": "Start tutorial",
    "這份教學會陪你完成第一次更新、第一次本機自動整理，以及日後手動管理群組的方法。所有資料只留在這台裝置。": "This tutorial covers your first subscription update, first local auto-organization, and manual group management. All data stays on this device.",
    "先建立你的訂閱書架": "Build your subscription shelf first",
    "按下「更新訂閱內容」後，Chanlume 會開啟 YouTube 的所有訂閱頁並自動載入完整清單。完成後這個頁面會立即顯示頻道。": "Update subscriptions opens YouTube's subscribed-channels page and loads the full list automatically. Channels appear here as soon as it finishes.",
    "第一次自動整理": "Your first auto-organization", "開啟自動整理": "Open auto-organizer",
    "自動整理只分析未分類頻道，先提出可勾選的建議；直到你按下「套用建議」才會修改群組。": "Auto-organization analyzes only unclassified channels and presents selectable suggestions. Groups change only after you apply them.",
    "檢查並手動調整": "Review and adjust manually",
    "選擇左側群組即可查看真正成員。點頻道卡片可看詳細資料；使用「管理成員」可批次加入或移出，也能用「新增群組」建立自己的分類。": "Choose a group on the left to see its members. Open a channel card for details, use Manage members for bulk changes, or create your own group.",
    "依喜好整理 YouTube": "Tune YouTube to your preferences",
    "偏好設定可以封鎖首頁、關閉 Shorts、隱藏影片右欄、關閉自動播放與隱藏已觀看影片；下方也能匯出或匯入備份。": "Preferences can block Home and Shorts, hide the video sidebar, disable autoplay, and hide watched videos. You can also export or import backups.",
    "準備完成": "You're ready", "完成": "Finish",
    "回到 YouTube 訂閱內容後，可從左側 Chanlume 群組或頁面上方快速切換。齒輪會直接開啟完整面板。": "On YouTube subscriptions, switch groups from the left sidebar or top toolbar. The gear opens the full panel.",
    "更新正在另一個 YouTube 分頁進行；完成後書架會自動更新並帶你到下一步。": "The update is running in another YouTube tab. This shelf will refresh and continue automatically when it finishes.",
    "等待更新完成…": "Waiting for update…", "新手教學已完成": "Tutorial completed", "介面語言已切換為繁體中文": "Interface language changed to Traditional Chinese",
    "繁體中文": "Traditional Chinese", "學習": "Learning", "放鬆": "Relaxation", "全部": "All",
    "遊戲": "Gaming", "音樂": "Music", "科技": "Technology", "新聞與時事": "News and current affairs",
    "投資與財經": "Finance and investing", "藝術與動畫": "Art and animation", "娛樂與影劇": "Entertainment and screen",
    "美食": "Food", "運動": "Sports", "汽機車": "Vehicles", "動物與寵物": "Animals and pets", "生活": "Lifestyle",
    "更改這個頻道的分類": "Change this channel's groups", "分類": "Groups", "選擇所屬群組": "Choose groups",
    "收合 Chanlume 群組": "Collapse Chanlume groups", "展開 Chanlume 群組": "Expand Chanlume groups",
    "目前在未分類": "Currently unclassified", "訂閱後即可分類": "Subscribe to organize this channel",
    "管理全部群組 ↗": "Manage all groups ↗", "請先訂閱這個頻道，再加入群組": "Subscribe to this channel before adding it to a group",
    "已加入未分類，稍後可以選擇群組": "Added to Unclassified; you can choose a group anytime",
    "已取消訂閱並從 Chanlume 移除": "Unsubscribed and removed from Chanlume",
    "合併群組": "Merge group", "合併到其他群組": "Merge into another group",
    "將這個群組的頻道搬到目標群組，完成後刪除目前群組。": "Move this group's channels into the target group, then delete the current group.",
    "選擇目標群組": "Choose a destination group", "合併到…": "Merge into…",
    "至少要有另一個群組才能合併。": "Create another group before merging.",
    "群組已合併": "Groups merged", "群組已更新": "Group updated", "群組已建立": "Group created",
    "群組已刪除；頻道資料仍保留": "Group deleted; channel data was kept",
    "目前沒有頻道可更新": "There are no channels to refresh",
    "目前結果都已在群組中": "All current results are already in this group",
    "目前結果都不在群組中": "None of the current results are in this group",
    "設定已儲存": "Settings saved", "暫時無法更新這個頻道": "Could not refresh this channel right now",
    "要清除 Chanlume 的本機群組與已收集頻道嗎？這不會取消 YouTube 訂閱。": "Clear Chanlume's local groups and collected channels? Your YouTube subscriptions will not change.",
    "已更新資料，但頻道沒有可讀取的近期影片": "Data refreshed, but no recent video titles were available",
    "正在讀取 YouTube 官方分類…": "Loading official YouTube categories…",
    "正在讀取 YouTube 官方頻道主題": "Loading official YouTube channel topics",
    "正在統計近期影片官方類別": "Analyzing official categories from recent videos",
    "只傳送公開的頻道與影片 ID。": "Only public channel and video IDs are sent.",
    "停止更新": "Stop refresh", "官方分類讀取失敗": "Could not load official categories",
    "Language changed to English": "Language changed to English"
  };
  const UI_TEXT_ZH = Object.fromEntries(Object.entries(UI_TEXT_EN).map(([zh, en]) => [en, zh]));

  function detectDefaultLanguage(value) {
    let locale = value;
    if (locale === undefined || locale === null || locale === "") {
      try { locale = globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || ""; }
      catch (_error) { locale = ""; }
    }
    return /^zh(?:-|_|$)/i.test(String(locale).trim()) ? "zh-TW" : "en";
  }

  function languageCode(value) {
    if (value === undefined || value === null || String(value).trim() === "") return detectDefaultLanguage();
    if (/^zh(?:-|_|$)/i.test(String(value || "").trim())) return "zh-TW";
    return "en";
  }

  function translateUiText(value, language) {
    const text = String(value ?? "");
    const target = languageCode(language);
    const exact = target === "en" ? UI_TEXT_EN : UI_TEXT_ZH;
    if (exact[text] !== undefined) return exact[text];
    if (target === "en") {
      const patterns = [
        [/^(\d+) 個頻道尚未分類$/, "$1 channels unclassified"], [/^(\d+) 個頻道$/, "$1 channels"],
        [/^加入目前結果（(\d+)）$/, "Add current results ($1)"], [/^移出目前結果（(\d+)）$/, "Remove current results ($1)"],
        [/^管理「(.+)」成員$/, "Manage “$1” members"], [/^只顯示「(.+)」$/, "Showing “$1” only"],
        [/^在 YouTube 開啟 (.+)$/, "Open $1 on YouTube"], [/^檢視頻道 (.+)$/, "View channel $1"],
        [/^(.+) 加入 (.+)$/, "Add $1 to $2"], [/^已儲存：(.+)$/, "Saved: $1"],
        [/^已在本機設定（末四碼 (.+)）；更新資料或自動整理時會加入官方分類。$/, "Saved locally (ending in $1); official categories will be included when refreshing or auto-organizing."],
        [/^依據：(.+)$/, "Based on: $1"],
        [/^(\d+) 個頻道因資訊不足或分類衝突而保留待分類$/, "$1 channels remain unclassified due to insufficient or conflicting signals"],
        [/^目前書架已有 (\d+) 個頻道，可以直接前往下一步。$/, "Your shelf already has $1 channels, so you can continue."],
        [/^(\d+) 個頻道尚未分類；自動整理完成後仍可逐一修正。$/, "$1 channels are unclassified; you can adjust them after auto-organization."],
        [/^訂閱書架已更新，共 (\d+) 個頻道$/, "Subscription shelf updated: $1 channels"],
        [/^已整理 (\d+) 個頻道$/, "Organized $1 channels"],
        [/^已取得 (\d+) 部近期影片$/, "Loaded $1 recent videos"],
        [/^已加入 (\d+) 個頻道$/, "Added $1 channels"], [/^已移出 (\d+) 個頻道$/, "Removed $1 channels"],
        [/^已加入「(.+)」，並記住這次修正$/, "Added to “$1” and learned from this correction"], [/^已加入「(.+)」$/, "Added to “$1”"], [/^已移出「(.+)」$/, "Removed from “$1”"],
        [/^高 (\d+)・中 (\d+)$/, "High $1 · Medium $2"],
        [/^停止更新 (\d+) \/ (\d+)$/, "Stop refresh $1 / $2"],
        [/^已停止；保留 (\d+) 個更新結果$/, "Stopped; kept $1 refreshed results"],
        [/^更新完成：(\d+) 個取得影片標題，(\d+) 個讀取失敗$/, "Refresh complete: $1 with recent titles, $2 failed"],
        [/^更新完成：(\d+) 個取得影片標題$/, "Refresh complete: $1 with recent titles"],
        [/^本機資料已更新；官方分類失敗：(.+)$/, "Local data refreshed; official categories failed: $1"],
        [/^本機資料已更新；(.+)$/, "Local data refreshed; $1"],
        [/^已用本機資料完成；YouTube 官方分類失敗：(.+)$/, "Completed with local data; official YouTube categories failed: $1"],
        [/^(\d+) 個頻道暫時無法讀取，已用現有資料分析$/, "$1 channels could not be read; existing data was analyzed"],
        [/^(\d+) \/ (\d+)\s+只傳送公開的頻道與影片 ID。$/, "$1 / $2  Only public channel and video IDs are sent."],
        [/^要更新 (\d+) 個頻道的公開資料嗎？可以隨時按「停止更新」。$/, "Refresh public data for $1 channels? You can select Stop refresh at any time."],
        [/^要把 (\d+) 個頻道加入「(.+)」嗎？$/, "Add $1 channels to “$2”?"],
        [/^要把 (\d+) 個頻道移出「(.+)」嗎？$/, "Remove $1 channels from “$2”?"],
        [/^要刪除「(.+)」嗎？其中 (\d+) 個頻道只會回到未分類，不會取消訂閱。$/, "Delete “$1”? Its $2 channels will return to Unclassified; YouTube subscriptions will not change."],
        [/^要將「(.+)」的 (\d+) 個頻道合併到「(.+)」嗎？來源群組會被刪除。$/, "Merge $2 channels from “$1” into “$3”? The source group will be deleted."],
        [/^本次只找到 (\d+) 個頻道。仍要以這份清單取代目前書架嗎？被移除頻道的分類資料也會刪除。$/, "This scan found only $1 channels. Replace the current shelf anyway? Classification data for removed channels will also be deleted."]
      ];
      for (const [pattern, replacement] of patterns) if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return text;
  }

  function localizeDom(root, language) {
    if (!root) return;
    const translateNode = (node) => {
      if (node.parentElement?.closest('[translate="no"]')) return;
      const match = String(node.nodeValue || "").match(/^(\s*)(.*?)(\s*)$/s);
      if (match?.[2]) node.nodeValue = `${match[1]}${translateUiText(match[2], language)}${match[3]}`;
    };
    if (root.nodeType === 3) translateNode(root);
    const documentRef = root.ownerDocument || root;
    const walker = documentRef.createTreeWalker(root, 4);
    let node;
    while ((node = walker.nextNode())) translateNode(node);
    const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
    for (const element of elements) for (const attribute of ["title", "aria-label", "placeholder"]) {
      if (element.hasAttribute?.(attribute)) element.setAttribute(attribute, translateUiText(element.getAttribute(attribute), language));
    }
  }
  const DEFAULT_GROUPS = [
    { id: "learning", name: "學習", icon: "book", color: "#7c5cff", channelIds: [] },
    { id: "relax", name: "放鬆", icon: "sparkles", color: "#ff6b8a", channelIds: [] }
  ];

  const ICONS = {
    book: "M5 4.8A2.8 2.8 0 0 1 7.8 2H11v15H7.8A2.8 2.8 0 0 0 5 19.8V4.8Zm14 0A2.8 2.8 0 0 0 16.2 2H13v15h3.2a2.8 2.8 0 0 1 2.8 2.8V4.8Z",
    sparkles: "m12 2 1.1 3.4a5.5 5.5 0 0 0 3.5 3.5L20 10l-3.4 1.1a5.5 5.5 0 0 0-3.5 3.5L12 18l-1.1-3.4a5.5 5.5 0 0 0-3.5-3.5L4 10l3.4-1.1a5.5 5.5 0 0 0 3.5-3.5L12 2Zm7 14 .6 1.7a2.8 2.8 0 0 0 1.7 1.7l1.7.6-1.7.6a2.8 2.8 0 0 0-1.7 1.7L19 24l-.6-1.7a2.8 2.8 0 0 0-1.7-1.7L15 20l1.7-.6a2.8 2.8 0 0 0 1.7-1.7L19 16Z",
    game: "M8 7h8a6 6 0 0 1 5.7 7.9l-1.1 3.4a2.4 2.4 0 0 1-4.1.8L14.8 17H9.2l-1.7 2.1a2.4 2.4 0 0 1-4.1-.8l-1.1-3.4A6 6 0 0 1 8 7Zm0 3v2H6v2h2v2h2v-2h2v-2h-2v-2H8Zm8.5 2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm2.5 3a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 19 15Z",
    music: "M18 3v13.1A4 4 0 1 1 16 13V7l-7 2v9.1A4 4 0 1 1 7 15V6l11-3Z",
    code: "m9 6-6 6 6 6 1.5-1.5L6 12l4.5-4.5L9 6Zm6 0-1.5 1.5L18 12l-4.5 4.5L15 18l6-6-6-6Z",
    star: "m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z"
  };

  const AUTO_GROUPS = [
    { id: "game-development", name: "遊戲開發", icon: "code", color: "#369e98" },
    { id: "science", name: "科普知識", icon: "book", color: "#639cde" },
    { id: "stories", name: "故事", icon: "book", color: "#ba8c62" },
    { id: "outdoors", name: "露營與生存", icon: "star", color: "#619f68" },
    { id: "vtuber", name: "VTuber", icon: "sparkles", color: "#ba7ee0" },
    { id: "games", name: "遊戲", icon: "game", color: "#2dbd9b", keywords: ["遊戲", "實況", "攻略", "電競", "手遊", "主機", "game", "gaming", "gameplay", "gamer", "esports", "steam", "nintendo", "playstation", "xbox", "minecraft", "godot", "unity", "osu", "gta", "pokemon"] },
    { id: "music", name: "音樂", icon: "music", color: "#ff6b8a", keywords: ["音樂", "歌曲", "歌手", "翻唱", "演奏", "鋼琴", "吉他", "樂團", "作曲", "music", "song", "singer", "cover", "concert", "piano", "guitar", "jazz", "lofi", "lyrics", "official audio", "official mv"] },
    { id: "technology", name: "科技", icon: "code", color: "#4a91ff", keywords: ["科技", "程式", "軟體", "硬體", "電腦", "開發者", "人工智慧", "手機", "評測", "tech", "technology", "programming", "coding", "developer", "software", "hardware", "computer", "windows", "linux", "javascript", "python", "android", "iphone", "chatgpt", "ai"] },
    { id: "learning", name: "學習", icon: "book", color: "#7c5cff", keywords: ["學習", "知識", "科普", "教學", "歷史", "數學", "物理", "化學", "語言", "心理", "哲學", "法律", "science", "education", "educational", "tutorial", "history", "math", "physics", "chemistry", "documentary", "explained", "lecture", "course"] },
    { id: "news", name: "新聞與時事", icon: "star", color: "#f0a44b", keywords: ["新聞", "時事", "政治", "國際", "報導", "評論", "媒體", "news", "politics", "current affairs", "reporter", "journalism", "breaking news", "world news"] },
    { id: "finance", name: "投資與財經", icon: "star", color: "#e5ad45", keywords: ["投資", "股票", "理財", "財經", "經濟", "商業", "加密貨幣", "比特幣", "finance", "investment", "investing", "stock", "economy", "business", "crypto", "bitcoin", "trading", "market"] },
    { id: "art", name: "藝術與動畫", icon: "sparkles", color: "#bc6fe8", keywords: ["藝術", "繪畫", "插畫", "動畫", "設計", "攝影", "漫畫", "剪輯", "art", "artist", "drawing", "illustration", "animation", "anime", "design", "photography", "filmmaking", "creative"] },
    { id: "entertainment", name: "娛樂與影劇", icon: "sparkles", color: "#e56fa8", keywords: ["娛樂", "搞笑", "喜劇", "電影", "戲劇", "影劇", "訪談", "脫口秀", "虛擬實況主", "娛樂新聞", "comedy", "movie", "film", "cinema", "drama", "reaction", "podcast", "interview", "talk show", "vtuber", "hololive", "streamer"] },
    { id: "food", name: "美食", icon: "sparkles", color: "#ff8a5c", keywords: ["美食", "料理", "食譜", "烹飪", "餐廳", "甜點", "吃播", "food", "cooking", "recipe", "restaurant", "kitchen", "chef", "dessert", "street food", "mukbang"] },
    { id: "sports", name: "運動", icon: "star", color: "#4bb6df", keywords: ["運動", "棒球", "籃球", "足球", "網球", "健身", "賽車", "體育", "sports", "baseball", "basketball", "football", "soccer", "tennis", "fitness", "workout", "racing", "nba", "mlb"] },
    { id: "vehicles", name: "汽機車", icon: "star", color: "#8f98a8", keywords: ["汽車", "機車", "試駕", "車評", "改裝車", "電動車", "automotive", "car review", "motorcycle", "supercar", "vehicle", "tesla"] },
    { id: "animals", name: "動物與寵物", icon: "sparkles", color: "#d3a35f", keywords: ["動物", "寵物", "貓咪", "狗狗", "萌寵", "animal", "pet", "cat", "dog", "wildlife"] },
    { id: "life", name: "生活", icon: "sparkles", color: "#51c58a", keywords: ["生活", "日常", "旅行", "旅遊", "開箱", "健康", "居家", "家庭", "vlog", "lifestyle", "travel", "unboxing", "health", "daily", "family", "home"] }
  ];

  const INTERNAL_TOPICS = [
    { id: "stories", label: "故事與敘事", groupId: "stories", phrases: ["說故事", "故事", "懸疑", "未解之謎", "都市傳說", "案件", "奇聞", "storytelling", "true crime", "unsolved mystery", "urban legend"] },
    { id: "outdoors", label: "露營與生存", groupId: "outdoors", phrases: ["露營", "野營", "野外生存", "荒野求生", "野炊", "camping", "camper", "bushcraft", "outdoor survival", "survival shelter"] },
    { id: "vtuber", label: "虛擬創作者", groupId: "vtuber", phrases: ["虛擬實況主", "vtuber", "hololive", "nijisanji", "にじさんじ", "ホロライブ"] },
    { id: "gameplay", label: "遊戲內容", groupId: "games", phrases: ["遊戲實況", "遊戲攻略", "新手攻略", "gameplay", "gaming", "let's play", "実況", "ゲーム実況", "攻略", "手遊", "電競", "esports", "steam", "nintendo", "playstation", "xbox", "minecraft", "pokemon", "gta"] },
    { id: "game-development", label: "遊戲開發", groupId: "game-development", phrases: ["遊戲開發", "遊戲製作", "game development", "game dev", "gamedev", "godot", "unity tutorial", "unreal engine", "devlog"] },
    { id: "music-performance", label: "音樂與演奏", groupId: "music", phrases: ["音樂", "歌曲", "歌手", "翻唱", "演奏", "鋼琴", "吉他", "樂團", "音楽", "歌ってみた", "演奏してみた", "music", "song", "singer", "cover song", "concert", "piano", "guitar", "jazz", "lofi", "lyrics", "official audio", "official mv"] },
    { id: "music-production", label: "音樂製作", groupId: "music", phrases: ["音樂製作", "編曲", "混音", "作曲", "beatmaking", "music production", "mixing", "mastering", "composer", "vocaloid"] },
    { id: "software", label: "程式與軟體", groupId: "technology", phrases: ["程式設計", "軟體開發", "網頁開發", "開發者", "programming", "coding", "developer", "software", "javascript", "typescript", "python", "rust language", "linux", "github", "open source"] },
    { id: "hardware", label: "電腦與硬體", groupId: "technology", phrases: ["電腦硬體", "電腦組裝", "顯示卡", "處理器", "主機板", "硬體評測", "computer hardware", "pc build", "graphics card", "gpu review", "cpu review", "laptop review"] },
    { id: "consumer-tech", label: "消費科技", groupId: "technology", phrases: ["科技評測", "手機評測", "開箱評測", "智慧型手機", "ガジェット", "tech review", "technology", "smartphone", "android", "iphone", "ipad", "wearable"] },
    { id: "artificial-intelligence", label: "人工智慧", groupId: "technology", phrases: ["人工智慧", "機器學習", "生成式 ai", "大型語言模型", "machine learning", "generative ai", "large language model", "chatgpt", "stable diffusion", "midjourney"], excludes: ["ai cover", "ai翻唱", "ai 翻唱"] },
    { id: "science", label: "科學與科普", groupId: "science", phrases: ["科普", "科學", "物理", "化學", "生物學", "天文", "宇宙", "量子", "science", "scientific", "physics", "chemistry", "biology", "astronomy"] },
    { id: "humanities", label: "人文與歷史", groupId: "learning", phrases: ["歷史", "哲學", "心理學", "社會學", "法律", "考古", "history", "philosophy", "psychology", "sociology", "law", "archaeology", "documentary"] },
    { id: "education", label: "教育與課程", groupId: "learning", phrases: ["教育", "學習", "課程", "講座", "教學頻道", "語言學習", "education", "educational", "course", "lecture", "language learning", "lesson", "tutorial"] },
    { id: "journalism", label: "新聞與報導", groupId: "news", phrases: ["新聞", "時事", "國際新聞", "調查報導", "記者", "新聞網", "news", "current affairs", "reporter", "journalism", "breaking news", "world news"] },
    { id: "politics", label: "政治與公共事務", groupId: "news", phrases: ["政治", "國會", "選舉", "公共政策", "地緣政治", "politics", "election", "public policy", "geopolitics", "military affairs"] },
    { id: "investing", label: "投資與市場", groupId: "finance", phrases: ["投資", "股票", "理財", "財經", "加密貨幣", "比特幣", "investment", "investing", "stock market", "finance", "crypto", "bitcoin", "trading", "market analysis"] },
    { id: "business", label: "商業與經濟", groupId: "finance", phrases: ["商業", "經濟", "創業", "企業經營", "職場", "business", "economy", "economics", "entrepreneur", "startup", "career"] },
    { id: "visual-art", label: "繪畫與設計", groupId: "art", phrases: ["繪畫", "插畫", "繪圖過程", "漫畫", "攝影", "平面設計", "イラスト", "お絵描き", "art", "artist", "drawing", "illustration", "speedpaint", "photography", "graphic design"] },
    { id: "animation", label: "動畫製作", groupId: "art", phrases: ["動畫製作", "動畫教學", "動畫創作", "アニメーション", "animation making", "animation tutorial", "motion design", "3d animation", "blender animation"] },
    { id: "film-tv", label: "影劇與評論", groupId: "entertainment", phrases: ["電影評論", "影劇評論", "戲劇", "電影解析", "影評", "映画", "movie review", "film review", "cinema", "drama", "tv show", "television"] },
    { id: "comedy-variety", label: "喜劇與綜藝", groupId: "entertainment", phrases: ["搞笑", "喜劇", "綜藝", "脫口秀", "反應影片", "お笑い", "comedy", "funny", "variety show", "talk show", "reaction video"] },
    { id: "creator-streaming", label: "直播與創作者", groupId: "entertainment", phrases: ["虛擬實況主", "直播精華", "實況精華", "vtuber", "hololive", "nijisanji", "streamer", "podcast", "interview"] },
    { id: "cooking", label: "料理與食譜", groupId: "food", phrases: ["料理", "食譜", "烹飪", "甜點", "料理教學", "料理研究", "料理動画", "レシピ", "cooking", "recipe", "kitchen", "chef", "dessert", "baking"] },
    { id: "food-review", label: "餐廳與美食", groupId: "food", phrases: ["美食", "餐廳", "吃播", "街頭美食", "探店", "food review", "restaurant", "street food", "mukbang", "foodie"] },
    { id: "fitness", label: "健身與運動", groupId: "sports", phrases: ["健身", "重訓", "瑜珈", "跑步", "運動訓練", "fitness", "workout", "bodybuilding", "weightlifting", "yoga", "running"] },
    { id: "competitive-sports", label: "球類與賽事", groupId: "sports", phrases: ["棒球", "籃球", "足球", "網球", "體育賽事", "baseball", "basketball", "football", "soccer", "tennis", "nba", "mlb", "sports highlights"] },
    { id: "cars", label: "汽車", groupId: "vehicles", phrases: ["汽車", "試駕", "車評", "改裝車", "電動車", "新車介紹", "automotive", "car review", "supercar", "electric vehicle", "tesla"] },
    { id: "motorcycles", label: "機車", groupId: "vehicles", phrases: ["機車", "重機", "摩托車", "騎士", "motorcycle", "motorbike", "scooter", "rider"] },
    { id: "pets", label: "寵物", groupId: "animals", phrases: ["寵物", "貓咪", "狗狗", "萌寵", "毛小孩", "ペット", "猫", "犬", "pet", "cat", "dog"] },
    { id: "wildlife", label: "動物與自然", groupId: "animals", phrases: ["野生動物", "動物紀錄", "自然生態", "wildlife", "animal rescue", "nature documentary", "zoology"] },
    { id: "travel", label: "旅行與觀光", groupId: "life", phrases: ["旅行", "旅遊", "觀光", "住宿", "航空", "旅行 vlog", "旅行記", "travel", "tourism", "hotel", "flight review", "backpacking"] },
    { id: "home-diy", label: "居家與手作", groupId: "life", phrases: ["居家", "收納", "裝潢", "手作", "木工", "園藝", "home improvement", "interior design", "diy", "woodworking", "gardening"] },
    { id: "fashion-beauty", label: "時尚與美容", groupId: "life", phrases: ["時尚", "穿搭", "美妝", "保養", "髮型", "fashion", "beauty", "makeup", "skincare", "hairstyle"] },
    { id: "health-wellness", label: "健康與身心", groupId: "life", phrases: ["健康", "營養", "醫療", "睡眠", "心理健康", "health", "wellness", "nutrition", "medical", "mental health", "sleep"] },
    { id: "daily-life", label: "生活紀錄", groupId: "life", phrases: ["生活日常", "日常生活", "家庭生活", "育兒", "daily vlog", "daily life", "family vlog", "parenting", "lifestyle vlog"] }
  ];
  const TOPIC_LABEL_EN = {
    "stories": "Stories and narratives", "outdoors": "Camping and survival", "vtuber": "Virtual creators",
    "gameplay": "Gaming", "game-development": "Game development", "music-performance": "Music and performance", "music-production": "Music production",
    "software": "Programming and software", "hardware": "Computers and hardware", "consumer-tech": "Consumer technology", "artificial-intelligence": "Artificial intelligence",
    "science": "Science", "humanities": "Humanities and history", "education": "Education and courses", "journalism": "News and reporting",
    "politics": "Politics and public affairs", "investing": "Investing and markets", "business": "Business and economics", "visual-art": "Art and design",
    "animation": "Animation production", "film-tv": "Film, TV and reviews", "comedy-variety": "Comedy and variety", "creator-streaming": "Streaming and creators",
    "cooking": "Cooking and recipes", "food-review": "Restaurants and food", "fitness": "Fitness and exercise", "competitive-sports": "Sports and competitions",
    "cars": "Cars", "motorcycles": "Motorcycles", "pets": "Pets", "wildlife": "Animals and nature", "travel": "Travel and tourism",
    "home-diy": "Home and DIY", "fashion-beauty": "Fashion and beauty", "health-wellness": "Health and wellness", "daily-life": "Daily life"
  };

  const VIDEO_CATEGORY_GROUPS = {
    "1": { groupId: "art", label: "Film & Animation", weight: 5 },
    "2": { groupId: "vehicles", label: "Autos & Vehicles", weight: 10 },
    "10": { groupId: "music", label: "Music", weight: 10 },
    "15": { groupId: "animals", label: "Pets & Animals", weight: 10 },
    "17": { groupId: "sports", label: "Sports", weight: 10 },
    "19": { groupId: "life", label: "Travel & Events", weight: 8 },
    "20": { groupId: "games", label: "Gaming", weight: 10 },
    "23": { groupId: "entertainment", label: "Comedy", weight: 9 },
    "24": { groupId: "entertainment", label: "Entertainment", weight: 5 },
    "25": { groupId: "news", label: "News & Politics", weight: 10 },
    "26": { groupId: "life", label: "Howto & Style", weight: 4 },
    "27": { groupId: "learning", label: "Education", weight: 9 },
    "28": { groupId: "technology", label: "Science & Technology", weight: 8 },
    "29": { groupId: "news", label: "Nonprofits & Activism", weight: 4 }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanChannelName(value, fallback) {
    const firstLine = String(value || "").split(/[\r\n]+/).map((part) => part.trim()).find(Boolean) || String(fallback || "");
    const compact = firstLine.replace(/\s+/g, " ").trim();
    for (let cut = 4; cut <= compact.length / 2 + 1; cut += 1) {
      if (compact.slice(0, cut).trim() === compact.slice(cut).trim()) return compact.slice(0, cut).trim();
    }
    return compact;
  }

  function sanitizeDescription(value) {
    const description = String(value || "").trim();
    const boilerplate = [
      "與好友、家人及全世界分享你的影片",
      "与好友、家人和全世界分享你的视频",
      "share your videos with friends, family, and the world"
    ];
    return boilerplate.some((text) => description.toLowerCase() === text.toLowerCase()) ? "" : description;
  }

  function sanitizeChannelKeywords(value) {
    const generic = new Set(["影片", "視頻", "视频", "分享", "可拍照的手機", "影像電話", "免費", "上传", "上傳", "video", "videos", "sharing", "camera phone", "video phone", "free", "upload"]);
    return String(value || "").split(/[,，]+/).map((part) => part.trim()).filter((part) => part && !generic.has(part.toLowerCase())).join(", ");
  }

  function defaultState() {
    const language = detectDefaultLanguage();
    return {
      version: VERSION,
      revision: 0,
      groups: clone(DEFAULT_GROUPS).map((group) => ({ ...group, name: language === "en" ? UI_TEXT_EN[group.name] || group.name : group.name })),
      channels: {},
      channelAliases: {},
      favoriteChannelIds: [],
      manualLabels: {},
      settings: {
        enabled: true,
        blockHome: false,
        hideShorts: false,
        hideSecondary: false,
        disableAutoplay: false,
        hideWatched: false,
        compactMode: false,
        onboardingComplete: false,
        language
      }
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    if (!input || typeof input !== "object") return base;
    const rawChannels = input.channels && typeof input.channels === "object" ? input.channels : {};
    const aliases = new Map();
    const channels = {};
    for (const [rawId, channel] of Object.entries(rawChannels)) {
      if (!channel || typeof channel !== "object") continue;
      const id = channelKey(channel.id) || channelKey(rawId) || channelKey(channel.url);
      if (!id) continue;
      aliases.set(String(rawId), id);
      if (channel.id) aliases.set(String(channel.id), id);
      const preferredUrlId = channelKey(channel.url) || id;
      channels[id] = {
        id,
        name: cleanChannelName(channel.name, id).slice(0, 120),
        url: `https://www.youtube.com${preferredUrlId}`,
        avatar: typeof channel.avatar === "string" ? channel.avatar.slice(0, 2048) : "",
        seenAt: Number(channel.seenAt) || 0,
        description: sanitizeDescription(channel.description).slice(0, 2000),
        keywords: sanitizeChannelKeywords(channel.keywords).slice(0, 1000),
        channelId: String(channel.channelId || "").trim().slice(0, 128),
        recentTitles: Array.isArray(channel.recentTitles) ? channel.recentTitles.map((title) => String(title).trim()).filter(Boolean).slice(0, 20) : [],
        recentVideoIds: Array.isArray(channel.recentVideoIds) ? channel.recentVideoIds.map(String).filter(Boolean).slice(0, 20) : [],
        topicCategories: Array.isArray(channel.topicCategories) ? channel.topicCategories.map(String).filter(Boolean).slice(0, 20) : [],
        topicIds: Array.isArray(channel.topicIds) ? channel.topicIds.map(String).filter(Boolean).slice(0, 20) : [],
        videoCategoryCounts: channel.videoCategoryCounts && typeof channel.videoCategoryCounts === "object" ? Object.fromEntries(Object.entries(channel.videoCategoryCounts).slice(0, 50).map(([key, value]) => [String(key), Math.max(0, Number(value) || 0)]).filter(([, value]) => value > 0)) : {},
        officialTags: Array.isArray(channel.officialTags) ? channel.officialTags.map(String).filter(Boolean).slice(0, 40) : [],
        officialProfiledAt: Number(channel.officialProfiledAt) || 0,
        profiledAt: Number(channel.profiledAt) || 0,
        profileVersion: Number(channel.profileVersion) || 0
      };
    }
    const channelAliases = {};
    const registerAlias = (value, recordId) => {
      const alias = channelKey(String(value || ""));
      if (alias && channels[recordId] && !channelAliases[alias]) channelAliases[alias] = recordId;
    };
    for (const [recordId, channel] of Object.entries(channels)) {
      registerAlias(recordId, recordId);
      registerAlias(channel.url, recordId);
      if (channel.channelId) registerAlias(`/channel/${channel.channelId}`, recordId);
    }
    for (const [rawAlias, rawRecordId] of Object.entries(input.channelAliases && typeof input.channelAliases === "object" ? input.channelAliases : {})) {
      const recordId = aliases.get(String(rawRecordId)) || channelKey(String(rawRecordId));
      registerAlias(rawAlias, recordId);
    }
    const resolvePersistedId = (value) => {
      const raw = String(value || "");
      const normalized = aliases.get(raw) || channelKey(raw);
      return channelAliases[normalized] || (channels[normalized] ? normalized : "");
    };
    const seenGroupIds = new Set();
    const groups = (Array.isArray(input.groups)
      ? input.groups
          .filter((group) => group && typeof group.name === "string")
          .map((group, index) => ({
            id: String(group.id || `group-${index + 1}`).slice(0, 80),
            name: group.name.trim().slice(0, 40) || `群組 ${index + 1}`,
            icon: ICONS[group.icon] ? group.icon : "star",
            color: /^#[0-9a-f]{6}$/i.test(group.color || "") ? group.color : "#7c5cff",
            channelIds: Array.isArray(group.channelIds)
              ? [...new Set(group.channelIds.map(resolvePersistedId).filter(Boolean))]
              : []
          }))
      : base.groups).filter((group) => group.id && !seenGroupIds.has(group.id) && seenGroupIds.add(group.id));
    const validGroupIds = new Set(groups.map((group) => group.id));
    const manualLabels = Object.fromEntries(Object.entries(input.manualLabels && typeof input.manualLabels === "object" ? input.manualLabels : {})
      .map(([channelId, groupIds]) => [resolvePersistedId(channelId), groupIds])
      .filter(([channelId, groupIds]) => channels[channelId] && Array.isArray(groupIds))
      .map(([channelId, groupIds]) => [channelId, [...new Set(groupIds.map(String).filter((groupId) => validGroupIds.has(groupId)))]])
      .filter(([, groupIds]) => groupIds.length));
    const rawSettings = input.settings && typeof input.settings === "object" ? input.settings : {};
    return {
      version: VERSION,
      revision: Math.max(0, Math.floor(Number(input.revision) || 0)),
      groups,
      channels,
      channelAliases,
      favoriteChannelIds: [...new Set((Array.isArray(input.favoriteChannelIds) ? input.favoriteChannelIds : []).map(resolvePersistedId).filter(Boolean))],
      manualLabels,
      settings: {
        enabled: typeof rawSettings.enabled === "boolean" ? rawSettings.enabled : true,
        blockHome: typeof rawSettings.blockHome === "boolean" ? rawSettings.blockHome : base.settings.blockHome,
        hideShorts: typeof rawSettings.hideShorts === "boolean" ? rawSettings.hideShorts : base.settings.hideShorts,
        hideSecondary: typeof rawSettings.hideSecondary === "boolean" ? rawSettings.hideSecondary : base.settings.hideSecondary,
        disableAutoplay: typeof rawSettings.disableAutoplay === "boolean" ? rawSettings.disableAutoplay : base.settings.disableAutoplay,
        hideWatched: typeof rawSettings.hideWatched === "boolean" ? rawSettings.hideWatched : base.settings.hideWatched,
        compactMode: typeof rawSettings.compactMode === "boolean" ? rawSettings.compactMode : base.settings.compactMode,
        onboardingComplete: typeof rawSettings.onboardingComplete === "boolean" ? rawSettings.onboardingComplete : base.settings.onboardingComplete,
        language: languageCode(rawSettings.language)
      }
    };
  }

  function channelKey(url) {
    if (!url || typeof url !== "string") return "";
    try {
      const parsed = new URL(url, "https://www.youtube.com");
      const path = parsed.pathname.replace(/\/$/, "");
      if (!/^\/(channel\/|@|c\/|user\/)/i.test(path)) return "";
      const parts = path.split("/").filter(Boolean);
      if (!parts.length) return "";
      const stableParts = parts[0].startsWith("@") ? [parts[0]] : parts.slice(0, 2);
      return `/${stableParts.join("/")}`.toLowerCase();
    } catch (_error) {
      return "";
    }
  }

  function youtubePageKind(value) {
    try {
      const pathname = String(value || "").startsWith("http") ? new URL(value).pathname : String(value || "").split(/[?#]/)[0];
      if (pathname === "/" || pathname === "") return "home";
      if (pathname === "/feed/subscriptions") return "subscriptions";
      return "other";
    } catch (_error) {
      return "other";
    }
  }

  function subscriptionGroupUrl(groupId) {
    const id = String(groupId || "all");
    return `https://www.youtube.com/feed/subscriptions#chanlume-group=${encodeURIComponent(id)}`;
  }

  function settingsAfterToggle(settings, setting, enabled) {
    const next = { ...defaultState().settings, ...(settings || {}), [setting]: Boolean(enabled) };
    if (setting === "hideSecondary" && enabled) next.disableAutoplay = true;
    return next;
  }

  function blockedPageRedirect(settings, value) {
    if (settings?.enabled === false) return "";
    let pathname = "";
    try {
      pathname = String(value || "").startsWith("http") ? new URL(value).pathname : String(value || "").split(/[?#]/)[0];
    } catch (_error) {}
    if (settings?.blockHome && youtubePageKind(value) === "home") return subscriptionGroupUrl("all");
    if (settings?.hideShorts && pathname.startsWith("/shorts")) return subscriptionGroupUrl("all");
    return "";
  }

  function createId(name, usedIds) {
    const base = String(name || "group")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "") || "group";
    let id = base;
    let suffix = 2;
    while (usedIds.includes(id)) id = `${base}-${suffix++}`;
    return id;
  }

  function channelIdentityKeys(channel, extraAliases = []) {
    return [...new Set([
      channel?.url,
      channel?.id,
      channel?.channelId ? `/channel/${channel.channelId}` : "",
      ...(Array.isArray(channel?.aliases) ? channel.aliases : []),
      ...(Array.isArray(extraAliases) ? extraAliases : [])
    ].map((value) => channelKey(String(value || ""))).filter(Boolean))];
  }

  function resolveChannelRecordId(state, identity) {
    const key = channelKey(String(identity || ""));
    if (!key) return "";
    return state?.channelAliases?.[key] || (state?.channels?.[key] ? key : "");
  }

  function upsertChannels(state, incoming, alreadyNormalized = false) {
    const next = alreadyNormalized ? state : normalizeState(state);
    for (const channel of incoming || []) {
      const identities = channelIdentityKeys(channel);
      const preferred = channelKey(channel?.url || channel?.id);
      if (!preferred) continue;
      const resolved = [...new Set(identities.map((identity) => resolveChannelRecordId(next, identity)).filter(Boolean))];
      const id = resolved.includes(preferred) ? preferred : resolved[0] || preferred;
      const previous = next.channels[id];
      next.channels[id] = {
        id,
        name: cleanChannelName(channel.name || previous?.name, id).slice(0, 120),
        url: `https://www.youtube.com${preferred.startsWith("/@") ? preferred : channelKey(previous?.url) || preferred}`,
        avatar: typeof channel.avatar === "string" && channel.avatar ? channel.avatar : previous?.avatar || "",
        seenAt: Number(channel.seenAt) || Date.now(),
        description: sanitizeDescription(channel.description || previous?.description).slice(0, 2000),
        keywords: sanitizeChannelKeywords(channel.keywords || previous?.keywords).slice(0, 1000),
        channelId: String(channel.channelId || previous?.channelId || "").trim(),
        recentTitles: Array.isArray(channel.recentTitles) ? channel.recentTitles.map(String).slice(0, 20) : previous?.recentTitles || [],
        recentVideoIds: Array.isArray(channel.recentVideoIds) ? channel.recentVideoIds.map(String).slice(0, 20) : previous?.recentVideoIds || [],
        topicCategories: Array.isArray(channel.topicCategories) ? channel.topicCategories.map(String).slice(0, 20) : previous?.topicCategories || [],
        topicIds: Array.isArray(channel.topicIds) ? channel.topicIds.map(String).slice(0, 20) : previous?.topicIds || [],
        videoCategoryCounts: channel.videoCategoryCounts || previous?.videoCategoryCounts || {},
        officialTags: Array.isArray(channel.officialTags) ? channel.officialTags.map(String).slice(0, 40) : previous?.officialTags || [],
        officialProfiledAt: Number(channel.officialProfiledAt) || Number(previous?.officialProfiledAt) || 0,
        profiledAt: Number(channel.profiledAt) || Number(previous?.profiledAt) || 0,
        profileVersion: Number(channel.profileVersion) || Number(previous?.profileVersion) || 0
      };
      next.channelAliases[id] = id;
      identities.forEach((identity) => { next.channelAliases[identity] = id; });
    }
    return alreadyNormalized ? next : normalizeState(next);
  }

  function reconcileSubscriptionScan(state, incoming, options = {}) {
    let next = normalizeState(state);
    const seen = new Set();
    for (const channel of incoming || []) {
      const aliases = channelIdentityKeys(channel).filter((identity) => identity !== channelKey(channel?.url || channel?.id));
      next = coalesceChannelIdentities(next, channel, aliases, true);
      next = upsertChannels(next, [channel], true);
      const recordId = resolveChannelRecordId(next, channel?.url || channel?.id);
      if (recordId) seen.add(recordId);
    }
    const removable = Object.keys(next.channels).filter((id) => !seen.has(id) && !id.startsWith("/channel/"));
    const previousCount = Object.keys(next.channels).length;
    const removalLimit = Math.max(10, Math.ceil(previousCount * 0.15));
    if (!options.allowLargeRemoval && previousCount >= 20 && removable.length > removalLimit) {
      const error = new Error(`Scan would remove ${removable.length} of ${previousCount} channels`);
      error.code = "SCAN_SHRINK_GUARD";
      throw error;
    }
    const removeSet = new Set(removable);
    removable.forEach((id) => {
      delete next.channels[id];
      delete next.manualLabels[id];
    });
    Object.entries(next.channelAliases).forEach(([alias, recordId]) => { if (removeSet.has(recordId) || removeSet.has(alias)) delete next.channelAliases[alias]; });
    next.groups = next.groups.map((group) => ({ ...group, channelIds: group.channelIds.filter((id) => !removeSet.has(id)) }));
    return normalizeState(next);
  }

  function replaceChannels(state, incoming) {
    return reconcileSubscriptionScan(state, incoming, { allowLargeRemoval: true });
  }

  function removeChannel(state, channelId) {
    const next = normalizeState(state);
    const id = resolveChannelRecordId(next, channelId) || String(channelId || "");
    delete next.channels[id];
    delete next.manualLabels[id];
    Object.entries(next.channelAliases).forEach(([alias, recordId]) => { if (recordId === id || alias === id) delete next.channelAliases[alias]; });
    next.groups = next.groups.map((group) => ({ ...group, channelIds: group.channelIds.filter((item) => item !== id) }));
    return normalizeState(next);
  }

  function coalesceChannelIdentities(state, primaryChannel, aliasIds, alreadyNormalized = false) {
    let next = alreadyNormalized ? state : normalizeState(state);
    const preferredIdentity = channelKey(primaryChannel?.url || primaryChannel?.id);
    if (!preferredIdentity) return next;
    const identities = channelIdentityKeys(primaryChannel, aliasIds);
    const resolvedIds = [...new Set(identities.map((identity) => resolveChannelRecordId(next, identity)).filter(Boolean))];
    const primaryId = resolvedIds.includes(preferredIdentity) ? preferredIdentity : resolvedIds[0] || preferredIdentity;
    const existing = resolvedIds.map((id) => next.channels[id]).filter(Boolean);
    if (!existing.length && primaryChannel) return upsertChannels(next, [primaryChannel], alreadyNormalized);
    if (!existing.length) return next;

    const records = existing;
    const newestLocal = records.reduce((best, item) => (Number(item.profiledAt) || 0) >= (Number(best.profiledAt) || 0) ? item : best, records[0]);
    const newestOfficial = records.reduce((best, item) => (Number(item.officialProfiledAt) || 0) >= (Number(best.officialProfiledAt) || 0) ? item : best, records[0]);
    const newestSeen = records.reduce((best, item) => (Number(item.seenAt) || 0) >= (Number(best.seenAt) || 0) ? item : best, records[0]);
    const target = {
      ...(next.channels[primaryId] || existing[0]),
      id: primaryId,
      url: `https://www.youtube.com${preferredIdentity.startsWith("/@") ? preferredIdentity : channelKey((next.channels[primaryId] || existing[0]).url) || preferredIdentity}`,
      name: cleanChannelName(primaryChannel?.name || next.channels[primaryId]?.name || newestSeen.name, primaryId).slice(0, 120),
      avatar: primaryChannel?.avatar || newestSeen.avatar || next.channels[primaryId]?.avatar || "",
      seenAt: Math.max(...records.map((item) => Number(item.seenAt) || 0)),
      description: newestLocal.description || next.channels[primaryId]?.description || "",
      keywords: newestLocal.keywords || next.channels[primaryId]?.keywords || "",
      channelId: String(primaryChannel?.channelId || records.find((item) => item.channelId)?.channelId || "").trim(),
      recentTitles: newestLocal.recentTitles?.length ? newestLocal.recentTitles : next.channels[primaryId]?.recentTitles || [],
      recentVideoIds: newestLocal.recentVideoIds?.length ? newestLocal.recentVideoIds : next.channels[primaryId]?.recentVideoIds || [],
      profiledAt: Number(newestLocal.profiledAt) || 0,
      profileVersion: Number(newestLocal.profileVersion) || 0,
      topicCategories: newestOfficial.topicCategories?.length ? newestOfficial.topicCategories : next.channels[primaryId]?.topicCategories || [],
      topicIds: newestOfficial.topicIds?.length ? newestOfficial.topicIds : next.channels[primaryId]?.topicIds || [],
      videoCategoryCounts: Object.keys(newestOfficial.videoCategoryCounts || {}).length ? newestOfficial.videoCategoryCounts : next.channels[primaryId]?.videoCategoryCounts || {},
      officialTags: newestOfficial.officialTags?.length ? newestOfficial.officialTags : next.channels[primaryId]?.officialTags || [],
      officialProfiledAt: Number(newestOfficial.officialProfiledAt) || 0
    };

    const identitySet = new Set(resolvedIds);
    next.favoriteChannelIds = [...new Set(next.favoriteChannelIds.map((id) => identitySet.has(id) ? primaryId : id))];
    next.groups = next.groups.map((group) => ({
      ...group,
      channelIds: [...new Set(group.channelIds.map((id) => identitySet.has(id) ? primaryId : id))]
    }));
    const learnedGroups = new Set(resolvedIds.flatMap((id) => next.manualLabels[id] || []));
    resolvedIds.forEach((id) => {
      if (id !== primaryId) delete next.channels[id];
      delete next.manualLabels[id];
    });
    next.channels[primaryId] = target;
    if (learnedGroups.size) next.manualLabels[primaryId] = [...learnedGroups];
    Object.entries(next.channelAliases).forEach(([alias, recordId]) => { if (identitySet.has(recordId)) next.channelAliases[alias] = primaryId; });
    identities.forEach((identity) => { next.channelAliases[identity] = primaryId; });
    next.channelAliases[primaryId] = primaryId;
    return alreadyNormalized ? next : normalizeState(next);
  }

  function groupForChannel(state, id) {
    const current = normalizeState(state);
    const recordId = resolveChannelRecordId(current, id) || String(id || "");
    return current.groups.filter((group) => group.channelIds.includes(recordId));
  }

  function unfiledChannelIds(state) {
    const current = normalizeState(state);
    const filed = new Set(current.groups.flatMap((group) => group.channelIds));
    return Object.keys(current.channels).filter((id) => !filed.has(id));
  }

  // Fold common script variants for matching only; never rewrite stored user text.
  const SCRIPT_PAIRS = "学學习習戏戲开開发發软軟计計机機电電脑腦显顯处處块塊绘繪画畫动動畫畫设設摄攝艺藝术術乐樂讲講说說识識经經济濟财財业業资資频頻实實录錄网網体體运運营營车車关關键鍵声聲传傳闻聞谜謎悬懸爱愛宠寵观觀众眾灵靈类類书書极極国國厨廚营營险險线線数數据據语語应應视視测測评評业業务務联聯络絡团團练練统統战戰争爭历歷时時间間见見读讀称稱话話细細节節专專题題产產质質种種装裝门門罗羅万萬进進气氣备備术術别別后後制製造造";
  const SCRIPT_MAP = new Map(SCRIPT_PAIRS.match(/../gu).map((pair) => [pair[0], pair[1]]));
  const KEYWORD_MATCHERS = new Map();
  function classificationText(value) {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/./gu, (char) => SCRIPT_MAP.get(char) || char)
      .replace(/人工智能/g, "人工智慧").replace(/軟件/g, "軟體").replace(/計算機/g, "電腦").replace(/視頻/g, "影片");
  }
  function contentText(value) {
    return classificationText(value).replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/g, " ")
      .replace(/(?:business\s+(?:e-?mail|inquir\w*|contact)|商[業務]\s*(?:合作|聯[絡繫])|合作邀約)[^\n。！？]*/g, " ");
  }
  function keywordMatches(text, keyword) {
    const source = String(text || "").toLowerCase();
    if (KEYWORD_MATCHERS.has(keyword)) return KEYWORD_MATCHERS.get(keyword)(source);
    const needle = classificationText(keyword);
    if (!needle) return false;
    if (/^[a-z0-9 '-]+$/.test(needle)) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
      KEYWORD_MATCHERS.set(keyword, (value) => pattern.test(value));
    } else {
      KEYWORD_MATCHERS.set(keyword, (value) => value.includes(needle));
    }
    return KEYWORD_MATCHERS.get(keyword)(source);
  }

  function collectRecentVideos(initialData) {
    const videos = [];
    const seen = new Set();
    function textFromRuns(value) {
      if (!value || typeof value !== "object") return "";
      if (typeof value.simpleText === "string") return value.simpleText.trim();
      if (Array.isArray(value.runs)) return value.runs.map((run) => run?.text || "").join("").trim();
      return "";
    }
    function add(id, title) {
      const clean = String(title || "").trim();
      const videoId = String(id || "").trim();
      const key = videoId || clean;
      if (clean && !seen.has(key) && videos.length < 20) { seen.add(key); videos.push({ id: videoId, title: clean }); }
    }
    function visit(node) {
      if (!node || videos.length >= 20) return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (typeof node !== "object") return;
      for (const key of ["videoRenderer", "gridVideoRenderer", "compactVideoRenderer"]) add(node[key]?.videoId, textFromRuns(node[key]?.title));
      const lockup = node.lockupViewModel;
      if (lockup?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") add(lockup.contentId || lockup.videoId, lockup.metadata?.lockupMetadataViewModel?.title?.content);
      Object.values(node).forEach(visit);
    }
    visit(initialData);
    return videos;
  }

  function parseYouTubeInitialData(source) {
    source = String(source || "");
    // YouTube now serves inert JSON instead of an inline assignment. Parse data,
    // never execute page scripts (this also works in an MV3 service worker).
    for (const script of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (!/\bid\s*=\s*(["'])yt-initial-data\1/i.test(script[1])) continue;
      try { const data = JSON.parse(script[2]); if (data && typeof data === "object" && !Array.isArray(data)) return data; } catch (_) {}
    }
    const marker = /(?:var\s+ytInitialData|window\[["']ytInitialData["']\]|ytInitialData)\s*=\s*\{/g;
    for (const match of String(source).matchAll(marker)) {
      const start = match.index + match[0].length - 1;
      let depth = 0, quoted = false, escaped = false;
      for (let index = start; index < source.length; index++) {
        const char = source[index];
        if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
        if (char === '"') quoted = true;
        else if (char === "{") depth++;
        else if (char === "}" && --depth === 0) { try { return JSON.parse(source.slice(start, index + 1)); } catch (_) { break; } }
      }
    }
    throw new Error("YouTube channel data unavailable");
  }

  function collectChannelUploads(initialData) {
    const tabs = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.map((item) => item.tabRenderer).filter(Boolean);
    if (!tabs) throw new Error("YouTube video tab unavailable");
    const tabPath = (tab) => String(tab?.endpoint?.commandMetadata?.webCommandMetadata?.url || "").split("?")[0].replace(/\/$/, "");
    const videosTab = tabs.find((tab) => tabPath(tab).endsWith("/videos") || tab.tabIdentifier === "videos");
    if (!videosTab) {
      // A recognized channel with only a Shorts tab has no normal uploads.
      if (initialData.metadata?.channelMetadataRenderer && tabs.some((tab) => tabPath(tab).endsWith("/shorts"))) return [];
      throw new Error("YouTube video tab unavailable");
    }
    if (!videosTab.selected || !videosTab.content) throw new Error("YouTube video tab not loaded");
    const text = (value) => value?.simpleText || value?.runs?.map((run) => run.text || "").join("") || "";
    const result = new Map();
    const visit = (node) => {
      if (!node || typeof node !== "object" || result.size >= 30) return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      // Skip shelves, reels and playlists instead of traversing into related videos.
      if (node.richSectionRenderer || node.reelShelfRenderer || node.reelItemRenderer || node.shelfRenderer) return;
      const video = node.videoRenderer || node.gridVideoRenderer;
      const lockup = node.lockupViewModel;
      if (video || lockup) {
        const card = video || lockup;
        if (JSON.stringify(card).includes('"reelWatchEndpoint"') || /\/shorts\//.test(JSON.stringify(card))) return;
        if (lockup && lockup.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return;
        const id = video?.videoId || lockup?.contentId;
        const title = video ? text(video.title) : lockup?.metadata?.lockupMetadataViewModel?.title?.content;
        if (/^[\w-]{11}$/.test(id || "") && title) result.set(id, { id, title: String(title).slice(0, 500), published: "", publishedLabel: video ? text(video.publishedTimeText) : "", format: "video" });
        return;
      }
      Object.values(node).forEach(visit);
    };
    visit(videosTab.content);
    return [...result.values()];
  }

  function collectRecentVideoTitles(initialData) {
    return collectRecentVideos(initialData).map((video) => video.title);
  }

  const LEARNING_STOP_WORDS = new Set(["the", "and", "for", "with", "from", "this", "that", "your", "you", "channel", "video", "videos", "official", "youtube", "頻道", "影片", "官方", "分享", "訂閱", "觀看", "最新", "我們", "我的", "一個", "以及", "可以", "介紹", "教學", "日常", "です", "ます", "動画", "チャンネル"]);
  const WORD_SEGMENTER = typeof Intl?.Segmenter === "function" ? new Intl.Segmenter("zh-Hant", { granularity: "word" }) : null;

  function normalizedTopicName(value) {
    const raw = String(value || "");
    const tail = raw.includes("/") ? raw.slice(raw.lastIndexOf("/") + 1) : raw;
    try { return decodeURIComponent(tail).replace(/_/g, " ").toLowerCase(); }
    catch (_error) { return tail.replace(/_/g, " ").toLowerCase(); }
  }

  function officialTopicGroup(value) {
    const topicIdGroups = {
      "/m/04rlf": "music", "/m/0bzvm2": "games", "/m/06ntj": "sports", "/m/02jjt": "entertainment", "/m/09kqc": "entertainment", "/m/02vxn": "entertainment", "/m/05qjc": "entertainment", "/m/0f2f9": "entertainment", "/m/019_rr": "life", "/m/032tl": "life", "/m/027x7n": "sports", "/m/02wbm": "food", "/m/03glg": "life", "/m/068hy": "animals", "/m/041xxh": "life", "/m/07c1v": "technology", "/m/07bxq": "life", "/m/07yv9": "vehicles", "/m/09s1f": "finance", "/m/0kt51": "life", "/m/01h6rj": "news", "/m/05qt0": "news", "/m/01k8wb": "learning"
    };
    if (topicIdGroups[String(value || "")]) return topicIdGroups[String(value || "")];
    const topic = normalizedTopicName(value);
    const rules = [
      [/gaming|video game|action game|role-playing|strategy game|simulation game|puzzle game|racing game/, "games"],
      [/music|jazz|hip hop|rhythm and blues|reggae|rock|soul|classical/, "music"],
      [/sport|football|baseball|basketball|boxing|cricket|golf|hockey|tennis|volleyball|wrestling|motorsport|fitness/, "sports"],
      [/technology/, "technology"],
      [/knowledge/, "learning"],
      [/politic|military/, "news"],
      [/business/, "finance"],
      [/food/, "food"],
      [/pet|animal/, "animals"],
      [/vehicle/, "vehicles"],
      [/humor|movie|performing art|tv show|entertainment/, "entertainment"],
      [/fashion|beauty|tourism|hobby|health|lifestyle/, "life"]
    ];
    return rules.find(([pattern]) => pattern.test(topic))?.[1] || "";
  }

  function learningTokens(channel) {
    const parts = [channel?.name, channel?.description, channel?.keywords, ...(Array.isArray(channel?.recentTitles) ? channel.recentTitles : [])].filter(Boolean);
    const tokens = new Set();
    for (const source of parts) {
      const text = contentText(source);
      const words = text.match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
      words.filter((word) => !LEARNING_STOP_WORDS.has(word)).forEach((word) => tokens.add(word));
      for (let index = 0; index < words.length - 1; index += 1) {
        const phrase = `${words[index]} ${words[index + 1]}`;
        if (!LEARNING_STOP_WORDS.has(words[index]) && !LEARNING_STOP_WORDS.has(words[index + 1])) tokens.add(phrase);
      }
      try {
        if (!WORD_SEGMENTER) continue;
        for (const segment of WORD_SEGMENTER.segment(text)) {
          const word = segment.segment.trim();
          if (segment.isWordLike && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word) && word.length >= 2 && word.length <= 10 && !LEARNING_STOP_WORDS.has(word)) tokens.add(word);
        }
      } catch (_error) {}
    }
    return tokens;
  }

  function buildLearnedProfiles(state) {
    const current = normalizeState(state);
    const groups = new Map(current.groups.map((group) => [group.id, group]));
    const groupDocuments = new Map();
    const termCounts = new Map();
    for (const [channelId, groupIds] of Object.entries(current.manualLabels)) {
      const channel = current.channels[channelId];
      if (!channel) continue;
      const tokens = learningTokens(channel);
      for (const groupId of groupIds) {
        if (!groups.has(groupId)) continue;
        groupDocuments.set(groupId, (groupDocuments.get(groupId) || 0) + 1);
        for (const token of tokens) {
          if (!termCounts.has(token)) termCounts.set(token, new Map());
          const counts = termCounts.get(token);
          counts.set(groupId, (counts.get(groupId) || 0) + 1);
        }
      }
    }
    return [...groups.values()].flatMap((group) => {
      const documentCount = groupDocuments.get(group.id) || 0;
      if (documentCount < 2) return [];
      const terms = [...termCounts.entries()].flatMap(([term, counts]) => {
        const count = counts.get(group.id) || 0;
        const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
        const concentration = total ? count / total : 0;
        if (count < 2 || concentration < 0.67) return [];
        return [{ term, weight: Math.min(7, 1.5 + Math.log2(count + 1) * 1.5 + concentration * 2) }];
      }).sort((a, b) => b.weight - a.weight).slice(0, 80);
      return terms.length ? [{ groupId: group.id, name: group.name, icon: group.icon, color: group.color, terms, documentCount }] : [];
    });
  }

  const GROUP_ALIASES = {
    games: ["遊戲", "gaming"], music: ["音樂"], technology: ["科技"], learning: ["學習", "學習與成長", "learning", "learning and growth"],
    news: ["新聞"], finance: ["財經", "投資", "finance"], art: ["藝術", "art"], entertainment: ["娛樂", "entertainment"],
    food: ["美食"], sports: ["運動"], vehicles: ["汽機車"], animals: ["動物", "animals"], life: ["生活", "生活與解壓", "lifestyle"],
    "game-development": ["遊戲開發", "game development"], science: ["科普", "科普知識", "science"], stories: ["故事", "stories"],
    outdoors: ["露營與生存", "露營", "camping and survival"], vtuber: ["vtuber"]
  };
  function groupMetadata(groupId, state) {
    const groups = Array.isArray(state?.groups) ? state.groups : [];
    const exact = groups.find((group) => group.id === groupId);
    if (exact) return exact;
    const known = AUTO_GROUPS.find((group) => group.id === groupId);
    if (!known) return { id: groupId, name: groupId, icon: "star", color: "#7c5cff" };
    const names = new Set([known.name, UI_TEXT_EN[known.name], ...(GROUP_ALIASES[groupId] || [])].filter(Boolean).map(classificationText));
    return groups.find((group) => names.has(classificationText(group.name.trim()))) || known;
  }

  function classifyChannel(channel, state, learnedProfiles) {
    const name = contentText(channel?.name);
    const description = contentText(channel?.description);
    const keywords = contentText(sanitizeChannelKeywords(`${channel?.keywords || ""}, ${(channel?.officialTags || []).join(", ")}`));
    const titles = [...new Set((Array.isArray(channel?.recentTitles) ? channel.recentTitles : []).map(contentText))];
    const scores = new Map();
    const topicScores = [];
    function add(groupId, score, reason, source) {
      if (!groupId || score <= 0) return;
      groupId = groupMetadata(groupId, state).id;
      if (!scores.has(groupId)) scores.set(groupId, { score: 0, reasons: [], sources: new Set() });
      const target = scores.get(groupId);
      target.score += score;
      if (reason && target.reasons.length < 5 && !target.reasons.includes(reason)) target.reasons.push(reason);
      if (source) target.sources.add(source);
    }
    for (const topic of INTERNAL_TOPICS) {
      const matches = new Set();
      const weak = new Set(["攻略", "新手攻略", "tutorial", "lesson", "course", "career", "business", "職場", "商業", "explained"]);
      const extra = { software: ["軟體", "程式", "電腦科學", "編程"], hardware: ["電腦", "顯卡", "cpu", "gpu", "主板", "筆電", "pc", "硬體", "處理器"], "artificial-intelligence": ["claude", "codex", "ai agent", "llm", "人工智能"], "visual-art": ["繪圖", "動畫", "animation"], cooking: ["廚師", "炒菜", "家常菜", "做菜", "烤肉"] };
      const phrases = [...topic.phrases, ...(extra[topic.id] || [])].filter((phrase) => !weak.has(phrase));
      const hits = (text) => {
        if ((topic.excludes || []).some((phrase) => keywordMatches(text, phrase))) return 0;
        if (topic.id === "fitness" && /繪畫|drawing|繪圖|畫畫/.test(text)) return 0;
        let count = 0;
        for (const phrase of phrases) if (keywordMatches(text, phrase)) { matches.add(phrase); count++; }
        return count;
      };
      const nameHits = hits(name), keywordHits = hits(keywords), descriptionHits = hits(description);
      const titleHits = titles.filter((title) => hits(title)).length;
      // Correlated synonyms in one field are capped; repeated distinct uploads carry more evidence.
      const score = (nameHits ? 7 : 0) + Math.min(8, keywordHits * 4) + Math.min(8, descriptionHits * 4) + (titleHits === 1 ? 1 : Math.min(12, titleHits * 2.5));
      if (score > 0) {
        topicScores.push({ ...topic, groupId: groupMetadata(topic.groupId, state).id, score, titleHits });
        const topicLabel = state?.settings?.language === "en" ? TOPIC_LABEL_EN[topic.id] || topic.label : topic.label;
        add(topic.groupId, score, `${topicLabel}: ${[...matches].slice(0, 3).join(", ")}`, "dictionary");
      }
    }
    const officialGroups = new Set();
    for (const topic of [...(channel?.topicCategories || []), ...(channel?.topicIds || [])]) {
      const groupId = officialTopicGroup(topic);
      if (groupId && !officialGroups.has(groupId)) { officialGroups.add(groupId); add(groupId, 10, `${state?.settings?.language === "en" ? "YouTube topic" : "YouTube 主題"}: ${normalizedTopicName(topic)}`, "official"); }
    }
    const categoryCounts = channel?.videoCategoryCounts && typeof channel.videoCategoryCounts === "object" ? channel.videoCategoryCounts : {};
    const categoryTotal = Object.values(categoryCounts).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    for (const [categoryId, countValue] of Object.entries(categoryCounts)) {
      const category = VIDEO_CATEGORY_GROUPS[categoryId];
      const count = Math.max(0, Number(countValue) || 0);
      if (!category || !count || !categoryTotal) continue;
      const ratio = count / categoryTotal;
      add(category.groupId, category.weight * Math.min(1, ratio * 1.5), `${state?.settings?.language === "en" ? "Recent videos" : "近期影片"}: ${category.label} ${Math.round(ratio * 100)}%`, "official");
    }
    const profiles = learnedProfiles || (state ? buildLearnedProfiles(state) : []);
    const tokens = learningTokens(channel);
    for (const profile of profiles) {
      const matched = profile.terms.filter((term) => tokens.has(term.term)).slice(0, 4);
      const score = Math.min(14, matched.reduce((sum, term) => sum + term.weight, 0));
      if (score > 0) add(profile.groupId, score, `${state?.settings?.language === "en" ? "Personal vocabulary" : "個人詞彙"}: ${matched.map((term) => term.term).join(", ")}`, "personal");
    }
    // Prefer an evidenced specific subject over its broad parent, without erasing alternatives.
    for (const [specific, broad] of [["game-development", "games"], ["science", "learning"]]) {
      const specificId = groupMetadata(specific, state).id, broadId = groupMetadata(broad, state).id;
      if (specificId !== broadId && topicScores.some((topic) => topic.groupId === specificId && topic.score >= 6) && scores.has(broadId)) scores.get(broadId).score *= 0.5;
    }
    const ranked = [...scores.entries()].map(([groupId, result]) => {
      const meta = groupMetadata(groupId, state);
      const tags = topicScores.filter((topic) => topic.groupId === groupId).sort((a, b) => b.score - a.score).slice(0, 3).map((topic) => state?.settings?.language === "en" ? TOPIC_LABEL_EN[topic.id] || topic.label : topic.label);
      const existing = state?.groups?.some((group) => group.id === meta.id);
      const displayName = !existing && state?.settings?.language === "en" ? UI_TEXT_EN[meta.name] || meta.name : meta.name;
      return { groupId, name: displayName, icon: meta.icon, color: meta.color, score: result.score, reasons: result.reasons, sources: [...result.sources], tags };
    }).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    const margin = best ? best.score - (runnerUp?.score || 0) : 0;
    if (!best || best.score < 4) return null;
    const confidence = best.score >= 15 && margin >= 6 ? "high" : best.score >= 6 && margin >= 3 ? "medium" : "low";
    const alternatives = ranked.slice(1, 3).filter((item) => item.score >= 4 && item.score >= best.score * 0.55).map((item) => ({ ...item, confidence: "low", margin: 0 }));
    return { ...best, confidence, alternatives, margin: Math.round(margin * 10) / 10, score: Math.round(best.score * 10) / 10 };
  }

  function buildAutoGroupSuggestions(state) {
    const current = normalizeState(state);
    const filed = new Set(current.groups.flatMap((group) => group.channelIds));
    const learnedProfiles = buildLearnedProfiles(current);
    const suggestions = new Map();
    const uncertain = [];
    const stats = { high: 0, medium: 0, low: 0, official: 0, personal: 0, dictionary: 0 };
    for (const channel of Object.values(current.channels)) {
      if (filed.has(channel.id)) continue;
      const result = classifyChannel(channel, current, learnedProfiles);
      if (!result) { uncertain.push(channel.id); continue; }
      stats[result.confidence] += 1;
      result.sources.forEach((source) => { if (source in stats) stats[source] += 1; });
      for (const candidate of [result, ...result.alternatives]) {
        if (!suggestions.has(candidate.groupId)) suggestions.set(candidate.groupId, { ...candidate, channelIds: [], channels: [] });
        const target = suggestions.get(candidate.groupId);
        target.channelIds.push(channel.id);
        target.channels.push({ id: channel.id, name: channel.name, reasons: candidate.reasons, confidence: candidate.confidence, score: candidate.score, margin: candidate.margin, tags: candidate.tags, sources: candidate.sources });
      }
    }
    return { groups: [...suggestions.values()], uncertain, stats, learnedProfileCount: learnedProfiles.length };
  }

  function recordManualMembership(state, channelId, groupId, enabled) {
    const next = normalizeState(state);
    updateMembershipInPlace(next, channelId, groupId, enabled);
    return normalizeState(next);
  }

  function updateMembershipInPlace(next, channelId, groupId, enabled) {
    const group = next.groups.find((item) => item.id === groupId);
    if (!group || !next.channels[channelId]) return false;
    group.channelIds = enabled ? [...new Set([...group.channelIds, channelId])] : group.channelIds.filter((id) => id !== channelId);
    const labels = new Set(next.manualLabels[channelId] || []);
    if (enabled) labels.add(groupId);
    else labels.delete(groupId);
    if (labels.size) next.manualLabels[channelId] = [...labels];
    else delete next.manualLabels[channelId];
    return true;
  }

  function applyAutoGroupSuggestions(state, suggestionGroups) {
    const next = normalizeState(state);
    for (const suggestion of suggestionGroups || []) {
      const validIds = [...new Set((suggestion.channelIds || []).filter((id) => next.channels[id]))];
      if (!validIds.length) continue;
      let group = next.groups.find((item) => item.id === suggestion.groupId || item.name.trim().toLowerCase() === String(suggestion.name || "").trim().toLowerCase());
      if (!group) {
        group = {
          id: createId(suggestion.name || suggestion.groupId, next.groups.map((item) => item.id)),
          name: String(suggestion.name || "自動分類").trim().slice(0, 40),
          icon: ICONS[suggestion.icon] ? suggestion.icon : "star",
          color: /^#[0-9a-f]{6}$/i.test(suggestion.color || "") ? suggestion.color : "#7c5cff",
          channelIds: []
        };
        next.groups.push(group);
      }
      group.channelIds = [...new Set([...group.channelIds, ...validIds])];
    }
    return normalizeState(next);
  }

  function mergeGroups(state, sourceGroupId, targetGroupId) {
    const next = normalizeState(state);
    const source = next.groups.find((group) => group.id === sourceGroupId);
    const target = next.groups.find((group) => group.id === targetGroupId);
    if (!source || !target || source.id === target.id) return next;
    target.channelIds = [...new Set([...target.channelIds, ...source.channelIds])];
    for (const [channelId, groupIds] of Object.entries(next.manualLabels)) {
      const labels = new Set(groupIds);
      if (labels.delete(source.id)) labels.add(target.id);
      if (labels.size) next.manualLabels[channelId] = [...labels];
      else delete next.manualLabels[channelId];
    }
    next.groups = next.groups.filter((group) => group.id !== source.id);
    return normalizeState(next);
  }

  function applyStateOperation(state, operation) {
    const current = normalizeState(state);
    const type = String(operation?.type || "");
    const payload = operation?.payload && typeof operation.payload === "object" ? operation.payload : {};
    if (!current.settings.enabled && ["set-subscription", "coalesce-channel-identities", "reconcile-subscription-scan"].includes(type)) {
      throw Object.assign(new Error("Chanlume is disabled"), { code: "CHANLUME_DISABLED" });
    }
    if (type === "toggle-membership") {
      let next = payload.channel ? coalesceChannelIdentities(current, payload.channel, payload.aliasIds) : current;
      const identity = channelKey(payload.channel?.url || payload.channel?.id || payload.channelId);
      if (payload.channel && identity && !resolveChannelRecordId(next, identity)) next = upsertChannels(next, [payload.channel]);
      const channelId = resolveChannelRecordId(next, identity);
      if (!channelId || !updateMembershipInPlace(next, channelId, String(payload.groupId || ""), Boolean(payload.enabled))) throw new Error("Invalid membership operation");
      return normalizeState(next);
    }
    if (type === "edit-memberships" || type === "edit-favorites") {
      const groupId = String(payload.groupId || "");
      if (type === "edit-memberships" && !current.groups.some((group) => group.id === groupId)) throw new Error("Unknown group");
      const favorites = new Set(current.favoriteChannelIds);
      for (const change of Array.isArray(payload.changes) ? payload.changes : []) {
        if (typeof change?.enabled !== "boolean") throw new Error("Invalid selection change");
        const id = resolveChannelRecordId(current, change.channelId);
        if (!id) continue; // A concurrent deletion must not recreate a channel.
        if (type === "edit-memberships") updateMembershipInPlace(current, id, groupId, change.enabled);
        else if (change.enabled) favorites.add(id);
        else favorites.delete(id);
      }
      current.favoriteChannelIds = [...favorites];
      return normalizeState(current);
    }
    if (type === "bulk-membership") {
      const next = current;
      const groupId = String(payload.groupId || "");
      if (!next.groups.some((group) => group.id === groupId)) throw new Error("Unknown group");
      for (const identity of [...new Set(Array.isArray(payload.channelIds) ? payload.channelIds.map(String) : [])]) {
        const channelId = resolveChannelRecordId(next, identity) || identity;
        updateMembershipInPlace(next, channelId, groupId, Boolean(payload.enabled));
      }
      return normalizeState(next);
    }
    if (type === "set-subscription") {
      if (payload.subscribed) {
        const merged = payload.channel ? coalesceChannelIdentities(current, payload.channel, payload.aliasIds) : current;
        return upsertChannels(merged, payload.channel ? [payload.channel] : []);
      }
      const channelId = channelKey(payload.channel?.url || payload.channel?.id || payload.channelId);
      return [channelId, ...(Array.isArray(payload.aliasIds) ? payload.aliasIds.map(String) : [])]
        .filter(Boolean)
        .reduce((next, id) => removeChannel(next, channelKey(id)), current);
    }
    if (type === "coalesce-channel-identities") return coalesceChannelIdentities(current, payload.primaryChannel, payload.aliasIds);
    if (type === "set-setting") {
      const setting = String(payload.setting || "");
      if (!["enabled", "blockHome", "hideShorts", "hideSecondary", "disableAutoplay", "hideWatched", "compactMode"].includes(setting)) throw new Error("Unknown setting");
      return normalizeState({ ...current, settings: settingsAfterToggle(current.settings, setting, payload.enabled) });
    }
    if (type === "set-language") return normalizeState({ ...current, settings: { ...current.settings, language: languageCode(payload.language) } });
    if (type === "set-onboarding-complete") return normalizeState({ ...current, settings: { ...current.settings, onboardingComplete: Boolean(payload.complete) } });
    if (type === "add-group-templates") {
      for (const id of new Set(Array.isArray(payload.groupIds) ? payload.groupIds : [])) {
        const template = AUTO_GROUPS.find((group) => group.id === id);
        if (!template) continue;
        const existing = groupMetadata(id, current);
        if (current.groups.some((group) => group.id === existing.id)) continue;
        current.groups.push({ id: template.id, name: current.settings.language === "en" ? UI_TEXT_EN[template.name] || template.name : template.name, icon: template.icon, color: template.color, channelIds: [] });
      }
      return normalizeState(current);
    }
    if (type === "save-group") {
      const next = current;
      const id = String(payload.id || "");
      const name = String(payload.name || "").trim().slice(0, 40);
      if (!name) throw new Error("Group name is required");
      const values = { name, icon: ICONS[payload.icon] ? payload.icon : "star", color: /^#[0-9a-f]{6}$/i.test(payload.color || "") ? payload.color : "#7c5cff" };
      if (id) {
        const group = next.groups.find((item) => item.id === id);
        if (!group) throw new Error("Unknown group");
        Object.assign(group, values);
      } else {
        next.groups.push({ id: createId(name, next.groups.map((item) => item.id)), ...values, channelIds: [] });
      }
      return normalizeState(next);
    }
    if (type === "merge-groups") {
      const sourceGroupId = String(payload.sourceGroupId || "");
      const targetGroupId = String(payload.targetGroupId || "");
      if (sourceGroupId === targetGroupId || !current.groups.some((group) => group.id === sourceGroupId) || !current.groups.some((group) => group.id === targetGroupId)) throw new Error("Invalid group merge");
      return mergeGroups(current, sourceGroupId, targetGroupId);
    }
    if (type === "delete-group") {
      const id = String(payload.groupId || "");
      if (!current.groups.some((group) => group.id === id)) throw new Error("Unknown group");
      return normalizeState({ ...current, groups: current.groups.filter((group) => group.id !== id) });
    }
    if (type === "apply-auto-suggestions") {
      const stillUnfiled = new Set(unfiledChannelIds(current));
      const suggestions = (Array.isArray(payload.groups) ? payload.groups : []).map((group) => ({ ...group, channelIds: (group.channelIds || []).filter((id) => stillUnfiled.has(id)) }));
      return applyAutoGroupSuggestions(current, suggestions);
    }
    if (type === "auto-classify") {
      const requested = new Set((Array.isArray(payload.channelIds) ? payload.channelIds : []).map((id) => resolveChannelRecordId(current, id)).filter(Boolean));
      const learnedProfiles = buildLearnedProfiles(current);
      const fallback = current.groups.find((group) => ["其他", "其它", "other", "others"].includes(group.name.trim().toLowerCase()));
      const other = fallback ? { ...fallback, groupId: fallback.id } : { groupId: createId("other", current.groups.map((group) => group.id)), name: current.settings.language === "en" ? "Other" : "其他", icon: "star", color: "#8b849c" };
      const assignments = new Map();
      for (const id of unfiledChannelIds(current)) {
        if (!requested.has(id)) continue;
        const destination = classifyChannel(current.channels[id], current, learnedProfiles) || other;
        if (!assignments.has(destination.groupId)) assignments.set(destination.groupId, { ...destination, channelIds: [] });
        assignments.get(destination.groupId).channelIds.push(id);
      }
      return applyAutoGroupSuggestions(current, [...assignments.values()]);
    }
    if (type === "patch-channels") {
      const next = current;
      for (const update of Array.isArray(payload.updates) ? payload.updates : []) {
        const id = resolveChannelRecordId(next, update?.id) || String(update?.id || "");
        if (!next.channels[id] || !update?.patch || typeof update.patch !== "object") continue;
        const target = next.channels[id];
        const patch = update.patch;
        const localStamp = Number(patch.profiledAt) || 0;
        if (localStamp && localStamp >= (Number(target.profiledAt) || 0)) {
          for (const key of ["description", "keywords", "channelId", "recentTitles", "recentVideoIds", "profiledAt", "profileVersion"]) if (Object.hasOwn(patch, key)) target[key] = patch[key];
        }
        const officialStamp = Number(patch.officialProfiledAt) || 0;
        if (officialStamp && officialStamp >= (Number(target.officialProfiledAt) || 0)) {
          for (const key of ["topicCategories", "topicIds", "videoCategoryCounts", "officialTags", "officialProfiledAt"]) if (Object.hasOwn(patch, key)) target[key] = patch[key];
        }
        if (Object.hasOwn(patch, "avatar") && (!target.avatar || (Number(patch.seenAt) || 0) >= (Number(target.seenAt) || 0))) target.avatar = patch.avatar;
        if (Object.hasOwn(patch, "seenAt") && (Number(patch.seenAt) || 0) >= (Number(target.seenAt) || 0)) target.seenAt = patch.seenAt;
      }
      return normalizeState(next);
    }
    if (["replace-channels", "reconcile-subscription-scan"].includes(type)) return reconcileSubscriptionScan(current, Array.isArray(payload.channels) ? payload.channels : [], { allowLargeRemoval: Boolean(payload.allowLargeRemoval) });
    if (type === "replace-state") return normalizeState(payload.state);
    if (type === "reset-state") return defaultState();
    throw new Error("Unknown state operation");
  }

  function iconSvg(name, color, size) {
    const path = ICONS[name] || ICONS.star;
    const px = Number(size) || 20;
    return `<svg aria-hidden="true" viewBox="0 0 24 24" width="${px}" height="${px}" fill="${color || "currentColor"}"><path d="${path}"/></svg>`;
  }

  return {
    VERSION,
    LEGACY_STORAGE_KEYS,
    readStoredValues,
    canonicalHash,
    LANGUAGES,
    detectDefaultLanguage,
    languageCode,
    translateUiText,
    localizeDom,
    ICONS,
    AUTO_GROUPS,
    INTERNAL_TOPICS,
    VIDEO_CATEGORY_GROUPS,
    DEFAULT_GROUPS,
    cleanChannelName,
    sanitizeDescription,
    sanitizeChannelKeywords,
    defaultState,
    normalizeState,
    channelKey,
    youtubePageKind,
    subscriptionGroupUrl,
    settingsAfterToggle,
    blockedPageRedirect,
    createId,
    upsertChannels,
    replaceChannels,
    reconcileSubscriptionScan,
    removeChannel,
    coalesceChannelIdentities,
    resolveChannelRecordId,
    groupForChannel,
    unfiledChannelIds,
    collectRecentVideos,
    parseYouTubeInitialData,
    collectChannelUploads,
    collectRecentVideoTitles,
    buildLearnedProfiles,
    classifyChannel,
    buildAutoGroupSuggestions,
    recordManualMembership,
    applyAutoGroupSuggestions,
    mergeGroups,
    applyStateOperation,
    iconSvg
  };
});
