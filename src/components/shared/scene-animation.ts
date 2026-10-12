import type { Air75SceneControls } from "./ansi-scene-config"

import type { KeyboardShaderMaterial, KeyboardSharedUniforms } from "./shaders"
import { MathUtils } from "three"

type LightingControls = Pick<Air75SceneControls, "常亮权重" | "灯效贴图混合增益" | "波纹缓动指数"
  | "波纹羽化宽度（场景单位）" | "波纹最大半径（场景单位）">

// 所有键帽共用这些 uniform，调参只需写入一次。
export function updateLightingUniforms(uniforms: KeyboardSharedUniforms, controls: LightingControls) {
  uniforms.uDefaultLighting.value = controls["常亮权重"]
  uniforms.uLightingIntensity.value = controls["灯效贴图混合增益"]
  uniforms.uEasingStrength.value = controls["波纹缓动指数"]
  uniforms.uFeather.value = controls["波纹羽化宽度（场景单位）"]
  uniforms.uRadius.value = controls["波纹最大半径（场景单位）"]
}

// 原地推进固定容量的波纹队列；返回值用于 demand 模式决定是否续帧。
export function advancePulses(uniforms: KeyboardSharedUniforms, duration: number, delta: number) {
  const progress = uniforms.uPulseProgress.value
  let moving = false
  for (let index = 0; index < progress.length; index += 1) {
    if (progress[index] >= 1) {
      continue
    }
    progress[index] = Math.min(1, progress[index] + delta / duration)
    moving = true
  }
  return moving
}

// 窄画幅保留原舞台 3:1 的水平视野，宽画幅沿用校准值。
export function getAspectFov(fov: number, aspect: number) {
  const halfFov = MathUtils.degToRad(fov) / 2
  return MathUtils.radToDeg(2 * Math.atan(Math.tan(halfFov) * Math.max(1, 3 / aspect)))
}

// 共用的外壳材质只释放一次；几何和贴图仍归调用方加载器管理。
export function disposeMaterials(meshes: Iterable<{ material: KeyboardShaderMaterial }>) {
  const materials = new Set(Array.from(meshes, mesh => mesh.material))
  materials.forEach(material => material.dispose())
}
