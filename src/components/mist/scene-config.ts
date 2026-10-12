import type { DialConfig, ResolvedValues } from "dialkit"
import { SCENE_CONFIG } from "@/components/raycast/scene-config"
import { AIR75_WHITE_SCENE_CONFIG } from "@/components/shared/ansi-scene-config"

export const MIST_SCENE_CONFIG = {
  "页面背景颜色": { type: "color", default: "#D3E6F2" },
  "背景渐变": {
    "_collapsed": true,
    "启用渐变": true as boolean,
    "终点颜色": { type: "color", default: "#ffffff" },
    "方向（°）": [180, 0, 360, 1],
  },
  ...SCENE_CONFIG,
  // 保留经 1012 帽顶碰撞检查的键程；波纹距离按约十倍键距换算。
  "按压深度（模型单位）": [0.16, 0, 0.4, 0.01],
  "按键压暗比例": [0, 0, 1, 0.01],
  "波纹羽化宽度（场景单位）": [0.8, 0.05, 3, 0.05],
  "波纹最大半径（场景单位）": [1.5, 0.2, 10, 0.05],
  "相机": AIR75_WHITE_SCENE_CONFIG.相机,
  "模型变换": AIR75_WHITE_SCENE_CONFIG.模型变换,
  "UV 预览": {
    "_collapsed": true,
    "垂直翻转 UV": false,
  },
} satisfies DialConfig

export type MistSceneControls = ResolvedValues<typeof MIST_SCENE_CONFIG>

export const MIST_UV_SOURCES = {
  model: "/assets/mist/ux-0923/wt.glb",
  base: "/assets/mist/ux-0923/BASE_0923_v1.png",
  rgb: "/assets/mist/ux-0923/RGB_0923_v1.png",
}

export const MIST_1012_SOURCES = {
  model: "/assets/mist/keyboard-1012.glb",
  base: "/assets/mist/texture-base-1012.png",
  rgb: "/assets/mist/texture-light-1012.png",
}
