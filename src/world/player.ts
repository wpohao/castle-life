import * as THREE from 'three/webgpu';
import { resolveCircleVsBoxes, type Box } from './collision';
import type { FollowCamera } from './camera';
import type { Input } from './input';

export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 3;
export const RUN_SPEED = 6;
const TURN_RATE = 12;

export interface MoveOptions {
  /** 外部決定的移動速度（騎馬時由 horse.moveSpeed 提供）；未給時用步行／奔跑 */
  speed?: number;
  radius?: number;
}

/** 第三人稱角色控制：相對鏡頭方向移動、轉向、碰撞。外觀由 root 底下的模型決定。 */
export class PlayerController {
  readonly root = new THREE.Group();
  /** 目前水平速度（公尺／秒），給動畫用 */
  speedNow = 0;
  facing = 0;

  constructor(start: { x: number; z: number }, facing = Math.PI) {
    this.root.position.set(start.x, 0, start.z);
    this.facing = facing;
    this.root.rotation.y = facing;
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  update(dt: number, input: Input, cam: FollowCamera, colliders: Box[], opts: MoveOptions = {}): void {
    const f = cam.forward();
    const r = new THREE.Vector2(-f.y, f.x);
    const move = new THREE.Vector2();
    if (input.isDown('KeyW')) move.add(f);
    if (input.isDown('KeyS')) move.sub(f);
    if (input.isDown('KeyD')) move.add(r);
    if (input.isDown('KeyA')) move.sub(r);

    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = opts.speed ?? (running ? RUN_SPEED : WALK_SPEED);
    if (move.lengthSq() > 0) {
      move.normalize();
      const target = Math.atan2(move.x, move.y);
      this.facing = turnToward(this.facing, target, TURN_RATE * dt);
      const nx = this.root.position.x + move.x * speed * dt;
      const nz = this.root.position.z + move.y * speed * dt;
      const p = resolveCircleVsBoxes({ x: nx, z: nz }, opts.radius ?? PLAYER_RADIUS, colliders);
      const moved = Math.hypot(p.x - this.root.position.x, p.z - this.root.position.z);
      this.speedNow = dt > 0 ? moved / dt : 0;
      this.root.position.x = p.x;
      this.root.position.z = p.z;
    } else {
      this.speedNow = 0;
    }
    this.root.rotation.y = this.facing;
  }

  teleport(x: number, z: number, facing?: number): void {
    this.root.position.set(x, 0, z);
    if (facing !== undefined) {
      this.facing = facing;
      this.root.rotation.y = facing;
    }
  }
}

/** 以最短角度方向轉向目標。 */
export function turnToward(current: number, target: number, maxStep: number): number {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/** 佔位人形（素材載入前或載入失敗時使用）。 */
export function createPlaceholderHumanoid(color = 0x3b5b8c): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 12), new THREE.MeshStandardMaterial({ color }));
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe0b896 }));
  head.position.y = 1.75;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: 0xd09c7a }));
  nose.position.set(0, 1.75, 0.2);
  for (const m of [body, head, nose]) m.castShadow = true;
  g.add(body, head, nose);
  return g;
}
