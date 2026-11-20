import * as THREE from 'three/webgpu';
import { findClip, instantiate } from './assets';
import type { AssetKey } from './assetManifest';

/** Quaternius 角色動畫名稱（去掉 "CharacterArmature|" 前綴後）。 */
export type AnimName =
  | 'Idle' | 'Idle_Neutral' | 'Idle_Sword' | 'Walk' | 'Run' | 'Sword_Slash' | 'Roll'
  | 'HitRecieve' | 'HitRecieve_2' | 'Death' | 'Wave' | 'Interact' | 'Punch_Right';

/**
 * 有骨架動畫的角色：包含 mixer 與動作切換（淡入淡出）。
 * root 由外部控制位置與朝向；模型本身已縮放到真實身高。
 */
export class AnimatedCharacter {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  currentName: string | null = null;
  /** 最近一次 loop() 的動畫；once() 播完（未 clampEnd）會自動回到它 */
  private lastLoop: { name: string; timeScale: number } | null = null;

  private constructor(
    readonly root: THREE.Group,
    readonly model: THREE.Object3D,
    clips: THREE.AnimationClip[],
    readonly placeholder: boolean,
  ) {
    this.mixer = new THREE.AnimationMixer(model);
    // 同名動畫可能同時有 "Armature|Idle" 與 "Idle" 兩份；優先使用帶 Armature 前綴的版本
    const chosen = new Map<string, THREE.AnimationClip>();
    for (const c of clips) {
      const short = c.name.split('|').pop()!;
      const prev = chosen.get(short);
      if (!prev || (!prev.name.includes('|') && c.name.includes('|'))) chosen.set(short, c);
    }
    for (const [short, c] of chosen) this.actions.set(short, this.mixer.clipAction(c));
    this.mixer.addEventListener('finished', (e) => {
      const a = (e as unknown as { action: THREE.AnimationAction }).action;
      if (a === this.current && !a.clampWhenFinished && this.lastLoop) {
        this.current = null;
        this.loop(this.lastLoop.name, 0.15, this.lastLoop.timeScale);
      }
    });
  }

  static async create(key: AssetKey): Promise<AnimatedCharacter> {
    const inst = await instantiate(key);
    return new AnimatedCharacter(inst.root, inst.model, inst.animations, inst.placeholder);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  /** 持續循環播放（idle/walk/run）。已在播同一個就不重來。 */
  loop(name: AnimName | string, fade = 0.2, timeScale = 1): void {
    const a = this.actions.get(name);
    if (!a) return;
    this.lastLoop = { name, timeScale };
    a.timeScale = timeScale;
    if (this.current === a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = a;
    this.currentName = name;
  }

  /** 播一次（揮砍、受擊、死亡）。clampEnd 為 true 時停在最後一格。 */
  once(name: AnimName | string, opts: { fade?: number; duration?: number; clampEnd?: boolean } = {}): void {
    const a = this.actions.get(name);
    if (!a) return;
    const fade = opts.fade ?? 0.08;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = !!opts.clampEnd;
    a.timeScale = opts.duration ? a.getClip().duration / opts.duration : 1;
    a.fadeIn(fade).play();
    if (this.current && this.current !== a) this.current.fadeOut(fade);
    this.current = a;
    this.currentName = name;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  /** 對模型的所有材質做色調調整（用同一模型做出不同的對手）。 */
  tint(colors: Record<string, number>): void {
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((m) => {
        const c = colors[m.name];
        if (c === undefined) return m;
        const n = (m as THREE.MeshStandardMaterial).clone();
        n.color.setHex(c);
        return n;
      }) as unknown as THREE.Material;
      if (mats.length === 1) mesh.material = (mesh.material as unknown as THREE.Material[])[0]!;
    });
  }

  /** 隱藏名稱符合的子物件（例如把國王的王冠拿掉）。 */
  hideParts(re: RegExp): void {
    this.model.traverse((o) => {
      if (re.test(o.name)) o.visible = false;
    });
  }
}

export { findClip };
