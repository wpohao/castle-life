import * as THREE from 'three/webgpu';
import type { Weapon } from '../config/items';
import { mat } from './materials';

/** 程式產生的武器模型：握把在原點，武器沿 +y 延伸。 */
export function buildWeaponModel(w: Weapon): THREE.Group {
  const g = new THREE.Group();
  g.name = `weapon:${w.id}`;
  const steel = w.id === 'rusty_sword' ? rusty() : w.id === 'knight_sword' ? polished() : mat('iron');
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, x = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  switch (w.kind) {
    case 'sword': {
      const len = w.reach * 0.55;
      add(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 8), mat('darkWood'), 0);
      add(new THREE.SphereGeometry(0.03, 8, 6), mat(w.id === 'knight_sword' ? 'gold' : 'iron'), -0.11);
      add(new THREE.BoxGeometry(0.22, 0.03, 0.04), mat(w.id === 'knight_sword' ? 'gold' : 'iron'), 0.11);
      const blade = add(new THREE.BoxGeometry(0.05, len, 0.008), steel, 0.12 + len / 2);
      const tip = add(new THREE.ConeGeometry(0.035, 0.1, 4), steel, 0.12 + len + 0.05);
      tip.scale.z = 0.25;
      blade.name = 'blade';
      break;
    }
    case 'axe': {
      add(new THREE.CylinderGeometry(0.022, 0.025, 0.85, 8), mat('wood'), 0.32);
      const head = add(new THREE.BoxGeometry(0.22, 0.2, 0.02), steel, 0.66, 0.1);
      head.name = 'blade';
      add(new THREE.BoxGeometry(0.06, 0.08, 0.05), steel, 0.66, -0.03);
      break;
    }
    case 'mace': {
      add(new THREE.CylinderGeometry(0.02, 0.022, 0.6, 8), mat('wood'), 0.2);
      const head = add(new THREE.IcosahedronGeometry(0.09, 0), steel, 0.55);
      head.name = 'blade';
      for (let i = 0; i < 6; i++) {
        const spike = add(new THREE.ConeGeometry(0.02, 0.07, 4), steel, 0.55);
        const dir = new THREE.Vector3(Math.cos(i), (i % 3) - 1, Math.sin(i * 2)).normalize();
        spike.position.addScaledVector(dir, 0.1);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      }
      break;
    }
    case 'spear': {
      add(new THREE.CylinderGeometry(0.02, 0.022, 2.0, 8), mat('wood'), 0.6);
      const head = add(new THREE.ConeGeometry(0.045, 0.3, 4), steel, 1.75);
      head.scale.z = 0.3;
      head.name = 'blade';
      break;
    }
  }
  return g;
}

let rustyMat: THREE.MeshStandardMaterial | null = null;
function rusty(): THREE.MeshStandardMaterial {
  return (rustyMat ??= new THREE.MeshStandardMaterial({ color: 0x7d5a44, roughness: 0.9, metalness: 0.5 }));
}

let polishedMat: THREE.MeshStandardMaterial | null = null;
function polished(): THREE.MeshStandardMaterial {
  return (polishedMat ??= new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.2, metalness: 1 }));
}
