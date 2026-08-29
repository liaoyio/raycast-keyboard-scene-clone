import type { DialConfig, ResolvedValues } from "dialkit";

import {
  DEFAULT_LIGHTING,
  KEY_PRESS_DEPTH,
  LIGHTING_INTENSITY,
  PRESSED_KEY_DIMMING,
  PULSE_DURATION,
  PULSE_EASING_STRENGTH,
  PULSE_FEATHER,
  PULSE_RADIUS,
} from "./constants";

// 参数范围既要覆盖常见调试需求，也要避免把相机或 Shader 调到不可恢复的状态。
export const SCENE_CONFIG = {
  defaultLighting: [DEFAULT_LIGHTING, 0, 1, 0.01],
  keyPressDepth: [KEY_PRESS_DEPTH, 0, 0.1, 0.001],
  lightingIntensity: [LIGHTING_INTENSITY, 0, 3, 0.01],
  pressedKeyDimming: [PRESSED_KEY_DIMMING, 0, 1, 0.01],
  pulseDuration: [PULSE_DURATION, 0.1, 3, 0.01],
  pulseEasingStrength: [PULSE_EASING_STRENGTH, 0.1, 10, 0.1],
  pulseFeather: [PULSE_FEATHER, 0.005, 0.3, 0.005],
  pulseRadius: [PULSE_RADIUS, 0.02, 1, 0.005],
  advanced: {
    _collapsed: true,
    keyPressDamping: [55, 5, 120, 1],
  },
} satisfies DialConfig;

export type SceneControls = ResolvedValues<typeof SCENE_CONFIG>;
