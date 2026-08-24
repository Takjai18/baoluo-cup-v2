# 寶螺盃 · 瑞士制管理系統（v2）

現場用單一頁面 Web App，專為 **寶螺盃**（九龍城基督徒會 × 宣道會基蔭堂）設計。

呢個倉庫係 **新版本／開發線**。正式比賽請繼續用 v1，避免開發中改動影響現場。

## 線上網址

| 用途 | 連結 |
|------|------|
| **v2 預覽（GitHub Pages）** | **https://takjai18.github.io/baoluo-cup-v2/** |
| v2 原始碼 | https://github.com/Takjai18/baoluo-cup-v2 |
| **正式場（v1，唔好喺呢度試新功能）** | https://takjai18.github.io/baoluo-cup/ |
| v1 原始碼 | https://github.com/Takjai18/baoluo-cup |

推送至 `main` 後，Pages 通常約 1–2 分鐘更新完成。硬 refresh 一次。

---

## 快速開始

### 線上（推薦現場用）

v2 預覽：https://takjai18.github.io/baoluo-cup-v2/  
正式場（v1）：https://takjai18.github.io/baoluo-cup/

### 本機

```bash
cd ~/Desktop/baoluo-cup-v2
python3 -m http.server 8766
```

然後開啟 http://localhost:8765

**現場用法：**

1. **單機**：唔開雲端都得；資料在瀏覽器 `localStorage`。
2. **多裝置即時同步**（推薦）：設定 Firebase 後，用**比賽 ID** 連同一場（見下節）。

---

## ☁ 雲端同步（多裝置）

用 **Firebase Firestore** 把整場比賽同步到多部電腦／平板。

| 角色 | 點樣加入 | 權限 |
|------|----------|------|
| **主持** | 比賽 ID + **主持碼** | 可改分、改選手、鎖定輪次。**可以多部機同時用主持碼入分**，系統會合併賽果 |
| **只讀** | 只輸入比賽 ID | 即時睇賽況（投影／查對戰） |

### 一次過：開通 Firebase

1. 到 [Firebase Console](https://console.firebase.google.com/) 開專案 → 加 **Web App**
2. 開 **Firestore Database**（生產模式）
3. **Rules** 貼上：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasAll(
        ['roomId','hostPassHash','state','rev','createdAt','updatedAt']
      );
      allow update: if request.resource.data.hostPassHash
                    == resource.data.hostPassHash;
      allow delete: if false;
    }
  }
}
```

4. 複製 `firebase-config.example.js` → `firebase-config.js`，填入專案 config  
   （或直接改 repo 內嘅 `firebase-config.js`）
5. 推上 GitHub Pages 後硬 refresh

未設定 config 時，App **自動退回本機模式**，唔會壞。

### 現場操作

1. 主辦機：**⓪ 大會設定** → **建立雲端比賽** → 設主持碼 → 記下 **比賽 ID**
2. 其他計分機：開同一網站 → **加入比賽** → 輸入 ID **同埋主持碼**（幾部機可以一齊入分）
3. 投影／查對戰：只輸入 ID，唔填主持碼＝只讀
4. 頂欄會顯示 `比賽ID · 主持／只讀`

**注意：** 比賽 ID 唔好公開亂傳。主持碼主要鎖住介面；Firestore Rules 以「知 ID 可讀」為主，適合教會內部活動。兩部主持機唔好喺同一秒各自「重新配對」；入分會自動合併。

---

## 比賽設定（可調）

| 項目 | 說明 |
|------|------|
| 人數 | 8／16／32／64／自訂（單雙數都得；單數自動獲勝計瑞士 1 勝，入圍同分再加賽） |
| 教會 | 九龍城基督徒會（城基）／宣道會基蔭堂（基蔭） |
| 瑞士制 | 輪數可調；設定頁計算器按人數建議輪數（可無視） |
| 淘汰賽 | **4／8／16 強**；計算器一併建議規模（17–32 人建議 8 強，33+ 建議 16 強） |
| 入圍規則 | **規則 A**（完整決策樹）／**規則 B**（簡易：淨勝分、打贏出線；單數扣坐場分） |
| Match | 先到 4 分即勝（Extreme 3／Over·Burst 2／Spin 1）；同時完場該 Battle 無分 |
| 瑞士積分 | 勝 1、負 0 |

「規則」分頁有兩部份（可收合）：Beyblade X 第 12 版對戰規則，以及寶螺盃入圍規則 A／B。

### 建議賽制（計算器）

| 人數 | 瑞士輪 | 淘汰賽 |
|------|--------|--------|
| 8–16 | 3–4 | 4 強 |
| 17–32 | 5 | 8 強 |
| 33–64 | 6 | 16 強 |

瑞士 ≈ `ceil(log₂ N)`。單數剛過 16／32 人時淘汰名額會建議大一檔，避免爭席加賽過長（例如 17 人 4 強）。

### 淘汰賽種子

- **4 強**：1v4、2v3  
- **8 強**：1v8、4v5、2v7、3v6  
- **16 強**：1v16、8v9…（標準 bracket）  
準決賽（剩 2 場）完場後產生決賽 + 季軍賽。

---

## 備份

- **自動備份**：開始比賽、鎖定輪次、產生淘汰賽、淘汰結果 → 本機滾動保存（最多 8 份）
- **立即本機備份**／**完整 JSON**／**安全匯出（隱藏出場次序）**
- 匯出頁可一鍵還原本機備份

---

## 配對與排名

- 瑞士制：同分優先、不同教會、避開重賽（先硬避再軟罰）
- **32／64 人**用 greedy 配對，避免搜尋卡死 UI
- 排名：瑞士分 →（剛好 2 人且有對賽）H2H → BP → 姓名；**多角同分不用 pairwise H2H**

---

## 測試

```bash
cd ~/Desktop/baoluo-cup
node tests/logic.test.js
```

---

## 更新 GitHub Pages

```bash
cd ~/Desktop/baoluo-cup
git add -A
git commit -m "說明改動"
git push origin main
```

`index.html` 內 `?v=` cache-bust 有改才會強制瀏覽器拉新 JS／CSS。

---

## 檔案

| 檔案 | 用途 |
|------|------|
| `index.html` | 介面結構 |
| `styles.css` | 樣式／投影 |
| `app.js` | 狀態、配對、計分、淘汰賽、雲端 UI |
| `parts.js` | 陀螺零件庫 |
| `sync.js` | Firebase 比賽 ID 即時同步 |
| `firebase-config.js` | Firebase 專案設定（未填則本機模式） |
| `firebase-config.example.js` | 設定範例 |
| `tests/logic.test.js` | 純邏輯單元測試 |
