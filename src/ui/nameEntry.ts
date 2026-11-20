import { PLAYER_NAME_MAX, sanitizePlayerName } from '../core/state';
import { h } from './dom';

/** 新遊戲取名畫面。 */
export function openNameEntry(root: HTMLElement, onDone: (name: string) => void): void {
  const input = h('input') as HTMLInputElement;
  input.type = 'text';
  input.maxLength = PLAYER_NAME_MAX * 2;
  input.placeholder = '你的名字';
  const err = h('p', { className: 'muted' });
  const submit = () => {
    const name = sanitizePlayerName(input.value);
    if (!name) {
      err.textContent = '請輸入名字。';
      return;
    }
    wrap.remove();
    onDone(name);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  const wrap = h('div', { className: 'fullscreen-msg' },
    h('div', { className: 'box' },
      h('h1', { text: '城堡生活' }),
      h('p', { text: '你是一名剛來到這座城的旅人。這裡有熱鬧的市集、競技場，還有城主府裡那位據說愛看星星的小姐……' }),
      h('p', { text: `請為自己取個名字（最多 ${PLAYER_NAME_MAX} 字）：` }),
      h('div', { className: 'row' }, input, h('button', { text: '開始', onClick: submit })),
      err,
    ),
  );
  root.append(wrap);
  input.focus();
}
