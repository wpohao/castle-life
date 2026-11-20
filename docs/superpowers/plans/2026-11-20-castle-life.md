# 城堡生活（暫名）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一款在 Chrome 以 WebGPU 執行的 3D 第三人稱中世紀城鎮生活遊戲：買武器買馬、騎馬逛城、競技場步戰、與 AI 扮演的城主府女子聊天培養好感、求婚結婚，並自動存檔。

**Architecture:** 遊戲規則（狀態、經濟、戰鬥、好感、存檔）全部寫成與畫面無關的純 TypeScript 模組並以 Vitest 測試；3D 層（Three.js WebGPURenderer）與 UI 層（DOM overlay）只負責把輸入轉成規則呼叫、把狀態畫出來。AI 對話由 WebLLM 在 Web Worker 中執行，經 `LlmClient` 介面注入，測試時以假引擎替代。

**Tech Stack:** Vite 6、TypeScript 5（strict）、three（`three/webgpu`、`three/tsl`）、@mlc-ai/web-llm、idb-keyval、Vitest、fake-indexeddb。

**Spec:** `docs/superpowers/specs/2026-11-20-castle-life-design.md`

## Global Constraints

- 只支援 WebGPU：`navigator.gpu` 不存在或 `requestAdapter()` 回傳 null → 顯示說明頁，不進遊戲；不做 WebGL 退路。畫面角落顯示渲染後端「WebGPU」。
- 所有遊戲內文字為**正體中文**；AI 回覆必須是正體中文。
- 素材只用 **CC0** 授權，來源與授權逐一記錄在 `CREDITS.md`；不得使用騎砍的任何素材、名稱、陣營、地名。
- 主角外觀固定、名字自取（去頭尾空白後 1～12 字）；所有玩家輸入一律以 `textContent` 顯示，永不 `innerHTML`。
- 不使用瀏覽器 `alert` / `confirm` / `prompt`；所有確認都用遊戲內 UI。
- 好感度 0～100；AI 微調每句限 −1～+1；規則為主（喜好／禁忌／送禮／戰績）。
- 存檔：IndexedDB 單槽、格式帶版本號 `version: 1`；匯出／匯入 JSON；刪除需遊戲內二次確認。
- 本機 Node 指令需 `NODE_OPTIONS=--use-system-ca`（Avast 攔截 HTTPS）；curl 需 `--ssl-no-revoke`。
- Commit 訊息格式：`<type>(<scope>): <正體中文 subject>`，結尾附 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 所有數值（價格、傷害、門檻）集中在 `src/config/`，方便調整平衡。
- 美術方向（spec §6.1 修訂）：**寫實場景＋風格化角色**。場景材質用 Poly Haven CC0 PBR 貼圖（2K 為上限）、天空用 Poly Haven CC0 HDRI；陰影、霧、AO、bloom、ACES；畫質分高／中／低。

## Review Focus

1. **匯入損壞或被手改的存檔**（非 JSON、版本錯、金錢為負、引用不存在的物品 ID）→ 拒絕並顯示原因，目前的存檔完全不變。→ Task 3 `parseSave` 測試。
2. **聊天輸入異常**（全空白、超過 200 字、AI 回覆中重複送出）→ 空白不送、超長截斷到 200 字、生成中送出鈕停用且不消耗當日次數。→ Task 11 `validatePlayerMessage` 與 `talk` 測試。
3. **模型下載中斷或 GPU 記憶體不足導致載入失敗** → 其他玩法照常，聊天視窗顯示錯誤與「重試」；重試成功後可正常聊天。→ Task 11 `LlmClient` 測試。
4. **切到別的分頁再回來**（requestAnimationFrame 恢復時 dt 可能數秒）→ 戰鬥不會瞬間結算，dt 夾在 0.1 秒；分頁隱藏時比賽暫停。→ Task 8 `stepBout` 測試。
5. **玩家名字輸入異常**（空白、超長、含 `<script>`）→ 空白拒絕、截到 12 字、原樣以文字顯示，不被當成 HTML，也原樣（不執行）進入 AI 提示。→ Task 2 `sanitizePlayerName` 測試。

---

## 檔案結構

```
castle-life/
  index.html  package.json  tsconfig.json  vite.config.ts  CREDITS.md  .gitignore
  public/assets/            CC0 素材（characters/ horses/ town/ weapons/ props/）
  src/
    main.ts                 啟動：WebGPU 偵測、renderer、主迴圈、場景切換
    boot/webgpu.ts          detectWebGPU()
    config/items.ts         武器、馬、禮物目錄
    config/arena.ts         競技場對手階梯
    config/romance.ts       她的人設、喜好、禁忌、好感階段、每日限制
    core/state.ts           GameState、createNewState、sanitizePlayerName
    core/economy.ts         購買、裝備、坐騎
    core/time.ts            restUntilNextDay
    core/arenaProgress.ts   recordBout
    core/save.ts            serialize、parseSave
    core/saveStore.ts       IndexedDB 讀寫、createAutosave
    combat/combat.ts        即時戰鬥模擬（純邏輯）
    combat/ai.ts            對手 AI
    romance/affection.ts    規則計分、applyChat、giveGift、propose
    romance/prompt.ts       提示組裝、模型回覆解析與檢查
    romance/llmClient.ts    LlmClient（載入狀態機、chat）、pickModel
    romance/llm.worker.ts   WebLLM worker
    romance/conversation.ts talk()：一次對話回合的完整流程
    world/collision.ts      圓 vs AABB 推出
    world/zones.ts          互動區、findInteraction
    world/assets.ts         GLTF 載入＋佔位模型 fallback、武器掛點
    world/assetManifest.ts  素材路徑表
    world/town.ts           城鎮場景
    world/input.ts          鍵盤滑鼠、pointer lock
    world/player.ts         第三人稱角色控制
    world/camera.ts         跟隨鏡頭
    world/horse.ts          canMount、騎乘移動
    world/arenaScene.ts     競技場場景
    world/manorScene.ts     城主府大廳與 NPC
    world/grass.ts          compute shader 草地
    world/wedding.ts        婚禮過場
    ui/styles.css  ui/hud.ts  ui/shop.ts  ui/inventory.ts  ui/inn.ts
    ui/chat.ts  ui/settings.ts  ui/loading.ts  ui/unsupported.ts  ui/nameEntry.ts
  tests/                    與 src/ 同結構的 *.test.ts
```

---

### Task 1: 專案骨架與 WebGPU 啟動

**Files:**
- Create: `package.json`、`tsconfig.json`、`vite.config.ts`、`index.html`、`.gitignore`、`src/main.ts`、`src/boot/webgpu.ts`、`src/ui/unsupported.ts`、`src/ui/styles.css`、`src/ui/hud.ts`
- Test: `tests/boot/webgpu.test.ts`

**Interfaces:**
- Produces: `detectWebGPU(nav?: Navigator): Promise<{ ok: true; adapter: GPUAdapter } | { ok: false; reason: 'no_api' | 'no_adapter' }>`；`showUnsupported(root: HTMLElement, reason): void`；`createHud(root): { setBackend(label: string): void; setGold(n: number): void; setPrompt(text: string | null): void; setDay(n: number): void }`；`main.ts` 匯出 `Game` 主迴圈骨架：`registerScene(name: SceneName, scene: GameScene)`、`switchScene(name)`，其中 `interface GameScene { enter(): void; exit(): void; update(dt: number): void; scene: THREE.Scene; camera: THREE.Camera }`，`type SceneName = 'town' | 'arena' | 'manor' | 'wedding'`。

- [ ] **Step 1: 初始化 git 與套件**

```bash
cd /c/Users/burton.wei_smartdail/Desktop/Burton/MyGithub/castle-life
git init -b main
NODE_OPTIONS=--use-system-ca npm init -y
NODE_OPTIONS=--use-system-ca npm i three @mlc-ai/web-llm idb-keyval
NODE_OPTIONS=--use-system-ca npm i -D vite typescript vitest @types/three fake-indexeddb @webgpu/types
```
`package.json` scripts：`"dev": "vite"`、`"build": "tsc --noEmit && vite build"`、`"test": "vitest run"`。`tsconfig` strict、`types: ["@webgpu/types", "vite/client"]`。`.gitignore`：`node_modules`、`dist`。

- [ ] **Step 2: 寫失敗測試 `tests/boot/webgpu.test.ts`**

```ts
test('沒有 navigator.gpu 回報 no_api', async () => {
  expect(await detectWebGPU({} as Navigator)).toEqual({ ok: false, reason: 'no_api' });
});
test('requestAdapter 回傳 null 回報 no_adapter', async () => {
  const nav = { gpu: { requestAdapter: async () => null } } as unknown as Navigator;
  expect(await detectWebGPU(nav)).toEqual({ ok: false, reason: 'no_adapter' });
});
test('有 adapter 回報 ok', async () => {
  const adapter = {} as GPUAdapter;
  const nav = { gpu: { requestAdapter: async () => adapter } } as unknown as Navigator;
  expect(await detectWebGPU(nav)).toEqual({ ok: true, adapter });
});
```

- [ ] **Step 3: 執行 `npx vitest run tests/boot`，預期 FAIL（模組不存在）**

- [ ] **Step 4: 實作 `detectWebGPU`、`showUnsupported`（正體中文說明：需要支援 WebGPU 的 Chrome 113 以上、如何確認）、`createHud`、`main.ts`**

`main.ts`：偵測失敗 → `showUnsupported`；成功 → `new THREE.WebGPURenderer({ antialias: true })`、`await renderer.init()`，確認 `renderer.backend.isWebGPUBackend === true`（否則也走 `showUnsupported`），HUD 顯示「WebGPU」。主迴圈 `renderer.setAnimationLoop`，dt 由 `THREE.Clock` 取得後夾在 `Math.min(dt, 0.1)`。先放一個暫時的地面與方塊場景作為 `town` 佔位。

- [ ] **Step 5: 執行測試 PASS；`npm run dev` 用 Chrome 開 `http://localhost:5173`，預期看到地面方塊與角落「WebGPU」、主控台無錯誤**

- [ ] **Step 6: Commit（先提交 spec 與 plan，再提交骨架）**

```bash
git add docs && git commit -m "docs: 新增城堡生活遊戲設計與實作計畫"
git add -A && git commit -m "chore: 建立 Vite + Three.js WebGPU 專案骨架"
git switch -c feature/burton/castle-life
```

---

### Task 2: 遊戲狀態、物品目錄、經濟與時間

**Files:**
- Create: `src/config/items.ts`、`src/core/state.ts`、`src/core/economy.ts`、`src/core/time.ts`
- Test: `tests/core/state.test.ts`、`tests/core/economy.test.ts`、`tests/core/time.test.ts`

**Interfaces:**
- Produces:
```ts
// config/items.ts
type WeaponKind = 'sword' | 'axe' | 'mace' | 'spear';
interface Weapon { id: string; name: string; kind: WeaponKind; price: number; damage: number; windup: number; recover: number; reach: number; model: string }
interface Horse { id: string; name: string; price: number; speed: number; color: number }
interface Gift { id: string; name: string; price: number; tags: string[] }
export const WEAPONS: Weapon[]; HORSES: Horse[]; GIFTS: Gift[];
export const STARTER_WEAPON_ID = 'rusty_sword'; START_GOLD = 50; RING_GIFT_ID = 'engagement_ring';
export function getWeapon(id: string): Weapon | undefined; getHorse(id); getGift(id);
// core/state.ts
export const SAVE_VERSION = 1;
interface GameState {
  version: 1; playerName: string; gold: number; day: number;
  ownedWeapons: string[]; equippedWeapon: string; ownedHorses: string[]; activeHorse: string | null;
  gifts: Record<string, number>;
  arena: { nextOpponent: number; champion: boolean };
  romance: { affection: number; chatsToday: number; giftGivenToday: boolean; topicsToday: string[]; married: boolean; memory: { role: 'player' | 'lady'; text: string }[] };
}
export function createNewState(playerName: string): GameState;
export function sanitizePlayerName(raw: string): string | null;
// core/economy.ts
type EconomyError = 'not_enough_gold' | 'already_owned' | 'unknown_item' | 'not_owned';
type EconomyResult = { ok: true; state: GameState } | { ok: false; reason: EconomyError };
export function buyWeapon(s: GameState, id: string): EconomyResult;  // 同簽章：buyHorse、buyGift（禮物可堆疊，不會 already_owned）
export function equipWeapon(s: GameState, id: string): EconomyResult;
export function setActiveHorse(s: GameState, id: string | null): EconomyResult;
// core/time.ts
export function restUntilNextDay(s: GameState): GameState;
```
所有函式回傳新物件，不修改輸入。

目錄數值（spec 交給實作者，以此為初始值）：

| 武器 id | 名稱 | 種類 | 價格 | 傷害 | windup | recover | reach |
|---|---|---|---|---|---|---|---|
| rusty_sword | 生鏽的劍 | sword | 0 | 8 | 0.45 | 0.35 | 1.6 |
| iron_sword | 鐵劍 | sword | 120 | 12 | 0.45 | 0.35 | 1.7 |
| mace | 釘頭錘 | mace | 160 | 15 | 0.6 | 0.45 | 1.5 |
| battle_axe | 戰斧 | axe | 220 | 19 | 0.7 | 0.5 | 1.5 |
| spear | 長槍 | spear | 240 | 13 | 0.5 | 0.4 | 2.4 |
| knight_sword | 騎士長劍 | sword | 480 | 20 | 0.42 | 0.32 | 1.8 |

馬：`chestnut_pony` 栗色小馬 150／速度 8；`dapple_grey` 灰斑馬 320／10；`black_destrier` 黑色戰馬 650／12。
禮物：`wildflowers` 野花束 10 `['flower']`；`honey_cake` 蜂蜜蛋糕 25 `['sweets']`；`poetry_book` 詩集 40 `['poetry']`；`silver_hairpin` 銀髮簪 80 `['jewelry']`；`astrolabe` 星象儀 120 `['stars']`；`dagger` 短劍 60 `['weapon']`；`engagement_ring` 訂婚戒指 500 `['ring']`。

- [ ] **Step 1: 寫失敗測試**

```ts
// state.test.ts
test('新遊戲初始值', () => {
  const s = createNewState('亞瑟');
  expect(s).toMatchObject({ version: 1, playerName: '亞瑟', gold: 50, day: 1, ownedWeapons: ['rusty_sword'], equippedWeapon: 'rusty_sword', activeHorse: null, arena: { nextOpponent: 0, champion: false } });
  expect(s.romance).toMatchObject({ affection: 0, chatsToday: 0, married: false });
});
test('名字：去空白、空白拒絕、截 12 字、保留特殊字元原文', () => {
  expect(sanitizePlayerName('  亞瑟 ')).toBe('亞瑟');
  expect(sanitizePlayerName('   ')).toBeNull();
  expect(sanitizePlayerName('一二三四五六七八九十甲乙丙')).toBe('一二三四五六七八九十甲乙');
  expect(sanitizePlayerName('<script>')).toBe('<script>');
});
// economy.test.ts
test('錢剛好等於價格可以買', () => {
  const s = { ...createNewState('a'), gold: 120 };
  const r = buyWeapon(s, 'iron_sword');
  expect(r.ok && r.state.gold).toBe(0);
  expect(r.ok && r.state.ownedWeapons).toContain('iron_sword');
});
test('錢不夠、重複購買、未知物品被拒且原狀態不變', () => {
  const s = createNewState('a');
  expect(buyWeapon(s, 'knight_sword')).toEqual({ ok: false, reason: 'not_enough_gold' });
  expect(buyWeapon(s, 'rusty_sword')).toEqual({ ok: false, reason: 'already_owned' });
  expect(buyHorse(s, 'unicorn')).toEqual({ ok: false, reason: 'unknown_item' });
  expect(s.gold).toBe(50);
});
test('禮物可堆疊', () => {
  let s = { ...createNewState('a'), gold: 100 };
  s = (buyGift(s, 'wildflowers') as any).state; s = (buyGift(s, 'wildflowers') as any).state;
  expect(s.gifts.wildflowers).toBe(2);
});
test('只能裝備／騎乘已擁有的東西；坐騎可設為 null', () => {
  const s = createNewState('a');
  expect(equipWeapon(s, 'spear')).toEqual({ ok: false, reason: 'not_owned' });
  expect(setActiveHorse(s, 'chestnut_pony')).toEqual({ ok: false, reason: 'not_owned' });
  expect(setActiveHorse(s, null).ok).toBe(true);
});
// time.test.ts
test('休息到隔天重置每日限制', () => {
  const s = createNewState('a');
  s.romance = { ...s.romance, chatsToday: 8, giftGivenToday: true, topicsToday: ['flower'] };
  const n = restUntilNextDay(s);
  expect(n.day).toBe(2);
  expect(n.romance).toMatchObject({ chatsToday: 0, giftGivenToday: false, topicsToday: [] });
});
```

- [ ] **Step 2: `npx vitest run tests/core` 預期 FAIL**
- [ ] **Step 3: 實作上述模組（名字以 `Array.from` 計字，避免切斷字元）**
- [ ] **Step 4: 測試 PASS**
- [ ] **Step 5: Commit** `feat(核心): 新增遊戲狀態、物品目錄與購買裝備規則`

---

### Task 3: 存檔（自動存檔、匯出、匯入、刪除）

**Files:**
- Create: `src/core/save.ts`、`src/core/saveStore.ts`
- Test: `tests/core/save.test.ts`、`tests/core/saveStore.test.ts`

**Interfaces:**
- Consumes: `GameState`、`SAVE_VERSION`、`getWeapon/getHorse/getGift`（Task 2）
- Produces:
```ts
export function serialize(s: GameState): string;
export function parseSave(json: string): { ok: true; state: GameState } | { ok: false; error: string }; // error 為正體中文訊息
export function loadSave(): Promise<GameState | null>;
export function writeSave(s: GameState): Promise<void>;
export function deleteSave(): Promise<void>;
export function downloadSaveFile(s: GameState): void; // 檔名 castle-life-save-day{N}.json
export function createAutosave(write: (s: GameState) => Promise<void>, debounceMs = 500): { notify(s: GameState): void; flush(): Promise<void> };
```
`saveStore` 用 `idb-keyval` 的 `get/set/del`，key `'castle-life/save'`。`main.ts` 在 `visibilitychange`（hidden）與 `pagehide` 呼叫 `flush()`。

- [ ] **Step 1: 寫失敗測試**

```ts
test('serialize → parseSave 來回一致', () => {
  const s = createNewState('亞瑟');
  expect(parseSave(serialize(s))).toEqual({ ok: true, state: s });
});
test.each([
  ['不是 JSON', '{oops'],
  ['版本不符', JSON.stringify({ ...createNewState('a'), version: 99 })],
  ['金錢為負', JSON.stringify({ ...createNewState('a'), gold: -5 })],
  ['未知武器', JSON.stringify({ ...createNewState('a'), ownedWeapons: ['laser'] })],
  ['裝備未擁有的武器', JSON.stringify({ ...createNewState('a'), equippedWeapon: 'spear' })],
  ['好感超出範圍', JSON.stringify({ ...createNewState('a'), romance: { ...createNewState('a').romance, affection: 999 } })],
  ['缺欄位', JSON.stringify({ version: 1 })],
])('拒絕損壞存檔：%s', (_, json) => {
  const r = parseSave(json);
  expect(r.ok).toBe(false);
  expect(!r.ok && r.error.length).toBeGreaterThan(0);
});
// saveStore.test.ts（import 'fake-indexeddb/auto'）
test('寫入後讀回；刪除後為 null', async () => { /* writeSave → loadSave 相等；deleteSave → null */ });
test('autosave 去抖：短時間多次 notify 只寫一次最後狀態；flush 立即寫', async () => {
  vi.useFakeTimers(); const write = vi.fn(async () => {});
  const a = createAutosave(write, 500);
  a.notify({ ...createNewState('a'), gold: 1 }); a.notify({ ...createNewState('a'), gold: 2 });
  await a.flush();
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0][0].gold).toBe(2);
});
```

- [ ] **Step 2: 測試 FAIL**
- [ ] **Step 3: 實作。`parseSave` 逐欄型別檢查（不引入 schema 套件），驗證所有物品 ID 存在於目錄**
- [ ] **Step 4: 測試 PASS**
- [ ] **Step 5: Commit** `feat(存檔): 新增自動存檔與存檔匯出匯入驗證`

---

### Task 4: 碰撞、互動區、角色控制與城鎮佈局（佔位模型）

**Files:**
- Create: `src/world/collision.ts`、`src/world/zones.ts`、`src/world/input.ts`、`src/world/player.ts`、`src/world/camera.ts`、`src/world/town.ts`
- Modify: `src/main.ts`（以 town 取代佔位場景、HUD 顯示互動提示）
- Test: `tests/world/collision.test.ts`、`tests/world/zones.test.ts`

**Interfaces:**
- Produces:
```ts
// collision.ts
interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export function resolveCircleVsBoxes(p: { x: number; z: number }, radius: number, boxes: Box[]): { x: number; z: number };
// zones.ts
type ZoneId = 'weapon_shop' | 'stable' | 'gift_stall' | 'inn' | 'arena' | 'manor';
interface Zone { id: ZoneId; label: string; x: number; z: number; radius: number; enterable: boolean } // enterable = 進入 3D 場景（arena/manor）
export function findInteraction(p: { x: number; z: number }, zones: Zone[]): Zone | null; // 取距離最近且在 radius 內者
// input.ts
export function createInput(canvas: HTMLCanvasElement): { isDown(code: string): boolean; consumePressed(code: string): boolean; mouseDelta(): { x: number; y: number }; mouseButtons(): { left: boolean; right: boolean }; dispose(): void };
// town.ts
export function createTownScene(ctx: { renderer; input; hud; getState(): GameState; onInteract(zone: Zone): void }): GameScene & { colliders: Box[]; zones: Zone[]; playerPosition(): { x: number; z: number } };
```
佈局照 spec §7.1：城門（出生點，z=+40）→ 中央廣場（原點）→ 西側武器鋪與禮品攤、東側馬廄、北側城主府（z=−30）、南側廣場旁旅店、競技場在東南。城牆圍出約 100×100 m。控制：WASD 走 3 m/s、Shift 跑 6 m/s、滑鼠轉鏡頭（點 canvas 進 pointer lock）、E 互動。角色半徑 0.4 m。

- [ ] **Step 1: 寫失敗測試**

```ts
test('圓在盒外不動', () => {
  expect(resolveCircleVsBoxes({ x: 5, z: 0 }, 0.4, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }])).toEqual({ x: 5, z: 0 });
});
test('圓壓進盒子右側被推到邊界外', () => {
  const r = resolveCircleVsBoxes({ x: 1.2, z: 0 }, 0.4, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }]);
  expect(r.x).toBeCloseTo(1.4); expect(r.z).toBeCloseTo(0);
});
test('卡在兩個相鄰盒子的角落也會被推出', () => { /* 兩盒相接，結果與兩盒距離皆 ≥ radius - 1e-6 */ });
test('findInteraction 取最近的區域；範圍外回傳 null', () => {
  const zones = [{ id: 'inn', x: 0, z: 0, radius: 2 }, { id: 'stable', x: 3, z: 0, radius: 2 }] as Zone[];
  expect(findInteraction({ x: 2, z: 0 }, zones)?.id).toBe('stable');
  expect(findInteraction({ x: 10, z: 0 }, zones)).toBeNull();
});
```

- [ ] **Step 2: 測試 FAIL**
- [ ] **Step 3: 實作 collision、zones（純邏輯），再實作 input、player、camera、town（建築先用方塊＋屋頂、地面、城牆，碰撞盒由建築自動產生）**
- [ ] **Step 4: 測試 PASS；`npm run dev` 在 Chrome 中確認：可走可跑、不穿牆、靠近各建築 HUD 出現「按 E 進入武器鋪」等提示**
- [ ] **Step 5: Commit** `feat(城鎮): 新增城鎮佈局、角色移動與碰撞`

---

### Task 5: CC0 素材與載入（含武器掛點）

**Files:**
- Create: `src/world/assets.ts`、`src/world/assetManifest.ts`、`CREDITS.md`、`public/assets/**`
- Modify: `src/world/town.ts`、`src/world/player.ts`（改用正式模型與動畫）
- Test: `tests/world/assets.test.ts`

**Interfaces:**
- Produces:
```ts
export function loadModel(key: AssetKey, loader?: { loadAsync(url: string): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> }): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[]; placeholder: boolean }>;
export function attachWeapon(character: THREE.Object3D, weapon: THREE.Object3D): void; // 掛到右手骨骼，找不到骨骼則掛到角色本身右前方
export function findHandBone(root: THREE.Object3D): THREE.Object3D | null; // 名稱比對 /hand.?slot.?r|hand.?r|righthand/i
type AssetKey = keyof typeof ASSETS;
```
場景材質與天空（寫實方向）：以 Poly Haven API（`https://api.polyhaven.com/files/<id>`，curl 加 `--ssl-no-revoke`）下載 1K～2K 的 PBR 貼圖（diffuse/normal/roughness/AO，jpg）放 `public/assets/textures/<id>/`，與一張 2K HDRI（`.hdr`）放 `public/assets/hdri/`；城牆、建築牆面、屋瓦、石板路、泥土地、木板各一套。建築幾何可自行以盒子＋屋頂組合後套 PBR 材質（triplanar 或依尺寸設 UV 重複），不強求現成建築模型。
人物、馬、武器、道具素材候選（全部 CC0，下載前到原始頁面再確認授權並記入 `CREDITS.md`）：KayKit Adventurers（主角、她、競技場對手；含 `handslot.r` 骨骼與動畫）、KayKit 或 Quaternius 中世紀武器、Quaternius Animated Animal Pack（馬：Idle/Walk/Gallop）、Kenney Castle Kit／Quaternius Medieval Village（城牆、建築、攤位）。若無法以指令下載（需要瀏覽器點擊），回報給使用者並列出要下載的包與放置路徑；在此之前遊戲持續以佔位模型運作。

- [ ] **Step 1: 寫失敗測試**

```ts
test('載入失敗回傳佔位模型而不是丟例外', async () => {
  const loader = { loadAsync: async () => { throw new Error('404'); } };
  const r = await loadModel('player', loader);
  expect(r.placeholder).toBe(true);
  expect(r.scene.children.length).toBeGreaterThan(0);
});
test('findHandBone 找到 handslot.r', () => {
  const root = new THREE.Object3D(); const b = new THREE.Bone(); b.name = 'handslot.r'; root.add(b);
  expect(findHandBone(root)).toBe(b);
});
test('沒有手部骨骼時武器仍掛在角色上', () => {
  const c = new THREE.Object3D(); const w = new THREE.Object3D();
  attachWeapon(c, w); expect(w.parent).toBe(c);
});
```

- [ ] **Step 2: 測試 FAIL → Step 3: 實作 → Step 4: PASS**
- [ ] **Step 5: 下載素材、填 `CREDITS.md`（素材包名稱、作者、網址、授權 CC0、下載日期）、替換城鎮與角色模型；角色走路／跑步／待機動畫用 `AnimationMixer` 依速度切換。Chrome 中確認模型、動畫、手上武器正確**
- [ ] **Step 6: Commit** `feat(素材): 導入 CC0 中世紀素材與武器掛點`

---

### Task 6: 市集、旅店與裝備畫面

**Files:**
- Create: `src/ui/shop.ts`、`src/ui/inventory.ts`、`src/ui/inn.ts`、`src/ui/settings.ts`、`src/ui/nameEntry.ts`
- Modify: `src/main.ts`（新遊戲時先開 nameEntry；`onInteract` 對 weapon_shop/stable/gift_stall/inn 開面板；I/Tab 開裝備；Esc 開設定；每次狀態變更呼叫 autosave.notify）
- Test: `tests/ui/shop.test.ts`

**Interfaces:**
- Consumes: Task 2 economy/time、Task 3 save/saveStore
- Produces:
```ts
interface ShopRow { id: string; name: string; price: number; stats: string; owned: boolean; affordable: boolean; action: 'buy' | 'owned' }
export function weaponRows(s: GameState): ShopRow[]; horseRows(s); giftRows(s); // 禮物 action 永遠 'buy'，owned 顯示持有數量於 stats
export function openShop(root: HTMLElement, kind: 'weapon' | 'horse' | 'gift', ctx: { getState(): GameState; setState(s: GameState): void }): () => void; // 回傳關閉函式
export function openInventory(root, ctx): () => void;   // 3D 角色預覽可用小型第二個 renderer 或同 renderer 的 viewport；顯示金錢、裝備武器、擁有武器（可點裝備）、擁有馬（可設坐騎）、禮物數量
export function openInn(root, ctx): () => void;          // 「休息一晚」→ restUntilNextDay
export function openSettings(root, ctx: { getState; setState; exportSave(): void; importSave(file: File): Promise<string | null /* 錯誤訊息 */>; resetGame(): Promise<void> }): () => void;
export function openNameEntry(root, onDone: (name: string) => void): void;
```
面板開啟時釋放 pointer lock、暫停角色控制。刪除存檔需按兩次（第二次按鈕文字變「確定要刪除？再按一次」）。

- [ ] **Step 1: 寫失敗測試**

```ts
test('武器列：已擁有標 owned、買不起標 affordable=false', () => {
  const rows = weaponRows(createNewState('a'));
  expect(rows.find(r => r.id === 'rusty_sword')).toMatchObject({ owned: true, action: 'owned' });
  expect(rows.find(r => r.id === 'knight_sword')).toMatchObject({ affordable: false, action: 'buy' });
  expect(rows.find(r => r.id === 'knight_sword')!.stats).toContain('傷害 20');
});
```

- [ ] **Step 2: FAIL → Step 3: 實作 → Step 4: PASS**
- [ ] **Step 5: Chrome 中手動確認：輸入名字開始、買劍並裝備後角色手上換武器、買馬後設為坐騎、旅店過一天 HUD 天數 +1、重新整理後進度還在、匯出→刪除→匯入可還原、匯入亂寫的檔案顯示錯誤且進度不變**
- [ ] **Step 6: Commit** `feat(市集): 新增商店、旅店、裝備與設定介面`

---

### Task 7: 騎馬

**Files:**
- Create: `src/world/horse.ts`
- Modify: `src/world/town.ts`、`src/world/player.ts`（F 上下馬；騎乘時以馬速移動、角色坐在鞍上、馬播 Walk/Gallop；騎馬時按 E 於可進入建築前提示「請先下馬（F）」）
- Test: `tests/world/horse.test.ts`

**Interfaces:**
- Produces:
```ts
type MountCheck = { ok: true; horse: Horse } | { ok: false; reason: 'no_horse' | 'in_zone' };
export function canMount(s: GameState, p: { x: number; z: number }, zones: Zone[]): MountCheck; // 站在 enterable 區域內不可上馬
export function moveSpeed(s: GameState, mounted: boolean, running: boolean): number; // 步行 3 / 跑 6 / 騎乘 = horse.speed，騎乘時 Shift 再 ×1.3
export function canEnter(zone: Zone, mounted: boolean): boolean; // enterable 且騎馬 → false
```

- [ ] **Step 1: 寫失敗測試**

```ts
test('沒有坐騎不能上馬', () => expect(canMount(createNewState('a'), { x: 0, z: 0 }, [])).toEqual({ ok: false, reason: 'no_horse' }));
test('在競技場門口不能上馬', () => { /* 有 activeHorse，站在 arena zone 內 → in_zone */ });
test('騎乘速度取自馬', () => { /* activeHorse dapple_grey → moveSpeed(s,true,false)=10、(s,true,true)=13 */ });
test('騎馬時不能進入競技場與城主府，可以開商店面板', () => {
  expect(canEnter({ id: 'arena', enterable: true } as Zone, true)).toBe(false);
  expect(canEnter({ id: 'weapon_shop', enterable: false } as Zone, true)).toBe(true);
});
```

- [ ] **Step 2: FAIL → Step 3: 實作 → Step 4: PASS；Chrome 中確認上下馬、騎乘移動、門口提示**
- [ ] **Step 5: Commit** `feat(騎馬): 新增城內上下馬與騎乘移動`

---

### Task 8: 戰鬥核心與對手 AI

**Files:**
- Create: `src/config/arena.ts`、`src/combat/combat.ts`、`src/combat/ai.ts`
- Test: `tests/combat/combat.test.ts`、`tests/combat/ai.test.ts`

**Interfaces:**
- Produces:
```ts
// config/arena.ts
interface Opponent { id: string; name: string; title: string; hp: number; damage: number; windup: number; recover: number; reach: number; blockChance: number; aggression: number; prize: number; weaponKind: WeaponKind }
export const OPPONENTS: Opponent[]; // 7 位，index 6 為冠軍
export const PLAYER_HP = 100;
// combat.ts
type FighterState = 'idle' | 'windup' | 'strike' | 'recover' | 'block' | 'dodge' | 'stagger' | 'down';
interface FighterStats { hp: number; damage: number; windup: number; recover: number; reach: number }
interface Fighter { stats: FighterStats; hp: number; pos: { x: number; z: number }; facing: number; state: FighterState; stateTime: number; dodgeCooldown: number; dodgeDir: { x: number; z: number } }
interface Command { move?: { x: number; z: number }; attack?: boolean; block?: boolean; dodge?: { x: number; z: number } }
type CombatEvent = { type: 'hit'; target: 'player' | 'enemy'; damage: number } | { type: 'blocked'; target: 'player' | 'enemy' } | { type: 'miss'; target: 'player' | 'enemy' } | { type: 'end'; result: 'win' | 'loss' };
interface Bout { player: Fighter; enemy: Fighter; time: number; paused: boolean; result: 'win' | 'loss' | null }
export const MAX_DT = 0.1, STRIKE_TIME = 0.1, STAGGER_TIME = 0.4, DODGE_TIME = 0.35, DODGE_COOLDOWN = 1.0, DODGE_SPEED = 6, MOVE_SPEED = 3, BLOCK_ARC_DEG = 120, ARENA_RADIUS = 12, START_DISTANCE = 6;
export function weaponStats(w: Weapon): FighterStats;   // hp = PLAYER_HP
export function opponentStats(o: Opponent): FighterStats;
export function createBout(player: FighterStats, enemy: FighterStats): Bout;
export function stepBout(b: Bout, dt: number, playerCmd: Command, enemyCmd: Command): CombatEvent[]; // 會修改 b
// ai.ts
export function decideEnemy(b: Bout, o: Opponent, rng: () => number): Command;
```
規則：`attack` 只在 idle/block 時生效 → windup（stats.windup 秒）→ strike（STRIKE_TIME，進入 strike 的那一刻判定一次命中）→ recover → idle。命中條件：距離 ≤ reach 且目標在攻擊者面向 ±60° 內。目標 dodge 中 → miss；目標 block 中且攻擊者在目標面向 ±(BLOCK_ARC_DEG/2) 內 → blocked（無傷害，攻擊者進入 stagger）；否則扣血、目標 stagger（打斷其 windup）。hp ≤ 0 → down，產生 end 事件。雙方自動面向對方；位置夾在 ARENA_RADIUS 內。`paused` 為 true 時 stepBout 不做事。dt 先夾到 MAX_DT。

對手初始值：

| # | 名稱 | hp | 傷害 | windup | recover | reach | 格擋率 | 積極度 | 獎金 |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 農家小子 | 40 | 6 | 0.8 | 0.6 | 1.5 | 0.05 | 0.3 | 30 |
| 1 | 酒館打手 | 55 | 8 | 0.7 | 0.55 | 1.5 | 0.1 | 0.4 | 50 |
| 2 | 傭兵 | 70 | 10 | 0.65 | 0.5 | 1.7 | 0.2 | 0.5 | 80 |
| 3 | 城衛隊長 | 85 | 12 | 0.6 | 0.45 | 1.8 | 0.3 | 0.55 | 120 |
| 4 | 流浪劍客 | 100 | 14 | 0.5 | 0.4 | 1.8 | 0.4 | 0.65 | 180 |
| 5 | 北境斧手 | 120 | 18 | 0.65 | 0.5 | 1.6 | 0.35 | 0.75 | 250 |
| 6 | 競技場冠軍 | 150 | 18 | 0.45 | 0.35 | 2.0 | 0.5 | 0.8 | 500 |

- [ ] **Step 1: 寫失敗測試**

```ts
const P = { hp: 100, damage: 10, windup: 0.4, recover: 0.3, reach: 2 };
const E = { hp: 30, damage: 5, windup: 0.5, recover: 0.3, reach: 2 };
function closeBout() { const b = createBout(P, E); b.enemy.pos = { x: 0, z: -1.5 }; b.player.pos = { x: 0, z: 0 }; return b; }
const run = (b: Bout, secs: number, p: Command = {}, e: Command = {}) => { const ev: CombatEvent[] = []; for (let t = 0; t < secs; t += 0.05) ev.push(...stepBout(b, 0.05, p, e)); return ev; };
test('攻擊在 windup 後命中並扣血', () => {
  const b = closeBout(); stepBout(b, 0.05, { attack: true }, {});
  const ev = run(b, 0.5);
  expect(ev).toContainEqual({ type: 'hit', target: 'enemy', damage: 10 });
  expect(b.enemy.hp).toBe(20);
});
test('距離超過 reach 揮空', () => { /* enemy z=-5 → miss，hp 不變 */ });
test('正面格擋無傷害且攻擊者硬直', () => { /* enemy 持續 block → blocked 事件、enemy.hp 不變、player.state 經過 stagger */ });
test('閃避中不受傷，閃避有冷卻', () => { /* enemy 於命中前 dodge → miss；冷卻內再次 dodge 無效 */ });
test('被打中會打斷 windup', () => { /* 雙方同時 attack，player windup 較短先中 → enemy 進入 stagger 且其攻擊不產生 hit */ });
test('血量歸零結束', () => { /* 連續攻擊 → 事件含 { type:'end', result:'win' }，b.result==='win'，之後 stepBout 回傳空陣列 */ });
test('dt 尖峰被夾住：一次 step 5 秒不會讓攻擊直接結算', () => {
  const b = closeBout(); stepBout(b, 0.05, { attack: true }, {}); stepBout(b, 5, {}, {});
  expect(b.enemy.hp).toBe(30); // 只前進 0.1 秒，仍在 windup
});
test('暫停時不前進', () => { const b = closeBout(); b.paused = true; stepBout(b, 0.05, { attack: true }, {}); expect(b.player.state).toBe('idle'); });
// ai.test.ts
test('AI 決策可重現（相同 rng 序列相同指令）', () => { /* 兩次以相同種子 rng 呼叫結果相等 */ });
test('遠距離時 AI 會靠近；玩家 windup 中且 rng < blockChance 時格擋', () => { /* 斷言 move 朝向玩家、block true */ });
test('冠軍在 100 場模擬中對「站著不動的玩家」勝率 100%，農家小子對「每 0.6 秒攻擊一次的玩家」勝率 < 20%', () => { /* 以 decideEnemy 與簡單玩家腳本跑 stepBout，確保難度遞增有意義 */ });
```

- [ ] **Step 2: FAIL → Step 3: 實作 → Step 4: PASS**
- [ ] **Step 5: Commit** `feat(戰鬥): 新增競技場戰鬥規則與對手 AI`

---

### Task 9: 競技場場景與戰績結算

**Files:**
- Create: `src/core/arenaProgress.ts`、`src/world/arenaScene.ts`
- Modify: `src/main.ts`（town 的 arena zone 進入 → 顯示下一位對手與獎金 →「上場」切到 arena 場景；結束後回城並 autosave；分頁隱藏時 `bout.paused = true`）
- Test: `tests/core/arenaProgress.test.ts`

**Interfaces:**
- Consumes: Task 8 `createBout/stepBout/decideEnemy/OPPONENTS`、Task 2 `getWeapon`
- Produces:
```ts
export const ARENA_WIN_AFFECTION = 2, ARENA_CHAMPION_AFFECTION = 10;
export function recordBout(s: GameState, result: 'win' | 'loss'): { state: GameState; prize: number; affectionBonus: number };
```
勝：加獎金、`nextOpponent + 1`、好感 +2；擊敗 index 6 → `champion = true`、好感額外 +10（共 +12）；冠軍後再戰對手固定為冠軍、獎金減半、不再給好感。敗：狀態完全不變（不扣錢、不晉級；天數只由旅店推進）。好感夾在 0～100。
場景：圓形沙地（半徑 12）＋看台；左鍵揮砍、右鍵按住格擋、空白鍵朝移動方向閃避、WASD 移動；畫面上方雙方血條；命中時鏡頭輕震＋受擊閃白；結束畫面顯示勝負與獎金，按 E 回城。

- [ ] **Step 1: 寫失敗測試**

```ts
test('勝利拿獎金、晉級、加好感', () => {
  const r = recordBout(createNewState('a'), 'win');
  expect(r).toMatchObject({ prize: 30, affectionBonus: 2 });
  expect(r.state.gold).toBe(80); expect(r.state.arena.nextOpponent).toBe(1);
});
test('擊敗冠軍成為冠軍並加 12 好感', () => { /* nextOpponent=6 → champion true，affectionBonus 12 */ });
test('冠軍後再戰：獎金減半、不加好感、nextOpponent 不超過 6', () => { /* prize 250、affectionBonus 0 */ });
test('落敗不扣錢不晉級', () => { /* gold、nextOpponent 不變，prize 0 */ });
test('好感不超過 100', () => { /* affection 95 擊敗冠軍 → 100 */ });
```

- [ ] **Step 2: FAIL → Step 3: 實作 → Step 4: PASS**
- [ ] **Step 5: Chrome 中實打：能贏第一位、輸了可重打、切分頁回來比賽沒有被瞬間結算、不同武器手感（斧慢、槍遠）可感受到差異**
- [ ] **Step 6: Commit** `feat(競技場): 新增競技場場景與戰績獎金結算`

---

### Task 10: 好感度規則、送禮與求婚

**Files:**
- Create: `src/config/romance.ts`、`src/romance/affection.ts`
- Test: `tests/romance/affection.test.ts`

**Interfaces:**
- Produces:
```ts
// config/romance.ts
interface Topic { id: string; keywords: string[] }
interface Persona { name: string; title: string; age: number; bio: string; speechStyle: string; likes: Topic[]; dislikes: Topic[]; favoriteGiftTags: string[]; likedGiftTags: string[]; dislikedGiftTags: string[] }
export const LADY: Persona; // 原創：名「艾琳娜」，城主之女，24 歲，愛讀詩、觀星、照顧花園、喜歡甜點；討厭炫耀殺戮與炫富、粗話
export const STAGES: { id: 'stranger' | 'acquainted' | 'friendly' | 'smitten' | 'ready'; name: string; min: number }[];
// [陌生 0, 熟識 15, 友好 35, 傾心 60, 可以求婚 85]
export const DAILY_CHAT_LIMIT = 8, LIKE_TOPIC_BONUS = 3, DISLIKE_TOPIC_PENALTY = -3, MESSAGE_DELTA_MIN = -4, MESSAGE_DELTA_MAX = 4;
export const GIFT_DELTA = { favorite: 8, liked: 4, neutral: 1, disliked: -3 }, PROPOSAL_REJECT_PENALTY = -5, MEMORY_LIMIT = 12;
// affection.ts
export function getStage(affection: number): (typeof STAGES)[number];
export function scoreMessage(text: string, p: Persona, topicsToday: string[]): { delta: number; matchedLikes: string[]; matchedDislikes: string[] };
export function applyChat(s: GameState, playerText: string, ladyReply: string, nudge: number): { state: GameState; delta: number } | { error: 'daily_limit' };
export function giveGift(s: GameState, giftId: string): { state: GameState; delta: number } | { error: 'not_owned' | 'already_gifted_today' | 'ring_is_for_proposal' };
export function propose(s: GameState): { state: GameState; accepted: boolean; reason: 'accepted' | 'no_ring' | 'not_ready' | 'already_married' };
```
規則：
- `scoreMessage`：每個喜好話題每天只計一次 +3（記入 `topicsToday`）；禁忌每次 −3。
- `applyChat`：`delta = clamp(rule + clamp(round(nudge), -1, 1), -4, 4)`；好感夾 0～100；`chatsToday + 1`；`memory` 追加玩家句與她的回覆，超過 `MEMORY_LIMIT` 丟最舊的。已婚：不受每日上限。
- `giveGift`：每天一次；消耗一個；戒指不能當禮物送。
- `propose`：需持有戒指且好感 ≥ 85 → 接受、`married = true`、消耗戒指；好感不足 → 拒絕、−5、戒指保留；沒戒指 → `no_ring`，好感不變。

- [ ] **Step 1: 寫失敗測試**

```ts
test('階段門檻', () => { expect(getStage(14).id).toBe('stranger'); expect(getStage(15).id).toBe('acquainted'); expect(getStage(85).id).toBe('ready'); });
test('喜好話題每天只加一次', () => {
  const a = scoreMessage('昨晚的星空好美', LADY, []); expect(a.delta).toBe(3);
  const b = scoreMessage('又看到星星了', LADY, a.matchedLikes); expect(b.delta).toBe(0);
});
test('禁忌話題扣分', () => expect(scoreMessage('我在競技場把對手打到見血', LADY, []).delta).toBeLessThan(0));
test('AI 微調被限制在 ±1，單句總和限制在 ±4', () => {
  const s = createNewState('a');
  expect((applyChat(s, '你好', '你好', 9) as any).delta).toBe(1);
  /* 一句同時命中兩個喜好（+6）+ nudge 1 → delta 4 */
});
test('每日上限 8 句', () => { /* chatsToday=8 → { error:'daily_limit' } */ });
test('已婚不受每日上限', () => { /* married=true, chatsToday=8 → 正常回傳 */ });
test('記憶只保留最近 12 筆', () => { /* 連聊 10 次 → memory.length === 12 */ });
test('送禮：最愛 +8、討厭 −3、一天一次、戒指不能送', () => {
  /* astrolabe → 8；隔天 dagger → −3；同日第二次 → already_gifted_today；engagement_ring → ring_is_for_proposal */
});
test('求婚：沒戒指、好感不足扣 5 保留戒指、成功結婚並消耗戒指', () => { /* 三種情境 */ });
```

- [ ] **Step 2: FAIL → Step 3: 實作（關鍵詞用 `includes` 比對；禁忌關鍵詞例：血、殺、宰了、錢多、有錢、蠢、滾）→ Step 4: PASS**
- [ ] **Step 5: Commit** `feat(戀愛): 新增好感度規則、送禮與求婚判定`

---

### Task 11: AI 對話（WebLLM）與城主府

**Files:**
- Create: `src/romance/prompt.ts`、`src/romance/llmClient.ts`、`src/romance/llm.worker.ts`、`src/romance/conversation.ts`、`src/ui/chat.ts`、`src/ui/loading.ts`、`src/world/manorScene.ts`
- Modify: `src/main.ts`（啟動後背景開始載入模型；HUD 顯示下載進度；manor zone 進入城主府場景）、`src/ui/settings.ts`（模型選擇：標準 1.5B／較聰明 3B）
- Test: `tests/romance/prompt.test.ts`、`tests/romance/llmClient.test.ts`、`tests/romance/conversation.test.ts`

**Interfaces:**
- Consumes: Task 10 `applyChat/giveGift/propose/getStage/LADY`、Task 2 `getWeapon`、Task 3 autosave
- Produces:
```ts
// prompt.ts
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export function buildMessages(s: GameState, p: Persona, userText: string): ChatMessage[];
export function parseModelReply(raw: string): { reply: string; nudge: number } | null;
export function isAcceptableReply(reply: string): boolean;
export function validatePlayerMessage(raw: string): string | null; // trim，空白 → null，截 200 字
export const FALLBACK_REPLIES: string[]; // 5 句符合人設的正體中文備用回覆
// llmClient.ts
type LlmStatus = { kind: 'idle' } | { kind: 'loading'; progress: number; text: string } | { kind: 'ready' } | { kind: 'generating' } | { kind: 'error'; message: string };
interface Engine { chat(messages: ChatMessage[]): Promise<string> }
type EngineFactory = (modelId: string, onProgress: (p: number, text: string) => void) => Promise<Engine>;
export const MODEL_STANDARD_F16 = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', MODEL_STANDARD_F32 = 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', MODEL_SMART_F16 = 'Qwen2.5-3B-Instruct-q4f16_1-MLC', MODEL_SMART_F32 = 'Qwen2.5-3B-Instruct-q4f32_1-MLC';
export function pickModel(features: ReadonlySet<string>, tier: 'standard' | 'smart'): string; // 有 'shader-f16' 用 f16
export class LlmClient { constructor(factory: EngineFactory); get status(): LlmStatus; onStatus(cb: (s: LlmStatus) => void): () => void; load(modelId: string): Promise<void>; chat(messages: ChatMessage[]): Promise<string>; }
export const webWorkerEngineFactory: EngineFactory; // CreateWebWorkerMLCEngine(new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' }), modelId, { initProgressCallback })；chat 呼叫 engine.chat.completions.create({ messages, temperature: 0.8, max_tokens: 200, response_format: { type: 'json_object' } })
// conversation.ts
type TalkResult = { kind: 'reply'; reply: string; delta: number; state: GameState } | { kind: 'rejected'; reason: 'empty' | 'busy' | 'daily_limit' | 'llm_unavailable' };
export function talk(s: GameState, rawText: string, llm: Pick<LlmClient, 'status' | 'chat'>): Promise<TalkResult>;
```
提示要點（`buildMessages` 的 system 內容）：她的人設與說話風格、目前好感階段名稱與該階段的態度（陌生＝禮貌疏離 … 可以求婚＝明顯傾心；已婚＝妻子）、玩家名字、競技場戰績（第幾關、是否冠軍）、目前武器名稱、今天第幾天；規則：「只用正體中文、一律以艾琳娜的身分回答、不提自己是 AI、回覆 1～3 句」；輸出格式：`{"reply": "...", "nudge": -1|0|1}`（nudge 代表玩家這句話是否有禮貌、用心）。歷史訊息取自 `s.romance.memory`。玩家名字與訊息原文放入，不做額外處理。
`isAcceptableReply`：非空、≤ 300 字、CJK 字元佔非空白字元 ≥ 50%、不含常見簡體專用字（如「们这说话时为对过还没么让给门问间听见东车钱实觉谢欢爱」任一）。
`talk` 流程：`validatePlayerMessage` → null 回 `empty`；`llm.status.kind === 'generating'` 回 `busy`；非 ready 回 `llm_unavailable`；`chatsToday` 已達上限且未婚回 `daily_limit`（不呼叫模型）；呼叫 chat → parse → 不合格重試一次 → 仍不合格用 `FALLBACK_REPLIES` 隨機一句、nudge 0 → `applyChat`。
`LlmClient`：`load` 期間 loading（progress 0～1）；factory 丟例外 → error（訊息正體中文，含「重試」說明），再次 `load` 可恢復；`chat` 期間 generating，結束回 ready；chat 失敗回 ready 並拋出。
城主府場景：大廳、艾琳娜 NPC 待機動畫；靠近按 E 開聊天視窗（訊息列表、輸入框、送出鈕、送禮下拉、求婚按鈕、顯示好感階段名稱與今日剩餘次數，不顯示數字）；模型未就緒時聊天視窗顯示下載進度或錯誤＋重試按鈕。生成期間送出鈕停用。

- [ ] **Step 1: 確認模型 ID 存在**：`node -e "import('@mlc-ai/web-llm').then(m=>console.log(m.prebuiltAppConfig.model_list.map(x=>x.model_id).filter(i=>i.startsWith('Qwen2.5-')).join('\n')))"`，預期包含上列四個 ID；若名稱不同，以實際清單中最接近的 Qwen2.5 1.5B／3B 指令版替換常數。
- [ ] **Step 2: 寫失敗測試**

```ts
// prompt.test.ts
test('validatePlayerMessage', () => {
  expect(validatePlayerMessage('   ')).toBeNull();
  expect(Array.from(validatePlayerMessage('字'.repeat(300))!).length).toBe(200);
});
test('parseModelReply 解析 JSON、容忍前後雜訊、格式錯回 null', () => {
  expect(parseModelReply('{"reply":"你好","nudge":1}')).toEqual({ reply: '你好', nudge: 1 });
  expect(parseModelReply('好的：{"reply":"嗯","nudge":0} ')).toEqual({ reply: '嗯', nudge: 0 });
  expect(parseModelReply('just text')).toBeNull();
});
test('isAcceptableReply 擋簡體、英文、空白、過長', () => {
  expect(isAcceptableReply('今晚的星空真美呢。')).toBe(true);
  expect(isAcceptableReply('我们去看星星吧')).toBe(false);
  expect(isAcceptableReply('Sure! As an AI...')).toBe(false);
  expect(isAcceptableReply('')).toBe(false);
});
test('system 提示含名字、階段、戰績與正體中文規則；名字原文不被轉義', () => {
  const s = { ...createNewState('<b>亞瑟</b>'), arena: { nextOpponent: 3, champion: false } };
  const sys = buildMessages(s, LADY, '你好')[0].content;
  expect(sys).toContain('<b>亞瑟</b>'); expect(sys).toContain('陌生'); expect(sys).toContain('正體中文');
});
// llmClient.test.ts
test('載入失敗 → error，重試成功 → ready', async () => {
  let fail = true;
  const c = new LlmClient(async () => { if (fail) throw new Error('OOM'); return { chat: async () => '{}' }; });
  await c.load('m'); expect(c.status.kind).toBe('error');
  fail = false; await c.load('m'); expect(c.status.kind).toBe('ready');
});
test('pickModel 依 shader-f16 選版本', () => {
  expect(pickModel(new Set(['shader-f16']), 'standard')).toBe(MODEL_STANDARD_F16);
  expect(pickModel(new Set(), 'smart')).toBe(MODEL_SMART_F32);
});
// conversation.test.ts（假 llm）
test('空白訊息不呼叫模型、不扣次數', async () => { /* chat 未被呼叫；kind rejected/empty */ });
test('生成中再送出回 busy', async () => { /* status generating → busy */ });
test('模型未就緒回 llm_unavailable', async () => {});
test('達每日上限不呼叫模型', async () => {});
test('回覆不合格會重試一次，再不合格用備用句', async () => { /* chat 回兩次簡體 → reply ∈ FALLBACK_REPLIES，chat 被呼叫 2 次 */ });
test('正常回覆套用好感', async () => { /* '{"reply":"謝謝你送的花","nudge":1}'，玩家說「我帶了花給你」→ delta 4（花 +3、nudge +1） */ });
```

- [ ] **Step 3: FAIL → Step 4: 實作 → Step 5: PASS**
- [ ] **Step 6: Chrome 中確認**：首次載入有進度、下載中仍可逛街打競技場；進城主府能聊天、回覆是正體中文且符合人設；生成時畫面仍可操作（若 FPS 明顯低於 30，生成期間把 `renderer.setPixelRatio` 降到 0.75，結束還原）；重新整理後模型從快取快速載入；在 DevTools 模擬離線重新整理，聊天顯示錯誤與重試。
- [ ] **Step 7: Commit** `feat(城主府): 新增本機 AI 對話與城主府場景`

---

### Task 12: 婚禮過場與婚後

**Files:**
- Create: `src/world/wedding.ts`
- Modify: `src/ui/chat.ts`（求婚結果）、`src/main.ts`（accepted → 切到 wedding 場景 → 結束回 town）、`src/world/manorScene.ts`（已婚時她改用妻子人設；`buildMessages` 已依 `married` 切換）
- Test: `tests/world/wedding.test.ts`

**Interfaces:**
- Consumes: Task 10 `propose`、Task 11 chat UI
- Produces:
```ts
interface Shot { duration: number; from: [number, number, number]; to: [number, number, number]; lookAt: [number, number, number]; caption: string }
export function weddingShots(playerName: string, ladyName: string): Shot[]; // 4～6 鏡，總長 15～25 秒，字幕含兩人名字，最後一句為「從此，{玩家}與{艾琳娜}在城裡過著幸福的日子。」
export function shotAt(shots: Shot[], t: number): { index: number; local: number } | null; // 超過總長回 null
export function createWeddingScene(ctx): GameScene & { onFinish(cb: () => void): void }; // 任意鍵可跳過
```

- [ ] **Step 1: 寫失敗測試**

```ts
test('鏡頭總長 15～25 秒且字幕帶名字', () => {
  const shots = weddingShots('亞瑟', '艾琳娜'); const total = shots.reduce((a, s) => a + s.duration, 0);
  expect(total).toBeGreaterThanOrEqual(15); expect(total).toBeLessThanOrEqual(25);
  expect(shots.at(-1)!.caption).toBe('從此，亞瑟與艾琳娜在城裡過著幸福的日子。');
});
test('shotAt 切換正確，超過總長回 null', () => { /* t=0 → index 0；t=第一鏡長度+0.01 → index 1；t=total+1 → null */ });
```

- [ ] **Step 2: FAIL → Step 3: 實作（廣場佈置花拱門、兩人站定、鏡頭插值）→ Step 4: PASS**
- [ ] **Step 5: Chrome 中以存檔編修（設定頁匯入一份好感 90、持有戒指的存檔）走完求婚 → 婚禮 → 回城，重新整理後仍為已婚、她以妻子口吻回話**
- [ ] **Step 6: Commit** `feat(婚禮): 新增求婚成功後的婚禮過場`

---

### Task 13: Compute shader 草地

**Files:**
- Create: `src/world/grass.ts`
- Modify: `src/world/town.ts`（廣場以外的空地鋪草，避開道路與建築碰撞盒）
- Test: `tests/world/grass.test.ts`

**Interfaces:**
- Consumes: Task 4 `Box`
- Produces:
```ts
export function scatterGrass(area: Box, exclude: Box[], count: number, rng: () => number): Float32Array; // [x, z, x, z, ...]，不落在 exclude 內
export function createGrass(renderer: THREE.WebGPURenderer, positions: Float32Array): { mesh: THREE.Mesh; update(time: number): void };
```
`createGrass`：以 TSL `instancedArray` 存每根草的位置與擺動狀態，`Fn(...)().compute(count)` 每幀依風（時間＋位置雜訊）與玩家位置（靠近時被推開）更新彎曲量，`renderer.compute(node)` 執行；草葉幾何為 3～5 段三角帶，以 `positionNode` 讀取 storage buffer 決定實例位置與彎曲。數量以 50,000 為起點，FPS < 50 時調降。

- [ ] **Step 1: 寫失敗測試**

```ts
test('草不會長在建築裡、數量正確、可重現', () => {
  const rng = mulberry32(1);
  const p = scatterGrass({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, [{ minX: -2, maxX: 2, minZ: -2, maxZ: 2 }], 500, rng);
  expect(p.length).toBe(1000);
  for (let i = 0; i < p.length; i += 2) expect(Math.abs(p[i]) <= 2 && Math.abs(p[i + 1]) <= 2).toBe(false);
});
```
（`mulberry32` 為測試內的小型種子亂數函式。）

- [ ] **Step 2: FAIL → Step 3: 實作 → Step 4: PASS**
- [ ] **Step 5: Chrome 中確認草隨風擺動、角色走過草被推開、DevTools Performance 中 FPS ≥ 50（不足就降數量並記錄最終值）**
- [ ] **Step 6: Commit** `feat(城鎮): 新增 compute shader 驅動的隨風草地`

---

### Task 14: 寫實渲染與畫質設定

**Files:**
- Create: `src/world/rendering.ts`、`src/config/quality.ts`
- Modify: `src/main.ts`（以 `RenderPipeline`／`PostProcessing` 取代直接 render）、`src/game.ts`、`src/world/town.ts`、`src/world/arenaScene.ts`、`src/world/manorScene.ts`（共用環境設定）、`src/ui/settings.ts`（畫質選單，存在 localStorage `castle-life/quality`，不進遊戲存檔）
- Test: `tests/config/quality.test.ts`

**Interfaces:**
- Produces:
```ts
type QualityLevel = 'high' | 'medium' | 'low';
interface QualityPreset { pixelRatioCap: number; shadowMapSize: number; ao: boolean; bloom: boolean; grassCount: number; textureMaxSize: 1024 | 2048 }
export const QUALITY: Record<QualityLevel, QualityPreset>;
// high: 2, 2048, true, true, 50000, 2048；medium: 1.5, 1024, true, false, 25000, 2048；low: 1, 512, false, false, 8000, 1024
export function loadQualityLevel(storage: Pick<Storage, 'getItem'>): QualityLevel; // 無值或非法值 → 'medium'
export function applyEnvironment(scene: THREE.Scene, opts: { hdri: THREE.Texture; fogColor: number; fogNear: number; fogFar: number }): void;
export function createSun(preset: QualityPreset): THREE.DirectionalLight; // castShadow，陰影相機跟隨玩家
export function createPostProcessing(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, preset: QualityPreset): { render(): void; setSize(w: number, h: number): void };
```
`Game` 改為每個場景透過 `createPostProcessing` 輸出（ACES 色調映射＋視 preset 開 AO〔TSL `ao`〕與 bloom〔TSL `bloom`〕）。Task 13 的草量改讀 `QualityPreset.grassCount`。

- [ ] **Step 1: 寫失敗測試**

```ts
test('畫質預設值', () => {
  expect(loadQualityLevel({ getItem: () => null })).toBe('medium');
  expect(loadQualityLevel({ getItem: () => 'ultra' })).toBe('medium');
  expect(loadQualityLevel({ getItem: () => 'low' })).toBe('low');
});
test('高畫質比低畫質陰影解析度高、草多', () => {
  expect(QUALITY.high.shadowMapSize).toBeGreaterThan(QUALITY.low.shadowMapSize);
  expect(QUALITY.high.grassCount).toBeGreaterThan(QUALITY.low.grassCount);
  expect(QUALITY.low.ao).toBe(false);
});
```

- [ ] **Step 2: FAIL → Step 3: 實作 → Step 4: PASS**
- [ ] **Step 5: 瀏覽器中三種畫質各截一張圖比對，確認 HDRI 天空、陰影、霧、AO 生效、主控台無錯誤；記錄三種畫質的 FPS**
- [ ] **Step 6: Commit** `feat(畫面): 新增寫實光影後製與畫質設定`

---

### Task 15: 整體驗收

**Files:**
- Modify: 依驗收發現的問題修正
- Create: `README.md`（啟動方式：`NODE_OPTIONS=--use-system-ca npm install`、`npm run dev`、Chrome 開啟；操作鍵位表；存檔說明）

- [ ] **Step 1: `npm test` 全部 PASS、`npm run build` 無型別錯誤**
- [ ] **Step 2: 在 Chrome（使用者實機 GPU）從新遊戲完整走一輪**：取名 → 逛城 → 打前三位對手 → 買武器、買馬、騎馬 → 進城主府聊天送禮 → 旅店過夜 → 匯出存檔 → 重新整理確認進度 → 以匯入的高好感存檔求婚 → 婚禮 → 婚後聊天。過程中主控台無錯誤。
- [ ] **Step 3: 檢查 Review Focus 五項在實機上的行為與預期一致**
- [ ] **Step 4: 確認 `CREDITS.md` 涵蓋 `public/assets` 下每一個素材包**
- [ ] **Step 5: Commit** `docs: 新增遊戲啟動與操作說明`
