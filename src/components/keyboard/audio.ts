"use client";

import { useCallback, useEffect, useRef } from "react";
import { KEY_SOUND_URL } from "./constants";
import KEY_SOUND_MAP, {
  SOUND_KEY_ALIASES,
  type KeySoundSlices,
  type SoundPhase,
} from "./sound-map";

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

export type PlayKeySound = (code: string, phase: SoundPhase) => void;

const LETTER_KEY_CODE = /^Key[A-Z]$/;
const LETTER_SOUND_SLICES = Object.entries(KEY_SOUND_MAP).flatMap(
  ([code, slices]): KeySoundSlices[] =>
    LETTER_KEY_CODE.test(code) && slices ? [slices] : [],
);

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * 加载单一键盘音频精灵，并返回播放指定按下或松开片段的函数。
 * 组件卸载时会释放 AudioContext 和全部音源，避免 Next.js 客户端跳转后残留资源。
 */
export function useKeyAudio(): PlayKeySound {
  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  useEffect(() => {
    const AudioContextConstructor =
      window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;

    if (!AudioContextConstructor) return undefined;

    const controller = new AbortController();
    const context = new AudioContextConstructor();
    const gain = context.createGain();
    let disposed = false;

    gain.gain.value = 3;
    gain.connect(context.destination);
    contextRef.current = context;
    gainRef.current = gain;

    fetch(KEY_SOUND_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load key sounds (${response.status})`);
        }

        return response.arrayBuffer();
      })
      .then((audioData) => context.decodeAudioData(audioData))
      .then((buffer) => {
        if (!disposed) bufferRef.current = buffer;
      })
      .catch((error: unknown) => {
        if (!disposed && !isAbortError(error)) bufferRef.current = null;
      });

    return () => {
      disposed = true;
      controller.abort();

      for (const source of sourcesRef.current) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          // 浏览器重复停止已经结束的音源时可能抛错，此处可以安全忽略。
        }
        source.disconnect();
      }

      sourcesRef.current.clear();
      bufferRef.current = null;
      gain.disconnect();
      contextRef.current = null;
      gainRef.current = null;
      void context.close().catch(() => undefined);
    };
  }, []);

  return useCallback((code: string, phase: SoundPhase) => {
    const context = contextRef.current;
    const buffer = bufferRef.current;
    const gain = gainRef.current;

    if (!context || !buffer || !gain) return;

    const alias = SOUND_KEY_ALIASES[code];
    const slices =
      KEY_SOUND_MAP[code] ??
      (alias ? KEY_SOUND_MAP[alias] : undefined) ??
      LETTER_SOUND_SLICES[
        Math.floor(Math.random() * LETTER_SOUND_SLICES.length)
      ];
    const slice = slices?.[phase];

    if (!slice) return;

    const [startMilliseconds, endMilliseconds] = slice;
    const startPlayback = () => {
      if (
        context.state === "closed" ||
        contextRef.current !== context ||
        bufferRef.current !== buffer ||
        gainRef.current !== gain
      ) {
        return;
      }

      const source = context.createBufferSource();

      source.buffer = buffer;
      source.connect(gain);
      sourcesRef.current.add(source);
      source.onended = () => {
        sourcesRef.current.delete(source);
        source.disconnect();
      };
      source.start(
        context.currentTime,
        startMilliseconds / 1000,
        (endMilliseconds - startMilliseconds) / 1000,
      );
    };

    if (context.state !== "running") {
      void context
        .resume()
        .then(startPlayback)
        .catch(() => undefined);
      return;
    }

    startPlayback();
  }, []);
}
