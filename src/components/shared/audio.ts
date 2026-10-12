"use client"

import type { KeySoundSlices, SoundPhase } from "./sound-map"
import { useCallback, useEffect, useRef } from "react"
import { KEY_SOUND_URL } from "@/components/shared/constants"
import KEY_SOUND_MAP, { SOUND_KEY_ALIASES } from "./sound-map"

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext }
export type PlayKeySound = (code: string, phase: SoundPhase) => void
interface KeyAudioPlayer { play: PlayKeySound, dispose: () => void }

const LETTER_SOUND_SLICES = Object.entries(KEY_SOUND_MAP).flatMap(
  ([code, slices]): KeySoundSlices[] => /^Key[A-Z]$/.test(code) && slices ? [slices] : [],
)

/** 优先使用按键自己的录音，缺失时回退到别名或字母键录音。 */
function getSoundSlice(code: string, phase: SoundPhase) {
  const alias = SOUND_KEY_ALIASES[code]
  const slices = KEY_SOUND_MAP[code] ?? (alias ? KEY_SOUND_MAP[alias] : undefined)
    ?? LETTER_SOUND_SLICES[Math.floor(Math.random() * LETTER_SOUND_SLICES.length)]
  return slices?.[phase]
}

/** 单个播放器拥有上下文、下载和音源，销毁后异步回调不能再启动播放。 */
export function createKeyAudioPlayer(context: AudioContext): KeyAudioPlayer {
  const controller = new AbortController()
  const gain = context.createGain()
  const sources = new Set<AudioBufferSourceNode>()
  let buffer: AudioBuffer | null = null
  let disposed = false

  gain.gain.value = 3
  gain.connect(context.destination)

  fetch(KEY_SOUND_URL, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) { throw new Error(`Unable to load key sounds (${response.status})`) }
      return response.arrayBuffer()
    })
    .then(data => context.decodeAudioData(data))
    .then((decoded) => { if (!disposed) { buffer = decoded } })
    .catch(() => { /* 音频不可用时仍保留按键和灯光交互。 */ })

  /** 播放录音切片，并在自然结束后立即断开音源。 */
  function playSlice(start: number, end: number) {
    if (disposed || !buffer || context.state === "closed") { return }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(gain)
    sources.add(source)
    source.onended = () => { sources.delete(source); source.disconnect() }
    source.start(context.currentTime, start / 1000, (end - start) / 1000)
  }

  /** 浏览器自动播放限制解除后再播放；期间卸载会使本次播放失效。 */
  function play(code: string, phase: SoundPhase) {
    if (disposed || !buffer) { return }
    const slice = getSoundSlice(code, phase)
    if (!slice) { return }
    const start = () => playSlice(...slice)
    if (context.state === "running") { start() }
    else { void context.resume().then(start).catch(() => undefined) }
  }

  /** 中断下载、停止音源并关闭上下文；允许重复清理。 */
  function dispose() {
    if (disposed) { return }
    disposed = true
    controller.abort()
    sources.forEach((source) => {
      source.onended = null
      try { source.stop() }
      catch { /* 已结束的音源无需再次停止。 */ }
      source.disconnect()
    })
    sources.clear()
    buffer = null
    gain.disconnect()
    void context.close().catch(() => undefined)
  }

  return { play, dispose }
}

/** React 只管理播放器的挂载周期，播放状态由播放器自身持有。 */
export function useKeyAudio(): PlayKeySound {
  const playerRef = useRef<KeyAudioPlayer | null>(null)
  useEffect(() => {
    const AudioContextConstructor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext
    if (!AudioContextConstructor) { return }
    const current = createKeyAudioPlayer(new AudioContextConstructor())
    playerRef.current = current
    return () => { playerRef.current = null; current.dispose() }
  }, [])
  return useCallback((code: string, phase: SoundPhase) => playerRef.current?.play(code, phase), [])
}
