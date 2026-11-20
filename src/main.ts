import * as THREE from 'three/webgpu';
import './ui/styles.css';
import { detectWebGPU } from './boot/webgpu';
import { showUnsupported } from './ui/unsupported';
import { createHud } from './ui/hud';
import { Game } from './game';
import { createInput } from './world/input';
import { createTownScene } from './world/town';
import { createNewState, type GameState } from './core/state';
import { applySceneTextures } from './world/textures';
import { createAutosave, deleteSave, downloadSaveFile, loadSave, writeSave } from './core/saveStore';
import { parseSave } from './core/save';
import { createPanelHost } from './ui/dom';
import type { UiContext } from './ui/context';
import { openShop } from './ui/shop';
import { openInn } from './ui/inn';
import { openInventory } from './ui/inventory';
import { openSettings } from './ui/settings';
import { openNameEntry } from './ui/nameEntry';
import type { Zone } from './world/zones';
import { createArenaScene } from './world/arenaScene';
import { townZones } from './world/townLayout';
import { getWeapon } from './config/items';
import { currentOpponentIndex, recordBout } from './core/arenaProgress';
import { openArenaGate } from './ui/arenaGate';
import { createManorScene } from './world/manorScene';
import { LlmClient, pickModel, webWorkerEngineFactory, type ModelTier } from './romance/llmClient';
import { openChat } from './ui/chat';
import { h } from './ui/dom';
import { createWeddingScene } from './world/wedding';
import { LADY } from './config/romance';
import { createGrass } from './world/grass';
import { scatterGrass } from './world/grassScatter';
import { grassExclusions, TOWN_LAYOUT } from './world/townLayout';
import { loadQualityLevel, QUALITY, QUALITY_KEY, type QualityLevel } from './config/quality';
import { applyEnvironment, loadSky } from './world/rendering';


function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function boot(): Promise<void> {
  const ui = document.getElementById('ui')!;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const check = await detectWebGPU();
  if (!check.ok) return showUnsupported(ui, check.reason);

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  await renderer.init();
  if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
    return showUnsupported(ui, 'not_webgpu_backend');
  }

  const hud = createHud(ui);
  hud.setBackend('WebGPU');
  const input = createInput(canvas);
  const autosave = createAutosave(writeSave);

  const saved = await loadSave();
  let state: GameState = saved ?? createNewState('旅人');
  const needsName = !saved;

  const refreshHud = () => {
    hud.setGold(state.gold);
    hud.setDay(state.day);
  };

  const panels = createPanelHost(ui, (open) => input.setEnabled(!open));
  const uiCtx: UiContext = {
    panels,
    getState: () => state,
    setState: (s) => {
      const weaponChanged = s.equippedWeapon !== state.equippedWeapon;
      state = s;
      refreshHud();
      autosave.notify(state);
      if (weaponChanged) {
        town.refreshEquipment();
        manor.refreshEquipment();
      }
    },
    toast: (t) => hud.toast(t),
  };

  const onInteract = (zone: Zone) => {
    switch (zone.id) {
      case 'weapon_shop': return openShop(uiCtx, 'weapon');
      case 'stable': return openShop(uiCtx, 'horse');
      case 'gift_stall': return openShop(uiCtx, 'gift');
      case 'inn': return openInn(uiCtx);
      case 'arena': return openArenaGate(uiCtx, () => void enterArena());
      case 'manor': return void enterManor();
    }
  };

  // ── 對話模型（背景載入，下載期間其他玩法照常） ──
  const features = new Set<string>(check.adapter.features as unknown as Iterable<string>);
  const tierKey = 'castle-life/model-tier';
  const llm = new LlmClient(webWorkerEngineFactory);
  const loadModel = () => void llm.load(pickModel(features, (localStorage.getItem(tierKey) as ModelTier) || 'standard'));
  llm.onStatus((s) => {
    // AI 生成時畫面降到約 6 fps，把顯示卡讓給模型
    game.setRenderThrottle(s.kind === 'generating' ? 10 : 1);
    if (s.kind === 'loading') hud.setStatus(s.text === '暖機中' ? '｜對話模型暖機中' : `｜對話模型 ${Math.round(s.progress * 100)}%`);
    else if (s.kind === 'error') hud.setStatus('｜對話模型載入失敗');
    else hud.setStatus(null);
  });

  const enterManor = async () => {
    input.setEnabled(false);
    await manor.ready;
    game.switchScene('manor');
    input.setEnabled(true);
  };

  const leaveManor = () => {
    game.switchScene('town');
    const door = townZones().find((z) => z.id === 'manor')!;
    town.player.teleport(door.x, door.z + 1.5, 0);
    town.follow.yaw = 0;
  };

  const talkToLady = () => {
    manor.chatMode = true;
    openChat(uiCtx, {
      llm,
      retryLoad: loadModel,
      onLadySpeak: (k) => manor.ladyReact(k),
      onProposalAccepted: () => void onProposalAccepted(),
      onClose: () => (manor.chatMode = false),
    });
  };

  const onProposalAccepted = async () => {
    manor.chatMode = false;
    input.setEnabled(false);
    void autosave.flush();
    await wedding.start(state.playerName, LADY.name, () => {
      game.switchScene('town');
      town.player.teleport(0, -3, 0);
      town.follow.yaw = 0;
      input.setEnabled(true);
      hud.toast(`恭喜！你和${LADY.name}結婚了。她還住在城主府，隨時可以去找她聊天。`);
    });
    game.switchScene('wedding');
  };

  const enterArena = async () => {
    const weapon = getWeapon(state.equippedWeapon)!;
    const idx = currentOpponentIndex(state);
    input.setEnabled(false);
    await arena.start({
      playerName: state.playerName,
      playerWeapon: weapon,
      opponentIndex: idx,
      onFinish: (result) => {
        const r = recordBout(state, result);
        uiCtx.setState(r.state);
        game.switchScene('town');
        const door = townZones().find((z) => z.id === 'arena')!;
        town.player.teleport(door.x - 1.5, door.z, -Math.PI / 2);
        if (result === 'win') {
          hud.toast(r.state.arena.champion && r.affectionBonus > 0 ? `你成為競技場冠軍！獲得 ${r.prize} 金幣，全城都在談論你。` : `勝利！獲得 ${r.prize} 金幣。`);
        } else hud.toast('這次輸了。休息一下再來挑戰吧。');
      },
    });
    game.switchScene('arena');
    input.setEnabled(true);
  };

  let quality: QualityLevel = loadQualityLevel(localStorage);
  const game = new Game(renderer, QUALITY[quality]);
  const town = createTownScene({ input, hud, getState: () => state, onInteract });
  game.registerScene('town', town);
  // Compute shader 草地（城牆內、避開道路與建築）
  const grassRng = mulberry32(2026);
  const H = TOWN_LAYOUT.halfSize - 1;
  const grass = createGrass(renderer, scatterGrass({ minX: -H, maxX: H, minZ: -H, maxZ: H }, grassExclusions(), QUALITY[quality].grassCount, grassRng), grassRng);
  town.scene.add(grass.mesh);
  let grassTime = 0;
  town.afterUpdate.push((dt) => {
    grassTime += dt;
    grass.update(grassTime, town.playerPosition());
  });

  const arena = createArenaScene({ input, hud, ui });
  game.registerScene('arena', arena);
  const manor = createManorScene({ input, hud, getState: () => state, onTalk: talkToLady, onLeave: leaveManor });
  game.registerScene('manor', manor);
  const wedding = createWeddingScene(town.scene, hud, ui);
  game.registerScene('wedding', wedding);
  const [sky] = await Promise.all([loadSky(), applySceneTextures(renderer.getMaxAnisotropy?.() ?? 8), town.ready]);
  applyEnvironment(town.scene, { hdri: sky, asBackground: true, environmentIntensity: 0.55, fog: { color: 0xc4d3df, near: 70, far: 260 } });
  applyEnvironment(arena.scene, { hdri: sky, asBackground: true, environmentIntensity: 0.55, fog: { color: 0xc4d3df, near: 60, far: 200 } });
  applyEnvironment(manor.scene, { hdri: sky, asBackground: false, environmentIntensity: 0.2 });
  game.switchScene('town');
  refreshHud();
  game.start();
  loadModel();

  // 全域快捷鍵（面板關閉時才作用；input 在面板開啟時會停用）
  game.onFrame(() => {
    if (panels.isOpen() || game.currentName !== 'town') return;
    if (input.consumePressed('KeyI') || input.consumePressed('Tab')) {
      openInventory(uiCtx, (on) => (town.previewMode = on));
    }
    if (input.consumePressed('Escape')) {
      openSettings(uiCtx, {
        exportSave: () => downloadSaveFile(state),
        importSave: async (file) => {
          const r = parseSave(await file.text());
          if (!r.ok) return r.error;
          uiCtx.setState(r.state);
          town.refreshEquipment();
          await autosave.flush();
          return null;
        },
        resetGame: async () => {
          await deleteSave();
          location.reload();
        },
        extraSections: [
          (body) => {
            const sel = h('select') as HTMLSelectElement;
            for (const lv of ['high', 'medium', 'low'] as const) {
              const o = h('option', { text: QUALITY[lv].label }) as HTMLOptionElement;
              o.value = lv;
              sel.append(o);
            }
            sel.value = quality;
            sel.addEventListener('change', () => {
              quality = sel.value as QualityLevel;
              try {
                localStorage.setItem(QUALITY_KEY, quality);
              } catch {
                /* 無法儲存就只套用本次 */
              }
              game.setQuality(QUALITY[quality]);
              hud.toast('畫質已切換。草地數量會在重新整理後套用。');
            });
            body.append(h('h3', { text: '畫質' }), h('div', { className: 'row' }, sel));
          },
          (body) => {
            const sel = h('select') as HTMLSelectElement;
            for (const [v, label] of [['standard', '標準（約 1 GB，反應快）'], ['smart', '聰明（約 2 GB，對話較自然，需要較好的顯示卡）']] as const) {
              const o = h('option', { text: label }) as HTMLOptionElement;
              o.value = v;
              sel.append(o);
            }
            sel.value = localStorage.getItem(tierKey) || 'standard';
            sel.addEventListener('change', () => {
              localStorage.setItem(tierKey, sel.value);
              hud.toast('已切換對話模型，重新載入中……');
              loadModel();
            });
            body.append(h('h3', { text: '對話模型' }), h('div', { className: 'row' }, sel));
          },
        ],
      });
    }
  });

  const flush = () => void autosave.flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  if (needsName) {
    input.setEnabled(false);
    openNameEntry(ui, (name) => {
      uiCtx.setState(createNewState(name));
      input.setEnabled(true);
      hud.toast(`歡迎來到這座城，${name}。`);
    });
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __game: unknown }).__game = { game, town, arena, manor, llm, input, ui: uiCtx, autosave };
  }
}

boot().catch((e) => {
  console.error(e);
  showUnsupported(document.getElementById('ui')!, 'not_webgpu_backend');
});
