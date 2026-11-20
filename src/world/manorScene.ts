import * as THREE from 'three/webgpu';
import type { GameScene } from '../game';
import type { GameState } from '../core/state';
import type { Hud } from '../ui/hud';
import { FollowCamera } from './camera';
import { AnimatedCharacter } from './character';
import type { Box } from './collision';
import type { Input } from './input';
import { mat, matDouble, worldScaleUV } from './materials';
import { PlayerController } from './player';
import { equipCharacter, locomotionAnim } from './town';

export interface ManorContext {
  input: Input;
  hud: Hud;
  getState(): GameState;
  onTalk(): void;
  onLeave(): void;
}

export interface ManorScene extends GameScene {
  ready: Promise<void>;
  /** 聊天時鏡頭對準艾琳娜 */
  chatMode: boolean;
  ladyReact(kind: 'talk' | 'happy' | 'sad'): void;
  player: PlayerController;
  refreshEquipment(): void;
}

const W = 22;
const D = 30;
const H = 8;
const LADY_POS = { x: 0, z: -10 };
const DOOR = { x: 0, z: D / 2 - 2 };

function buildHall(scene: THREE.Scene): Box[] {
  const floorGeo = new THREE.PlaneGeometry(W, D);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(worldScaleUV(floorGeo, 2.5), mat('wood'));
  floor.receiveShadow = true;
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.02, D - 4), mat('cloth'));
  carpet.position.y = 0.011;
  carpet.receiveShadow = true;
  scene.add(floor, carpet);

  const walls = new THREE.Mesh(worldScaleUV(new THREE.BoxGeometry(W, H, D), 3), matDouble('castleStone'));
  walls.material = matDouble('castleStone');
  (walls.geometry as THREE.BufferGeometry).scale(-1, 1, 1);
  walls.position.y = H / 2;
  walls.receiveShadow = true;
  scene.add(walls);

  // 柱子
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const col = new THREE.Mesh(worldScaleUV(new THREE.CylinderGeometry(0.55, 0.65, H, 16), 2), mat('stoneWall'));
      col.position.set(sx * 6.5, H / 2, -10 + i * 7);
      col.castShadow = col.receiveShadow = true;
      scene.add(col);
    }
  }
  // 窗戶（發光面板＝外面的天光）
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe2a8, emissiveIntensity: 1.6 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), glow);
      win.position.set(sx * (W / 2 - 0.02), 4.2, -10 + i * 7);
      win.rotation.y = -sx * Math.PI / 2;
      scene.add(win);
    }
  }
  // 壁爐（北牆）
  const fire = new THREE.Mesh(worldScaleUV(new THREE.BoxGeometry(4, 3.2, 1.2), 1.5), mat('stoneWall'));
  fire.position.set(-6.5, 1.6, -D / 2 + 0.6);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x220a00, emissive: 0xff6a1a, emissiveIntensity: 2.2 }));
  hole.position.set(-6.5, 0.95, -D / 2 + 1.21);
  scene.add(fire, hole);
  const fireLight = new THREE.PointLight(0xff8a3a, 30, 14, 2);
  fireLight.position.set(-6.5, 1.4, -D / 2 + 2.2);
  scene.add(fireLight);
  // 主位與長桌
  const dais = new THREE.Mesh(worldScaleUV(new THREE.BoxGeometry(8, 0.5, 4), 2), mat('stoneWall'));
  dais.position.set(0, 0.25, -D / 2 + 2.5);
  const throne = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1), mat('darkWood'));
  throne.position.set(0, 1.8, -D / 2 + 2);
  const table = new THREE.Mesh(worldScaleUV(new THREE.BoxGeometry(2.2, 0.9, 7), 1.5), mat('darkWood'));
  table.position.set(5.5, 0.45, 2);
  const banners = [-3, 3].map((x) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), mat('clothBlue'));
    b.position.set(x, 4.5, -D / 2 + 0.05);
    return b;
  });
  scene.add(dais, throne, table, ...banners);
  // 書架（艾琳娜身旁）
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 0.6), mat('wood'));
  shelf.position.set(W / 2 - 0.4, 1.7, -10);
  shelf.rotation.y = Math.PI / 2;
  scene.add(shelf);
  for (let i = 0; i < 18; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.3), mat(i % 3 === 0 ? 'cloth' : i % 3 === 1 ? 'clothBlue' : 'darkWood'));
    book.position.set(W / 2 - 0.55, 0.6 + Math.floor(i / 6) * 1.05, -11.2 + (i % 6) * 0.42);
    scene.add(book);
  }
  // 吊燈
  for (const z of [-6, 4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 24), mat('iron'));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, H - 2, z);
    const l = new THREE.PointLight(0xffd59a, 18, 16, 2);
    l.position.set(0, H - 2.4, z);
    scene.add(ring, l);
  }

  const half = { w: W / 2 - 0.6, d: D / 2 - 0.6 };
  const boxes: Box[] = [
    { minX: -W, maxX: -half.w, minZ: -D, maxZ: D },
    { minX: half.w, maxX: W, minZ: -D, maxZ: D },
    { minX: -W, maxX: W, minZ: -D, maxZ: -half.d },
    { minX: -W, maxX: W, minZ: half.d, maxZ: D },
    { minX: -4, maxX: 4, minZ: -D / 2, maxZ: -D / 2 + 4.5 },
    { minX: 4.4, maxX: 6.6, minZ: -1.5, maxZ: 5.5 },
    { minX: -8.5, maxX: -4.5, minZ: -D / 2, maxZ: -D / 2 + 1.4 },
    { minX: W / 2 - 1, maxX: W / 2, minZ: -11.6, maxZ: -8.4 },
  ];
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) boxes.push({ minX: sx * 6.5 - 0.7, maxX: sx * 6.5 + 0.7, minZ: -10 + i * 7 - 0.7, maxZ: -10 + i * 7 + 0.7 });
  boxes.push({ minX: LADY_POS.x - 0.45, maxX: LADY_POS.x + 0.45, minZ: LADY_POS.z - 0.45, maxZ: LADY_POS.z + 0.45 });
  return boxes;
}

export function createManorScene(ctx: ManorContext): ManorScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a140e);
  scene.add(new THREE.HemisphereLight(0xffe8c8, 0x3a2a1a, 0.9));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
  key.position.set(8, 12, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, near: 1, far: 50 });
  scene.add(key);
  const colliders = buildHall(scene);

  const player = new PlayerController(DOOR, Math.PI);
  scene.add(player.root);
  const follow = new FollowCamera();
  follow.distance = 4.2;
  let pc: AnimatedCharacter | null = null;
  let lady: AnimatedCharacter | null = null;
  let reactTimer = 0;

  const manor: ManorScene = {
    scene,
    camera: follow.camera,
    chatMode: false,
    player,
    ready: Promise.resolve(),
    refreshEquipment() {
      if (pc) equipCharacter(pc, ctx.getState().equippedWeapon);
    },
    ladyReact(kind) {
      if (!lady) return;
      lady.once(kind === 'happy' ? 'Wave' : kind === 'sad' ? 'HitRecieve_2' : 'Interact', { duration: kind === 'sad' ? 1 : 1.6 });
      reactTimer = kind === 'sad' ? 1 : 1.6;
    },
    enter() {
      player.teleport(DOOR.x, DOOR.z, Math.PI);
      follow.yaw = 0;
      follow.snap();
      manor.refreshEquipment();
    },
    exit() {
      ctx.hud.setPrompt(null);
    },
    update(dt) {
      if (manor.chatMode) {
        // 過肩對準艾琳娜
        const p = player.position;
        const dx = LADY_POS.x - p.x;
        const dz = LADY_POS.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        follow.camera.position.set(p.x - (dx / d) * 1.6 - (dz / d) * 0.7, 1.75, p.z - (dz / d) * 1.6 + (dx / d) * 0.7);
        follow.camera.lookAt(LADY_POS.x, 1.45, LADY_POS.z);
        player.facing = Math.atan2(dx, dz);
        player.root.rotation.y = player.facing;
        ctx.hud.setPrompt(null);
        follow.snap();
      } else {
        player.update(dt, ctx.input, follow, colliders);
        follow.update(dt, player.position, ctx.input);
        // 鏡頭不能穿出牆外與天花板
        const c = follow.camera.position;
        c.x = THREE.MathUtils.clamp(c.x, -W / 2 + 0.4, W / 2 - 0.4);
        c.z = THREE.MathUtils.clamp(c.z, -D / 2 + 0.4, D / 2 - 0.4);
        c.y = Math.min(c.y, H - 0.5);
        const p = player.position;
        const nearLady = Math.hypot(p.x - LADY_POS.x, p.z - LADY_POS.z) < 2.6;
        const nearDoor = Math.hypot(p.x - DOOR.x, p.z - DOOR.z) < 2.2;
        ctx.hud.setPrompt(nearLady ? '按 E 與艾琳娜交談' : nearDoor ? '按 E 離開城主府' : null);
        if (ctx.input.consumePressed('KeyE')) {
          if (nearLady) ctx.onTalk();
          else if (nearDoor) ctx.onLeave();
        }
      }
      if (pc) {
        pc.loop(manor.chatMode ? 'Idle' : locomotionAnim(player.speedNow));
        pc.update(dt);
      }
      if (lady) {
        // 平常看向玩家
        const p = player.position;
        const target = Math.atan2(p.x - LADY_POS.x, p.z - LADY_POS.z);
        lady.root.rotation.y += Math.atan2(Math.sin(target - lady.root.rotation.y), Math.cos(target - lady.root.rotation.y)) * Math.min(1, dt * 3);
        reactTimer -= dt;
        if (reactTimer <= 0) lady.loop('Idle', 0.3);
        lady.update(dt);
      }
    },
  };
  manor.ready = Promise.all([AnimatedCharacter.create('player'), AnimatedCharacter.create('lady')]).then(([a, b]) => {
    pc = a;
    lady = b;
    player.root.add(a.root);
    b.root.position.set(LADY_POS.x, 0, LADY_POS.z);
    scene.add(b.root);
    b.loop('Idle');
    manor.refreshEquipment();
  });
  return manor;
}
