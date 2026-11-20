import * as THREE from 'three/webgpu';
import type { GameScene } from '../game';
import type { GameState } from '../core/state';
import type { Hud } from '../ui/hud';
import type { Box } from './collision';
import { FollowCamera } from './camera';
import type { Input } from './input';
import { createPlaceholderHumanoid, PlayerController } from './player';
import { TOWN_LAYOUT, townColliders, townZones } from './townLayout';
import { buildBuilding, buildGround, buildProps, buildWalls } from './townBuilder';
import { findInteraction, type Zone } from './zones';

export interface TownContext {
  input: Input;
  hud: Hud;
  getState(): GameState;
  onInteract(zone: Zone): void;
}

export interface TownScene extends GameScene {
  colliders: Box[];
  zones: Zone[];
  player: PlayerController;
  follow: FollowCamera;
  playerPosition(): { x: number; z: number };
  /** 設定這一幀 update 前要套用的額外移動參數（騎馬用，Task 7） */
  moveSpeedOverride: number | null;
  /** 每幀 update 後的掛鉤（動畫、草地等） */
  afterUpdate: ((dt: number) => void)[];
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTownScene(ctx: TownContext): TownScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc3e4);
  scene.fog = new THREE.Fog(0xb9d1e4, 60, 220);

  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a4a32, 1.1);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(40, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 200;
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);

  scene.add(buildGround(), buildWalls(), buildProps(mulberry32(7)));
  for (const b of TOWN_LAYOUT.buildings) scene.add(buildBuilding(b));

  const colliders = townColliders();
  const zones = townZones();
  const player = new PlayerController(TOWN_LAYOUT.spawn, TOWN_LAYOUT.spawnFacing);
  player.root.add(createPlaceholderHumanoid());
  scene.add(player.root);

  const follow = new FollowCamera();
  follow.yaw = 0;

  const town: TownScene = {
    scene,
    camera: follow.camera,
    colliders,
    zones,
    player,
    follow,
    moveSpeedOverride: null,
    afterUpdate: [],
    playerPosition: () => ({ x: player.position.x, z: player.position.z }),
    enter() {
      follow.snap();
    },
    exit() {
      ctx.hud.setPrompt(null);
    },
    update(dt) {
      player.update(dt, ctx.input, follow, colliders, town.moveSpeedOverride !== null ? { speed: town.moveSpeedOverride } : {});
      follow.update(dt, player.position, ctx.input);
      const zone = findInteraction(town.playerPosition(), zones);
      ctx.hud.setPrompt(zone ? `按 E ${zone.enterable ? '進入' : '前往'}${zone.label}` : null);
      if (zone && ctx.input.consumePressed('KeyE')) ctx.onInteract(zone);
      for (const h of town.afterUpdate) h(dt);
    },
  };
  return town;
}
