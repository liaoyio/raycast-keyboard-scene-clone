import type { WorkbenchAssets } from "../src/components/air75/workbench-assets"
import type { TestElement } from "./helpers"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import * as React from "react"
import * as THREE from "three"
import { it } from "vitest"
import { loadModule, resolveControls } from "./helpers"

type AssetsModule = typeof import("../src/components/air75/workbench-assets")
type SceneModule = typeof import("../src/components/air75/workbench-scene")
type SceneProps = React.ComponentProps<SceneModule["default"]>
type WorkbenchConfig = typeof import("../src/components/air75/workbench-config")
type SceneLoadState
  = | { status: "loading" }
    | { status: "error", message: string }
    | { status: "loaded", assets: WorkbenchAssets, ready: boolean }
interface FixtureOptions { document?: unknown, failTexture?: boolean }
interface KeyboardProps { scene: THREE.Group, onReady: () => void }
type CanvasElement = TestElement<{ children: TestElement<Partial<KeyboardProps>>[] }>
type StageElement = TestElement<{ children: [CanvasElement, unknown] }>
interface SceneElement {
  props: SceneProps
  type: (props: SceneProps) => StageElement
}
type BoundaryElement = TestElement<{ children: SceneElement }>
interface RendererModule {
  default: (props: SceneProps) => BoundaryElement
  projectBounds: (box: THREE.Box3, point: THREE.Vector3, camera: THREE.Camera) => {
    left: number
    right: number
    bottom: number
  }
}

const config = loadModule<WorkbenchConfig>("air75/workbench-config.ts", {
  "@/components/shared/ansi-scene-config": loadModule("shared/ansi-scene-config.ts"),
})
const defaultControls = resolveControls(config.AIR75_WORKBENCH_CONFIG)
const controls = { ...defaultControls, 相机: { ...defaultControls["相机"], "垂直视场角（°）": 12 } }

// 构造最小 GLB，分别验证文件头和外部资源边界。
function glb(document: unknown) {
  const json = Buffer.from(JSON.stringify(document).padEnd(Math.ceil(JSON.stringify(document).length / 4) * 4, " "))
  const bytes = Buffer.alloc(20 + json.length)
  bytes.writeUInt32LE(0x46546C67, 0)
  bytes.writeUInt32LE(2, 4)
  bytes.writeUInt32LE(bytes.length, 8)
  bytes.writeUInt32LE(json.length, 12)
  bytes.writeUInt32LE(0x4E4F534A, 16)
  json.copy(bytes, 20)
  return Uint8Array.from(bytes).buffer
}

// 记录资源创建、销毁和加载状态，覆盖失败与取消时的清理。
function fixture({ document = {}, failTexture = false }: FixtureOptions = {}) {
  const events: string[] = []
  let state: SceneLoadState | undefined
  const effects: (() => (() => void))[] = []
  function tracked<Resource extends THREE.Texture | THREE.BufferGeometry | THREE.Material>(resource: Resource, name: string) {
    resource.addEventListener("dispose", () => events.push(name))
    return resource
  }
  const embedded = tracked(new THREE.Texture(), "embedded texture")
  const geometry = tracked(new THREE.BoxGeometry(), "geometry")
  const material = tracked(new THREE.MeshBasicMaterial({ map: embedded }), "material")
  const scene = new THREE.Group().add(new THREE.Mesh(geometry, material))
  const modules = {
    "react": {
      ...React,
      useEffect(effect: () => (() => void)) { effects.push(effect) },
      useState(initial: SceneLoadState) {
        state ??= initial
        return [state, (update: SceneLoadState | ((current: SceneLoadState) => SceneLoadState)) => {
          state = typeof update === "function" ? update(state ?? initial) : update
        }]
      },
    },
    "@react-three/fiber": { Canvas: "Canvas" },
    "three": { ...THREE, TextureLoader: class {
      async loadAsync(url: string) {
        if (failTexture && url.includes("rgb")) { throw new Error("invalid image") }
        return tracked(new THREE.Texture(), url.includes("base") ? "base texture" : "rgb texture")
      }
    } },
    "three/examples/jsm/loaders/DRACOLoader.js": { DRACOLoader: class {
      setDecoderPath() { return this }
      dispose() { events.push("decoder") }
    } },
    "three/examples/jsm/loaders/GLTFLoader.js": { GLTFLoader: class {
      setDRACOLoader() { return this }
      async parseAsync() { events.push("parse"); return { scene, scenes: [scene] } }
    } },
    "@/components/shared/scene-error-boundary": {},
    "@/components/shared/shaders": { configureKeyboardTextures: (textures: THREE.Texture[]) => {
      for (const texture of textures) { texture.colorSpace = THREE.SRGBColorSpace }
    } },
    "@/components/shared/ansi-renderer": { validateAir75Scene() {} },
  }
  const globals = {
    TextDecoder,
    AbortController,
    fetch: async () => ({ ok: true, arrayBuffer: async () => glb(document) }),
  }
  const assets = loadModule<AssetsModule>("air75/workbench-assets.ts", modules, { globals })
  const renderer = loadModule<RendererModule>("air75/workbench-scene.tsx", { ...modules, "./workbench-assets": assets }, { globals, expose: ["projectBounds"] })
  return {
    ...assets,
    ...renderer,
    events,
    effects,
    getState() { assert.ok(state); return state },
    getLoaded() { assert.ok(state?.status === "loaded"); return state },
    setState(next: SceneLoadState) { state = next },
  }
}

const sources = {
  model: "/assets/air75/keyboard.glb",
  base: "/assets/air75/texture-black-base.webp",
  rgb: "/assets/air75/texture-black-rgb.webp",
}

it("gLB validation accepts embedded data and rejects malformed or external resources before parsing", async () => {
  const valid = fixture()
  assert.doesNotThrow(() => valid.validateEmbeddedGlb(glb({ buffers: [{}], images: [{ uri: "data:image/png;base64,YQ==" }] })))
  assert.throws(() => valid.validateEmbeddedGlb(new ArrayBuffer(4)), /格式无效/)
  const external = fixture({ document: { images: [{ uri: "https://example.com/texture.png" }] } })
  await assert.rejects(external.loadWorkbenchAssets(sources, true, new AbortController().signal), /外部文件/)
  assert.equal(external.events.includes("parse"), false)
  assert.deepEqual(external.events.sort(), ["base texture", "decoder", "rgb texture"])
  await assert.rejects(valid.loadWorkbenchAssets({ ...sources, model: "https://example.com/model.glb" }, true, new AbortController().signal), /本机导入/)
})

it("successful assets retain selected UV orientation and release owned resources exactly once", async () => {
  const mounted = fixture()
  const assets = await mounted.loadWorkbenchAssets(sources, false, new AbortController().signal)
  assert.equal(assets.base.flipY, false)
  assert.equal(assets.rgb.flipY, false)
  assert.equal(assets.base.colorSpace, THREE.SRGBColorSpace)
  assert.deepEqual(mounted.events, ["parse", "decoder"])
  mounted.disposeAssets(assets)
  assert.deepEqual(mounted.events.sort(), ["base texture", "decoder", "embedded texture", "geometry", "material", "parse", "rgb texture"])
})

it("a failed texture and a cancelled request dispose every successfully loaded resource", async () => {
  const failed = fixture({ failTexture: true })
  await assert.rejects(failed.loadWorkbenchAssets(sources, true, new AbortController().signal), /灯光 UV读取失败/)
  assert.deepEqual(failed.events.sort(), ["base texture", "decoder", "embedded texture", "geometry", "material", "parse"])
  const cancelled = fixture()
  const controller = new AbortController()
  const pending = cancelled.loadWorkbenchAssets(sources, true, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: "AbortError" })
  assert.deepEqual(cancelled.events.sort(), ["base texture", "decoder", "rgb texture"])
})

it("replay remounts only animation while a new scene refreshes first-frame readiness", async () => {
  const mounted = fixture()
  const assets = await mounted.loadWorkbenchAssets(sources, true, new AbortController().signal)
  mounted.setState({ status: "loaded", assets, ready: false })
  function render(replay: number) {
    const boundary = mounted.default({ sources, controls, replay })
    const content = boundary.props.children
    const canvas = content.type(content.props).props.children[0]
    const keyboard = canvas.props.children.find(child => child.props.scene)
    assert.ok(keyboard?.props.scene && keyboard.props.onReady)
    return { boundary, canvas, keyboard: keyboard as TestElement<KeyboardProps> }
  }
  const first = render(0)
  first.keyboard.props.onReady()
  const ready = mounted.getState()
  const replayed = render(1)
  assert.equal(first.boundary.key, replayed.boundary.key)
  assert.equal(first.canvas.type, replayed.canvas.type)
  assert.equal(first.canvas.key, replayed.canvas.key)
  assert.equal(first.keyboard.props.scene, replayed.keyboard.props.scene)
  assert.notEqual(first.keyboard.key, replayed.keyboard.key)
  replayed.keyboard.props.onReady()
  assert.equal(mounted.getState(), ready, "replay does not repeat readiness state updates")
  const replacement = { ...assets, gltf: { ...assets.gltf, scene: assets.gltf.scene.clone() } }
  mounted.setState({ status: "loaded", assets: replacement, ready: false })
  const refreshed = render(1)
  assert.notEqual(refreshed.keyboard.key, replayed.keyboard.key, "a new decoded scene cannot retain a stale rendered ref")
  refreshed.keyboard.props.onReady()
  assert.equal(mounted.getLoaded().ready, true)
  assert.deepEqual(mounted.events, ["parse", "decoder"], "replay does not decode or dispose resources")
})

it("restarting the resource effect clears stale readiness before loading fresh GPU assets", async () => {
  const mounted = fixture()
  const assets = await mounted.loadWorkbenchAssets(sources, true, new AbortController().signal)
  mounted.setState({ status: "loaded", assets, ready: true })
  const boundary = mounted.default({ sources, controls })
  boundary.props.children.type(boundary.props.children.props)
  const cleanup = mounted.effects.at(-1)!()
  assert.equal(mounted.getState().status, "loading")
  await new Promise(setImmediate)
  assert.equal(mounted.getState().status, "loaded")
  assert.equal(mounted.getLoaded().ready, false, "the fresh Canvas waits for its own first frame")
  cleanup()
  assert.equal(mounted.events.filter(event => event === "base texture").length, 1)
})

it("projected backdrop bounds retain the keyboard edges across camera aspect ratios", () => {
  const mounted = fixture()
  const box = new THREE.Box3(new THREE.Vector3(-8, -0.5, -3), new THREE.Vector3(8, 0.5, 3))
  const point = new THREE.Vector3()
  for (const aspect of [1, 2, 3]) {
    const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100)
    camera.position.set(0, 16, 12)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const expected: THREE.Vector3[] = []
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) { expected.push(new THREE.Vector3(x, y, z).project(camera)) }
      }
    }
    const bounds = mounted.projectBounds(box, point, camera)
    assert.equal(bounds.left, Math.min(...expected.map(p => p.x)))
    assert.equal(bounds.right, Math.max(...expected.map(p => p.x)))
    assert.equal(bounds.bottom, Math.max(...expected.map(p => 1 - p.y)))
  }
})
