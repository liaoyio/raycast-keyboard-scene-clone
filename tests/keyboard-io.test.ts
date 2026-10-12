import assert from "node:assert/strict"
import { it } from "vitest"
import { loadModule } from "./helpers"

type InputModule = typeof import("../src/components/shared/input")
type PointerInput = Parameters<ReturnType<InputModule["createKeyboardInput"]>["pointerEvents"]["onPointerDown"]>[0]
interface AudioSourceDouble {
  starts: number[][]
  stops: number
  disconnects: number
  onended: (() => void) | null
  connect: () => void
  start: (...args: number[]) => void
  stop: () => void
  disconnect: () => void
}

const { createKeyboardInput } = loadModule<InputModule>("shared/input.ts", {
  "react": {},
  "usehooks-ts": {},
  "@/components/shared/audio": {},
})

// 指针事件只保留控制器消费的字段。
const pointer = (code: string) => ({ object: { name: code }, button: 0, buttons: 1, stopPropagation() {} }) as PointerInput
// 同时记录按下与静默清理事件，区分输入释放和资源卸载。
function inputFixture() {
  const events: string[] = []
  const input = createKeyboardInput({
    press: code => events.push(`press:${code}`),
    release: (code, silent) => events.push(`${silent ? "clear" : "release"}:${code}`),
  })
  return { input, events }
}

it("physical and pointer holds share one key without duplicate sound or early release", () => {
  const { input, events } = inputFixture()
  input.keyDown("KeyA")
  input.keyDown("KeyA")
  input.pointerEvents.onPointerDown(pointer("KeyA"))
  input.keyUp("KeyA")
  assert.equal(input.pressedKeysRef.current.has("KeyA"), true)
  input.releasePointer()
  assert.deepEqual(events, ["press:KeyA", "release:KeyA"])
})

it("dragging hands off pointer ownership while a physical key stays pressed", () => {
  const { input, events } = inputFixture()
  input.keyDown("KeyA")
  input.pointerEvents.onPointerDown(pointer("KeyA"))
  input.pointerEvents.onPointerMove(pointer("KeyB"))
  input.pointerEvents.onPointerOver(pointer("KeyB"))
  input.releasePointer()
  assert.deepEqual([...input.pressedKeysRef.current], ["KeyA"])
  input.keyUp("KeyA")
  assert.deepEqual(events, ["press:KeyA", "press:KeyB", "release:KeyB", "release:KeyA"])
})

it("command release clears swallowed keyup events but respects a simultaneous pointer hold", () => {
  const { input } = inputFixture();
  ["MetaLeft", "ShiftLeft", "KeyA", "KeyB"].forEach(input.keyDown)
  input.pointerEvents.onPointerDown(pointer("KeyA"))
  input.keyUp("MetaLeft")
  assert.deepEqual([...input.pressedKeysRef.current], ["ShiftLeft", "KeyA"])
  input.releasePointer()
  input.keyUp("ShiftLeft")
  assert.equal(input.pressedKeysRef.current.size, 0)
})

it("blur or disabled cleanup clears every owner silently and allows a fresh press", () => {
  const { input, events } = inputFixture()
  input.keyDown("KeyA")
  input.pointerEvents.onPointerDown(pointer("KeyB"))
  input.releaseAll()
  input.releaseAll()
  input.keyUp("KeyA")
  assert.equal(input.pressedKeysRef.current.size, 0)
  assert.deepEqual(events, ["press:KeyA", "press:KeyB", "clear:KeyA", "clear:KeyB"])
  input.keyDown("KeyA")
  assert.equal(events.at(-1), "press:KeyA")
})

// 用可控的 resume Promise 检查卸载与恢复播放之间的竞态。
function audioFixture() {
  const sources: AudioSourceDouble[] = []
  let resume: (() => void) | undefined
  let closed = 0
  let disconnected = 0
  const context = {
    state: "running" as AudioContextState,
    currentTime: 1,
    destination: {},
    createGain: () => ({ gain: {}, connect() {}, disconnect() { disconnected++ } }),
    decodeAudioData: async () => ({}),
    resume: () => new Promise<void>((resolve) => { resume = resolve }),
    close: async () => { closed++; context.state = "closed" },
    createBufferSource() {
      const source: AudioSourceDouble = { starts: [], stops: 0, disconnects: 0, onended: null, connect() {}, start(...args) { this.starts.push(args) }, stop() { this.stops++ }, disconnect() { this.disconnects++ } }
      sources.push(source)
      return source
    },
  }
  const { createKeyAudioPlayer } = loadModule<typeof import("../src/components/shared/audio")>("shared/audio.ts", {
    "react": {},
    "@/components/shared/constants": { KEY_SOUND_URL: "/sound.ogg" },
    "./sound-map": { default: { KeyA: [[100, 200], [200, 300]] }, SOUND_KEY_ALIASES: {} },
  }, { globals: { AbortController, fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) } })
  // Web Audio 替身仅实现播放器实际消费的 API，其余浏览器成员不参与测试。
  return { player: createKeyAudioPlayer(context as unknown as AudioContext), context, sources, resume: () => { assert.ok(resume); resume() }, counts: () => ({ closed, disconnected }) }
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve))

it("audio playback releases finished sources and disposes the remaining sources exactly once", async () => {
  const fixture = audioFixture()
  await flush()
  fixture.player.play("KeyA", 0)
  assert.deepEqual(fixture.sources[0].starts, [[1, 0.1, 0.1]])
  assert.ok(fixture.sources[0].onended)
  fixture.sources[0].onended()
  fixture.player.play("KeyA", 1)
  fixture.player.dispose()
  fixture.player.dispose()
  assert.equal(fixture.sources[0].stops, 0)
  assert.equal(fixture.sources[1].stops, 1)
  assert.deepEqual(fixture.counts(), { closed: 1, disconnected: 1 })
})

it("resolving audio resume after disposal cannot create a new source", async () => {
  const fixture = audioFixture()
  await flush()
  fixture.context.state = "suspended"
  fixture.player.play("KeyA", 0)
  fixture.player.dispose()
  fixture.resume()
  await flush()
  assert.equal(fixture.sources.length, 0)
})
