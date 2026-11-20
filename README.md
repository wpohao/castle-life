# 城堡生活（暫名）

在瀏覽器裡用 **WebGPU** 跑的 3D 中世紀城鎮生活遊戲：逛市集買武器買馬、騎馬逛城、上競技場比試，
再到城主府和艾琳娜聊天培養感情——她由**在你電腦上執行的 AI 模型**扮演，可以自由打字聊天——最後求婚、結婚。

## 線上遊玩

👉 https://wpohao.github.io/castle-life/ （用支援 WebGPU 的 Chrome 開啟）

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy-pages.yml`）會自動測試、打包並發布到 GitHub Pages。

## 需求

- Windows／macOS／Linux 上的 **Chrome 113 以上**（或新版 Edge），且顯示卡支援 WebGPU（網址列輸入 `chrome://gpu` 確認）。
- Node.js 20 以上。
- 第一次進遊戲會在背景下載對話模型（標準約 1 GB），之後從瀏覽器快取載入。

## 啟動

```bash
# 本機有 Avast 之類的 HTTPS 掃描時，Node 需要使用系統憑證
NODE_OPTIONS=--use-system-ca npm install
npm run dev
```

用 Chrome 打開 http://localhost:5173 。

素材已放在 `public/assets/`。如需重新下載：`NODE_OPTIONS=--use-system-ca node scripts/fetch-assets.mjs`。

## 操作

| 按鍵 | 城鎮 | 競技場 |
|---|---|---|
| WASD | 移動 | 移動（W 朝對手、A/D 繞圈） |
| Shift | 奔跑／騎馬衝刺 | — |
| 滑鼠 | 轉動視角（先點一下畫面鎖定滑鼠） | — |
| 左鍵 | — | 揮砍 |
| 右鍵（按住） | — | 格擋 |
| 空白鍵 | — | 閃避 |
| E | 進入建築、交談 | 比賽結束後回城 |
| F | 上馬／下馬 | — |
| I 或 Tab | 個人裝備 | — |
| Esc | 設定（存檔、畫質、對話模型） | — |

## 玩法重點

- 錢從**競技場**贏來：共 7 位對手，越後面越強，冠軍獎金 500。輸了不扣錢。
- **旅店**休息一晚會進入下一天，聊天與送禮的每日次數重置。
- 艾琳娜喜歡**星空、詩、花、甜點**；討厭炫耀殺戮、炫富、粗話。送禮一天一次，最愛的禮物在禮品攤。
- 好感夠高、身上帶著**訂婚戒指**（禮品攤 500 金）就能求婚。

## 存檔

- 進度自動存在瀏覽器（IndexedDB）。清除瀏覽器資料會讓存檔消失。
- Esc → 設定 → **匯出存檔**可以下載備份檔；**匯入存檔**還原。

## 開發

```bash
npm test         # 單元測試（Vitest）
npm run build    # 型別檢查＋打包
```

設計文件：`docs/superpowers/specs/2026-11-20-castle-life-design.md`；素材授權：`CREDITS.md`。
