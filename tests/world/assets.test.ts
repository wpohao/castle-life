import * as THREE from 'three/webgpu';
import { attachWeapon, findHandBone, loadModel } from '../../src/world/assets';
import { buildWeaponModel } from '../../src/world/weapons';
import { WEAPONS } from '../../src/config/items';

test('載入失敗回傳佔位模型而不是丟例外', async () => {
  const loader = { loadAsync: async () => { throw new Error('404'); } };
  const r = await loadModel('player', loader);
  expect(r.placeholder).toBe(true);
  expect(r.scene.children.length).toBeGreaterThan(0);
  expect(r.animations).toEqual([]);
});

test('載入成功時回傳原始場景與動畫', async () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)));
  const clip = new THREE.AnimationClip('Idle', 1, []);
  const loader = { loadAsync: async () => ({ scene, animations: [clip] }) };
  const r = await loadModel('player', loader);
  expect(r.placeholder).toBe(false);
  expect(r.animations).toEqual([clip]);
});

test('findHandBone 找到 handslot.r', () => {
  const root = new THREE.Object3D();
  const b = new THREE.Bone();
  b.name = 'handslot.r';
  root.add(b);
  expect(findHandBone(root)).toBe(b);
});

test('findHandBone 找到 Quaternius 骨架的 Wrist.R，不會誤抓左手', () => {
  const root = new THREE.Object3D();
  const l = new THREE.Bone();
  l.name = 'Wrist.L';
  const r = new THREE.Bone();
  r.name = 'Wrist.R';
  root.add(l, r);
  expect(findHandBone(root)).toBe(r);
});

test('沒有手部骨骼時武器仍掛在角色上', () => {
  const c = new THREE.Object3D();
  const w = new THREE.Object3D();
  attachWeapon(c, w);
  expect(w.parent).toBe(c);
});

test('重新掛武器會先移除舊武器', () => {
  const c = new THREE.Object3D();
  const a = new THREE.Object3D();
  const b = new THREE.Object3D();
  attachWeapon(c, a);
  attachWeapon(c, b);
  expect(a.parent).toBeNull();
  expect(b.parent).toBe(c);
});

test('每把武器都能產生模型，長槍比劍長', () => {
  const len = (id: string) => new THREE.Box3().setFromObject(buildWeaponModel(WEAPONS.find((w) => w.id === id)!)).getSize(new THREE.Vector3()).y;
  for (const w of WEAPONS) expect(buildWeaponModel(w).children.length).toBeGreaterThan(0);
  expect(len('spear')).toBeGreaterThan(len('iron_sword'));
});
