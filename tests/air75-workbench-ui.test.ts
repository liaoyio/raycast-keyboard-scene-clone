import type { ReactElement } from "react"
import type { Air75AssetSources, Air75WorkbenchControls } from "../src/components/air75/workbench-config"
import type { TestElement } from "./helpers"
import assert from "node:assert/strict"
import { it } from "vitest"
import { loadModule, nodes, resolveControls } from "./helpers"

type WorkbenchModule = typeof import("../src/components/air75/workbench")
type WorkbenchConfigModule = typeof import("../src/components/air75/workbench-config")
type InputModule = typeof import("../src/components/shared/input")
type UploadFile = Pick<File, "name" | "size">
interface FocusableElement {
  tagName: string
  focus: () => void
  matches: (selector?: string) => boolean
}
interface KeyboardEventStub {
  code: string
  key: string
  target: FocusableElement | null
  stopImmediatePropagation: () => void
}
interface WorkbenchNodeProps {
  "aria-label"?: string
  "data-testid"?: string
  "role"?: string
  "src"?: string
  "tabIndex"?: number
  "ref"?: { current: FocusableElement | null }
  "onClick"?: () => void
  "onChange"?: (event: { currentTarget: { files: UploadFile[], value: string } }) => void
}
interface WorkbenchRootProps {
  "data-theme": string
  "style": { backgroundColor: string }
}
interface SceneViewProps { sources: Air75AssetSources, replay: number }

// 模拟控件事件和舞台焦点，记录本地素材 URL 的完整释放过程。
function fixture() {
  const slots: unknown[] = []
  const cleanups: (() => void)[] = []
  const listeners = new Map<string, (event: KeyboardEventStub) => void>()
  const document: { activeElement: FocusableElement | null } = { activeElement: null }
  const presses: string[] = []
  const revoked: string[] = []
  let created = 0
  let cursor = 0
  let tree: ReactElement<WorkbenchRootProps>
  class Element implements FocusableElement {
    readonly tagName: string
    constructor(type: string) { this.tagName = type.toUpperCase() }
    focus() { document.activeElement = this }
    matches() { return ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"].includes(this.tagName) }
  }
  const config = loadModule<WorkbenchConfigModule>("air75/workbench-config.ts", {
    "@/components/shared/ansi-scene-config": loadModule("shared/ansi-scene-config.ts"),
  })
  const dial = {
    values: resolveControls(config.AIR75_WORKBENCH_CONFIG),
    setValues(values: Partial<Air75WorkbenchControls>) { this.values = { ...this.values, ...values } },
    resetValues() { this.values = resolveControls(config.AIR75_WORKBENCH_CONFIG) },
  }
  const { Air75Workbench } = loadModule<WorkbenchModule>("air75/workbench.tsx", {
    "react": {
      useReducer<State, Action>(reducer: (state: State, action: Action) => State, initial: State) {
        const index = cursor++
        slots[index] ??= initial
        return [slots[index], (action: Action) => { slots[index] = reducer(slots[index] as State, action) }]
      },
      useRef<Value>(initial: Value) { const index = cursor++; return slots[index] ??= { current: initial } },
      useEffect(effect: () => (() => void) | void) {
        const index = cursor++
        if (slots[index]) { return }
        slots[index] = true
        const cleanup = effect()
        if (cleanup) { cleanups.push(cleanup) }
      },
    },
    "@/components/icons": { Settings: "svg" },
    "next/dynamic": { default: () => "WorkbenchScene" },
    "dialkit": { DialRoot: "DialRoot", useDialKitController: () => dial },
    "usehooks-ts": { useEventListener: (name: string, handler: (event: KeyboardEventStub) => void) => listeners.set(name, handler) },
    "@/utils/cn": { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") },
    "@/components/air75/workbench-config": config,
    "@/components/shared/asset-input": loadModule("shared/asset-input.tsx"),
  }, { globals: { URL: {
    createObjectURL() { return `blob:uploaded-${++created}` },
    revokeObjectURL(url: string) { revoked.push(url) },
  } } })
  const inputListeners = new Map<string, (event: KeyboardEventStub) => void>()
  const { useKeyboardInput } = loadModule<InputModule>("shared/input.ts", {
    "react": { useRef: <Value>(current: Value) => ({ current }), useCallback: <Callback>(fn: Callback) => fn, useMemo: <Value>(fn: () => Value) => fn(), useEffect() {} },
    "usehooks-ts": { useEventListener: (name: string, handler: (event: KeyboardEventStub) => void) => inputListeners.set(name, handler), useEventCallback: <Callback>(fn: Callback) => fn },
    "@/components/shared/audio": { useKeyAudio: () => () => {} },
  }, { globals: { HTMLElement: Element } })
  useKeyboardInput({ enabled: true, supportedKeys: new Set(["KeyA"]), onPress: code => presses.push(code) })

  function render() {
    cursor = 0
    tree = Air75Workbench() as ReactElement<WorkbenchRootProps>
    for (const node of nodes<WorkbenchNodeProps>(tree)) {
      if (node.props.ref) { node.props.ref.current ??= new Element(String(node.type)) }
    }
    return tree
  }
  function find(predicate: (node: TestElement<WorkbenchNodeProps>) => boolean) {
    const node = nodes<WorkbenchNodeProps>(tree).find(predicate)
    assert.ok(node, "expected control is rendered")
    return node
  }
  function click(label: string) {
    const node = find(({ type, props }) => type === "button" && (props["aria-label"] === label || props.children === label));
    (node.props.ref?.current ?? new Element("button")).focus()
    assert.ok(node.props.onClick)
    node.props.onClick()
    render()
  }
  render()
  return {
    dial,
    presses,
    click,
    find,
    render,
    revoked,
    unmount() { cleanups.forEach(cleanup => cleanup()) },
    scene() {
      const node = find(({ type }) => type === "WorkbenchScene")
      return node.props as WorkbenchNodeProps & SceneViewProps
    },
    alert() {
      const message = find(({ props }) => props.role === "alert").props.children
      assert.equal(typeof message, "string")
      return message as string
    },
    upload(label: string, file: UploadFile) {
      const input = find(({ type, props }) => type === "input" && props["aria-label"] === `导入 ${label}`)
      assert.ok(input.props.onChange)
      input.props.onChange({ currentTarget: { files: [file], value: file.name } })
      render()
    },
    get tree() { return tree },
    backdrops: () => nodes<WorkbenchNodeProps>(tree).filter(({ type, props }) => type === "img" && props.src === "/assets/common/stage-background.webp"),
    pressKey() {
      const event = { code: "KeyA", key: "a", target: document.activeElement, stopImmediatePropagation() {} }
      inputListeners.get("keydown")!(event)
      inputListeners.get("keyup")!(event)
    },
    escape() { listeners.get("keydown")!({ key: "Escape", code: "Escape", target: document.activeElement, stopImmediatePropagation() {} }); render() },
    assertStageFocused() {
      const stage = find(({ props }) => props["data-testid"] === "keyboard-stage")
      assert.equal(stage.props.tabIndex, -1)
      assert.equal(document.activeElement, stage.props.ref?.current)
    },
  }
}

it("closing settings, Escape and replay return physical keyboard input to the stage", () => {
  const page = fixture()
  page.click("模型动画设置")
  page.pressKey()
  assert.deepEqual(page.presses, [], "focused controls must retain their native keyboard behavior")
  page.click("关闭设置抽屉")
  page.assertStageFocused()
  page.pressKey()
  page.click("模型动画设置")
  page.escape()
  page.assertStageFocused()
  page.pressKey()
  const before = page.scene().replay
  page.click("重播入场")
  page.assertStageFocused()
  page.pressKey()
  assert.equal(page.scene().replay, before + 1)
  assert.deepEqual(page.presses, ["KeyA", "KeyA", "KeyA"])
})

it("finish switching and reset apply matching stage defaults while Dialkit can change the page color", () => {
  const page = fixture()
  assert.equal(page.tree.props.style.backgroundColor, "#080808")
  assert.equal(page.backdrops().length, 2)
  page.click("模型动画设置")
  page.click("白色")
  page.assertStageFocused()
  page.pressKey()
  assert.equal(page.tree.props["data-theme"], "white")
  assert.equal(page.tree.props.style.backgroundColor, "#f6f6f4")
  assert.equal(page.backdrops().length, 0)
  page.dial.setValues({
    舞台背景: { ...page.dial.values["舞台背景"], 网页背景颜色: "#ccddff", 左侧背景: true },
    灯效贴图混合增益: 2.8,
  })
  page.render()
  assert.equal(page.tree.props.style.backgroundColor, "#ccddff")
  assert.equal(page.backdrops().length, 1)
  page.click("恢复截图默认参数")
  page.assertStageFocused()
  page.pressKey()
  assert.equal(page.tree.props["data-theme"], "white")
  assert.equal(page.tree.props.style.backgroundColor, "#f6f6f4")
  assert.equal(page.backdrops().length, 0)
  assert.equal(page.dial.values["灯效贴图混合增益"], 1.67)
  page.click("黑色")
  page.assertStageFocused()
  page.pressKey()
  assert.deepEqual(page.presses, ["KeyA", "KeyA", "KeyA"])
  assert.equal(page.tree.props.style.backgroundColor, "#080808")
  assert.equal(page.backdrops().length, 2)
})

it("invalid uploads keep the current asset, while replacement, restore and unmount release local URLs", () => {
  const page = fixture()
  page.click("模型动画设置")
  page.upload("Base UV", { name: "custom.png", size: 100 })
  assert.equal(page.scene().sources.base, "blob:uploaded-1")
  page.upload("Base UV", { name: "empty.png", size: 0 })
  assert.match(page.alert(), /非空文件/)
  assert.equal(page.scene().sources.base, "blob:uploaded-1")
  assert.deepEqual(page.revoked, [])
  page.upload("Base UV", { name: "replacement.webp", size: 100 })
  assert.deepEqual(page.revoked, ["blob:uploaded-1"])
  page.click("恢复内置Base UV")
  assert.match(page.scene().sources.base, /texture-black-base/)
  page.upload("RGB 灯光 UV", { name: "rgb.png", size: 100 })
  page.click("白色")
  assert.match(page.scene().sources.rgb, /texture-white-rgb/)
  page.upload("模型 GLB", { name: "custom.glb", size: 100 })
  page.unmount()
  assert.deepEqual(page.revoked, ["blob:uploaded-1", "blob:uploaded-2", "blob:uploaded-3", "blob:uploaded-4"])
})
