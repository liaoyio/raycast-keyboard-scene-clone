"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useEventListener } from "usehooks-ts";

import { useKeyAudio } from "./audio";

type KeyHandler = (code: string) => void;
type KeyboardPointerEvent = ThreeEvent<PointerEvent>;

interface KeyboardInputOptions {
  enabled: boolean;
  supportedKeys: ReadonlySet<string>;
  onPress?: KeyHandler;
  onRelease?: KeyHandler;
}

const MODIFIER_KEY_CODE = /^(?:Shift|Control|Alt|Meta)(?:Left|Right)$/;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.matches(
      "a[href], button, input, select, textarea, [role='button'], [role='link']",
    ) || target.isContentEditable
  );
}

/**
 * 统一处理实体键盘与指针输入。只要任一输入源仍占用某个按键，
 * 就保持按下状态，避免重复触发光效和声音。
 */
export function useKeyboardInput({
  enabled,
  supportedKeys,
  onPress,
  onRelease,
}: KeyboardInputOptions) {
  const keyboardKeysRef = useRef(new Set<string>());
  const pointerKeysRef = useRef(new Set<string>());
  const pressedKeysRef = useRef(new Set<string>());
  const pointerKeyRef = useRef<string | null>(null);
  const pointerDownRef = useRef(false);
  const documentRef = useRef<Document>(null!);
  const playSound = useKeyAudio();

  const press = useCallback(
    (code: string) => {
      if (!enabled) return;
      if (pressedKeysRef.current.has(code)) return;

      pressedKeysRef.current.add(code);
      playSound(code, 0);
      onPress?.(code);
    },
    [enabled, onPress, playSound],
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

  const releaseKeysLostToMeta = useCallback(() => {
    for (const code of Array.from(keyboardKeysRef.current)) {
      if (MODIFIER_KEY_CODE.test(code)) continue;

      keyboardKeysRef.current.delete(code);
      if (!pointerKeysRef.current.has(code)) release(code);
    }
  }, [release]);

  useEffect(() => {
    documentRef.current = document;
  }, []);

  useEventListener("keydown", (event) => {
    if (!enabled || isInteractiveTarget(event.target)) return;
    if (!supportedKeys.has(event.code)) return;

    keyboardKeysRef.current.add(event.code);
    press(event.code);
  });

  useEventListener("keyup", (event) => {
    if (!enabled) return;

    // macOS may omit non-modifier keyup events while Command is held.
    // Releasing Command therefore also relinquishes every keyboard-owned
    // non-modifier key, without disturbing a simultaneous pointer hold.
    if (event.code.startsWith("Meta")) releaseKeysLostToMeta();
    if (!supportedKeys.has(event.code)) return;

    keyboardKeysRef.current.delete(event.code);
    if (!pointerKeysRef.current.has(event.code)) release(event.code);
  });

  useEventListener("pointerup", releasePointerKeys);
  useEventListener("pointercancel", releasePointerKeys);
  useEventListener("blur", releaseAll);
  useEventListener("visibilitychange", releaseAll, documentRef);

  useEffect(() => {
    if (!enabled) releaseAll();

    return releaseAll;
  }, [enabled, releaseAll]);

  const enterPointerKey = useCallback(
    (event: KeyboardPointerEvent) => {
      if (!enabled) return;
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
    [enabled, press, release],
  );

  const pointerEvents = useMemo(() => {
    if (!enabled) return {};

    return {
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
    };
  }, [enabled, enterPointerKey, releasePointerKeys]);

  return { pointerEvents, pressedKeysRef };
}
