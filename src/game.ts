import * as THREE from 'three/webgpu';
import type { QualityPreset } from './config/quality';
import { applyShadowQuality, createSceneOutput, type SceneOutput } from './world/rendering';

export type SceneName = 'town' | 'arena' | 'manor' | 'wedding';

export interface GameScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  enter(): void;
  exit(): void;
  update(dt: number): void;
}

export const MAX_FRAME_DT = 0.1;

export class Game {
  private scenes = new Map<SceneName, GameScene>();
  private current: GameScene | null = null;
  currentName: SceneName | null = null;
  private timer = new THREE.Timer();
  private paused = false;
  private frameHooks: ((dt: number) => void)[] = [];
  private switchHooks: (() => void)[] = [];
  private outputs = new Map<GameScene, SceneOutput>();

  constructor(readonly renderer: THREE.WebGPURenderer, private preset: QualityPreset) {
    window.addEventListener('resize', () => this.resize());
    this.applyPixelRatio();
    this.resize();
  }

  registerScene(name: SceneName, scene: GameScene): void {
    this.scenes.set(name, scene);
  }

  switchScene(name: SceneName): void {
    const next = this.scenes.get(name);
    if (!next) throw new Error(`unknown scene ${name}`);
    this.current?.exit();
    this.current = next;
    this.currentName = name;
    applyShadowQuality(next.scene, this.preset);
    this.resize();
    for (const hk of this.switchHooks) hk();
    next.enter();
  }

  /** 切換畫質：重建所有場景的輸出管線、更新像素比與陰影。 */
  setQuality(preset: QualityPreset): void {
    this.preset = preset;
    for (const o of this.outputs.values()) o.dispose();
    this.outputs.clear();
    this.applyPixelRatio();
    if (this.current) applyShadowQuality(this.current.scene, preset);
    this.resize();
  }

  /** 每次切換場景時呼叫（例如清掉上一個場景沒處理的按鍵）。 */
  onSceneSwitch(cb: () => void): void {
    this.switchHooks.push(cb);
  }

  /** 每幀在場景 update 之前呼叫（UI、計時等）。 */
  onFrame(cb: (dt: number) => void): void {
    this.frameHooks.push(cb);
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  start(): void {
    this.timer.connect(document);
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), MAX_FRAME_DT);
      if (!this.current) return;
      for (const h of this.frameHooks) h(dt);
      if (!this.paused) this.current.update(dt);
      this.outputFor(this.current).render();
    });
  }

  private outputFor(s: GameScene): SceneOutput {
    let o = this.outputs.get(s);
    if (!o) {
      o = createSceneOutput(this.renderer, s.scene, s.camera, this.preset);
      this.outputs.set(s, o);
    }
    return o;
  }

  private applyPixelRatio(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preset.pixelRatioCap));
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.current) {
      this.current.camera.aspect = w / h;
      this.current.camera.updateProjectionMatrix();
    }
  }
}
