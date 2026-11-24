import { getGift, RING_GIFT_ID } from '../config/items';
import { GIFT_DELTA, LADY } from '../config/romance';
import { getStage, giveGift, propose } from '../romance/affection';
import type { UiContext } from './context';
import { h } from './dom';

export interface LadyVisitHooks {
  /** 她有反應時（給 3D 角色播動作） */
  onLadyReact(kind: 'happy' | 'sad'): void;
  onProposalAccepted(): void;
  onClose(): void;
}

const GIFT_LINES: Record<keyof typeof GIFT_DELTA, string> = {
  favorite: '（艾琳娜眼睛一亮，捧著禮物捨不得放下）這……你怎麼知道我最想要這個？謝謝你！',
  liked: '（她開心地笑了）好漂亮，我很喜歡。謝謝你。',
  neutral: '（她禮貌地收下）謝謝你的心意。',
  disliked: '（她皺了皺眉，把東西推了回來）……我不太喜歡這種東西。',
};

const PROPOSAL_LINES = {
  no_ring: '（你摸了摸口袋——沒有戒指。還是先去禮品攤看看吧。）',
  not_ready: '（艾琳娜愣住了，臉頰微紅，輕輕搖頭）……對不起，我們認識還不夠久。再給我一點時間，好嗎？',
  accepted: '（艾琳娜捂住嘴，眼眶泛紅，用力點頭）……我願意。我一直在等你說這句話。',
  already_married: '（她笑著輕捶你一下）傻瓜，我們已經結婚了呀。',
} as const;

/** 城主府與艾琳娜見面：送禮、求婚。 */
export function openLadyVisit(ctx: UiContext, hooks: LadyVisitHooks): void {
  let closing = false;
  ctx.panels.open(
    `與${LADY.name}見面`,
    (body, close) => {
      const header = h('p', { className: 'muted' });
      const log = h('div', { className: 'chat-log' });
      const giftSel = h('select') as HTMLSelectElement;
      const giftBtn = h('button', { text: '送禮' });
      const proposeBtn = h('button', { text: '💍 求婚' });

      const add = (who: 'lady' | 'note', text: string) => {
        const line = h('div', { className: `chat-line ${who}` });
        if (who === 'lady') line.append(h('b', { text: LADY.name }), '：');
        line.append(text);
        log.append(line);
        log.scrollTop = log.scrollHeight;
      };

      const refresh = () => {
        const s = ctx.getState();
        const stage = s.romance.married ? '夫妻' : getStage(s.romance.affection).name;
        header.textContent = `關係：${stage}｜${s.romance.giftGivenToday ? '今天已送過禮' : '今天還可以送一次禮'}`;
        giftSel.replaceChildren();
        const gifts = Object.entries(s.gifts).filter(([id, n]) => n > 0 && id !== RING_GIFT_ID);
        for (const [id, n] of gifts) {
          const o = h('option', { text: `${getGift(id)?.name ?? id} ×${n}` }) as HTMLOptionElement;
          o.value = id;
          giftSel.append(o);
        }
        giftSel.disabled = gifts.length === 0 || closing;
        giftBtn.disabled = gifts.length === 0 || closing || s.romance.giftGivenToday;
        proposeBtn.style.display = s.romance.married ? 'none' : '';
        proposeBtn.disabled = closing;
      };

      giftBtn.addEventListener('click', () => {
        const id = giftSel.value;
        const r = giveGift(ctx.getState(), id);
        if ('error' in r) {
          add('note', r.error === 'already_gifted_today' ? '（今天已經送過禮了。）' : '（沒有這個禮物。）');
        } else {
          ctx.setState(r.state);
          add('note', `你送給她${getGift(id)?.name ?? ''}。`);
          add('lady', GIFT_LINES[r.reaction]);
          hooks.onLadyReact(r.delta > 0 ? 'happy' : 'sad');
        }
        refresh();
      });

      proposeBtn.addEventListener('click', () => {
        const r = propose(ctx.getState());
        ctx.setState(r.state);
        add('lady', PROPOSAL_LINES[r.reason]);
        if (r.accepted) {
          closing = true;
          hooks.onLadyReact('happy');
          setTimeout(() => {
            close();
            hooks.onProposalAccepted();
          }, 2500);
        } else if (r.reason === 'not_ready') hooks.onLadyReact('sad');
        refresh();
      });

      add('note', `（${LADY.name}正在窗邊看書，聽到腳步聲抬起頭來。）`);
      body.append(header, log, h('div', { className: 'row' }, giftSel, giftBtn, proposeBtn));
      refresh();
    },
    {
      className: 'panel-chat',
      onClose: () => hooks.onClose(),
    },
  );
}
