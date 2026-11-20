import { getGift, getHorse, getWeapon } from '../config/items';
import { equipWeapon, setActiveHorse } from '../core/economy';
import { ECONOMY_ERROR_TEXT, type UiContext } from './context';
import { h } from './dom';
import { weaponStats } from './shopRows';

/** 裝備畫面。面板靠右，左邊留給 3D 角色預覽（由 onPreview 切換鏡頭）。 */
export function openInventory(ctx: UiContext, onPreview: (on: boolean) => void): void {
  onPreview(true);
  ctx.panels.open(
    '個人裝備',
    (body) => {
      const render = () => {
        body.replaceChildren();
        const s = ctx.getState();
        body.append(h('p', {}, h('b', { text: s.playerName }), `　金幣 ${s.gold}　第 ${s.day} 天`));
        if (s.arena.champion) body.append(h('p', { className: 'muted', text: '🏆 競技場冠軍' }));
        else body.append(h('p', { className: 'muted', text: `競技場：已擊敗 ${s.arena.nextOpponent} 位對手` }));

        body.append(h('h3', { text: '武器' }));
        for (const id of s.ownedWeapons) {
          const w = getWeapon(id)!;
          const equipped = s.equippedWeapon === id;
          body.append(
            h('div', { className: 'row' },
              h('span', { text: `${w.name}${equipped ? '（裝備中）' : ''}` }),
              h('span', { className: 'muted', text: weaponStats(w) }),
              !equipped && h('button', { text: '裝備', onClick: () => apply(equipWeapon(ctx.getState(), id), `換上了${w.name}。`) }),
            ),
          );
        }

        body.append(h('h3', { text: '馬匹' }));
        if (s.ownedHorses.length === 0) body.append(h('p', { className: 'muted', text: '還沒有馬。可以到東邊的馬廄購買。' }));
        for (const id of s.ownedHorses) {
          const horse = getHorse(id)!;
          const active = s.activeHorse === id;
          body.append(
            h('div', { className: 'row' },
              h('span', { text: `${horse.name}${active ? '（坐騎）' : ''}` }),
              h('span', { className: 'muted', text: `速度 ${horse.speed}` }),
              active
                ? h('button', { text: '牽回馬廄', onClick: () => apply(setActiveHorse(ctx.getState(), null), `${horse.name}回馬廄休息了。`) })
                : h('button', { text: '設為坐騎', onClick: () => apply(setActiveHorse(ctx.getState(), id), `${horse.name}成為你的坐騎，按 F 上馬。`) }),
            ),
          );
        }

        body.append(h('h3', { text: '禮物' }));
        const gifts = Object.entries(s.gifts).filter(([, n]) => n > 0);
        if (gifts.length === 0) body.append(h('p', { className: 'muted', text: '沒有禮物。' }));
        for (const [id, n] of gifts) body.append(h('div', { className: 'row' }, h('span', { text: `${getGift(id)?.name ?? id} × ${n}` })));
      };
      const apply = (r: ReturnType<typeof equipWeapon>, msg: string) => {
        if (r.ok) {
          ctx.setState(r.state);
          ctx.toast(msg);
        } else ctx.toast(ECONOMY_ERROR_TEXT[r.reason]);
        render();
      };
      render();
    },
    { className: 'panel-right', onClose: () => onPreview(false) },
  );
}
