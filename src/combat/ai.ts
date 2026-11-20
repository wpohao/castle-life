import type { Opponent } from '../config/arena';
import type { Bout, Command } from './combat';

export interface EnemyAI {
  decide(b: Bout, dt: number): Command;
}

type Reaction = 'block' | 'dodge' | 'none';

/**
 * 對手 AI（有狀態）：
 * - 玩家每次出手只擲一次骰決定格擋／閃避／硬吃，避免每幀重擲讓格擋率失真。
 * - 距離外靠近；距離內依積極度決定出手間隔。
 */
export function createEnemyAI(o: Opponent, rng: () => number): EnemyAI {
  let reaction: Reaction = 'none';
  let reactingToAttack = false;
  let attackTimer = nextAttackDelay();
  let strafe = rng() < 0.5 ? 1 : -1;
  let strafeTimer = 1 + rng() * 2;

  function nextAttackDelay(): number {
    return 0.25 + (1 - o.aggression) * 1.6 * (0.6 + rng() * 0.8);
  }

  return {
    decide(b, dt) {
      if (b.result) return {};
      const me = b.enemy;
      const p = b.player;
      const dx = p.pos.x - me.pos.x;
      const dz = p.pos.z - me.pos.z;
      const d = Math.hypot(dx, dz) || 1e-6;
      const toward = { x: dx / d, z: dz / d };

      // 對玩家出手的反應：每次出手只決定一次
      const playerAttacking = p.state === 'windup';
      if (playerAttacking && !reactingToAttack) {
        reactingToAttack = true;
        const r = rng();
        reaction = r < o.blockChance ? 'block' : r < o.blockChance + 0.12 * o.aggression ? 'dodge' : 'none';
      } else if (!playerAttacking && p.state !== 'strike') {
        reactingToAttack = false;
        reaction = 'none';
      }
      if (reactingToAttack && d <= p.stats.reach + 0.5) {
        if (reaction === 'block') return { block: true };
        if (reaction === 'dodge') {
          reaction = 'none';
          return { dodge: { x: -toward.z * strafe, z: toward.x * strafe } };
        }
      }

      strafeTimer -= dt;
      if (strafeTimer <= 0) {
        strafe = -strafe;
        strafeTimer = 1 + rng() * 2;
      }

      const ideal = me.stats.reach * 0.85;
      if (d > ideal) {
        // 靠近，帶一點側移
        const side = 0.25 * strafe;
        return { move: { x: toward.x - toward.z * side, z: toward.z + toward.x * side } };
      }

      attackTimer -= dt;
      if (attackTimer <= 0 && me.state === 'idle') {
        attackTimer = nextAttackDelay();
        return { attack: true };
      }
      if (d < 0.9) return { move: { x: -toward.x, z: -toward.z } };
      // 在距離內左右游移
      return { move: { x: -toward.z * strafe * 0.4, z: toward.x * strafe * 0.4 } };
    },
  };
}
