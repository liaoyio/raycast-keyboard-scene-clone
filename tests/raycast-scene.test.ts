import type { SceneControls } from "../src/components/raycast/scene-config"
import type { KeyboardShaderMaterial } from "../src/components/shared/shaders"
import type { TestElement } from "./helpers"
import assert from "node:assert/strict"
import * as React from "react"
import * as THREE from "three"
import { it } from "vitest"
import { loadModule, resolveControls } from "./helpers"

interface MeshProps {
  name: string
  geometry: THREE.BufferGeometry
  material: KeyboardShaderMaterial
  ref: (object: THREE.Mesh) => void
  onAfterRender: () => void
}
interface KeyboardModelProps {
  active: boolean
  onFirstFrame: () => void
  controls: SceneControls
}
interface SceneModule {
  KeyboardModel: (props: KeyboardModelProps) => TestElement<{ children: TestElement<MeshProps>[] }>
}
interface HookSlot { value: unknown, deps: readonly unknown[] }
type InputOptions = Parameters<typeof import("../src/components/shared/input").useKeyboardInput>[0] & {
  onPress: (code: string) => void
}

const constants = loadModule<typeof import("../src/components/shared/constants")>("shared/constants.ts")
const shaders = loadModule<typeof import("../src/components/shared/shaders")>("shared/shaders.ts", { "@/components/shared/constants": constants })
const animation = loadModule<typeof import("../src/components/shared/scene-animation")>("shared/scene-animation.ts")
const config = loadModule<typeof import("../src/components/raycast/scene-config")>("raycast/scene-config.ts", { "@/components/shared/constants": constants })
// 保留每次渲染的 Hook 槽位，让逐帧动画与卸载清理可直接验证。
function mountKeyboard() {
  const controls = resolveControls(config.SCENE_CONFIG)
  const model = new THREE.Group().add(...["static", "KeyA"].map(name =>
    Object.assign(new THREE.Mesh(new THREE.BoxGeometry()), { name })))
  const textures = [new THREE.Texture(), new THREE.Texture()]
  const pressedKeysRef = { current: new Set<string>() }
  let hooks: HookSlot[] = []
  let cursor = 0
  let frame: (state: object, delta: number) => void = () => assert.fail("Keyboard not mounted")
  let input: InputOptions | undefined
  let ready = 0
  const cleanups: (() => void)[] = []
  function memo<T>(factory: () => T, deps: readonly unknown[]): T {
    const index = cursor++
    const previous = hooks[index]
    if (previous && deps.every((value, offset) => Object.is(value, previous.deps[offset]))) { return previous.value as T }
    const value = factory()
    hooks[index] = { value, deps }
    return value
  }
  const scene = loadModule<SceneModule>("raycast/scene.tsx", {
    "three": THREE,
    "react": {
      ...React,
      useMemo: memo,
      useCallback: <T>(callback: T, deps: readonly unknown[]) => memo(() => callback, deps),
      useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => memo(() => { const cleanup = effect(); if (cleanup) { cleanups.push(cleanup) } }, deps),
    },
    "@react-three/fiber": { useFrame: (callback: typeof frame) => { frame = callback } },
    "@react-three/drei": {
      useGLTF: Object.assign(() => ({ scene: model }), { preload() {} }),
      useTexture: Object.assign(() => textures, { preload() {} }),
    },
    "dialkit": {},
    "@/components/shared/constants": constants,
    "@/components/shared/shaders": shaders,
    "@/components/shared/scene-animation": animation,
    "@/components/shared/debug": {},
    "@/components/raycast/scene-config": config,
    "@/components/shared/input": { useKeyboardInput: (options: InputOptions) => {
      input = options
      return { pointerEvents: {}, pressedKeysRef }
    } },
  }, { expose: ["KeyboardModel"] })
  return {
    controls,
    pressed: pressedKeysRef.current,
    input: () => { assert.ok(input); return input },
    ready: () => ready,
    render: () => {
      cursor = 0
      return scene.KeyboardModel({ active: true, onFirstFrame: () => { ready += 1 }, controls })
    },
    tick: () => frame({}, 1 / 60),
    unmount: () => { cleanups.splice(0).forEach(cleanup => cleanup()); hooks = [] },
  }
}

it("raycast reveals the scene only after a draw and starts fresh after remount", () => {
  const mounted = mountKeyboard()
  const first = mounted.render().props.children
  mounted.tick()
  assert.equal(mounted.ready(), 0, "a scheduled frame is not proof of a drawn mesh")
  first[0].props.onAfterRender()
  first[1].props.onAfterRender()
  mounted.render().props.children[0].props.onAfterRender()
  assert.equal(mounted.ready(), 1)

  let disposals = 0
  first.forEach(mesh => mesh.props.material.addEventListener("dispose", () => { disposals += 1 }))
  mounted.unmount()
  assert.equal(disposals, first.length)
  const next = mounted.render().props.children
  assert.notEqual(next[0].props.material, first[0].props.material)
  assert.equal(mounted.ready(), 1)
  next[0].props.onAfterRender()
  assert.equal(mounted.ready(), 2, "a new desktop mount waits for its own draw")
})

it("raycast runtime preserves press direction, wave progress and release dimming", () => {
  const mounted = mountKeyboard()
  const key = mounted.render().props.children.find(mesh => mesh.props.name === "KeyA")!
  const object = new THREE.Mesh(key.props.geometry, key.props.material)
  key.props.ref(object)
  const rest = object.position.clone()
  mounted.pressed.add("KeyA")
  mounted.input().onPress("KeyA")
  mounted.tick()
  const depth = THREE.MathUtils.damp(0, mounted.controls["按压深度（模型单位）"], mounted.controls["高级"]["按键收敛速率（s⁻¹）"], 1 / 60)
  assert.ok(object.position.distanceTo(rest.clone().addScaledVector(constants.LOCAL_PRESS_AXIS, depth)) < 1e-8)
  const uniforms = key.props.material.uniforms
  assert.ok(Math.abs(uniforms.uPulseProgress.value[0] - (1 / 60) / mounted.controls["波纹时长（s）"]) < 1e-7)
  assert.ok(uniforms.uDim.value < 1)
  mounted.pressed.clear()
  for (let frame = 0; frame < 300; frame += 1) { mounted.tick() }
  assert.ok(object.position.equals(rest))
  assert.equal(uniforms.uDim.value, 1)
  assert.ok(uniforms.uPulseProgress.value.every(value => value === 1))
})
