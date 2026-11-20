import * as THREE from 'three/webgpu';
import './ui/styles.css';
import { detectWebGPU } from './boot/webgpu';
import { showUnsupported } from './ui/unsupported';
import { createHud } from './ui/hud';
import { Game } from './game';
import { createInput } from './world/input';
import { createTownScene } from './world/town';
import { createNewState, type GameState } from './core/state';

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
  let state: GameState = createNewState('旅人');
  hud.setGold(state.gold);
  hud.setDay(state.day);

  const game = new Game(renderer);
  const town = createTownScene({
    input,
    hud,
    getState: () => state,
    onInteract: (zone) => hud.toast(`（${zone.label}：之後的步驟會開啟這裡）`),
  });
  game.registerScene('town', town);
  game.switchScene('town');
  game.start();

  if (import.meta.env.DEV) {
    (window as unknown as { __game: unknown }).__game = { game, town, input, get state() { return state; }, set state(s: GameState) { state = s; } };
  }
}

boot().catch((e) => {
  console.error(e);
  showUnsupported(document.getElementById('ui')!, 'not_webgpu_backend');
});
