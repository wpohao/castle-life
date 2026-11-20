import { PLAYER_HP, type Opponent } from '../config/arena';
import type { Weapon } from '../config/items';

export type FighterState = 'idle' | 'windup' | 'strike' | 'recover' | 'block' | 'dodge' | 'stagger' | 'down';
export type Side = 'player' | 'enemy';

export interface FighterStats {
  hp: number;
  damage: number;
  windup: number;
  recover: number;
  reach: number;
}

export interface Fighter {
  stats: FighterStats;
  hp: number;
  pos: { x: number; z: number };
  /** 面向角（three.js 慣例：0 面向 +z） */
  facing: number;
  state: FighterState;
  stateTime: number;
  dodgeCooldown: number;
  dodgeDir: { x: number; z: number };
}

export interface Command {
  move?: { x: number; z: number };
  attack?: boolean;
  block?: boolean;
  dodge?: { x: number; z: number };
}

export type CombatEvent =
  | { type: 'hit'; target: Side; damage: number }
  | { type: 'blocked'; target: Side }
  | { type: 'miss'; target: Side }
  | { type: 'end'; result: 'win' | 'loss' };

export interface Bout {
  player: Fighter;
  enemy: Fighter;
  time: number;
  paused: boolean;
  result: 'win' | 'loss' | null;
}

export const MAX_DT = 0.1;
export const STRIKE_TIME = 0.1;
export const STAGGER_TIME = 0.4;
export const DODGE_TIME = 0.35;
export const DODGE_COOLDOWN = 1.0;
export const DODGE_SPEED = 6;
export const MOVE_SPEED = 3;
export const BLOCK_MOVE_FACTOR = 0.5;
export const BLOCK_ARC_DEG = 120;
export const HIT_ARC_DEG = 120;
export const ARENA_RADIUS = 12;
export const START_DISTANCE = 6;
export const MIN_SEPARATION = 0.8;

export function weaponStats(w: Weapon): FighterStats {
  return { hp: PLAYER_HP, damage: w.damage, windup: w.windup, recover: w.recover, reach: w.reach };
}

export function opponentStats(o: Opponent): FighterStats {
  return { hp: o.hp, damage: o.damage, windup: o.windup, recover: o.recover, reach: o.reach };
}

function fighter(stats: FighterStats, z: number, facing: number): Fighter {
  return { stats, hp: stats.hp, pos: { x: 0, z }, facing, state: 'idle', stateTime: 0, dodgeCooldown: 0, dodgeDir: { x: 0, z: 0 } };
}

export function createBout(player: FighterStats, enemy: FighterStats): Bout {
  return {
    player: fighter(player, START_DISTANCE / 2, Math.PI),
    enemy: fighter(enemy, -START_DISTANCE / 2, 0),
    time: 0,
    paused: false,
    result: null,
  };
}

const setState = (f: Fighter, s: FighterState) => {
  f.state = s;
  f.stateTime = 0;
};

const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const bearing = (from: Fighter, to: Fighter) => Math.atan2(to.pos.x - from.pos.x, to.pos.z - from.pos.z);
const dist = (a: Fighter, b: Fighter) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

function applyCommand(f: Fighter, other: Fighter, c: Command): void {
  if (f.state === 'down') return;
  const free = f.state === 'idle' || f.state === 'block';
  if (free && c.dodge && f.dodgeCooldown <= 0) {
    let { x, z } = c.dodge;
    let len = Math.hypot(x, z);
    if (len < 1e-6) {
      // 沒給方向就往後退
      x = f.pos.x - other.pos.x;
      z = f.pos.z - other.pos.z;
      len = Math.hypot(x, z) || 1;
    }
    f.dodgeDir = { x: x / len, z: z / len };
    f.dodgeCooldown = DODGE_COOLDOWN;
    setState(f, 'dodge');
    return;
  }
  if (free && c.attack) {
    setState(f, 'windup');
    return;
  }
  if (f.state === 'idle' && c.block) setState(f, 'block');
  else if (f.state === 'block' && !c.block) setState(f, 'idle');
}

function move(f: Fighter, c: Command, dt: number): void {
  if (f.state === 'dodge') {
    f.pos.x += f.dodgeDir.x * DODGE_SPEED * dt;
    f.pos.z += f.dodgeDir.z * DODGE_SPEED * dt;
    return;
  }
  if ((f.state !== 'idle' && f.state !== 'block') || !c.move) return;
  const len = Math.hypot(c.move.x, c.move.z);
  if (len < 1e-6) return;
  const speed = MOVE_SPEED * (f.state === 'block' ? BLOCK_MOVE_FACTOR : 1) * Math.min(1, len);
  f.pos.x += (c.move.x / len) * speed * dt;
  f.pos.z += (c.move.z / len) * speed * dt;
}

function clampArena(f: Fighter): void {
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > ARENA_RADIUS) {
    f.pos.x *= ARENA_RADIUS / r;
    f.pos.z *= ARENA_RADIUS / r;
  }
}

function separate(a: Fighter, b: Fighter): void {
  const d = dist(a, b);
  if (d >= MIN_SEPARATION) return;
  let nx = a.pos.x - b.pos.x;
  let nz = a.pos.z - b.pos.z;
  const len = Math.hypot(nx, nz);
  if (len < 1e-6) {
    nx = 0;
    nz = 1;
  } else {
    nx /= len;
    nz /= len;
  }
  const push = (MIN_SEPARATION - d) / 2;
  a.pos.x += nx * push;
  a.pos.z += nz * push;
  b.pos.x -= nx * push;
  b.pos.z -= nz * push;
}

function resolveStrike(att: Fighter, tgt: Fighter, tgtSide: Side, b: Bout, ev: CombatEvent[]): void {
  const inReach = dist(att, tgt) <= att.stats.reach;
  const inArc = angleDiff(att.facing, bearing(att, tgt)) <= ((HIT_ARC_DEG / 2) * Math.PI) / 180;
  if (!inReach || !inArc || tgt.state === 'dodge' || tgt.state === 'down') {
    ev.push({ type: 'miss', target: tgtSide });
    return;
  }
  if (tgt.state === 'block' && angleDiff(tgt.facing, bearing(tgt, att)) <= ((BLOCK_ARC_DEG / 2) * Math.PI) / 180) {
    ev.push({ type: 'blocked', target: tgtSide });
    setState(att, 'stagger');
    return;
  }
  const dmg = att.stats.damage;
  tgt.hp = Math.max(0, tgt.hp - dmg);
  ev.push({ type: 'hit', target: tgtSide, damage: dmg });
  if (tgt.hp <= 0) {
    setState(tgt, 'down');
    b.result = tgtSide === 'enemy' ? 'win' : 'loss';
    ev.push({ type: 'end', result: b.result });
  } else {
    setState(tgt, 'stagger');
  }
}

function advance(f: Fighter, other: Fighter, side: Side, b: Bout, dt: number, ev: CombatEvent[]): void {
  f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
  if (f.state === 'down' || f.state === 'idle' || f.state === 'block') return;
  f.stateTime += dt;
  switch (f.state) {
    case 'windup':
      if (f.stateTime >= f.stats.windup) {
        setState(f, 'strike');
        resolveStrike(f, other, side === 'player' ? 'enemy' : 'player', b, ev);
      }
      break;
    case 'strike':
      if (f.stateTime >= STRIKE_TIME) setState(f, 'recover');
      break;
    case 'recover':
      if (f.stateTime >= f.stats.recover) setState(f, 'idle');
      break;
    case 'dodge':
      if (f.stateTime >= DODGE_TIME) setState(f, 'idle');
      break;
    case 'stagger':
      if (f.stateTime >= STAGGER_TIME) setState(f, 'idle');
      break;
  }
}

/** 推進一步模擬（會修改 b），回傳這一步發生的事件。dt 會被夾在 MAX_DT。 */
export function stepBout(b: Bout, dt: number, playerCmd: Command, enemyCmd: Command): CombatEvent[] {
  if (b.paused || b.result) return [];
  const step = Math.min(Math.max(dt, 0), MAX_DT);
  b.time += step;
  const ev: CombatEvent[] = [];
  const { player: p, enemy: e } = b;

  applyCommand(p, e, playerCmd);
  applyCommand(e, p, enemyCmd);
  move(p, playerCmd, step);
  move(e, enemyCmd, step);
  separate(p, e);
  clampArena(p);
  clampArena(e);
  // 雙方自動面向對方（倒地者除外）
  if (p.state !== 'down') p.facing = bearing(p, e);
  if (e.state !== 'down') e.facing = bearing(e, p);

  advance(p, e, 'player', b, step, ev);
  if (!b.result) advance(e, p, 'enemy', b, step, ev);
  return ev;
}
