import assert from "node:assert/strict"
import * as THREE from "three"
import { it } from "vitest"
import { loadModule } from "./helpers"

const constants = loadModule<typeof import("../src/components/shared/constants")>("shared/constants.ts", { three: THREE })
const shaders = loadModule<typeof import("../src/components/shared/shaders")>("shared/shaders.ts", { "three": THREE, "@/components/shared/constants": constants })
const profile = loadModule<typeof import("../src/components/mist/keyboard-profile")>("mist/keyboard-profile.ts", { "three": THREE, "@/components/shared/shaders": shaders, "./import-model": { mapMistImportedKeyCodes() { throw new Error("model mapping is covered by import-model tests") } } })

// 实际材质与共享波纹数组验证跨键传播，键位适配另由模型测试负责。
it("mist shares Raycast expansion uniforms across keycaps and keeps static structure unlit", () => {
  const source = new THREE.Mesh(new THREE.BoxGeometry())
  const uniforms = shaders.createKeyboardSharedUniforms(new THREE.Texture(), new THREE.Texture())
  const key = profile.createMistUvMaterial(uniforms, source, true)
  const neighbor = profile.createMistUvMaterial(uniforms, source, true)
  const fixed = profile.createMistUvMaterial(uniforms, source, false)
  assert.equal(key.vertexShader, shaders.KEYBOARD_VERTEX_SHADER)
  assert.equal(key.uniforms.uPulseProgress, neighbor.uniforms.uPulseProgress)
  assert.equal(key.uniforms.uPulseCenters, neighbor.uniforms.uPulseCenters)
  assert.equal(key.uniforms.uLightingIntensity, uniforms.uLightingIntensity)
  uniforms.uPulseProgress.value[0] = 0
  assert.equal(neighbor.uniforms.uPulseProgress.value[0], 0)
  uniforms.uLightingIntensity.value = 3
  assert.equal(fixed.uniforms.uLightingIntensity.value, 0)
  assert.equal(fixed.uniforms.uBaseMap, uniforms.uBaseMap)
  assert.ok(key.fragmentShader.includes("float distanceToPulse = length(vWorldXZ - uPulseCenters[index]);"))
  assert.ok(key.fragmentShader.includes("mix(baseColor, rgbColor, clamp(lightingMix, 0.0, 1.0))"))
  assert.equal(profile.MIST_RENDER_PROFILE.onPress, undefined, "shared renderer must create the expanding pulse")
  key.dispose(); neighbor.dispose(); fixed.dispose(); source.geometry.dispose()
})

it("mist locates pulses at geometric centers and reduced motion follows key state without expansion", () => {
  const geometry = new THREE.BoxGeometry().translate(2, 3, 4)
  const source = new THREE.Mesh(geometry)
  assert.deepEqual(profile.MIST_RENDER_PROFILE.lampPosition(source).toArray(), [2, 3, 4])
  const uniforms = shaders.createKeyboardSharedUniforms(new THREE.Texture(), new THREE.Texture())
  const key = profile.createMistUvMaterial(uniforms, source, true)
  const advance = profile.MIST_RENDER_PROFILE.advanceLight!
  assert.equal(advance(key, true, 0, true), false)
  assert.equal(key.uniforms.uReducedMotion.value, 1)
  assert.equal(key.uniforms.uPressed.value, 1)
  advance(key, false, 0, true)
  assert.equal(key.uniforms.uPressed.value, 0)
  advance(key, false, 0, false)
  assert.equal(key.uniforms.uReducedMotion.value, 0)
  assert.ok(key.fragmentShader.includes("uReducedMotion > 0.5 ? uPressed : pulse"))
  key.dispose(); geometry.dispose()
})
