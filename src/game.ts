import * as THREE from 'three/webgpu';

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

  constructor(readonly renderer: THREE.WebGPURenderer) {
    window.addEventListener('resize', () => this.resize());
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
    this.resize();
    next.enter();
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
      this.renderer.render(this.current.scene, this.current.camera);
    });
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
