# Chanlume 1.18.5 效能改善

日期：2026-09-08。以下保留 1.18.5 當時的基準量測；效能改善已包含在 1.18.7，最新套件見 README。尚未在使用者登入的 YouTube 帳號完成安裝後實測，商店版本亦尚未更新。

## 原因與修改

1. **每張卡片都複製整個訂閱資料庫。** `shared.js` 的 `groupForChannel()` 會先執行 `normalizeState()`。舊版每張影片的分類標籤都呼叫它，而且先查分類才比較是否需要更新標籤。500 個頻道、200 張卡片，單次篩選就有約 100,000 次頻道資料處理。新版 content script 在接受新 revision 時建立分類索引，卡片直接查索引；持久化資料的驗證仍保留。
2. **更新排程可能一直延後。** 舊版每次相關 DOM 變動都重新開始 180 ms 倒數；持續載入時可能遲遲不篩選。新版合併待處理卡片，保留第一個 32 ms 排程期限；SPA 導航與切換群組可立即要求更新。實際執行時刻仍受瀏覽器主執行緒影響。
3. **自己更新 UI 又觸發自己。** 新增分類標籤會令舊版再次處理同張卡片。新版忽略自己的標籤與控制區變動，並避免一般卡片載入連帶重查頻道頁控制。
4. **部分 DOM 更新漏接。** 新版涵蓋卡片重用時只改 `href`、已觀看進度只改 `style` 的情況。`style` 監聽僅在訂閱頁且開啟已觀看篩選時使用。
5. **舊頁面資料被保留。** 身分橋接器原本強參照整個 `ytInitialData`，離開掃描頁仍存在。新版改為弱參照，離開頁面清理身分快取，背景分頁暫停觀察與重試。content script 同時清除待處理 DOM 節點，回前景再套用最新狀態。
6. **重複狀態通知與圖片載入。** 三個前端在正規化前排除已處理 revision；管理頁頻道頭像改為延遲載入。

## 前後比較

在獨立、無使用者登入資料的 headless Edge 152.0.4191.66，使用合成的 500 個頻道、10 個群組、200 張卡片。頻道含描述及 20 個近期標題；沒有遠端圖片或影片。每版本兩次獨立頁面，各量測三次完整 `applyFilters()`。比較來源為修改前 1.18.4 與實際 1.18.5 原始碼。

| 指標 | 1.18.4 | 1.18.5 |
|---|---:|---:|
| 單次完整篩選，六次量測範圍 | 1,046–1,974 ms | 2.2–7.8 ms |
| 新增一張卡片後，被處理次數 | 2 | 1 |
| 靜置後額外卡片處理 | 0 | 0 |
| SPA 離開後舊 initial-data 合成物件，強制 GC 後仍被保留 | 是 | 否 |

這不是 YouTube 全頁載入速度、CPU 使用率或瀏覽器總記憶體的測量。JSON 另記錄三次篩選前後的 JS heap 淨增量；它會受到 GC 時機影響，不能當作尖峰配置量、總配置量或常駐 RAM 節省百分比。沒有證據宣稱修正了所有 YouTube 記憶體增長。

隱藏影片仍使用 CSS，因此不代表 YouTube 已卸載影片卡片、縮圖或推薦內容。完整更新訂閱也仍需要等待 YouTube 載入清單；保留穩定結尾檢查與大量刪除防護，避免為縮短等待而誤刪本機頻道。

## 驗證與重現

- 六個 JavaScript 入口語法檢查通過。
- `node --test tests/shared.test.js tests/manifest.test.js tests/background.test.js`：44/44 通過。
- 本機 HTTP server 的 8766 port 下執行 `tests/ui-smoke.cjs`：通過。
- 同一 server 下執行 `tests/performance-smoke.cjs`：通過。涵蓋持續 DOM 變動不阻塞篩選、無自我重刷、卡片 href 重用、背景狀態追上、revision 去重、觀看進度變更、非訂閱頁無用卡片工作排除、身分橋接導航與背景恢復。
- 設定 `CHANLUME_NODE_MODULES` 指向含 Playwright 的 node_modules 後，`node work/performance-audit.cjs` 自行啟動限 localhost 的測試 server，產生 `work/performance-audit-results.json`。該 JSON 包含實測原始碼 SHA-256。
- `scripts/package.py` 建立 ZIP，檢查 manifest 在根目錄，驗證來源、解壓縮鏡像、ZIP 全部 18 個檔案內容一致。

記憶體判讀方法參考 [Chrome DevTools：Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)，區別配置造成的 GC 負擔、持有不用的資料，以及需要長時間快照才能確認的持續洩漏。

## 本機套用

此歷史效能紀錄對應的套件為 `outputs/TubeShelf-1.18.7.zip`；目前套件為 `outputs/Chanlume-1.19.3.zip`，解壓縮鏡像為 `outputs/extension/`。若目前已從該資料夾載入未封裝擴充套件，在擴充功能管理頁重新載入，再重新整理既有 YouTube 分頁一次。這次重新整理用於替換舊版內容腳本；日常群組篩選與分類變更仍在頁面內動態套用。

1.18.7 SHA-256：`b012f4612c4dfbb29efb0acb1f21920c5ee77ae3c82fabd69df2bfc1d3e9a08e`。
