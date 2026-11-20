import * as THREE from 'three/webgpu';
import './ui/styles.css';
import { detectWebGPU } from './boot/webgpu';
import { showUnsupported } from './ui/unsupported';
import { createHud } from './ui/hud';
import { Game, type GameScene } from './game';

async function boot(): Promise<void> {
  const ui = document.getElementById('ui')!;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const check = await detectWebGPU();
  if (!check.ok) return showUnsupported(ui, check.reason);

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();
  if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
    return showUnsupported(ui, 'not_webgpu_backend');
  }

  const hud = createHud(ui);
  hud.setBackend('WebGPU');
  const game = new Game(renderer);
  game.registerScene('town', placeholderScene());
  game.switchScene('town');
  game.start();
}

function placeholderScene(): GameScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camera.position.set(6, 5, 8);
  camera.lookAt(0, 0.5, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(5, 10, 4);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x6f9a4a }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xb08850 }));
  cube.position.y = 0.5;
  scene.add(cube);
  return {
    scene,
    camera,
    enter() {},
    exit() {},
    update(dt) {
      cube.rotation.y += dt;
    },
  };
}

boot().catch((e) => {
  console.error(e);
  showUnsupported(document.getElementById('ui')!, 'not_webgpu_backend');
});
