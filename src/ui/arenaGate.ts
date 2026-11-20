import { OPPONENTS } from '../config/arena';
import { getWeapon } from '../config/items';
import { currentOpponentIndex, REMATCH_PRIZE_FACTOR } from '../core/arenaProgress';
import type { UiContext } from './context';
import { h } from './dom';

/** 競技場入口：顯示下一位對手與獎金，按「上場」開打。 */
export function openArenaGate(ctx: UiContext, onFight: () => void): void {
  ctx.panels.open('競技場', (body, close) => {
    const s = ctx.getState();
    const idx = currentOpponentIndex(s);
    const opp = OPPONENTS[idx]!;
    const prize = s.arena.champion ? Math.floor(opp.prize * REMATCH_PRIZE_FACTOR) : opp.prize;
    body.append(
      h('p', { className: 'muted', text: s.arena.champion ? '你已經是冠軍了。冠軍還是可以接受挑戰、賺點獎金。' : '主持人高喊：「下一位挑戰者，上前來！」' }),
      h('p', {}, h('b', { text: `第 ${idx + 1} 戰／共 ${OPPONENTS.length} 戰` })),
      h('p', { text: `對手：${opp.title}　${opp.name}` }),
      h('p', { className: 'muted', text: `體力 ${opp.hp}｜攻擊 ${opp.damage}｜出手 ${opp.windup.toFixed(2)} 秒` }),
      h('p', { text: `獎金：${prize} 金幣` }),
      h('p', { className: 'muted', text: `你的武器：${getWeapon(s.equippedWeapon)?.name ?? '—'}（體力 100）` }),
      h('p', { className: 'muted', text: '輸了不會扣錢，可以隨時再挑戰。' }),
      h('div', { className: 'row' },
        h('button', { text: '上場！', onClick: () => { close(); onFight(); } }),
        h('button', { text: '再準備一下', onClick: () => close() }),
      ),
    );
  });
}
