import * as THREE from 'three/webgpu';
import { mat, matDouble, worldScaleUV, type MaterialName } from './materials';
import { TOWN_LAYOUT, type Building } from './townLayout';

function mesh(geo: THREE.BufferGeometry, m: MaterialName, cast = true, receive = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat(m));
  o.castShadow = cast;
  o.receiveShadow = receive;
  return o;
}

function box(w: number, h: number, d: number, m: MaterialName, tile = 2): THREE.Mesh {
  return mesh(worldScaleUV(new THREE.BoxGeometry(w, h, d), tile), m);
}

/** 人字形屋頂（沿 x 方向的屋脊）。 */
function gableRoof(w: number, d: number, rise: number, overhang = 0.6): THREE.Mesh {
  const shape = new THREE.Shape();
  const hw = d / 2 + overhang;
  shape.moveTo(-hw, 0);
  shape.lineTo(0, rise);
  shape.lineTo(hw, 0);
  shape.lineTo(-hw, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
  geo.translate(0, 0, -(w + overhang * 2) / 2);
  geo.rotateY(Math.PI / 2);
  return mesh(worldScaleUV(geo, 1.5), 'roofTile');
}

function doorRotation(b: Building): number {
  return { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[b.door];
}

function addDoorAndSign(g: THREE.Group, b: Building, doorW = 1.6, doorH = 2.6): void {
  // 門與招牌放在建築本地 +z 面，再依門的方向旋轉整棟
  const depth = b.door === 'e' || b.door === 'w' ? b.w : b.d;
  const door = box(doorW, doorH, 0.15, 'darkWood', 1);
  door.position.set(0, doorH / 2, depth / 2 + 0.05);
  const frame = box(doorW + 0.4, 0.3, 0.3, 'wood', 1);
  frame.position.set(0, doorH + 0.15, depth / 2 + 0.1);
  const sign = box(1.8, 0.7, 0.08, 'wood', 1);
  sign.position.set(doorW / 2 + 1.4, doorH + 0.4, depth / 2 + 0.6);
  const arm = box(0.08, 0.08, 0.7, 'iron', 1);
  arm.position.set(doorW / 2 + 1.4, doorH + 0.85, depth / 2 + 0.3);
  g.add(door, frame, sign, arm);
}

function house(b: Building): THREE.Group {
  const g = new THREE.Group();
  const rotated = b.door === 'e' || b.door === 'w';
  const w = rotated ? b.d : b.w;
  const d = rotated ? b.w : b.d;
  const base = box(w, 1, d, 'stoneWall');
  base.position.y = 0.5;
  const walls = box(w - 0.2, b.h - 1, d - 0.2, 'plaster');
  walls.position.y = 1 + (b.h - 1) / 2;
  // 木骨架
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = box(0.3, b.h, 0.3, 'darkWood', 1);
      post.position.set((sx * (w - 0.2)) / 2, b.h / 2, (sz * (d - 0.2)) / 2);
      g.add(post);
    }
  }
  const beam = box(w, 0.25, d, 'darkWood', 1);
  beam.position.y = b.h * 0.55;
  const roof = gableRoof(Math.max(w, d), Math.min(w, d), Math.min(w, d) * 0.45);
  roof.rotation.y = w >= d ? 0 : Math.PI / 2;
  roof.position.y = b.h;
  const chimney = box(0.8, 2.5, 0.8, 'stoneWall', 1);
  chimney.position.set(w * 0.3, b.h + 1.5, -d * 0.15);
  g.add(base, walls, beam, roof, chimney);
  addDoorAndSign(g, { ...b, w, d, door: 's' });
  // 窗戶
  for (const sx of [-1, 1]) {
    const win = box(1, 1.1, 0.1, 'darkWood', 1);
    win.position.set(sx * w * 0.3, b.h * 0.65, d / 2 + 0.02);
    g.add(win);
  }
  return g;
}

function stall(b: Building): THREE.Group {
  const g = new THREE.Group();
  const rotated = b.door === 'e' || b.door === 'w';
  const w = rotated ? b.d : b.w;
  const d = rotated ? b.w : b.d;
  const counter = box(w, 1.1, 0.8, 'wood', 1);
  counter.position.set(0, 0.55, d / 2 - 0.4);
  const back = box(w, 2.2, 0.2, 'wood', 1);
  back.position.set(0, 1.1, -d / 2 + 0.1);
  g.add(counter, back);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = box(0.15, b.h, 0.15, 'darkWood', 1);
      post.position.set((sx * w) / 2, b.h / 2, (sz * d) / 2);
      g.add(post);
    }
  }
  const canopy = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 1.2, 8, 4), matDouble('cloth'));
  canopy.rotation.x = -Math.PI / 2 + 0.25;
  canopy.position.y = b.h + 0.2;
  canopy.castShadow = true;
  g.add(canopy);
  // 攤位上的小物
  const colors: MaterialName[] = ['cloth', 'clothBlue', 'gold'];
  for (let i = 0; i < 5; i++) {
    const item = box(0.3, 0.25, 0.3, colors[i % colors.length]!, 1);
    item.position.set(-w / 2 + 0.6 + i * ((w - 1.2) / 4), 1.25, d / 2 - 0.4);
    g.add(item);
  }
  return g;
}

function arena(b: Building): THREE.Group {
  const g = new THREE.Group();
  const r = b.w / 2;
  const segs = 28;
  const gapHalf = 0.22; // 入口缺口（弧度），朝向本地 +z
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const da = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(da) < gapHalf) continue;
    const segLen = (2 * Math.PI * r) / segs + 0.15;
    const wall = box(segLen, b.h, 1.2, 'castleStone');
    wall.position.set(Math.sin(a) * r, b.h / 2, Math.cos(a) * r);
    wall.rotation.y = a;
    g.add(wall);
    if (i % 2 === 0) {
      const merlon = box(1, 0.9, 1.2, 'castleStone', 1);
      merlon.position.set(Math.sin(a) * r, b.h + 0.45, Math.cos(a) * r);
      merlon.rotation.y = a;
      g.add(merlon);
    }
  }
  // 入口拱門
  for (const sx of [-1, 1]) {
    const pillar = box(1.4, b.h + 1.5, 1.6, 'castleStone');
    pillar.position.set(sx * 2.3, (b.h + 1.5) / 2, r);
    g.add(pillar);
  }
  const lintel = box(6, 1.2, 1.6, 'castleStone');
  lintel.position.set(0, b.h + 0.9, r);
  const banner = box(2.4, 1.6, 0.1, 'cloth', 1);
  banner.position.set(0, b.h - 0.5, r + 0.85);
  g.add(lintel, banner);
  const sand = mesh(new THREE.CircleGeometry(r - 0.6, 40), 'sand', false, true);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.02;
  g.add(sand);
  return g;
}

function manor(b: Building): THREE.Group {
  const g = new THREE.Group();
  const main = box(b.w, b.h, b.d, 'castleStone');
  main.position.y = b.h / 2;
  const roof = gableRoof(b.w, b.d, b.d * 0.35);
  roof.position.y = b.h;
  g.add(main, roof);
  for (const sx of [-1, 1]) {
    const tower = mesh(worldScaleUV(new THREE.CylinderGeometry(2.6, 2.8, b.h + 6, 20), 2), 'castleStone');
    tower.position.set((sx * b.w) / 2, (b.h + 6) / 2, b.d / 2 - 1);
    const cone = mesh(new THREE.ConeGeometry(3.2, 4.5, 20), 'roofTile');
    cone.position.set((sx * b.w) / 2, b.h + 6 + 2.25, b.d / 2 - 1);
    const flag = box(0.06, 2.4, 0.06, 'iron', 1);
    flag.position.set((sx * b.w) / 2, b.h + 6 + 5.5, b.d / 2 - 1);
    const cloth = box(1.2, 0.7, 0.04, 'clothBlue', 1);
    cloth.position.set((sx * b.w) / 2 + 0.62, b.h + 6 + 6.2, b.d / 2 - 1);
    g.add(tower, cone, flag, cloth);
  }
  // 大門與台階
  const door = box(3, 4.5, 0.3, 'darkWood', 1);
  door.position.set(0, 2.25 + 0.6, b.d / 2 + 0.05);
  const steps = box(6, 0.6, 2, 'stoneWall', 1);
  steps.position.set(0, 0.3, b.d / 2 + 1);
  g.add(door, steps);
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const win = box(1.1, 2.2, 0.12, 'darkWood', 1);
    win.position.set(i * 3, b.h * 0.6, b.d / 2 + 0.02);
    g.add(win);
  }
  for (const sx of [-1, 1]) {
    const banner = box(1.4, 3.5, 0.08, 'clothBlue', 1);
    banner.position.set(sx * 2.6, b.h * 0.55, b.d / 2 + 0.1);
    g.add(banner);
  }
  return g;
}

export function buildBuilding(b: Building): THREE.Group {
  let g: THREE.Group;
  switch (b.shape) {
    case 'house': g = house(b); break;
    case 'stall': g = stall(b); break;
    case 'arena': g = arena(b); break;
    case 'manor': g = manor(b); break;
  }
  g.position.set(b.x, 0, b.z);
  g.rotation.y = doorRotation(b);
  g.name = b.id;
  return g;
}

export function buildWalls(): THREE.Group {
  const g = new THREE.Group();
  const H = TOWN_LAYOUT.halfSize;
  const h = TOWN_LAYOUT.wallHeight;
  const T = 2;
  const sides: [number, number, number, number][] = [
    [0, -H - T / 2, 2 * H + 2 * T, T],
    [0, H + T / 2, 2 * H + 2 * T, T],
    [-H - T / 2, 0, T, 2 * H],
    [H + T / 2, 0, T, 2 * H],
  ];
  for (const [x, z, w, d] of sides) {
    const wall = box(w, h, d, 'castleStone', 3);
    wall.position.set(x, h / 2, z);
    g.add(wall);
    const along = w > d ? 'x' : 'z';
    const len = Math.max(w, d);
    for (let s = -len / 2 + 1; s < len / 2; s += 2.4) {
      const m = box(1.2, 1.1, T, 'castleStone', 1);
      m.position.set(along === 'x' ? x + s : x, h + 0.55, along === 'z' ? z + s : z);
      if (along === 'z') m.rotation.y = Math.PI / 2;
      g.add(m);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tower = mesh(worldScaleUV(new THREE.CylinderGeometry(3.5, 3.8, h + 5, 20), 3), 'castleStone');
      tower.position.set(sx * (H + 1), (h + 5) / 2, sz * (H + 1));
      const cone = mesh(new THREE.ConeGeometry(4.3, 5, 20), 'roofTile');
      cone.position.set(sx * (H + 1), h + 5 + 2.5, sz * (H + 1));
      g.add(tower, cone);
    }
  }
  // 南側城門（關閉的閘門）
  for (const sx of [-1, 1]) {
    const gt = box(5, h + 4, 5, 'castleStone', 3);
    gt.position.set(sx * 5, (h + 4) / 2, H + 1);
    g.add(gt);
  }
  const gateTop = box(6, 3, 5, 'castleStone', 3);
  gateTop.position.set(0, h + 0.5, H + 1);
  const portcullis = box(5, h - 1, 0.3, 'iron', 1);
  portcullis.position.set(0, (h - 1) / 2, H - 0.3);
  g.add(gateTop, portcullis);
  return g;
}

export function buildGround(): THREE.Group {
  const g = new THREE.Group();
  const H = TOWN_LAYOUT.halfSize;
  const groundGeo = new THREE.PlaneGeometry(H * 2 + 80, H * 2 + 80);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = mesh(worldScaleUV(groundGeo, 4), 'grass', false, true);
  g.add(ground);
  // 主幹道：城門 → 廣場 → 城主府
  const road = mesh(worldScaleUV(new THREE.BoxGeometry(6, 0.05, H * 2 - 6), 2), 'cobble', false, true);
  road.position.set(0, 0.025, 2);
  const crossRoad = mesh(worldScaleUV(new THREE.BoxGeometry(44, 0.05, 5), 2), 'cobble', false, true);
  crossRoad.position.set(0, 0.026, -3);
  const plazaGeo = new THREE.CircleGeometry(TOWN_LAYOUT.plazaRadius, 48);
  plazaGeo.rotateX(-Math.PI / 2);
  const plaza = mesh(worldScaleUV(plazaGeo, 2), 'cobble', false, true);
  plaza.position.y = 0.03;
  // 通往競技場與旅店的泥土路
  const path1 = mesh(worldScaleUV(new THREE.BoxGeometry(4, 0.05, 20), 2), 'dirt', false, true);
  path1.position.set(9.5, 0.024, 17);
  path1.rotation.y = 0.46;
  g.add(road, crossRoad, plaza, path1);
  // 水井
  const w = TOWN_LAYOUT.well;
  const ring = mesh(worldScaleUV(new THREE.CylinderGeometry(w.size / 2, w.size / 2 + 0.1, 1, 20, 1, true), 1), 'stoneWall');
  ring.material = matDouble('stoneWall');
  ring.position.set(w.x, 0.5, w.z);
  const water = mesh(new THREE.CircleGeometry(w.size / 2 - 0.1, 20), 'water', false, true);
  water.rotation.x = -Math.PI / 2;
  water.position.set(w.x, 0.35, w.z);
  const wellRoof = mesh(new THREE.ConeGeometry(1.8, 1.2, 4), 'roofTile');
  wellRoof.position.set(w.x, 3.2, w.z);
  wellRoof.rotation.y = Math.PI / 4;
  g.add(ring, water, wellRoof);
  for (const sx of [-1, 1]) {
    const post = box(0.15, 2.6, 0.15, 'darkWood', 1);
    post.position.set(w.x + sx * 0.9, 1.3 + 0.3, w.z);
    g.add(post);
  }
  return g;
}

/** 廣場周邊的裝飾：木桶、箱子、樹。 */
export function buildProps(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const barrelGeo = worldScaleUV(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 14), 1);
  const spots: [number, number][] = [[-15, 4], [-15.5, 5], [14, 3], [14.5, 2], [-5, 20], [5, -20], [-8, -22]];
  for (const [x, z] of spots) {
    const b = mesh(barrelGeo, 'wood');
    b.position.set(x, 0.45, z);
    g.add(b);
  }
  for (const [x, z] of [[-14, -8], [13, 6], [8, 18]] as [number, number][]) {
    const c = box(0.9, 0.9, 0.9, 'wood', 1);
    c.position.set(x, 0.45, z);
    c.rotation.y = rng() * Math.PI;
    g.add(c);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 8);
  const leafGeo = new THREE.IcosahedronGeometry(2, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: 1, flatShading: true });
  const trees: [number, number][] = [[-38, -38], [-40, -10], [-38, 40], [38, -40], [40, 8], [-30, -44], [30, -44], [44, -20], [-44, 20], [12, 44], [-20, 44]];
  for (const [x, z] of trees) {
    const t = mesh(trunkGeo, 'darkWood');
    t.position.set(x, 1.5, z);
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.castShadow = true;
    l.position.set(x, 3.8 + rng(), z);
    l.scale.setScalar(0.9 + rng() * 0.5);
    g.add(t, l);
  }
  return g;
}
