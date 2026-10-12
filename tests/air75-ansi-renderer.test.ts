import type { Air75SceneControls } from "../src/components/shared/ansi-scene-config"
import type { KeyboardShaderMaterial } from "../src/components/shared/shaders"
import type { TestElement } from "./helpers"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as React from "react"
import * as THREE from "three"
import { it } from "vitest"
import { loadModule, resolveControls } from "./helpers"

interface GltfNode {
  name?: string
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}
interface GltfDocument {
  nodes: GltfNode[]
  meshes: { primitives: { attributes: { POSITION: number } }[] }[]
  accessors: { min: THREE.Vector3Tuple, max: THREE.Vector3Tuple }[]
  scenes: { nodes: number[] }[]
  scene?: number
}
interface MeshProps {
  name: string
  geometry: THREE.BufferGeometry
  material: KeyboardShaderMaterial
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
  ref: (mesh: THREE.Mesh) => void
  onAfterRender: () => void
}
interface KeyboardProps {
  children: TestElement<MeshProps>[]
  position: THREE.Vector3Tuple
  rotation: THREE.Vector3Tuple
  scale: number
}
interface HookSlot { value: unknown, deps: readonly unknown[] }
interface FrameState { camera: THREE.Camera, invalidate: () => void, size: { width: number, height: number } }
type InputOptions = Required<Parameters<typeof import("../src/components/shared/input").useKeyboardInput>[0]>
type RendererModule = typeof import("../src/components/shared/ansi-renderer") & {
  mapKeyCodes: (scene: THREE.Group) => Map<string, string>
}

const bytes = readFileSync(new URL("../public/assets/air75/keyboard.glb", import.meta.url))
const gltf: GltfDocument = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
const expectedRows = {
  F区: "Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 PrintScreen Delete",
  数字: "Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace PageUp",
  字母1: "Tab KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash PageDown",
  字母2: "CapsLock KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter Home",
  字母3: "ShiftLeft KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ShiftRight ArrowUp End",
  指令区: "ControlLeft AltLeft MetaLeft Space MetaRight Fn ControlRight ArrowLeft ArrowDown ArrowRight",
}

// 用真实局部包围盒代替解码顶点，保留 GLB 的节点层级和完整变换。
function createScene(source = gltf) {
  const nodes = source.nodes.map((node) => {
    let object: THREE.Object3D = new THREE.Group()
    if (node.mesh !== undefined) {
      const primitive = source.meshes[node.mesh].primitives[0]
      const { min, max } = source.accessors[primitive.attributes.POSITION]
      const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max))
      const geometry = new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray())
      geometry.translate(...box.getCenter(new THREE.Vector3()).toArray())
      object = new THREE.Mesh(geometry)
    }
    object.name = node.name ?? ""
    if (node.matrix) { object.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix)) }
    else {
      object.position.fromArray(node.translation ?? [0, 0, 0])
      object.quaternion.fromArray(node.rotation ?? [0, 0, 0, 1])
      object.scale.fromArray(node.scale ?? [1, 1, 1])
    }
    return object
  })
  source.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) { nodes[index].add(nodes[child]) }
  })
  return new THREE.Group().add(...source.scenes[source.scene ?? 0].nodes.map(index => nodes[index]))
}

const constants = loadModule<typeof import("../src/components/shared/constants")>("shared/constants.ts")
const shaders = loadModule<typeof import("../src/components/shared/shaders")>("shared/shaders.ts", { "@/components/shared/constants": constants })
const animation = loadModule<typeof import("../src/components/shared/scene-animation")>("shared/scene-animation.ts")
const sceneConfig = loadModule<typeof import("../src/components/shared/ansi-scene-config")>("shared/ansi-scene-config.ts")

// 按组件隔离 Hook 槽位，测试相机、按键和按需渲染的真实更新。
function mountScene(scene = createScene(), fitAspect = false) {
  let updates = 0
  let invalidations = 0
  let frame: (state: object, delta: number) => void = () => assert.fail("Scene not mounted")
  let input: InputOptions | undefined
  const pressedKeysRef = { current: new Set<string>() }
  const invalidate = () => { invalidations += 1 }
  const camera = new THREE.PerspectiveCamera()
  const textures = [new THREE.Texture(), new THREE.Texture()]
  let controls: Air75SceneControls = resolveControls(sceneConfig.AIR75_WHITE_SCENE_CONFIG)
  const componentHooks = new Map<string, HookSlot[]>()
  let hooks: HookSlot[] = []
  let cursor = 0
  function renderWithHooks<T>(component: string, render: () => T): T {
    if (!componentHooks.has(component)) { componentHooks.set(component, []) }
    hooks = componentHooks.get(component)!
    cursor = 0
    return render()
  }
  function memo<T>(factory: () => T, deps: readonly unknown[]): T {
    const index = cursor++
    const previous = hooks[index]
    if (previous && deps?.every((value, offset) => Object.is(value, previous.deps?.[offset]))) { return previous.value as T }
    const value = factory()
    hooks[index] = { value, deps }
    return value
  }
  const module = loadModule<RendererModule>("shared/ansi-renderer.tsx", {
    "three": THREE,
    "./scene-animation": animation,
    "react": {
      ...React,
      useState: <T>(initial: T) => {
        const state = memo(() => ({ value: initial }), [])
        return [state.value, (value: T) => { state.value = value; updates += 1 }]
      },
      useMemo: memo,
      useCallback: <T>(callback: T, deps: readonly unknown[]) => memo(() => callback, deps),
      useRef: <T>(value: T) => memo(() => ({ current: value }), []),
      useEffect: memo,
      useLayoutEffect: memo,
    },
    "@react-three/fiber": {
      Canvas: "Canvas",
      useFrame: (callback: typeof frame) => { frame = callback },
      useThree: <T>(select: (state: FrameState) => T) => select({ camera, invalidate, size: { width: 800, height: 400 } }),
    },
    "@react-three/drei": {
      useGLTF: Object.assign(() => ({ scene }), { preload() {} }),
      useTexture: Object.assign(() => textures, { preload() {} }),
    },
    "dialkit": { useDialKit: (name: string, config: unknown, options: { id: string, persist?: boolean }) => {
      assert.equal(name, "渲染设置")
      assert.equal(config, sceneConfig.AIR75_WHITE_SCENE_CONFIG)
      assert.equal(options.id, "air75-v3-white-scene")
      assert.equal(options.persist, undefined)
      return controls
    } },
    "usehooks-ts": { useMediaQuery: () => false },
    "@/components/shared/ansi-scene-config": sceneConfig,
    "@/components/shared/debug": { DebugPanel: "DebugPanel" },
    "@/components/shared/constants": constants,
    "@/components/shared/shaders": shaders,
    "@/components/shared/input": { useKeyboardInput: (options: InputOptions) => {
      input = options
      return { pointerEvents: {}, pressedKeysRef }
    } },
  }, { expose: ["mapKeyCodes"] })
  const keyboard = (active = true) => renderWithHooks("keyboard", () => module.Air75AnsiKeyboard({ active, onReady: () => { updates += 1 }, controls, scene, base: textures[0], rgb: textures[1], fitAspect }) as TestElement<KeyboardProps>)
  return {
    ...module,
    keyboard,
    camera,
    updates: () => updates,
    tick: () => frame({}, 1 / 60),
    invalidations: () => invalidations,
    input: () => { assert.ok(input); return input },
    pressed: pressedKeysRef.current,
    setControls: (update: Partial<Air75SceneControls>) => { controls = { ...controls, ...update }; return keyboard() },
    controls: () => controls,
  }
}

// 限制最多模拟十秒，防止未收敛的动画让测试无限运行。
function settle(mounted: ReturnType<typeof mountScene>) {
  for (let index = 0; index < 600; index += 1) {
    const before = mounted.invalidations()
    mounted.tick()
    if (mounted.invalidations() === before) { return }
  }
  assert.fail("Animation must settle and stop requesting frames")
}

it("the actual six GLB groups map to 83 ANSI keys regardless of child order", () => {
  const scene = createScene()
  const { mapKeyCodes } = mountScene(scene)
  const codes = mapKeyCodes(scene)
  assert.equal(codes.size, 83)
  assert.equal(new Set(codes.values()).size, 83)
  assert.equal([...codes.values()].includes("IntlBackslash"), false)
  for (const [name, expected] of Object.entries(expectedRows)) {
    const keys = scene.getObjectByName(name)!.children.slice().sort((a, b) =>
      new THREE.Box3().setFromObject(a).getCenter(new THREE.Vector3()).x
        - new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3()).x)
    assert.equal(keys.map(key => codes.get(key.uuid)).join(" "), expected)
  }
  for (const [name, code] of [["回车", "Enter"], ["空格", "Space"], ["1", "Backslash"]]) {
    assert.equal(codes.get(scene.getObjectByName(name)!.uuid), code)
  }
  scene.traverse(object => object.children.reverse())
  assert.deepEqual([...mapKeyCodes(scene)], [...codes])
})

it("missing or incomplete GLB key groups fail instead of silently shifting codes", () => {
  const scene = createScene()
  const { mapKeyCodes } = mountScene(scene)
  const group = scene.getObjectByName("字母1")!
  group.name = "missing"
  assert.throws(() => mapKeyCodes(scene), /字母1: expected 15 keys, got 0/)
  group.name = "字母1"
  group.remove(group.children[0])
  assert.throws(() => mapKeyCodes(scene), /字母1: expected 15 keys, got 14/)
})

it("workbench imports reject missing UVs and duplicate ANSI groups", () => {
  const scene = createScene()
  const { validateAir75Scene } = mountScene(scene)
  assert.doesNotThrow(() => validateAir75Scene(scene))
  const key = scene.getObjectByName("字母1")!.children[0] as THREE.Mesh<THREE.BufferGeometry>
  const uv = key.geometry.getAttribute("uv")
  key.geometry.deleteAttribute("uv")
  assert.throws(() => validateAir75Scene(scene), /缺少有效 UV/)
  key.geometry.setAttribute("uv", uv)
  uv.setX(0, NaN)
  assert.throws(() => validateAir75Scene(scene), /无效 UV 坐标/)
  uv.setX(0, 0)
  scene.add(Object.assign(new THREE.Group(), { name: "字母1" }))
  assert.throws(() => validateAir75Scene(scene), /重复的按键分组/)
})

it("workbench framing preserves horizontal coverage on a narrow canvas", () => {
  const mounted = mountScene(createScene(), true)
  mounted.keyboard()
  const configured = THREE.MathUtils.degToRad(mounted.controls()["相机"]["垂直视场角（°）"])
  const actual = THREE.MathUtils.degToRad(mounted.camera.fov)
  assert.ok(Math.abs(Math.tan(actual / 2) * 2 - Math.tan(configured / 2) * 3) < 0.000001)
})

it("demand rendering becomes ready after drawing, settles, and wakes on press/release", () => {
  const mounted = mountScene()
  const meshes = mounted.keyboard().props.children
  assert.equal(mounted.updates(), 0)
  assert.equal(meshes.filter(mesh => mesh.props.onAfterRender).length, meshes.length)
  // 首网格可能在视锥外；任一实际绘制的网格都能首次就绪，后续调用保持幂等。
  meshes.at(-1)!.props.onAfterRender()
  meshes[0].props.onAfterRender()
  meshes[0].props.onAfterRender()
  assert.equal(mounted.updates(), 1)

  const key = meshes.find(mesh => mesh.props.name === "KeyA")!
  const object = new THREE.Mesh(key.props.geometry, key.props.material)
  object.position.copy(key.props.position)
  object.quaternion.copy(key.props.quaternion)
  object.scale.copy(key.props.scale)
  key.props.ref(object)
  const restY = object.position.y
  settle(mounted)
  const idle = mounted.invalidations()
  for (let index = 0; index < 10; index += 1) { mounted.tick() }
  assert.equal(mounted.invalidations(), idle)
  assert.equal(key.props.material.uniforms.uDefaultLighting.value, 0)

  mounted.pressed.add("KeyA")
  mounted.input().onPress("KeyA")
  assert.equal(mounted.invalidations(), idle + 1)
  assert.ok(key.props.material.uniforms.uPulseProgress.value.includes(0))
  settle(mounted)
  assert.ok(object.position.y < restY)
  assert.ok(key.props.material.uniforms.uPulseProgress.value.every(value => value === 1))
  const held = mounted.invalidations()
  mounted.pressed.delete("KeyA")
  mounted.input().onRelease("KeyA")
  assert.equal(mounted.invalidations(), held + 1)
  settle(mounted)
  assert.equal(object.position.y, restY)
  assert.equal(key.props.material.uniforms.uDim.value, 1)
})

it("all meshes preserve the shared texture shader without enclosure color compensation", () => {
  const mounted = mountScene()
  const meshes = mounted.keyboard().props.children.map(mesh => mesh.props)
  const codes = new Set(Object.values(expectedRows).flatMap(row => row.split(" ")))
  const staticMeshes = meshes.filter(mesh => !codes.has(mesh.name))
  const enclosure = staticMeshes[0].material
  const key = meshes.find(mesh => mesh.name === "KeyA")!.material
  assert.equal(meshes.length, 90)
  assert.equal(staticMeshes.length, 7)
  assert.ok(staticMeshes.every(mesh => mesh.material === enclosure))
  for (const { material } of meshes) {
    assert.equal(material.vertexShader, shaders.KEYBOARD_VERTEX_SHADER)
    assert.equal(material.fragmentShader, shaders.KEYBOARD_FRAGMENT_SHADER)
    assert.deepEqual(Object.keys(material.uniforms).sort(), Object.keys(key.uniforms).sort())
    assert.equal(material.uniforms.uDim.value, 1)
  }
  for (const name of ["uPulseCenters", "uPulseProgress", "uBaseMap", "uRgbMap"]) {
    assert.equal(enclosure.uniforms[name], key.uniforms[name])
  }
})

it("dialkit edits wake demand rendering and change real materials, camera, press and pulse behavior", () => {
  const mounted = mountScene()
  const group = mounted.keyboard()
  const key = group.props.children.find(mesh => mesh.props.name === "KeyA")!
  const object = new THREE.Mesh(key.props.geometry, key.props.material)
  object.position.copy(key.props.position)
  object.quaternion.copy(key.props.quaternion)
  object.scale.copy(key.props.scale)
  key.props.ref(object)
  const restY = object.position.y
  settle(mounted)
  const idle = mounted.invalidations()
  const previousPosition = mounted.camera.position.clone()
  const updatedGroup = mounted.setControls({
    "常亮权重": 0.3,
    "按压深度（模型单位）": 0.42,
    "灯效贴图混合增益": 2,
    "按键压暗比例": 0.25,
    "波纹时长（s）": 0.8,
    "波纹缓动指数": 3,
    "波纹羽化宽度（场景单位）": 2,
    "波纹最大半径（场景单位）": 12,
    "相机": {
      ...mounted.controls()["相机"],
      "终点 X（场景单位）": 2,
      "终点 Y（场景单位）": 52,
      "终点 Z（场景单位）": 25,
      "注视点 Z（场景单位）": 1,
      "垂直视场角（°）": 18,
      "收敛速率（s⁻¹）": 6,
    },
    "模型变换": {
      ...mounted.controls()["模型变换"],
      "平移 X（场景单位）": 1,
      "旋转 Y（°）": 15,
      "统一缩放": 1.1,
    },
    "高级": { ...mounted.controls()["高级"], "按键收敛速率（s⁻¹）": 80 },
  })
  assert.ok(mounted.invalidations() > idle)
  assert.ok(mounted.camera.position.equals(previousPosition), "editing controls must not restart the entrance")
  assert.equal(mounted.camera.fov, 18)
  assert.equal(updatedGroup.props.children.find(mesh => mesh.props.name === "KeyA")!.props.material, key.props.material)
  const uniforms = key.props.material.uniforms
  for (const [name, value] of Object.entries({
    uDefaultLighting: 0.3,
    uLightingIntensity: 2,
    uEasingStrength: 3,
    uFeather: 2,
    uRadius: 12,
  })) { assert.equal(uniforms[name].value, value) }

  const model = new THREE.Group()
  model.position.fromArray(updatedGroup.props.position)
  model.rotation.set(...updatedGroup.props.rotation)
  model.scale.setScalar(updatedGroup.props.scale)
  model.add(object)
  model.updateMatrixWorld(true)
  const center = object.geometry.boundingBox!.getCenter(new THREE.Vector3())
  const worldCenter = object.localToWorld(center)
  mounted.pressed.add("KeyA")
  mounted.input().onPress("KeyA")
  assert.equal(uniforms.uPulseCenters.value[0].x, worldCenter.x)
  assert.equal(uniforms.uPulseCenters.value[0].y, worldCenter.z)
  mounted.tick()
  assert.ok(Math.abs(uniforms.uPulseProgress.value[0] - (1 / 60) / 0.8) < 0.000001)
  assert.ok(Math.abs(object.position.y - (restY - THREE.MathUtils.damp(0, 0.42, 80, 1 / 60))) < 0.000001)
  const expectedCamera = previousPosition.clone().lerp(new THREE.Vector3(2, 52, 25), 1 - Math.exp(-6 / 60))
  assert.ok(mounted.camera.position.distanceTo(expectedCamera) < 0.000001)
  settle(mounted)
  assert.ok(mounted.camera.position.equals(new THREE.Vector3(2, 52, 25)))
  const lookDirection = new THREE.Vector3(-0.044001, 0.008901, 1).sub(mounted.camera.position).normalize()
  assert.ok(mounted.camera.getWorldDirection(new THREE.Vector3()).distanceTo(lookDirection) < 0.000001)
  assert.equal(object.position.y, restY - 0.42)
  assert.equal(uniforms.uDim.value, 0.75)

  mounted.setControls({ 按键压暗比例: 0.8 })
  mounted.tick()
  assert.ok(Math.abs(uniforms.uDim.value - 0.2) < 0.000001, "dimming updates while a key is held at rest")
  mounted.setControls({ "按压深度（模型单位）": 0 })
  settle(mounted)
  assert.equal(object.position.y, restY)
  assert.equal(uniforms.uDim.value, 1)
  const settled = mounted.invalidations()
  mounted.tick()
  assert.equal(mounted.invalidations(), settled)
})
