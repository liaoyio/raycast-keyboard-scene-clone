import type { DialConfig, ResolvedValues } from "dialkit"

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
} from "@/components/shared/constants"

// 资源地址与本场景的校准配置一起维护。
export const MODEL_URL = "/assets/raycast/keyboard.glb"
export const BASE_TEXTURE_URL = "/assets/raycast/texture-base.jpg"
export const RGB_TEXTURE_URL = "/assets/raycast/texture-rgb.jpg"

// 参数范围既要覆盖常见调试需求，也要避免把相机或 Shader 调到不可恢复的状态。
export const SCENE_CONFIG = {
  "常亮权重": [DEFAULT_LIGHTING, 0, 1, 0.01],
  "按压深度（模型单位）": [KEY_PRESS_DEPTH, 0, 0.1, 0.001],
  "灯效贴图混合增益": [LIGHTING_INTENSITY, 0, 3, 0.01],
  "按键压暗比例": [PRESSED_KEY_DIMMING, 0, 1, 0.01],
  "波纹时长（s）": [PULSE_DURATION, 0.1, 3, 0.01],
  "波纹缓动指数": [PULSE_EASING_STRENGTH, 0.1, 10, 0.1],
  "波纹羽化宽度（场景单位）": [PULSE_FEATHER, 0.005, 0.3, 0.005],
  "波纹最大半径（场景单位）": [PULSE_RADIUS, 0.02, 1, 0.005],
  "相机": {
    "_collapsed": true,
    "终点 X（场景单位）": [CAMERA_TARGET_POSITION.x, -3, 3, 0.01],
    "终点 Y（场景单位）": [CAMERA_TARGET_POSITION.y, 1, 7, 0.01],
    "终点 Z（场景单位）": [CAMERA_TARGET_POSITION.z, -2, 5, 0.01],
    "注视点 X（场景单位）": [CAMERA_LOOK_AT.x, -2, 2, 0.01],
    "注视点 Y（场景单位）": [CAMERA_LOOK_AT.y, -2, 2, 0.01],
    "注视点 Z（场景单位）": [CAMERA_LOOK_AT.z, -2, 2, 0.01],
    "垂直视场角（°）": [20, 10, 50, 0.1],
    "收敛速率（s⁻¹）": [4.5, 0.5, 20, 0.1],
  },
  "模型变换": {
    "_collapsed": true,
    "平移 X（场景单位）": [0, -2, 2, 0.01],
    "平移 Y（场景单位）": [0, -2, 2, 0.01],
    "平移 Z（场景单位）": [0, -2, 2, 0.01],
    "旋转 X（°）": [0, -20, 20, 0.1],
    "旋转 Y（°）": [0, -20, 20, 0.1],
    "旋转 Z（°）": [0, -20, 20, 0.1],
    "统一缩放": [1, 0.5, 1.5, 0.01],
  },
  "高级": {
    "_collapsed": true,
    "按键收敛速率（s⁻¹）": [55, 5, 120, 1],
  },
} satisfies DialConfig

export type SceneControls = ResolvedValues<typeof SCENE_CONFIG>
