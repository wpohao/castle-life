import { createEnemyAI } from '../../src/combat/ai';
import { createBout, opponentStats, stepBout, weaponStats, type Bout, type Command } from '../../src/combat/combat';
import { OPPONENTS } from '../../src/config/arena';
import { getWeapon } from '../../src/config/items';

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

const DT = 1 / 30;

function simulate(oppIndex: number, playerScript: (b: Bout, t: number) => Command, seed: number): 'win' | 'loss' | null {
  const o = OPPONENTS[oppIndex]!;
  const b = createBout(weaponStats(getWeapon('rusty_sword')!), opponentStats(o));
  const ai = createEnemyAI(o, mulberry32(seed));
  for (let t = 0; t < 120 && !b.result; t += DT) stepBout(b, DT, playerScript(b, t), ai.decide(b, DT));
  return b.result;
}

test('AI 決策可重現（相同亂數種子產生相同指令序列）', () => {
  const run = () => {
    const o = OPPONENTS[3]!;
    const b = createBout(weaponStats(getWeapon('rusty_sword')!), opponentStats(o));
    const ai = createEnemyAI(o, mulberry32(42));
    const cmds: Command[] = [];
    for (let i = 0; i < 300; i++) {
      const c = ai.decide(b, DT);
      cmds.push(c);
      stepBout(b, DT, i % 20 === 0 ? { attack: true } : {}, c);
    }
    return JSON.stringify(cmds);
  };
  expect(run()).toBe(run());
});

test('遠距離時 AI 會朝玩家靠近', () => {
  const o = OPPONENTS[0]!;
  const b = createBout(weaponStats(getWeapon('rusty_sword')!), opponentStats(o));
  const c = createEnemyAI(o, mulberry32(1)).decide(b, DT);
  const toPlayer = { x: b.player.pos.x - b.enemy.pos.x, z: b.player.pos.z - b.enemy.pos.z };
  expect(c.move).toBeDefined();
  expect(c.move!.x * toPlayer.x + c.move!.z * toPlayer.z).toBeGreaterThan(0);
});

test('玩家出手時，格擋率高的對手會格擋', () => {
  const o = { ...OPPONENTS[6]!, blockChance: 1 };
  const b = createBout(weaponStats(getWeapon('rusty_sword')!), opponentStats(o));
  b.player.pos = { x: 0, z: 0 };
  b.enemy.pos = { x: 0, z: -1.5 };
  stepBout(b, DT, { attack: true }, {});
  expect(createEnemyAI(o, mulberry32(3)).decide(b, DT).block).toBe(true);
});

test('冠軍面對站著不動的玩家必勝', () => {
  for (let seed = 1; seed <= 20; seed++) expect(simulate(6, () => ({}), seed)).toBe('loss');
});

test('農家小子面對積極進攻的玩家勝率低於 20%', () => {
  const aggressive = (b: Bout, t: number): Command => {
    const dx = b.enemy.pos.x - b.player.pos.x;
    const dz = b.enemy.pos.z - b.player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.4) return { move: { x: dx / d, z: dz / d } };
    return { attack: Math.floor(t / 0.6) !== Math.floor((t - DT) / 0.6) };
  };
  let enemyWins = 0;
  for (let seed = 1; seed <= 50; seed++) if (simulate(0, aggressive, seed) === 'loss') enemyWins++;
  expect(enemyWins / 50).toBeLessThan(0.2);
});

test('難度遞增：同樣的玩家腳本，對冠軍的勝率比對農家小子低', () => {
  const script = (b: Bout, t: number): Command => {
    const dx = b.enemy.pos.x - b.player.pos.x;
    const dz = b.enemy.pos.z - b.player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.4) return { move: { x: dx / d, z: dz / d } };
    return { attack: Math.floor(t / 0.6) !== Math.floor((t - DT) / 0.6) };
  };
  const rate = (i: number) => {
    let w = 0;
    for (let seed = 1; seed <= 30; seed++) if (simulate(i, script, seed) === 'win') w++;
    return w / 30;
  };
  expect(rate(6)).toBeLessThan(rate(0));
});
