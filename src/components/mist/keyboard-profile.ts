import type { KeyboardRenderProfile } from "@/components/shared/ansi-renderer"
import type { KeyboardSharedUniforms } from "@/components/shared/shaders"
import * as THREE from "three"
import { createKeyboardMaterial } from "@/components/shared/shaders"
import { mapMistImportedKeyCodes } from "./import-model"

// 末两枚只有图标，作为指针虚拟键；不推断功能或绑定 F11/F12。
export const MIST_KEY_ROWS = [
  "Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 AudioVolumeDown AudioVolumeUp IconGrid IconWave",
  "Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace Home",
  "Tab KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash End",
  "CapsLock KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter PageUp",
  "ShiftLeft KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ShiftRight ArrowUp PageDown",
  "ControlLeft MetaLeft AltLeft Space AltRight Fn ControlRight ArrowLeft ArrowDown ArrowRight",
] as const

// 波纹从键帽几何中心的世界坐标发出，静态结构保留 Base 外观。
export function createMistUvMaterial(uniforms: KeyboardSharedUniforms, _source: THREE.Mesh<THREE.BufferGeometry>, interactive: boolean) {
  const material = createKeyboardMaterial(uniforms)
  Object.assign(material.uniforms, {
    uReducedMotion: { value: 0 },
    uPressed: { value: 0 },
    ...(!interactive ? { uLightingIntensity: { value: 0 } } : {}),
  })
  material.fragmentShader = `uniform float uReducedMotion;\nuniform float uPressed;\n${material.fragmentShader}`.replace(
    "float pulseLight = pulse * uLightingIntensity;",
    "float pulseLight = (uReducedMotion > 0.5 ? uPressed : pulse) * uLightingIntensity;",
  ).replace(
    // 两态 UV 已包含完整亮灯外观，增益只能加速混合，不能向贴图之外外推颜色。
    "mix(baseColor, rgbColor, lightingMix)",
    "mix(baseColor, rgbColor, clamp(lightingMix, 0.0, 1.0))",
  )
  return material
}

export const MIST_RENDER_PROFILE: KeyboardRenderProfile = {
  mapKeyCodes: mapMistImportedKeyCodes,
  createMaterial: createMistUvMaterial,
  // 减少动画时不扩散，亮灯直接跟随按下与松开。
  advanceLight(material, pressed, _delta, reducedMotion) {
    material.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0
    material.uniforms.uPressed.value = pressed ? 1 : 0
    return false
  },
  lampPosition(source) {
    source.geometry.computeBoundingBox()
    return source.geometry.boundingBox!.getCenter(new THREE.Vector3())
  },
}
