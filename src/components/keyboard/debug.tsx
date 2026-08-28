"use client";

import { useEffect, useState } from "react";
import {
  DialRoot,
  useDialKit,
  type DialConfig,
  type ResolvedValues,
} from "dialkit";

import {
  CAMERA_LOOK_AT,
  CAMERA_TARGET_POSITION,
  DEFAULT_LIGHTING,
  KEY_PRESS_DEPTH,
  LIGHTING_INTENSITY,
  PRESSED_KEY_DIMMING,
  PULSE_DURATION,
  PULSE_EASING_STRENGTH,
  PULSE_FEATHER,
  PULSE_RADIUS,
} from "./constants";

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
] as const;

// 参数范围既要覆盖常见调试需求，也要避免把相机或 Shader 调到不可恢复的状态。
const SCENE_CONFIG = {
  defaultLighting: [DEFAULT_LIGHTING, 0, 1, 0.01],
  keyPressDepth: [KEY_PRESS_DEPTH, 0, 0.1, 0.001],
  lightingIntensity: [LIGHTING_INTENSITY, 0, 3, 0.01],
  pressedKeyDimming: [PRESSED_KEY_DIMMING, 0, 1, 0.01],
  pulseDuration: [PULSE_DURATION, 0.1, 3, 0.01],
  pulseEasingStrength: [PULSE_EASING_STRENGTH, 0.1, 10, 0.1],
  pulseFeather: [PULSE_FEATHER, 0.005, 0.3, 0.005],
  pulseRadius: [PULSE_RADIUS, 0.02, 1, 0.005],
  camera: {
    _collapsed: true,
    targetX: [CAMERA_TARGET_POSITION.x, -3, 3, 0.01],
    targetY: [CAMERA_TARGET_POSITION.y, 1, 7, 0.01],
    targetZ: [CAMERA_TARGET_POSITION.z, -2, 5, 0.01],
    lookAtX: [CAMERA_LOOK_AT.x, -2, 2, 0.01],
    lookAtY: [CAMERA_LOOK_AT.y, -2, 2, 0.01],
    lookAtZ: [CAMERA_LOOK_AT.z, -2, 2, 0.01],
    fov: [20, 10, 50, 0.1],
    damping: [4.5, 0.5, 20, 0.1],
  },
  model: {
    _collapsed: true,
    positionX: [0, -2, 2, 0.01],
    positionY: [0, -2, 2, 0.01],
    positionZ: [0, -2, 2, 0.01],
    rotationX: [0, -20, 20, 0.1],
    rotationY: [0, -20, 20, 0.1],
    rotationZ: [0, -20, 20, 0.1],
    scale: [1, 0.5, 1.5, 0.01],
  },
  advanced: {
    _collapsed: true,
    keyPressDamping: [55, 5, 120, 1],
  },
} satisfies DialConfig;

export type SceneControls = ResolvedValues<typeof SCENE_CONFIG>;

export function useSceneControls(): SceneControls {
  return useDialKit("Settings", SCENE_CONFIG, {
    id: "raycast-keyboard-scene",
    persist: {
      key: "raycast-keyboard-scene:dialkit",
      storage: "localStorage",
      presets: true,
    },
  });
}

export function DebugPanel() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cursor = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || enabled) return;

      const expectedCode = KONAMI_CODE[cursor];
      if (event.code === expectedCode) {
        cursor += 1;
        event.preventDefault();
      } else {
        cursor = event.code === KONAMI_CODE[0] ? 1 : 0;
      }

      if (cursor === KONAMI_CODE.length) {
        cursor = 0;
        setEnabled(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  return enabled ? (
    <DialRoot
      productionEnabled
      defaultOpen
      position="bottom-right"
      theme="dark"
    />
  ) : null;
}
