import * as THREE from 'three/webgpu';
import type { GameScene } from '../game';
import { OPPONENTS } from '../config/arena';
import type { Weapon } from '../config/items';
import { createEnemyAI, type EnemyAI } from '../combat/ai';
import {
  ARENA_RADIUS, createBout, DODGE_TIME, opponentStats, STAGGER_TIME, STRIKE_TIME, stepBout, weaponStats,
  type Bout, type CombatEvent, type Command, type Fighter,
} from '../combat/combat';
import type { Hud } from '../ui/hud';
import { h } from '../ui/dom';
import { attachWeapon } from './assets';
import { AnimatedCharacter } from './character';
import type { Input } from './input';
import { mat, matDouble, worldScaleUV } from './materials';
import { OPPONENT_LOOK, opponentWeapon } from './opponentLook';
import { buildWeaponModel } from './weapons';

export interface ArenaStart {
  playerName: string;
  playerWeapon: Weapon;
  opponentIndex: number;
  onFinish(result: 'win' | 'loss'): void;
}

export interface ArenaScene extends GameScene {
  start(opts: ArenaStart): Promise<void>;
  bout: Bout | null;
}

const COUNTDOWN = 2.4;

function buildArena(scene: THREE.Scene): void {
  const R = ARENA_RADIUS + 2;
  const sandGeo = new THREE.CircleGeometry(R, 64);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(worldScaleUV(sandGeo, 3), mat('sand'));
  sand.receiveShadow = true;
  scene.add(sand);
  // 內牆
  const wallGeo = new THREE.CylinderGeometry(R, R, 2.2, 64, 1, true);
  const wall = new THREE.Mesh(worldScaleUV(wallGeo, 2), matDouble('castleStone'));
  wall.position.y = 1.1;
  wall.receiveShadow = true;
  scene.add(wall);
  // 看台（階梯）
  for (let i = 0; i < 6; i++) {
    const r0 = R + i * 1.3;
    const topY = 2.2 + i * 0.9;
    const topGeo = new THREE.RingGeometry(r0, r0 + 1.3, 64, 1);
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(worldScaleUV(topGeo, 2), mat('stoneWall'));
    top.position.y = topY;
    top.receiveShadow = true;
    const riser = new THREE.Mesh(worldScaleUV(new THREE.CylinderGeometry(r0 + 1.3, r0 + 1.3, 0.9, 64, 1, true), 2), matDouble('castleStone'));
    riser.position.y = topY + 0.45;
    scene.add(top);
    if (i < 5) scene.add(riser);
  }
  const outer = new THREE.Mesh(worldScaleUV(new THREE.CylinderGeometry(R + 9.5, R + 9.5, 9, 64, 1, true), 3), mat('castleStone'));
  outer.position.y = 4.5;
  scene.add(outer);
  // 觀眾：InstancedMesh 的人形方塊
  const crowdGeo = new THREE.CapsuleGeometry(0.22, 0.5, 2, 6);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const count = 420;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const palette = [0x8a3a2a, 0x2f4d7a, 0x6b6b3a, 0x5a4a3a, 0xa08060, 0x3a5a3a, 0x7a6a8a];
  for (let i = 0; i < count; i++) {
    const row = i % 6;
    const a = (i / count) * Math.PI * 2 * 6.3 + row * 0.3;
    const gapA = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));
    const r = R + 0.8 + row * 1.3;
    const y = 2.2 + row * 0.9 + 0.5;
    const visible = Math.abs(gapA) > 0.25; // 入口上方留空
    m.makeTranslation(Math.cos(a) * r, visible ? y : -50, Math.sin(a) * r);
    crowd.setMatrixAt(i, m);
    crowd.setColorAt(i, c.setHex(palette[i % palette.length]!));
  }
  crowd.castShadow = true;
  scene.add(crowd);
  // 旗幟
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 8), mat('darkWood'));
    pole.position.set(Math.cos(a) * (R + 9), 9 + 3, Math.sin(a) * (R + 9));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), i % 2 ? mat('cloth') : mat('clothBlue'));
    flag.position.set(Math.cos(a) * (R + 9) + 0.8, 14.3, Math.sin(a) * (R + 9));
    scene.add(pole, flag);
  }
}

export function createArenaScene(ctx: { input: Input; hud: Hud; ui: HTMLElement }): ArenaScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc3e4);
  scene.fog = new THREE.Fog(0xb9d1e4, 50, 160);
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x6a5a40, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(18, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  buildArena(scene);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const camPos = new THREE.Vector3(0, 3, 10);
  let shake = 0;

  let player: AnimatedCharacter | null = null;
  let enemy: AnimatedCharacter | null = null;
  let ai: EnemyAI | null = null;
  let opts: ArenaStart | null = null;
  let countdown = 0;
  let finished = false;
  let endTimer = 0;

  // HUD
  const overlay = h('div', { className: 'arena-hud' });
  const pName = h('div', { className: 'name' });
  const eName = h('div', { className: 'name right' });
  const pBar = h('div', { className: 'fill' });
  const eBar = h('div', { className: 'fill enemy' });
  const banner = h('div', { className: 'arena-banner' });
  const flash = h('div', { className: 'arena-flash' });
  const help = h('div', { className: 'arena-help', text: '左鍵 揮砍｜右鍵按住 格擋｜空白鍵 閃避｜WASD 移動' });
  overlay.append(
    h('div', { className: 'bar-wrap' }, pName, h('div', { className: 'bar' }, pBar)),
    h('div', { className: 'bar-wrap right' }, eName, h('div', { className: 'bar' }, eBar)),
    banner,
    flash,
    help,
  );

  const onVisibility = () => {
    if (arena.bout) arena.bout.paused = document.visibilityState === 'hidden';
  };

  function setBanner(text: string | null): void {
    banner.textContent = text ?? '';
    banner.style.display = text ? '' : 'none';
  }

  function flashScreen(color: string): void {
    flash.style.background = color;
    flash.style.opacity = '0.35';
    setTimeout(() => (flash.style.opacity = '0'), 90);
  }

  function animate(ch: AnimatedCharacter, f: Fighter, prev: string, moving: boolean): void {
    if (f.state === prev && f.state !== 'idle' && f.state !== 'block') return;
    switch (f.state) {
      case 'windup':
        if (prev !== 'windup') ch.once('Sword_Slash', { duration: f.stats.windup + STRIKE_TIME + f.stats.recover });
        break;
      case 'dodge':
        ch.once('Roll', { duration: DODGE_TIME + 0.1 });
        break;
      case 'stagger':
        ch.once('HitRecieve', { duration: STAGGER_TIME });
        break;
      case 'down':
        ch.once('Death', { clampEnd: true, duration: 1.2 });
        break;
      case 'block':
        ch.loop('Idle_Gun_Pointing', 0.1);
        break;
      case 'idle':
        ch.loop(moving ? 'Walk' : 'Idle_Sword', 0.15);
        break;
    }
  }

  function placeCharacter(ch: AnimatedCharacter, f: Fighter): void {
    ch.root.position.set(f.pos.x, 0, f.pos.z);
    ch.root.rotation.y = f.facing;
  }

  function readPlayerCommand(b: Bout): Command {
    const i = ctx.input;
    const p = b.player;
    const e = b.enemy;
    const fx = e.pos.x - p.pos.x;
    const fz = e.pos.z - p.pos.z;
    const len = Math.hypot(fx, fz) || 1;
    const f = { x: fx / len, z: fz / len };
    const r = { x: -f.z, z: f.x };
    const mv = { x: 0, z: 0 };
    if (i.isDown('KeyW')) { mv.x += f.x; mv.z += f.z; }
    if (i.isDown('KeyS')) { mv.x -= f.x; mv.z -= f.z; }
    if (i.isDown('KeyD')) { mv.x += r.x; mv.z += r.z; }
    if (i.isDown('KeyA')) { mv.x -= r.x; mv.z -= r.z; }
    const cmd: Command = { move: mv, block: i.mouseButtons().right };
    if (i.consumeClick()) cmd.attack = true;
    if (i.consumePressed('Space')) cmd.dodge = Math.hypot(mv.x, mv.z) > 0 ? mv : { x: -f.x, z: -f.z };
    return cmd;
  }

  function handleEvents(ev: CombatEvent[]): void {
    for (const e of ev) {
      if (e.type === 'hit') {
        shake = e.target === 'player' ? 0.25 : 0.12;
        flashScreen(e.target === 'player' ? '#c0392b' : '#ffffff');
      } else if (e.type === 'blocked') {
        shake = 0.08;
        flashScreen('#d9a441');
      } else if (e.type === 'end') {
        finished = true;
        endTimer = 0;
        const opp = OPPONENTS[opts!.opponentIndex]!;
        setBanner(e.result === 'win' ? `勝利！你擊敗了${opp.title}${opp.name}` : '你倒下了……');
      }
    }
  }

  function updateBars(b: Bout): void {
    pBar.style.width = `${(b.player.hp / b.player.stats.hp) * 100}%`;
    eBar.style.width = `${(b.enemy.hp / b.enemy.stats.hp) * 100}%`;
  }

  const arena: ArenaScene = {
    scene,
    camera,
    bout: null,
    async start(o) {
      opts = o;
      const opp = OPPONENTS[o.opponentIndex]!;
      const look = OPPONENT_LOOK[opp.id] ?? { key: 'player' as const };
      if (player) scene.remove(player.root);
      if (enemy) scene.remove(enemy.root);
      [player, enemy] = await Promise.all([AnimatedCharacter.create('player'), AnimatedCharacter.create(look.key)]);
      if (look.tint) enemy.tint(look.tint);
      attachWeapon(player.model, buildWeaponModel(o.playerWeapon));
      const ew = opponentWeapon(opp.id, opp.weaponKind);
      attachWeapon(enemy.model, buildWeaponModel(ew));
      scene.add(player.root, enemy.root);
      const b = createBout(weaponStats(o.playerWeapon), opponentStats(opp));
      arena.bout = b;
      ai = createEnemyAI(opp, Math.random);
      placeCharacter(player, b.player);
      placeCharacter(enemy, b.enemy);
      player.loop('Idle_Sword');
      enemy.loop('Idle_Sword');
      pName.textContent = o.playerName;
      eName.textContent = `${opp.title}　${opp.name}`;
      updateBars(b);
      countdown = COUNTDOWN;
      finished = false;
      setBanner(`第 ${o.opponentIndex + 1} 戰：${opp.title} ${opp.name}`);
      camPos.set(b.player.pos.x, 3.2, b.player.pos.z + 5);
    },
    enter() {
      ctx.hud.setVisible(false);
      ctx.ui.append(overlay);
      document.addEventListener('visibilitychange', onVisibility);
    },
    exit() {
      overlay.remove();
      ctx.hud.setVisible(true);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    update(dt) {
      const b = arena.bout;
      if (!b || !player || !enemy || !ai || !opts) return;
      const prevP = b.player.state;
      const prevE = b.enemy.state;

      if (countdown > 0) {
        countdown -= dt;
        if (countdown <= 0) setBanner(null);
        else if (countdown < 1) setBanner('開始！');
        ctx.input.consumeClick();
        ctx.input.consumePressed('Space');
      } else if (!finished) {
        const pc = readPlayerCommand(b);
        const ec = ai.decide(b, dt);
        const pMoving = Math.hypot(pc.move?.x ?? 0, pc.move?.z ?? 0) > 0.1;
        const eMoving = Math.hypot(ec.move?.x ?? 0, ec.move?.z ?? 0) > 0.1;
        handleEvents(stepBout(b, dt, pc, ec));
        animate(player, b.player, prevP, pMoving);
        animate(enemy, b.enemy, prevE, eMoving);
        updateBars(b);
      } else {
        endTimer += dt;
        if (endTimer > 1.2) {
          banner.textContent = `${banner.textContent?.split('｜')[0]}｜按 E 回城`;
          if (ctx.input.consumePressed('KeyE')) {
            const o = opts;
            opts = null;
            o.onFinish(b.result!);
          }
        }
      }
      placeCharacter(player, b.player);
      placeCharacter(enemy, b.enemy);
      player.update(dt);
      enemy.update(dt);

      // 鎖定鏡頭：玩家身後偏右，看向兩人之間
      const p = b.player.pos;
      const e = b.enemy.pos;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const desired = new THREE.Vector3(p.x - (dx / d) * 4.6 - (dz / d) * 1.9, 2.9, p.z - (dz / d) * 4.6 + (dx / d) * 1.9);
      camPos.lerp(desired, 1 - Math.exp(-dt * 6));
      camera.position.copy(camPos);
      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shake = Math.max(0, shake - dt * 1.5);
      }
      camera.lookAt(p.x + dx * 0.6, 1.1, p.z + dz * 0.6);
    },
  };
  setBanner(null);
  return arena;
}
