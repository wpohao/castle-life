import * as THREE from 'three/webgpu';
import type { GameScene } from '../game';
import type { Hud } from '../ui/hud';
import { h } from '../ui/dom';
import { AnimatedCharacter } from './character';
import { mat } from './materials';
import { shotAt, weddingShots, WEDDING_SPOT, type Shot } from './weddingShots';

export interface WeddingScene extends GameScene {
  /** 準備角色並重設時間軸；完成（或跳過）時呼叫 onDone */
  start(playerName: string, ladyName: string, onDone: () => void): Promise<void>;
}

const GUEST_SPOTS: [number, number, number][] = [
  [-3.5, 0, -1.5], [3.5, 0, -1.5], [-2, 0, 0.5], [2, 0, 0.5], [-4.5, 0, 1], [4.5, 0, 1],
];

function buildArch(): THREE.Group {
  const g = new THREE.Group();
  const flowerMats = [0xe8a8b8, 0xffffff, 0xf2d06b, 0xd85a6a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 10), mat('wood'));
    post.position.set(sx * 1.4, 1.5, 0);
    post.castShadow = true;
    g.add(post);
  }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 8, 24, Math.PI), mat('wood'));
  arc.position.y = 3;
  g.add(arc);
  const flower = new THREE.IcosahedronGeometry(0.13, 0);
  for (let i = 0; i < 46; i++) {
    const t = i / 45;
    let x: number, y: number;
    if (t < 0.3) { x = -1.4; y = (t / 0.3) * 3; }
    else if (t < 0.7) { const a = Math.PI * (1 - (t - 0.3) / 0.4); x = Math.cos(a) * 1.4; y = 3 + Math.sin(a) * 1.4; }
    else { x = 1.4; y = 3 - ((t - 0.7) / 0.3) * 3; }
    const f = new THREE.Mesh(flower, flowerMats[i % flowerMats.length]);
    f.position.set(x + (Math.sin(i * 7) * 0.08), y, Math.cos(i * 5) * 0.12);
    g.add(f);
  }
  return g;
}

/**
 * 婚禮過場：借用城鎮場景（同一個 THREE.Scene），加上拱門、新人與賓客，
 * 用獨立鏡頭依序播放鏡頭與字幕。任意鍵可跳過。
 */
export function createWeddingScene(townScene: THREE.Scene, hud: Hud, uiRoot: HTMLElement): WeddingScene {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  const props = new THREE.Group();
  const arch = buildArch();
  arch.position.set(WEDDING_SPOT[0], 0, WEDDING_SPOT[2] - 1.3);
  props.add(arch);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 9), mat('cloth'));
  carpet.position.set(0, 0.04, WEDDING_SPOT[2] + 4);
  props.add(carpet);

  const caption = h('div', { className: 'wedding-caption' });
  const skipHint = h('div', { className: 'wedding-skip', text: '按任意鍵跳過' });
  let shots: Shot[] = [];
  let t = 0;
  let done: (() => void) | null = null;
  const actors: AnimatedCharacter[] = [];
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();

  const finish = () => {
    const cb = done;
    done = null;
    cb?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (t > 1) {
      e.preventDefault();
      finish();
    }
  };

  const wedding: WeddingScene = {
    scene: townScene,
    camera,
    async start(playerName, ladyName, onDone) {
      shots = weddingShots(playerName, ladyName);
      t = 0;
      done = onDone;
      for (const a of actors) a.root.removeFromParent();
      actors.length = 0;
      const looks: { key: 'player' | 'lady' | 'adventurerFemale' | 'king'; tint?: Record<string, number> }[] = [
        { key: 'player' }, { key: 'lady' },
        { key: 'adventurerFemale' }, { key: 'player', tint: { Green: 0x5a2a22, LightGreen: 0x7a3a2c } },
        { key: 'king' }, { key: 'adventurerFemale', tint: { Green: 0x3a3a5a } },
        { key: 'player', tint: { Green: 0xb59a6a, LightGreen: 0xcbb487 } }, { key: 'player', tint: { Green: 0x4a4a4a } },
      ];
      const made = await Promise.all(looks.map((l) => AnimatedCharacter.create(l.key)));
      made.forEach((a, i) => {
        if (looks[i]!.tint) a.tint(looks[i]!.tint!);
        actors.push(a);
        props.add(a.root);
      });
      const [groom, bride, ...guests] = made;
      groom!.root.position.set(WEDDING_SPOT[0] - 0.6, 0, WEDDING_SPOT[2]);
      groom!.root.rotation.y = Math.PI / 2;
      bride!.root.position.set(WEDDING_SPOT[0] + 0.6, 0, WEDDING_SPOT[2]);
      bride!.root.rotation.y = -Math.PI / 2;
      guests.forEach((g, i) => {
        const s = GUEST_SPOTS[i]!;
        g.root.position.set(s[0], 0, WEDDING_SPOT[2] + 6 + s[2]);
        g.root.rotation.y = Math.PI;
      });
      for (const a of made) a.loop('Idle');
    },
    enter() {
      townScene.add(props);
      uiRoot.append(caption, skipHint);
      hud.setVisible(false);
      window.addEventListener('keydown', onKey);
    },
    exit() {
      props.removeFromParent();
      caption.remove();
      skipHint.remove();
      hud.setVisible(true);
      window.removeEventListener('keydown', onKey);
    },
    update(dt) {
      t += dt;
      const cur = shotAt(shots, t);
      if (!cur) {
        finish();
        return;
      }
      const s = shots[cur.index]!;
      const k = THREE.MathUtils.smoothstep(cur.local / s.duration, 0, 1);
      from.set(...s.from);
      to.set(...s.to);
      camera.position.lerpVectors(from, to, k);
      camera.lookAt(...s.lookAt);
      if (caption.textContent !== s.caption) caption.textContent = s.caption;
      caption.style.opacity = String(Math.min(1, cur.local * 2, (s.duration - cur.local) * 2));
      // 「我願意」那一鏡，新娘揮手；最後一鏡賓客揮手
      if (cur.index === 2 && cur.local < dt * 1.5) actors[1]?.once('Wave', { duration: 2 });
      if (cur.index === 3 && cur.local < dt * 1.5) for (const g of actors.slice(2)) g.once('Wave', { duration: 2.5 });
      for (const a of actors) a.update(dt);
    },
  };
  return wedding;
}
