import type { ReactElement } from "react"
import type { WorkbenchAssets } from "../src/components/air75/workbench-assets"
import type { MistUvSources } from "../src/components/mist/import-assets"
import type { MistSceneControls } from "../src/components/mist/scene-config"
import type { TestElement } from "./helpers"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import * as React from "react"
import * as THREE from "three"
import { it } from "vitest"
import { loadModule, nodes, resolveControls } from "./helpers"

type HeroModule = typeof import("../src/components/mist/hero")
type AssetsModule = typeof import("../src/components/mist/import-assets")
type SharedAssetsModule = typeof import("../src/components/air75/workbench-assets")
type ConfigModule = typeof import("../src/components/mist/scene-config")
type SceneModule = typeof import("../src/components/mist/scene")
type UploadFile = Pick<File, "name" | "size">
interface Focusable { focus: () => void }
interface ControlProps {
  "aria-label"?: string
  "role"?: string
  "ref"?: { current: Focusable | null }
  "tabIndex"?: number
  "mode"?: string
  "onClick"?: () => void
  "onChange"?: (event: { currentTarget: { files: UploadFile[], value: string } }) => void
}
interface RootProps { style: { backgroundColor: string, backgroundImage: string } }
interface SceneProps { sources?: MistUvSources, controls: MistSceneControls, showLoading?: boolean }
interface PreviewState { assets?: WorkbenchAssets, ready: boolean, loading: boolean, error: string }
interface KeyboardProps { scene?: THREE.Group, onReady: () => void }
interface PendingAssets {
  signal: AbortSignal
  resolve: (assets: WorkbenchAssets) => void
  reject: (error: Error) => void
}

const raycastConfig = loadModule<typeof import("../src/components/raycast/scene-config")>("raycast/scene-config.ts", { "@/components/shared/constants": loadModule("shared/constants.ts", { three: THREE }) })
// 模拟原生输入控件；实际 DOM 的过滤另由浏览器验收。
class EditableTarget extends EventTarget {
  isContentEditable = false
  closest() { return this }
}

const config = loadModule<ConfigModule>("mist/scene-config.ts", {
  "@/components/raycast/scene-config": raycastConfig,
  "@/components/shared/ansi-scene-config": loadModule("shared/ansi-scene-config.ts"),
})
const builtin = config.MIST_UV_SOURCES

// 执行实际控件事件，记录批量提交、焦点与本地 URL 生命周期。
function pageFixture() {
  const slots: unknown[] = []
  const cleanups: (() => void)[] = []
  const actions: { type: string }[] = []
  const revoked: string[] = []
  const listeners = new Map<string, (event: KeyboardEvent) => void>()
  const opened: { url: string, target: string, features: string }[] = []
  const document: { activeElement?: Focusable } = {}
  let loadingPreview: () => ReactElement
  let created = 0
  let cursor = 0
  let tree: ReactElement<RootProps>
  let controls: TestElement<ControlProps>[] = []
  const dial = {
    values: resolveControls(config.MIST_SCENE_CONFIG),
    resetValues() { this.values = resolveControls(config.MIST_SCENE_CONFIG) },
  }
  const { MistHero } = loadModule<HeroModule>("mist/hero.tsx", {
    "react": {
      useReducer<State, Action>(reducer: (state: State, action: Action) => State, initial: State) {
        const index = cursor++
        slots[index] ??= initial
        return [slots[index], (action: Action) => {
          actions.push(action as { type: string })
          slots[index] = reducer(slots[index] as State, action)
        }]
      },
      useMemo<Value>(factory: () => Value) { const index = cursor++; return slots[index] ??= factory() },
      useRef<Value>(initial: Value) { const index = cursor++; return slots[index] ??= { current: initial } },
      useEffect(effect: () => (() => void) | void) {
        const index = cursor++
        if (slots[index]) { return }
        slots[index] = true
        const cleanup = effect()
        if (cleanup) { cleanups.push(cleanup) }
      },
    },
    "next/dynamic": { default: (_loader: unknown, options: { loading: () => ReactElement }) => { loadingPreview = options.loading; return "MistScene" } },
    "next/image": { default: "img" },
    "next-themes": { useTheme: () => ({ resolvedTheme: "light" }) },
    "dialkit": { DialRoot: "DialRoot", useDialKitController: () => dial },
    "usehooks-ts": {
      useMediaQuery: () => true,
      useIntersectionObserver: () => ({ ref() {}, isIntersecting: true }),
      useEventListener: (name: string, handler: (event: KeyboardEvent) => void) => listeners.set(name, handler),
    },
    "@/components/icons": { Settings: "svg" },
    "@/components/shared/asset-input": loadModule("shared/asset-input.tsx"),
    "@/components/shared/scene-error-boundary": { SceneErrorBoundary: "Boundary" },
    "@/utils/cn": { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") },
    "./scene-config": config,
    "./loading-indicator": loadModule("mist/loading-indicator.tsx", { "@/utils/cn": { cn: (...classes: string[]) => classes.join(" ") } }),
  }, { globals: { HTMLElement: EditableTarget, window: { open: (url: string, target: string, features: string) => opened.push({ url, target, features }) }, URL: {
    createObjectURL() { return `blob:uploaded-${++created}` },
    revokeObjectURL(url: string) { revoked.push(url) },
  } } })

  function render() {
    cursor = 0
    tree = MistHero() as ReactElement<RootProps>
    controls = nodes<ControlProps>(tree)
    for (const node of controls) {
      if (node.props.ref) {
        node.props.ref.current ??= { focus() { document.activeElement = this } }
      }
    }
  }
  function find(predicate: (node: TestElement<ControlProps>) => boolean) {
    const node = controls.find(predicate)
    assert.ok(node, "expected control is rendered")
    return node
  }
  function click(label: string) {
    const node = find(({ type, props }) => type === "button" && (props["aria-label"] === label || props.children === label))
    assert.ok(node.props.onClick)
    node.props.onClick()
    render()
  }
  function upload(label: string, files: UploadFile[]) {
    const input = find(({ type, props }) => type === "input" && props["aria-label"] === label)
    assert.ok(input.props.onChange)
    const target = { files, value: files[0]?.name ?? "" }
    input.props.onChange({ currentTarget: target })
    assert.equal(target.value, "", "choosing the same files again must trigger a change event")
    render()
  }
  render()
  return {
    loadingPreview: () => loadingPreview(),
    dial,
    opened,
    keyDown(key: string, options: Partial<KeyboardEvent> = {}) {
      listeners.get("keydown")!({ key, ...options } as KeyboardEvent)
    },
    blur() { listeners.get("blur")!({} as KeyboardEvent) },
    actions,
    revoked,
    click,
    find,
    upload,
    render,
    get created() { return created },
    get tree() { return tree },
    scene() { return find(({ type }) => type === "MistScene").props as ControlProps & SceneProps },
    alert() { return find(({ props }) => props.role === "alert").props.children as string },
    assertStageFocused() {
      const stage = find(({ props }) => props["aria-label"] === "雾透键盘交互舞台")
      assert.equal(stage.props.tabIndex, -1)
      assert.equal(document.activeElement, stage.props.ref?.current)
    },
    escape() {
      let stopped = false
      listeners.get("keydown")!({ key: "Escape", defaultPrevented: false, stopImmediatePropagation() { stopped = true } } as KeyboardEvent)
      render()
      assert.equal(stopped, true)
    },
    unmount() { cleanups.forEach(cleanup => cleanup()) },
  }
}

it("mist easter eggs open the requested destinations once and accept uppercase English keys", () => {
  const page = pageFixture()
  for (const word of ["HALLOWEEN", "xmas", "nuphy"]) {
    for (const key of word) { page.keyDown("Shift"); page.keyDown(key) }
  }
  assert.deepEqual(page.opened, [
    { url: "https://youtu.be/MHIxAY98Bvg", target: "_blank", features: "noopener,noreferrer" },
    { url: "https://youtu.be/MHIxAY98Bvg", target: "_blank", features: "noopener,noreferrer" },
    { url: "https://nuphy.com", target: "_blank", features: "noopener,noreferrer" },
  ])
  page.keyDown("y", { repeat: true })
  assert.equal(page.opened.length, 3)
  page.unmount()
})

it("mist easter eggs ignore controls, modifiers, IME and long repeats and clear interrupted sequences", () => {
  const page = pageFixture()
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { defaultPrevented: true }, { target: new EditableTarget() }]) {
    for (const key of "xmas") { page.keyDown(key, options) }
  }
  assert.equal(page.opened.length, 0)
  page.keyDown("x"); page.keyDown("m"); page.blur()
  page.keyDown("a"); page.keyDown("s")
  assert.equal(page.opened.length, 0)
  for (const key of "xm as") { page.keyDown(key) }
  assert.equal(page.opened.length, 0)
  for (const key of "xmas") { page.keyDown(key); page.keyDown(key, { repeat: true }) }
  assert.equal(page.opened.length, 1)
  page.unmount()
})

it("mist aligns Raycast controls while retaining calibrated camera, model units and background settings", () => {
  const values = resolveControls(config.MIST_SCENE_CONFIG)
  const raycast = resolveControls(raycastConfig.SCENE_CONFIG)
  const distances = ["波纹羽化宽度（场景单位）", "波纹最大半径（场景单位）"] as const
  for (const label of distances) { assert.ok(Math.abs(values[label] - raycast[label] * 10) < 1e-9) }
  for (const label of ["常亮权重", "灯效贴图混合增益", "波纹时长（s）", "波纹缓动指数"] as const) {
    assert.equal(values[label], raycast[label])
  }
  assert.deepEqual(Object.keys(values).filter(key => Object.hasOwn(raycast, key)), Object.keys(raycast))
  assert.equal(values.相机["终点 Y（场景单位）"], 55.117985)
  assert.equal(values["按压深度（模型单位）"], 0.16, "1012 key tops intersect static geometry at the scaled Raycast depth")
  assert.equal(values["按键压暗比例"], 0)
  assert.equal(values.页面背景颜色, "#D3E6F2")
  assert.equal(values.背景渐变.启用渐变, true)
  assert.equal(Object.hasOwn(values, "白灯渐亮时间（s）"), false)
})

it("mist quick import commits a complete group once and rejects ambiguous, duplicate or oversized files atomically", () => {
  const page = pageFixture()
  assert.deepEqual({ ...page.scene().sources }, { ...config.MIST_1012_SOURCES })
  page.click("雾透模型与 UV 设置")
  page.upload("快速导入模型与 UV", [
    { name: "wt.glb", size: 100 },
    { name: "BASE_0923_v1.png", size: 100 },
    { name: "RGB_0923_v1.png", size: 100 },
  ])
  assert.equal(page.actions.filter(action => action.type === "assets").length, 1)
  assert.deepEqual({ ...page.scene().sources }, { model: "blob:uploaded-1", base: "blob:uploaded-2", rgb: "blob:uploaded-3" })
  for (const [files, message] of [
    [[{ name: "base.png", size: 100 }, { name: "unknown.png", size: 100 }], /无法识别/],
    [[{ name: "one.glb", size: 100 }, { name: "two.GLB", size: 100 }], /只能导入一个/],
    [[{ name: "model.glb", size: 100 }, { name: "base.png", size: 50 * 1024 * 1024 + 1 }], /不超过 50 MB/],
  ] as const) {
    page.upload("快速导入模型与 UV", [...files])
    assert.match(page.alert(), message)
    assert.equal(page.created, 3)
    assert.equal(page.actions.filter(action => action.type === "assets").length, 1)
    assert.deepEqual({ ...page.scene().sources }, { model: "blob:uploaded-1", base: "blob:uploaded-2", rgb: "blob:uploaded-3" })
  }
  assert.deepEqual(page.revoked, [])
  page.unmount()
})

it("mist partial replacements, restore, preset switch and unmount release each owned URL once", () => {
  const page = pageFixture()
  page.click("雾透模型与 UV 设置")
  page.upload("快速导入模型与 UV", [{ name: "wt.glb", size: 100 }, { name: "base.png", size: 100 }, { name: "rgb.png", size: 100 }])
  page.upload("导入 Base UV", [{ name: "custom.webp", size: 100 }])
  assert.equal(page.scene().sources?.model, "blob:uploaded-1")
  assert.equal(page.scene().sources?.base, "blob:uploaded-4")
  assert.equal(page.scene().sources?.rgb, "blob:uploaded-3")
  page.click("恢复内置Base UV")
  assert.equal(page.scene().sources?.base, config.MIST_1012_SOURCES.base)
  page.click("1012 UV")
  assert.deepEqual({ ...page.scene().sources }, { ...config.MIST_1012_SOURCES })
  page.click("0923 UV")
  assert.deepEqual({ ...page.scene().sources }, { ...builtin })
  page.upload("导入 模型 GLB", [{ name: "custom.glb", size: 100 }])
  page.unmount()
  assert.deepEqual(page.revoked, ["blob:uploaded-2", "blob:uploaded-4", "blob:uploaded-1", "blob:uploaded-3", "blob:uploaded-5"])
})

it("mist uses native Dialkit colors and optional gradients without changing UV selections and closes settings back to the stage", () => {
  const page = pageFixture()
  assert.equal(config.MIST_SCENE_CONFIG.页面背景颜色.type, "color")
  assert.equal(page.tree.props.style.backgroundColor, "#D3E6F2")
  assert.equal(page.tree.props.style.backgroundImage, "linear-gradient(180deg, #D3E6F2, #ffffff)")
  assert.equal(config.MIST_SCENE_CONFIG.背景渐变.终点颜色.type, "color")
  page.click("雾透模型与 UV 设置")
  assert.equal(page.find(({ type }) => type === "DialRoot").props.mode, "inline")
  page.click("0923 UV")
  page.dial.values = {
    ...page.dial.values,
    "页面背景颜色": "oklch(0.8 0.08 180)",
    "背景渐变": { "启用渐变": true, "终点颜色": "#d7e1e8", "方向（°）": 90 },
    "UV 预览": { "垂直翻转 UV": true },
    "灯效贴图混合增益": 1.7,
  } as unknown as MistSceneControls
  page.render()
  assert.equal(page.tree.props.style.backgroundColor, "oklch(0.8 0.08 180)")
  assert.equal(page.tree.props.style.backgroundImage, "linear-gradient(90deg, oklch(0.8 0.08 180), #d7e1e8)")
  assert.deepEqual({ ...page.scene().sources }, { ...builtin })
  assert.equal(page.scene().controls["UV 预览"]["垂直翻转 UV"], true)
  page.click("关闭雾透设置")
  page.assertStageFocused()
  page.click("雾透模型与 UV 设置")
  page.escape()
  page.assertStageFocused()
  page.click("雾透模型与 UV 设置")
  page.click("1012 UV")
  assert.equal(page.tree.props.style.backgroundColor, "oklch(0.8 0.08 180)")
  assert.equal(page.scene().controls["灯效贴图混合增益"], 1.7)
  page.dial.values.背景渐变.启用渐变 = false
  page.render()
  assert.equal(page.tree.props.style.backgroundImage, "none")
  assert.equal(page.tree.props.style.backgroundColor, "oklch(0.8 0.08 180)")
  page.dial.resetValues()
  page.render()
  assert.equal(page.tree.props.style.backgroundColor, "#D3E6F2")
  assert.equal(page.tree.props.style.backgroundImage, "linear-gradient(180deg, #D3E6F2, #ffffff)")
  page.unmount()
})

// 最小 GLB 只用于验证加载器的容器与外链边界，不模拟键位适配。
function glb(document: unknown) {
  const source = JSON.stringify(document)
  const json = Buffer.from(source.padEnd(Math.ceil(source.length / 4) * 4, " "))
  const bytes = Buffer.alloc(20 + json.length)
  bytes.writeUInt32LE(0x46546C67, 0)
  bytes.writeUInt32LE(2, 4)
  bytes.writeUInt32LE(bytes.length, 8)
  bytes.writeUInt32LE(json.length, 12)
  bytes.writeUInt32LE(0x4E4F534A, 16)
  json.copy(bytes, 20)
  return Uint8Array.from(bytes).buffer
}

// 复用真实模型加载与去重释放逻辑，分别控制图像失败和模型校验失败。
function loaderFixture({ document = {}, failTexture = false, invalidModel = false } = {}) {
  const events: string[] = []
  function tracked<Resource extends THREE.Texture | THREE.BufferGeometry | THREE.Material>(resource: Resource, label: string) {
    resource.addEventListener("dispose", () => events.push(label))
    return resource
  }
  const embedded = tracked(new THREE.Texture(), "embedded")
  const scene = new THREE.Group().add(new THREE.Mesh(tracked(new THREE.BoxGeometry(), "geometry"), tracked(new THREE.MeshBasicMaterial({ map: embedded }), "material")))
  const modules = {
    "three": { ...THREE, TextureLoader: class {
      async loadAsync(url: string) {
        const base = url.includes("BASE") || url.includes("base")
        if (failTexture && !base) { throw new Error("invalid image") }
        return tracked(new THREE.Texture(), base ? "base" : "rgb")
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
    "@/components/shared/ansi-renderer": { validateAir75Scene() { throw new Error("Air75 validation must not run for Mist") } },
    "@/components/shared/shaders": { configureKeyboardTextures(textures: THREE.Texture[]) { textures.forEach(texture => texture.colorSpace = THREE.SRGBColorSpace) } },
  }
  const globals = { TextDecoder, Error, fetch: async () => ({ ok: true, arrayBuffer: async () => glb(document) }) }
  const shared = loadModule<SharedAssetsModule>("air75/workbench-assets.ts", modules, { globals })
  const mist = loadModule<AssetsModule>("mist/import-assets.ts", {
    ...modules,
    "@/components/air75/workbench-assets": shared,
    "./import-model": { prepareMistImportScene() { events.push("prepare Mist"); if (invalidModel) { throw new Error("导入模型缺少雾透键帽。") } } },
    "./scene-config": config,
    "./loading-indicator": loadModule("mist/loading-indicator.tsx", { "@/utils/cn": { cn: (...classes: string[]) => classes.join(" ") } }),
  }, { globals })
  return { ...mist, disposeAssets: shared.disposeAssets, events }
}

it("mist loading accepts its bundled paths and local files, rejects remote paths and embedded external references", async () => {
  const loaded = loaderFixture()
  const assets = await loaded.loadMistUvAssets(builtin, false, new AbortController().signal)
  assert.equal(assets.base.flipY, false)
  assert.equal(assets.rgb.flipY, false)
  assert.equal(assets.base.colorSpace, THREE.SRGBColorSpace)
  assert.deepEqual(loaded.events, ["parse", "prepare Mist", "decoder"])
  loaded.disposeAssets(assets)
  assert.deepEqual(loaded.events.sort(), ["base", "decoder", "embedded", "geometry", "material", "parse", "prepare Mist", "rgb"])
  const local = loaderFixture()
  const localAssets = await local.loadMistUvAssets({ model: "blob:model", base: "blob:base", rgb: "blob:rgb" }, true, new AbortController().signal)
  assert.equal(localAssets.base.flipY, true)
  local.disposeAssets(localAssets)
  for (const kind of ["model", "base", "rgb"] as const) {
    const remote = loaderFixture()
    await assert.rejects(remote.loadMistUvAssets({ ...builtin, [kind]: "https://example.com/asset" }, false, new AbortController().signal), /本机导入/)
    assert.deepEqual(remote.events, [], "invalid sources must not decode or allocate resources")
  }
  const external = loaderFixture({ document: { images: [{ uri: "https://example.com/image.png" }] } })
  await assert.rejects(external.loadMistUvAssets(builtin, false, new AbortController().signal), /外部文件/)
  assert.deepEqual(external.events.sort(), ["base", "decoder", "rgb"])
})

it("mist failed model validation, partial image failure and cancellation release all completed resources", async () => {
  const invalid = loaderFixture({ invalidModel: true })
  await assert.rejects(invalid.loadMistUvAssets(builtin, false, new AbortController().signal), /缺少雾透键帽/)
  assert.deepEqual(invalid.events.sort(), ["base", "decoder", "embedded", "geometry", "material", "parse", "prepare Mist", "rgb"])
  const partial = loaderFixture({ failTexture: true })
  await assert.rejects(partial.loadMistUvAssets(builtin, false, new AbortController().signal), /灯光 UV读取失败/)
  assert.deepEqual(partial.events.sort(), ["base", "decoder", "embedded", "geometry", "material", "parse", "prepare Mist"])
  const cancelled = loaderFixture()
  const controller = new AbortController()
  const request = cancelled.loadMistUvAssets(builtin, false, controller.signal)
  controller.abort()
  await assert.rejects(request, { name: "AbortError" })
  assert.deepEqual(cancelled.events.sort(), ["base", "decoder", "rgb"])
})

// 按 React 提交时序运行 Effect，检查替换前后旧资源的归属和迟到结果。
function sceneFixture() {
  const slots: unknown[] = []
  const effects = new Map<number, { deps: readonly unknown[], cleanup?: () => void }>()
  const pendingEffects: (() => void)[] = []
  const requests: PendingAssets[] = []
  const disposed: WorkbenchAssets[] = []
  let cursor = 0
  let sources: MistUvSources | undefined
  let controls = resolveControls(config.MIST_SCENE_CONFIG)
  let tree: TestElement
  const { default: Scene } = loadModule<SceneModule>("mist/scene.tsx", {
    "react": {
      ...React,
      useState<State>(initial: State) {
        const index = cursor++
        slots[index] ??= initial
        return [slots[index], (update: State | ((current: State) => State)) => {
          slots[index] = typeof update === "function" ? (update as (current: State) => State)(slots[index] as State) : update
        }]
      },
      useEffect(effect: () => (() => void) | void, deps: readonly unknown[]) {
        const index = cursor++
        const previous = effects.get(index)
        if (previous && deps.every((dependency, position) => Object.is(dependency, previous.deps[position]))) { return }
        pendingEffects.push(() => {
          previous?.cleanup?.()
          effects.set(index, { deps, cleanup: effect() || undefined })
        })
      },
    },
    "@react-three/drei": {},
    "@react-three/fiber": { Canvas: "Canvas" },
    "@/components/air75/workbench-assets": { disposeAssets: (assets: WorkbenchAssets) => disposed.push(assets) },
    "@/components/mist/keyboard-profile": {},
    "@/components/shared/ansi-renderer": {},
    "./import-assets": { loadMistUvAssets: (_sources: MistUvSources, _flipY: boolean, signal: AbortSignal) => new Promise<WorkbenchAssets>((resolve, reject) => requests.push({ signal, resolve, reject })) },
    "./import-model": {},
    "./scene-config": config,
    "./loading-indicator": loadModule("mist/loading-indicator.tsx", { "@/utils/cn": { cn: (...classes: string[]) => classes.join(" ") } }),
  }, { globals: { AbortController, Error } })
  function render(next = sources) {
    sources = next
    cursor = 0
    tree = Scene({ sources, controls, showLoading: sources !== undefined, fallback: React.createElement("img", { alt: "loading keyboard" }) }) as TestElement
    return tree
  }
  function commit() { pendingEffects.splice(0).forEach(effect => effect()) }
  function keyboard() {
    const canvas = nodes(tree).find(node => node.type === "Canvas")!
    const suspense = canvas.props.children as TestElement
    return suspense.props.children as TestElement<KeyboardProps>
  }
  return {
    requests,
    disposed,
    render,
    commit,
    keyboard,
    state: () => slots[0] as PreviewState,
    setColor() { controls = { ...controls, 页面背景颜色: "#ccddff" } },
    unmount() { effects.forEach(effect => effect.cleanup?.()) },
  }
}

// 场景替身只用于确认资源身份，不进入 Three.js 渲染或复制几何。
function assets(): WorkbenchAssets {
  const scene = new THREE.Group()
  return { gltf: { scene, scenes: [scene] } as WorkbenchAssets["gltf"], base: new THREE.Texture(), rgb: new THREE.Texture() }
}

it("mist never removes the loading keyboard before the first rendered frame, including errors and replacements", async () => {
  const page = pageFixture()
  assert.equal(nodes(page.loadingPreview()).some(node => node.type === "img" && node.props.src === "/assets/mist/render-idle.webp"), true, "dynamic module download must retain the keyboard")
  assert.equal(nodes(page.loadingPreview()).some(node => node.props.role === "status"), false)
  assert.equal(page.scene().showLoading, false)
  page.click("雾透模型与 UV 设置")
  page.click("0923 UV")
  assert.equal(page.scene().showLoading, true)
  page.click("1012 UV")
  assert.equal(page.scene().showLoading, true)
  page.unmount()
  const scene = sceneFixture()
  const hasFallback = () => nodes(scene.render()).some(node => node.props["data-ready"] === false && nodes(node.props.children).some(child => child.type === "img" && child.props.alt === "loading keyboard"))
  assert.equal(hasFallback(), true, "initial mount must show a keyboard before effects or asset downloads")
  scene.commit()
  assert.equal(nodes(scene.render()).some(node => node.props.role === "status"), false)
  assert.equal(hasFallback(), true)
  scene.requests[0].reject(new Error("offline"))
  await new Promise(setImmediate)
  assert.equal(hasFallback(), true, "initial loading failure must retain the static keyboard")
  assert.equal(scene.render().props["aria-busy"], false)
  assert.equal(nodes(scene.render()).some(node => node.props.role === "status"), false)
  scene.render(builtin)
  scene.commit()
  assert.equal(nodes(scene.render()).some(node => node.props.role === "status"), true)
  const first = assets()
  scene.requests[1].resolve(first)
  await new Promise(setImmediate)
  assert.equal(hasFallback(), true, "decoded assets are not a rendered frame")
  scene.commit()
  scene.keyboard().props.onReady()
  assert.equal(hasFallback(), false)
  assert.equal(nodes(scene.render()).some(node => node.props.role === "status"), false)
  scene.render({ ...builtin, base: "blob:replacement" })
  scene.commit()
  assert.equal(hasFallback(), false, "keep the old live scene while downloading a replacement")
  scene.requests[2].resolve(assets())
  await new Promise(setImmediate)
  assert.equal(hasFallback(), true, "replacement still needs its own rendered frame")
  scene.commit()
  scene.keyboard().props.onReady()
  assert.equal(hasFallback(), false)
  scene.unmount()
})

it("mist keeps the last good preview on failed replacement and disposes old assets only after successful commit", async () => {
  const scene = sceneFixture()
  scene.render(builtin)
  scene.commit()
  const first = assets()
  scene.requests[0].resolve(first)
  await new Promise(setImmediate)
  scene.render()
  scene.commit()
  scene.keyboard().props.onReady()
  scene.render()
  scene.setColor()
  scene.render()
  scene.commit()
  assert.equal(scene.requests.length, 1, "page color changes must not reload model or UV")
  const secondSources = { ...builtin, base: "blob:replacement" }
  scene.render(secondSources)
  scene.commit()
  assert.equal(scene.state().assets, first)
  assert.equal(scene.state().ready, true)
  scene.requests[1].reject(new Error("UV 图片读取失败"))
  await new Promise(setImmediate)
  scene.render()
  scene.commit()
  assert.equal(scene.keyboard().props.scene, first.gltf.scene)
  assert.equal(scene.state().error, "UV 图片读取失败")
  assert.deepEqual(scene.disposed, [])
  scene.render({ ...secondSources, base: "blob:valid" })
  scene.commit()
  const second = assets()
  scene.requests[2].resolve(second)
  await new Promise(setImmediate)
  scene.render()
  assert.equal(scene.keyboard().props.scene, second.gltf.scene)
  assert.equal(scene.state().ready, false, "replacement waits for its own first rendered frame")
  assert.deepEqual(scene.disposed, [], "the previous scene remains owned until the replacement commits")
  scene.commit()
  assert.deepEqual(scene.disposed, [first])
  scene.unmount()
  assert.deepEqual(scene.disposed, [first, second])
})

it("mist cancelled requests cannot overwrite the selected scene and release late decoded assets", async () => {
  const scene = sceneFixture()
  scene.render(builtin)
  scene.commit()
  scene.render({ ...builtin, model: "blob:newest" })
  scene.commit()
  assert.equal(scene.requests[0].signal.aborted, true)
  const stale = assets()
  scene.requests[0].resolve(stale)
  await new Promise(setImmediate)
  assert.deepEqual(scene.disposed, [stale])
  assert.equal(scene.state().assets, undefined)
  const newest = assets()
  scene.requests[1].resolve(newest)
  await new Promise(setImmediate)
  scene.render()
  scene.commit()
  assert.equal(scene.keyboard().props.scene, newest.gltf.scene)
  scene.unmount()
  assert.equal(scene.requests[1].signal.aborted, true)
  assert.deepEqual(scene.disposed, [stale, newest])
})
