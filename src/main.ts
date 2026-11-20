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
      if (weaponChanged) town.refreshEquipment();
    },
    toast: (t) => hud.toast(t),
  };

  const onInteract = (zone: Zone) => {
    switch (zone.id) {
      case 'weapon_shop': return openShop(uiCtx, 'weapon');
      case 'stable': return openShop(uiCtx, 'horse');
      case 'gift_stall': return openShop(uiCtx, 'gift');
      case 'inn': return openInn(uiCtx);
      default: return hud.toast(`（${zone.label}：之後的步驟會開啟這裡）`);
    }
  };

  const game = new Game(renderer);
  const town = createTownScene({ input, hud, getState: () => state, onInteract });
  game.registerScene('town', town);
  await Promise.all([applySceneTextures(renderer.getMaxAnisotropy?.() ?? 8), town.ready]);
  game.switchScene('town');
  refreshHud();
  game.start();

  // 全域快捷鍵（面板關閉時才作用；input 在面板開啟時會停用）
  game.onFrame(() => {
    if (panels.isOpen()) return;
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
    (window as unknown as { __game: unknown }).__game = { game, town, input, ui: uiCtx, autosave };
  }
}

boot().catch((e) => {
  console.error(e);
  showUnsupported(document.getElementById('ui')!, 'not_webgpu_backend');
});
