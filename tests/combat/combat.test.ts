import { createBout, stepBout, type Bout, type CombatEvent, type Command, type FighterStats } from '../../src/combat/combat';

const P: FighterStats = { hp: 100, damage: 10, windup: 0.4, recover: 0.3, reach: 2 };
const E: FighterStats = { hp: 30, damage: 5, windup: 0.5, recover: 0.3, reach: 2 };

function closeBout(): Bout {
  const b = createBout(P, E);
  b.player.pos = { x: 0, z: 0 };
  b.enemy.pos = { x: 0, z: -1.5 };
  return b;
}

function run(b: Bout, secs: number, p: Command = {}, e: Command = {}): CombatEvent[] {
  const ev: CombatEvent[] = [];
  for (let t = 0; t < secs - 1e-9; t += 0.05) ev.push(...stepBout(b, 0.05, p, e));
  return ev;
}

test('開場雙方面對面、滿血、狀態 idle', () => {
  const b = createBout(P, E);
  expect(b.player.hp).toBe(100);
  expect(b.enemy.hp).toBe(30);
  expect(b.player.state).toBe('idle');
  expect(Math.hypot(b.player.pos.x - b.enemy.pos.x, b.player.pos.z - b.enemy.pos.z)).toBeCloseTo(6);
  expect(b.result).toBeNull();
});

test('攻擊在 windup 後命中並扣血', () => {
  const b = closeBout();
  stepBout(b, 0.05, { attack: true }, {});
  const ev = run(b, 0.5);
  expect(ev).toContainEqual({ type: 'hit', target: 'enemy', damage: 10 });
  expect(b.enemy.hp).toBe(20);
});

test('windup 還沒結束前不會造成傷害', () => {
  const b = closeBout();
  stepBout(b, 0.05, { attack: true }, {});
  run(b, 0.25);
  expect(b.enemy.hp).toBe(30);
  expect(b.player.state).toBe('windup');
});

test('距離超過 reach 揮空', () => {
  const b = closeBout();
  b.enemy.pos = { x: 0, z: -5 };
  stepBout(b, 0.05, { attack: true }, {});
  const ev = run(b, 0.5);
  expect(ev).toContainEqual({ type: 'miss', target: 'enemy' });
  expect(b.enemy.hp).toBe(30);
});

test('正面格擋無傷害且攻擊者硬直', () => {
  const b = closeBout();
  stepBout(b, 0.05, { attack: true }, { block: true });
  const states: string[] = [];
  const ev: CombatEvent[] = [];
  for (let i = 0; i < 12; i++) {
    ev.push(...stepBout(b, 0.05, {}, { block: true }));
    states.push(b.player.state);
  }
  expect(ev).toContainEqual({ type: 'blocked', target: 'enemy' });
  expect(b.enemy.hp).toBe(30);
  expect(states).toContain('stagger');
});

test('閃避中不受傷', () => {
  const b = closeBout();
  stepBout(b, 0.05, { attack: true }, {});
  run(b, 0.2);
  stepBout(b, 0.05, {}, { dodge: { x: 1, z: 0 } });
  const ev = run(b, 0.3);
  expect(ev).toContainEqual({ type: 'miss', target: 'enemy' });
  expect(b.enemy.hp).toBe(30);
});

test('閃避有冷卻，冷卻內再按無效', () => {
  const b = closeBout();
  stepBout(b, 0.05, {}, { dodge: { x: 1, z: 0 } });
  run(b, 0.4);
  expect(b.enemy.state).toBe('idle');
  stepBout(b, 0.05, {}, { dodge: { x: 1, z: 0 } });
  expect(b.enemy.state).toBe('idle');
});

test('被打中會打斷對方的 windup', () => {
  const b = closeBout();
  stepBout(b, 0.05, { attack: true }, { attack: true });
  const ev = run(b, 0.6);
  expect(ev).toContainEqual({ type: 'hit', target: 'enemy', damage: 10 });
  expect(ev.some((e) => e.type === 'hit' && e.target === 'player')).toBe(false);
});

test('血量歸零結束，之後不再產生事件', () => {
  const b = closeBout();
  const ev: CombatEvent[] = [];
  for (let i = 0; i < 400 && !b.result; i++) ev.push(...stepBout(b, 0.05, { attack: true }, {}));
  expect(ev).toContainEqual({ type: 'end', result: 'win' });
  expect(b.result).toBe('win');
  expect(b.enemy.state).toBe('down');
  expect(stepBout(b, 0.05, { attack: true }, {})).toEqual([]);
});

test('玩家被打倒為 loss', () => {
  const b = closeBout();
  b.player.hp = 5;
  for (let i = 0; i < 100 && !b.result; i++) stepBout(b, 0.05, {}, { attack: true });
  expect(b.result).toBe('loss');
});

test('dt 尖峰被夾住：一次 step 5 秒不會讓攻擊直接結算', () => {
  const b = closeBout();
  stepBout(b, 0.05, { attack: true }, {});
  stepBout(b, 5, {}, {});
  expect(b.enemy.hp).toBe(30);
});

test('暫停時不前進', () => {
  const b = closeBout();
  b.paused = true;
  stepBout(b, 0.05, { attack: true }, {});
  expect(b.player.state).toBe('idle');
  expect(b.time).toBe(0);
});

test('移動會被限制在場地內', () => {
  const b = closeBout();
  for (let i = 0; i < 400; i++) stepBout(b, 0.05, { move: { x: 0, z: 1 } }, {});
  expect(Math.hypot(b.player.pos.x, b.player.pos.z)).toBeLessThanOrEqual(12 + 1e-6);
});

test('雙方不會重疊', () => {
  const b = closeBout();
  for (let i = 0; i < 60; i++) stepBout(b, 0.05, { move: { x: 0, z: -1 } }, {});
  expect(Math.hypot(b.player.pos.x - b.enemy.pos.x, b.player.pos.z - b.enemy.pos.z)).toBeGreaterThanOrEqual(0.8 - 1e-6);
});
