"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import { useKeyAudio } from "./audio";
import { SUPPORTED_KEY_CODE } from "./constants";

type KeyHandler = (code: string) => void;
type KeyboardPointerEvent = ThreeEvent<PointerEvent>;

interface KeyboardInputOptions {
  enabled: boolean;
  onPress?: KeyHandler;
  onRelease?: KeyHandler;
}

/**
 * 统一处理实体键盘与指针输入。只要任一输入源仍占用某个按键，
 * 就保持按下状态，避免重复触发光效和声音。
 */
export function useKeyboardInput({
  enabled,
  onPress,
  onRelease,
}: KeyboardInputOptions) {
  const keyboardKeysRef = useRef(new Set<string>());
  const pointerKeysRef = useRef(new Set<string>());
  const pressedKeysRef = useRef(new Set<string>());
  const pointerKeyRef = useRef<string | null>(null);
  const pointerDownRef = useRef(false);
  const playSound = useKeyAudio();

  const press = useCallback(
    (code: string) => {
      if (pressedKeysRef.current.has(code)) return;

      pressedKeysRef.current.add(code);
      playSound(code, 0);
      onPress?.(code);
    },
    [onPress, playSound],
  );

  const release = useCallback(
    (code: string, silent = false) => {
      if (!pressedKeysRef.current.has(code)) return;

      pressedKeysRef.current.delete(code);
      if (!silent) playSound(code, 1);
      onRelease?.(code);
    },
    [onRelease, playSound],
  );

  const releasePointerKeys = useCallback(() => {
    for (const code of pointerKeysRef.current) {
      if (!keyboardKeysRef.current.has(code)) release(code);
    }

    pointerKeysRef.current.clear();
    pointerKeyRef.current = null;
    pointerDownRef.current = false;
  }, [release]);

  const releaseAll = useCallback(() => {
    for (const code of pressedKeysRef.current) release(code, true);

    keyboardKeysRef.current.clear();
    pointerKeysRef.current.clear();
    pointerKeyRef.current = null;
    pointerDownRef.current = false;
  }, [release]);

  useEffect(() => {
    if (!enabled) {
      releaseAll();
      return undefined;
    }

    const controller = new AbortController();
    const listenerOptions: AddEventListenerOptions = {
      signal: controller.signal,
    };

    window.addEventListener(
      "keydown",
      (event) => {
        if (!SUPPORTED_KEY_CODE.test(event.code)) return;

        keyboardKeysRef.current.add(event.code);
        press(event.code);
      },
      listenerOptions,
    );

    window.addEventListener(
      "keyup",
      (event) => {
        if (!SUPPORTED_KEY_CODE.test(event.code)) return;

        keyboardKeysRef.current.delete(event.code);
        if (!pointerKeysRef.current.has(event.code)) release(event.code);
      },
      listenerOptions,
    );

    window.addEventListener("pointerup", releasePointerKeys, listenerOptions);
    window.addEventListener("pointercancel", releasePointerKeys, listenerOptions);
    window.addEventListener("blur", releaseAll, listenerOptions);
    document.addEventListener("visibilitychange", releaseAll, listenerOptions);

    return () => {
      controller.abort();
      releaseAll();
    };
  }, [enabled, press, release, releaseAll, releasePointerKeys]);

  const enterPointerKey = useCallback(
    (event: KeyboardPointerEvent) => {
      event.stopPropagation();

      const code = event.object.name;
      if (!code || code === "static" || pointerKeyRef.current === code) return;

      const previousCode = pointerKeyRef.current;
      if (previousCode) {
        pointerKeysRef.current.delete(previousCode);
        if (!keyboardKeysRef.current.has(previousCode)) release(previousCode);
      }

      pointerKeyRef.current = code;
      pointerKeysRef.current.add(code);
      press(code);
    },
    [press, release],
  );

  const pointerEvents = useMemo(
    () => ({
      onPointerDown: (event: KeyboardPointerEvent) => {
        if (event.button !== 0) return;
        pointerDownRef.current = true;
        enterPointerKey(event);
      },
      onPointerMove: (event: KeyboardPointerEvent) => {
        if (pointerDownRef.current || (event.buttons & 1) !== 0) {
          enterPointerKey(event);
        }
      },
      onPointerOver: (event: KeyboardPointerEvent) => {
        if (pointerDownRef.current || (event.buttons & 1) !== 0) {
          enterPointerKey(event);
        }
      },
      onPointerUp: releasePointerKeys,
      onPointerCancel: releasePointerKeys,
    }),
    [enterPointerKey, releasePointerKeys],
  );

  return { pointerEvents, pressedKeysRef };
}
