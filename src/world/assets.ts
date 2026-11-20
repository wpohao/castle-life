import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ASSET_HEIGHT, assetUrl, type AssetKey } from './assetManifest';
import { createPlaceholderHumanoid } from './player';

export interface LoadedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  placeholder: boolean;
}

export interface ModelLoader {
  loadAsync(url: string): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>;
}

let defaultLoader: ModelLoader | null = null;
const cache = new Map<AssetKey, Promise<LoadedModel>>();

function placeholderFor(key: AssetKey): THREE.Object3D {
  if (key.startsWith('horse')) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 1.8), new THREE.MeshStandardMaterial({ color: 0x7a4a2a }));
    body.position.y = 1.2;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.4), new THREE.MeshStandardMaterial({ color: 0x7a4a2a }));
    neck.position.set(0, 1.7, 0.85);
    neck.rotation.x = 0.5;
    g.add(body, neck);
    for (const [x, z] of [[-0.2, -0.7], [0.2, -0.7], [-0.2, 0.7], [0.2, 0.7]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), new THREE.MeshStandardMaterial({ color: 0x4a2a1a }));
      leg.position.set(x, 0.45, z);
      g.add(leg);
    }
    return g;
  }
  return createPlaceholderHumanoid(key === 'lady' ? 0x2f6b3a : 0x3b5b8c);
}

/** 依包圍盒把模型縮放到指定高度，並讓腳底貼齊 y=0。 */
export function normalizeHeight(obj: THREE.Object3D, height: number): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if (size.y <= 0) return;
  obj.scale.multiplyScalar(height / size.y);
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
}

/** 載入模型；失敗時回傳佔位模型，不丟例外。 */
export async function loadModel(key: AssetKey, loader?: ModelLoader): Promise<LoadedModel> {
  const l = loader ?? (defaultLoader ??= new GLTFLoader() as unknown as ModelLoader);
  try {
    const g = await l.loadAsync(assetUrl(key));
    g.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return { scene: g.scene, animations: g.animations, placeholder: false };
  } catch (e) {
    console.warn(`[castle-life] 模型 ${key} 載入失敗，改用佔位模型`, e);
    return { scene: placeholderFor(key), animations: [], placeholder: true };
  }
}

/**
 * 取得一份可獨立擺放、可獨立播動畫的模型實例（共用快取的原始檔）。
 * 外層包一個 Group，縮放與位移放在內層，外層由遊戲自由控制位置與朝向。
 */
export async function instantiate(key: AssetKey): Promise<{ root: THREE.Group; model: THREE.Object3D; animations: THREE.AnimationClip[]; placeholder: boolean }> {
  let p = cache.get(key);
  if (!p) {
    p = loadModel(key);
    cache.set(key, p);
  }
  const base = await p;
  const model = base.placeholder ? placeholderFor(key) : cloneSkinned(base.scene);
  if (!base.placeholder) normalizeHeight(model, ASSET_HEIGHT[key]);
  const root = new THREE.Group();
  root.add(model);
  return { root, model, animations: base.animations, placeholder: base.placeholder };
}

const HAND_RE = /hand.?slot.?r|wrist.?r$|righthand|hand.?r$/i;

export function findHandBone(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && HAND_RE.test(o.name)) found = o;
  });
  return found;
}

const WEAPON_SLOT = 'weapon-slot';

/** 把武器掛到右手骨骼；找不到骨骼時掛在角色右前方。會先移除舊武器。 */
export function attachWeapon(character: THREE.Object3D, weapon: THREE.Object3D): void {
  const old: THREE.Object3D[] = [];
  character.traverse((o) => {
    if (o.userData[WEAPON_SLOT] && o !== weapon) old.push(o);
  });
  for (const o of old) o.removeFromParent();
  weapon.userData[WEAPON_SLOT] = true;
  const hand = findHandBone(character);
  if (hand) {
    // 骨骼常帶有模型的縮放，抵銷之讓武器保持真實尺寸
    hand.updateMatrixWorld(true);
    const s = new THREE.Vector3();
    hand.getWorldScale(s);
    const root = new THREE.Vector3();
    character.getWorldScale(root);
    weapon.scale.setScalar(root.x / (s.x || 1));
    hand.add(weapon);
  } else {
    weapon.position.set(0.35, 0.9, 0.2);
    character.add(weapon);
  }
}

/** 依名稱找動畫（忽略 "Armature|" 前綴）。 */
export function findClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined {
  return clips.find((c) => c.name === name) ?? clips.find((c) => c.name.split('|').pop() === name);
}
