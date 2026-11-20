import * as THREE from 'three/webgpu';
import { getHorse, type Horse } from '../config/items';
import type { GameState } from '../core/state';
import type { AssetKey } from './assetManifest';
import { AnimatedCharacter } from './character';
import type { Vec2 } from './collision';
import { RUN_SPEED, WALK_SPEED } from './player';
import { findInteraction, type Zone } from './zones';

export const MOUNTED_SPRINT = 1.3;
export const HORSE_RADIUS = 0.9;

export type MountCheck = { ok: true; horse: Horse } | { ok: false; reason: 'no_horse' | 'in_zone' };

export function canMount(s: GameState, p: Vec2, zones: Zone[]): MountCheck {
  const horse = s.activeHorse ? getHorse(s.activeHorse) : undefined;
  if (!horse) return { ok: false, reason: 'no_horse' };
  const z = findInteraction(p, zones);
  if (z?.enterable) return { ok: false, reason: 'in_zone' };
  return { ok: true, horse };
}

export function moveSpeed(s: GameState, mounted: boolean, running: boolean): number {
  if (mounted) {
    const h = s.activeHorse ? getHorse(s.activeHorse) : undefined;
    const base = h?.speed ?? WALK_SPEED;
    return running ? base * MOUNTED_SPRINT : base;
  }
  return running ? RUN_SPEED : WALK_SPEED;
}

export function canEnter(zone: Zone, mounted: boolean): boolean {
  return !(zone.enterable && mounted);
}

export function horseAnim(speed: number): 'Idle' | 'Walk' | 'Gallop' {
  if (speed < 0.3) return 'Idle';
  if (speed < 5) return 'Walk';
  return 'Gallop';
}

/** 馬匹 id → 模型與毛色。 */
export function horseAppearance(id: string): { key: AssetKey; tint?: Record<string, number> } {
  switch (id) {
    case 'dapple_grey': return { key: 'horseWhite', tint: { Main: 0xa7a7a2, Main_Light: 0xc8c8c4 } };
    case 'black_destrier': return { key: 'horseBrown', tint: { Main: 0x1c1816, Main_Dark: 0x0f0c0b, Main_Light: 0x2a2421, Hair: 0x0b0908 } };
    default: return { key: 'horseBrown' };
  }
}

/** 鞍座高度與騎乘姿勢。 */
export const SADDLE = { height: 0.78, back: -0.08 };

/**
 * 跨坐姿勢：在動畫姿勢之上，以「角色模型座標」的軸疊加旋轉（角色面向 +z、左手在 +x）。
 * [骨骼名稱, 軸, 角度]：繞 +x 負角度＝腿往前抬，繞 z 正角度＝往 +x（左）張開。
 */
const SEAT_POSE: [string, 'x' | 'z', number][] = [
  ['UpperLegL', 'x', -1.25],
  ['UpperLegL', 'z', 0.38],
  ['UpperLegR', 'x', -1.25],
  ['UpperLegR', 'z', -0.38],
  ['LowerLegL', 'x', 1.15],
  ['LowerLegR', 'x', 1.15],
];
const AXES = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, 1) };

/**
 * 依馬背骨骼（Back/Torso）與角色臀部（Hips）的實際位置，算出角色應抬高與前後移動多少。
 * 找不到骨骼時退回 SADDLE 預設值。座標以玩家 root 的本地座標表示。
 */
export function saddleOffset(horseModel: THREE.Object3D, character: THREE.Object3D, playerRoot: THREE.Object3D): { y: number; z: number } {
  playerRoot.updateMatrixWorld(true);
  const back = horseModel.getObjectByName('Torso2') ?? horseModel.getObjectByName('Torso');
  const hips = character.getObjectByName('Hips');
  if (!back || !hips) return { y: SADDLE.height, z: SADDLE.back };
  const inv = new THREE.Matrix4().copy(playerRoot.matrixWorld).invert();
  const b = back.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const hp = hips.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const charY = character.position.y;
  return { y: b.y + SADDLE_CLEARANCE - (hp.y - charY), z: b.z + SADDLE.back };
}
const SADDLE_CLEARANCE = 0.3;

/** 每幀在 mixer 更新之後呼叫，把腿彎成跨坐姿勢。 */
export function applySeatPose(model: THREE.Object3D): void {
  const modelQ = model.getWorldQuaternion(new THREE.Quaternion());
  const parentQ = new THREE.Quaternion();
  const r = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  for (const [name, ax, angle] of SEAT_POSE) {
    const b = model.getObjectByName(name);
    if (!b?.parent) continue;
    axis.copy(AXES[ax]).applyQuaternion(modelQ);
    b.parent.getWorldQuaternion(parentQ);
    r.setFromAxisAngle(axis, angle);
    // 世界座標的旋轉轉成骨骼本地：local' = parent⁻¹ · R · parent · local
    const q = parentQ.clone().invert().multiply(r).multiply(parentQ);
    b.quaternion.premultiply(q);
    b.updateMatrixWorld(true);
  }
}

/** 管理上下馬：馬模型掛在玩家 root 底下、角色抬到鞍上。 */
export class HorseRider {
  horse: AnimatedCharacter | null = null;
  horseId: string | null = null;
  mounted = false;
  private loading = false;

  constructor(private readonly playerRoot: THREE.Group, private readonly getCharacterRoot: () => THREE.Object3D | null) {}

  async mount(horse: Horse): Promise<void> {
    if (this.mounted || this.loading) return;
    this.loading = true;
    try {
      if (!this.horse || this.horseId !== horse.id) {
        this.horse?.root.removeFromParent();
        const look = horseAppearance(horse.id);
        this.horse = await AnimatedCharacter.create(look.key);
        if (look.tint) this.horse.tint(look.tint);
        this.horseId = horse.id;
      }
      this.playerRoot.add(this.horse.root);
      const ch = this.getCharacterRoot();
      if (ch) {
        const seat = saddleOffset(this.horse.model, ch, this.playerRoot);
        ch.position.set(0, seat.y, seat.z);
      }
      this.mounted = true;
    } finally {
      this.loading = false;
    }
  }

  dismount(): void {
    if (!this.mounted) return;
    this.horse?.root.removeFromParent();
    const ch = this.getCharacterRoot();
    if (ch) ch.position.set(0, 0, 0);
    this.mounted = false;
  }

  update(dt: number, speed: number, characterModel: THREE.Object3D | null): void {
    if (!this.mounted || !this.horse) return;
    const anim = horseAnim(speed);
    this.horse.loop(anim, 0.25, anim === 'Gallop' ? Math.max(0.8, speed / 10) : 1);
    this.horse.update(dt);
    if (characterModel) applySeatPose(characterModel);
  }
}
