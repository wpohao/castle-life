import * as THREE from 'three/webgpu';
import { builtinAOContext, mrt, normalView, pass, screenUV } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { QualityPreset } from '../config/quality';

/** 載入 Poly Haven CC0 HDRI 天空；失敗回傳 null（場景保留純色天空）。 */
export async function loadSky(): Promise<THREE.Texture | null> {
  try {
    const tex = await new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}assets/hdri/sky.hdr`);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  } catch (e) {
    console.warn('[castle-life] HDRI 載入失敗，改用純色天空', e);
    return null;
  }
}

export interface EnvironmentOptions {
  hdri: THREE.Texture | null;
  /** false 時只拿 HDRI 當反射光源，不當背景（室內） */
  asBackground: boolean;
  environmentIntensity: number;
  fog?: { color: number; near: number; far: number };
}

export function applyEnvironment(scene: THREE.Scene, o: EnvironmentOptions): void {
  if (o.hdri) {
    scene.environment = o.hdri;
    scene.environmentIntensity = o.environmentIntensity;
    if (o.asBackground) {
      scene.background = o.hdri;
      scene.backgroundIntensity = 1;
    }
  }
  if (o.fog) scene.fog = new THREE.Fog(o.fog.color, o.fog.near, o.fog.far);
}

/** 依畫質設定所有平行光的陰影解析度。 */
export function applyShadowQuality(scene: THREE.Scene, preset: QualityPreset): void {
  scene.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (l.isDirectionalLight && l.castShadow && l.shadow.mapSize.x !== preset.shadowMapSize) {
      l.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      l.shadow.map?.dispose();
      l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
  });
}

export interface SceneOutput {
  render(): void;
  dispose(): void;
}

/**
 * 建立一個場景的最終輸出。AO 與 bloom 都關閉時直接 renderer.render（最省）；
 * 否則用 RenderPipeline：GTAO 需要額外一次法線／深度預先繪製，bloom 疊在場景色彩上。
 */
export function createSceneOutput(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, preset: QualityPreset): SceneOutput {
  if (!preset.ao && !preset.bloom) {
    return { render: () => renderer.render(scene, camera), dispose: () => {} };
  }
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  if (preset.ao) {
    const prePass = pass(scene, camera);
    prePass.setMRT(mrt({ output: normalView }));
    const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), camera);
    aoPass.resolutionScale = 0.5;
    scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  }
  const color = scenePass.getTextureNode('output');
  pipeline.outputNode = preset.bloom ? color.add(bloom(color, 0.25, 0.4, 0.85)) : scenePass;
  return {
    render: () => pipeline.render(),
    dispose: () => pipeline.dispose(),
  };
}
