import { buyGift, buyHorse, buyWeapon, type EconomyResult } from '../core/economy';
import type { GameState } from '../core/state';
import { ECONOMY_ERROR_TEXT, type UiContext } from './context';
import { h } from './dom';
import { giftRows, horseRows, weaponRows, type ShopRow } from './shopRows';

export type ShopKind = 'weapon' | 'horse' | 'gift';

const SHOP: Record<ShopKind, { title: string; greet: string; rows: (s: GameState) => ShopRow[]; buy: (s: GameState, id: string) => EconomyResult; after: (name: string) => string }> = {
  weapon: { title: '武器鋪', greet: '鐵匠擦了擦手：「看看吧，都是好鋼。」', rows: weaponRows, buy: buyWeapon, after: (n) => `買下了${n}。到裝備畫面（I）就能換上。` },
  horse: { title: '馬廄', greet: '馬夫拍拍馬脖子：「每一匹都養得很壯。」', rows: horseRows, buy: buyHorse, after: (n) => `買下了${n}。到裝備畫面（I）設為坐騎，就能按 F 騎乘。` },
  gift: { title: '禮品攤', greet: '攤主笑著說：「送給心上人的嗎？」', rows: giftRows, buy: buyGift, after: (n) => `買下了${n}。` },
};

export function openShop(ctx: UiContext, kind: ShopKind): void {
  const def = SHOP[kind];
  ctx.panels.open(def.title, (body) => {
    const render = () => {
      body.replaceChildren();
      const s = ctx.getState();
      body.append(h('p', { className: 'muted', text: def.greet }), h('p', { text: `你的金幣：${s.gold}` }));
      const table = h('table');
      table.append(h('tr', {}, h('th', { text: '品項' }), h('th', { text: '說明' }), h('th', { text: '價格' }), h('th')));
      for (const r of def.rows(s)) {
        const btn =
          r.action === 'owned'
            ? h('button', { text: '已擁有', disabled: true })
            : h('button', {
                text: '購買',
                disabled: !r.affordable,
                onClick: () => {
                  const res = def.buy(ctx.getState(), r.id);
                  if (res.ok) {
                    ctx.setState(res.state);
                    ctx.toast(def.after(r.name));
                  } else ctx.toast(ECONOMY_ERROR_TEXT[res.reason]);
                  render();
                },
              });
        table.append(h('tr', {}, h('td', { text: r.name }), h('td', { className: 'muted', text: r.stats }), h('td', { text: `${r.price} 金` }), h('td', {}, btn)));
      }
      body.append(table);
    };
    render();
  });
}
