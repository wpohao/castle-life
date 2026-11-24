import { restUntilNextDay } from '../core/time';
import type { UiContext } from './context';
import { h } from './dom';

export function openInn(ctx: UiContext): void {
  ctx.panels.open('旅店「金麥穗」', (body, close) => {
    body.append(
      h('p', { className: 'muted', text: '老闆娘擦著酒杯：「累了吧？樓上的房間都整理好了。」' }),
      h('p', { text: '休息一晚會進入下一天，送禮的每日次數會重置。' }),
      h('button', {
        text: '休息一晚（免費）',
        onClick: () => {
          const next = restUntilNextDay(ctx.getState());
          ctx.setState(next);
          close();
          ctx.toast(`你睡了個好覺。第 ${next.day} 天的早晨。`);
        },
      }),
    );
  });
}
