import { getGift, RING_GIFT_ID } from '../config/items';
import { DAILY_CHAT_LIMIT, GIFT_DELTA, LADY } from '../config/romance';
import { getStage, giveGift, propose } from '../romance/affection';
import { talk } from '../romance/conversation';
import type { LlmClient, LlmStatus } from '../romance/llmClient';
import type { UiContext } from './context';
import { h } from './dom';

export interface ChatHooks {
  llm: LlmClient;
  retryLoad(): void;
  /** 她說話時（給 3D 角色播動作） */
  onLadySpeak(kind: 'talk' | 'happy' | 'sad'): void;
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

function statusText(s: LlmStatus): string | null {
  switch (s.kind) {
    case 'idle': return '對話模型尚未開始載入。';
    case 'loading': return `對話模型下載中…… ${Math.round(s.progress * 100)}%（第一次需要較久，之後會從快取載入）`;
    case 'error': return s.message;
    default: return null;
  }
}

export function openChat(ctx: UiContext, hooks: ChatHooks): void {
  let unsub: (() => void) | null = null;
  ctx.panels.open(
    `與${LADY.name}交談`,
    (body, close) => {
      const header = h('p', { className: 'muted' });
      const log = h('div', { className: 'chat-log' });
      const status = h('div', { className: 'chat-status' });
      const retry = h('button', { text: '重試', onClick: () => hooks.retryLoad() });
      const input = h('input') as HTMLInputElement;
      input.type = 'text';
      input.placeholder = '想對她說什麼？';
      input.maxLength = 400;
      const send = h('button', { text: '說' });
      const giftSel = h('select') as HTMLSelectElement;
      const giftBtn = h('button', { text: '送禮' });
      const proposeBtn = h('button', { text: '💍 求婚' });
      let busy = false;

      const add = (who: 'player' | 'lady' | 'note', text: string) => {
        const line = h('div', { className: `chat-line ${who}` });
        if (who !== 'note') line.append(h('b', { text: who === 'player' ? ctx.getState().playerName : LADY.name }), '：');
        line.append(text);
        log.append(line);
        log.scrollTop = log.scrollHeight;
        return line;
      };

      const refresh = () => {
        const s = ctx.getState();
        const stage = s.romance.married ? '夫妻' : getStage(s.romance.affection).name;
        const left = s.romance.married ? '不限' : `${Math.max(0, DAILY_CHAT_LIMIT - s.romance.chatsToday)} 句`;
        header.textContent = `關係：${stage}｜今天還能聊 ${left}｜${s.romance.giftGivenToday ? '今天已送過禮' : '今天還可以送一次禮'}`;
        const st = hooks.llm.status;
        const msg = statusText(st);
        status.replaceChildren();
        if (msg) status.append(msg);
        if (st.kind === 'error') status.append(' ', retry);
        status.style.display = msg ? '' : 'none';
        const canTalk = st.kind === 'ready' && !busy;
        send.disabled = !canTalk;
        input.disabled = st.kind !== 'ready' && st.kind !== 'generating';
        giftSel.replaceChildren();
        const gifts = Object.entries(s.gifts).filter(([id, n]) => n > 0 && id !== RING_GIFT_ID);
        for (const [id, n] of gifts) {
          const o = h('option', { text: `${getGift(id)?.name ?? id} ×${n}` }) as HTMLOptionElement;
          o.value = id;
          giftSel.append(o);
        }
        giftSel.disabled = gifts.length === 0 || busy;
        giftBtn.disabled = gifts.length === 0 || busy || s.romance.giftGivenToday;
        proposeBtn.style.display = s.romance.married ? 'none' : '';
        proposeBtn.disabled = busy;
      };

      const doSend = async () => {
        if (busy) return;
        const text = input.value;
        busy = true;
        refresh();
        const thinking = text.trim() ? add('note', `（${LADY.name}正在想該怎麼回答……）`) : null;
        const res = await talk(ctx.getState(), text, hooks.llm);
        thinking?.remove();
        busy = false;
        if (res.kind === 'rejected') {
          if (res.reason === 'daily_limit') add('note', '（艾琳娜：「今天聊了好多呢……我有點累了，明天再來找我好嗎？」）');
          else if (res.reason === 'llm_unavailable') add('note', '（對話模型還沒準備好，請稍候。）');
          refresh();
          return;
        }
        add('player', Array.from(text.trim()).slice(0, 200).join(''));
        input.value = '';
        ctx.setState(res.state);
        add('lady', res.reply);
        hooks.onLadySpeak(res.delta > 0 ? 'happy' : res.delta < 0 ? 'sad' : 'talk');
        refresh();
        input.focus();
      };
      send.addEventListener('click', () => void doSend());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) void doSend();
      });

      giftBtn.addEventListener('click', () => {
        const id = giftSel.value;
        const r = giveGift(ctx.getState(), id);
        if ('error' in r) {
          add('note', r.error === 'already_gifted_today' ? '（今天已經送過禮了。）' : '（沒有這個禮物。）');
        } else {
          ctx.setState(r.state);
          add('note', `你送給她${getGift(id)?.name ?? ''}。`);
          add('lady', GIFT_LINES[r.reaction]);
          hooks.onLadySpeak(r.delta > 0 ? 'happy' : 'sad');
        }
        refresh();
      });

      proposeBtn.addEventListener('click', () => {
        const r = propose(ctx.getState());
        ctx.setState(r.state);
        add('lady', PROPOSAL_LINES[r.reason]);
        refresh();
        if (r.accepted) {
          hooks.onLadySpeak('happy');
          setTimeout(() => {
            close();
            hooks.onProposalAccepted();
          }, 2500);
        } else if (r.reason === 'not_ready') hooks.onLadySpeak('sad');
      });

      // 先放最近的對話記憶
      for (const m of ctx.getState().romance.memory) add(m.role, m.text);
      if (ctx.getState().romance.memory.length === 0) add('note', `（${LADY.name}正在窗邊看書，聽到腳步聲抬起頭來。）`);

      unsub = hooks.llm.onStatus(() => refresh());
      body.append(header, log, status, h('div', { className: 'row' }, input, send), h('div', { className: 'row' }, giftSel, giftBtn, proposeBtn));
      refresh();
      setTimeout(() => input.focus(), 50);
    },
    {
      className: 'panel-chat',
      onClose: () => {
        unsub?.();
        hooks.onClose();
      },
    },
  );
}
