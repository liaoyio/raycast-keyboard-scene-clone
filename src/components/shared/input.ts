"use client"

import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { useEventCallback, useEventListener } from "usehooks-ts"

import { useKeyAudio } from "@/components/shared/audio"

type KeyHandler = (code: string) => void
type KeyboardPointerEvent = ThreeEvent<PointerEvent>
interface KeyboardInputOptions {
  enabled: boolean
  supportedKeys: ReadonlySet<string>
  onPress?: KeyHandler
  onRelease?: KeyHandler
}
interface InputNotifications {
  press: KeyHandler
  release: (code: string, silent: boolean) => void
}

const MODIFIER_KEY_CODE = /^(?:Shift|Control|Alt|Meta)(?:Left|Right)$/

/** 表单和操作按钮保留自己的键盘行为。 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.matches("a[href], button, input, select, textarea, [role='button'], [role='link']")
    || target.isContentEditable
  )
}

/** 合并实体键盘和拖动的占用；最后一个输入源松开后才释放按键。 */
export function createKeyboardInput(notify: InputNotifications) {
  const keyboard = new Set<string>()
  const pressed = new Set<string>()
  let pointerKey: string | null = null
  let dragging = false

  /** 同一按键只触发一次声音和波纹。 */
  function press(code: string) {
    if (pressed.has(code)) { return }
    pressed.add(code)
    notify.press(code)
  }

  /** 强制清理时不播放松键声音。 */
  function release(code: string, silent = false) {
    if (!pressed.delete(code)) { return }
    notify.release(code, silent)
  }

  /** 指针移出键帽后仍由实体键盘按住的键保持按下。 */
  function releasePointer() {
    if (pointerKey && !keyboard.has(pointerKey)) { release(pointerKey) }
    pointerKey = null
    dragging = false
  }

  /** 失焦、禁用或卸载时一次清空所有输入源。 */
  function releaseAll() {
    pressed.forEach(code => release(code, true))
    keyboard.clear()
    pointerKey = null
    dragging = false
  }

  /** macOS 可能吞掉 Command 组合中的 keyup，松开 Command 时回收这些键。 */
  function keyUp(code: string) {
    const released = code.startsWith("Meta")
      ? Array.from(keyboard).filter(key => !MODIFIER_KEY_CODE.test(key)).concat(code)
      : [code]
    released.forEach((key) => {
      keyboard.delete(key)
      if (pointerKey !== key) { release(key) }
    })
  }

  /** 拖动经过新键帽时交接指针占用，不干扰实体按键。 */
  function enterPointer(event: KeyboardPointerEvent) {
    event.stopPropagation()
    const code = event.object.name
    if (!code || code === "static" || code === pointerKey) { return }
    if (pointerKey && !keyboard.has(pointerKey)) { release(pointerKey) }
    pointerKey = code
    press(code)
  }

  /** 同时支持舞台内按下和从舞台外拖入。 */
  function movePointer(event: KeyboardPointerEvent) {
    if (dragging || (event.buttons & 1) !== 0) { enterPointer(event) }
  }

  return {
    pressedKeysRef: { current: pressed },
    keyDown(code: string) { keyboard.add(code); press(code) },
    keyUp,
    releaseAll,
    releasePointer,
    pointerEvents: {
      onPointerDown(event: KeyboardPointerEvent) {
        if (event.button !== 0) { return }
        dragging = true
        enterPointer(event)
      },
      onPointerMove: movePointer,
      onPointerOver: movePointer,
      onPointerUp: releasePointer,
      onPointerCancel: releasePointer,
    },
  }
}

/** 将浏览器事件接入同一个输入控制器，订阅与禁用清理集中在此处。 */
export function useKeyboardInput({ enabled, supportedKeys, onPress, onRelease }: KeyboardInputOptions) {
  const playSound = useKeyAudio()
  const press = useEventCallback((code: string) => { playSound(code, 0); onPress?.(code) })
  const release = useEventCallback((code: string, silent: boolean) => {
    if (!silent) { playSound(code, 1) }
    onRelease?.(code)
  })
  const input = useMemo(() => createKeyboardInput({ press, release }), [press, release])

  useEventListener("keydown", (event) => {
    if (enabled && supportedKeys.has(event.code) && !isInteractiveTarget(event.target)) { input.keyDown(event.code) }
  })
  useEventListener("keyup", (event) => { if (enabled) { input.keyUp(event.code) } })
  useEventListener("pointerup", input.releasePointer)
  useEventListener("pointercancel", input.releasePointer)
  useEventListener("blur", input.releaseAll)

  useEffect(() => {
    if (!enabled) { input.releaseAll() }
    document.addEventListener("visibilitychange", input.releaseAll)
    return () => {
      document.removeEventListener("visibilitychange", input.releaseAll)
      input.releaseAll()
    }
  }, [enabled, input])

  return { pointerEvents: enabled ? input.pointerEvents : {}, pressedKeysRef: input.pressedKeysRef }
}
