import * as THREE from 'three/webgpu';
import type { Input } from './input';

const SENSITIVITY = 0.0025;
const MIN_PITCH = -0.2;
const MAX_PITCH = 1.1;

/** 第三人稱跟隨鏡頭：滑鼠控制 yaw/pitch，鏡頭在目標後上方。 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.35;
  distance = 5;
  height = 1.6;
  private current = new THREE.Vector3();
  private initialized = false;

  constructor(fov = 60) {
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 600);
  }

  update(dt: number, target: THREE.Vector3, input: Input): void {
    const d = input.mouseDelta();
    this.yaw -= d.x * SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch + d.y * SENSITIVITY, MIN_PITCH, MAX_PITCH);

    const focus = new THREE.Vector3(target.x, target.y + this.height, target.z);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ).multiplyScalar(this.distance);
    const desired = focus.clone().add(offset);
    desired.y = Math.max(desired.y, 0.3);

    if (!this.initialized) {
      this.current.copy(desired);
      this.initialized = true;
    } else {
      this.current.lerp(desired, 1 - Math.exp(-dt * 14));
    }
    this.camera.position.copy(this.current);
    this.camera.lookAt(focus);
  }

  /** 鏡頭前方在 xz 平面上的單位向量（角色移動方向用）。 */
  forward(): THREE.Vector2 {
    return new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
  }

  snap(): void {
    this.initialized = false;
  }
}
