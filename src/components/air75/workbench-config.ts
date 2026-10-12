import type { DialConfig, ResolvedValues } from "dialkit"

import { AIR75_WHITE_SCENE_CONFIG } from "@/components/shared/ansi-scene-config"

// 配色切换与重置共用同一组舞台默认值。
export function getWorkbenchStage(finish: Air75Finish) {
  return {
    网页背景颜色: finish === "white" ? "#f6f6f4" : "#080808",
    左侧背景: finish === "black",
    右侧背景: finish === "black",
  }
}

// 只给素材工作台使用；保留其他 Hero 各自校准过的默认值。
export const AIR75_WORKBENCH_CONFIG = {
  ...AIR75_WHITE_SCENE_CONFIG,
  "灯效贴图混合增益": [1.67, 0, 3, 0.01],
  "波纹时长（s）": [0.71, 0.1, 3, 0.01],
  "波纹缓动指数": [3.2, 0.1, 10, 0.1],
  "波纹羽化宽度（场景单位）": [0.85, 0.05, 10, 0.05],
  "波纹最大半径（场景单位）": [1.4, 0.1, 30, 0.1],
  "舞台背景": {
    _collapsed: true,
    ...getWorkbenchStage("black"),
  },
  "底部阴影": {
    "_collapsed": true,
    "显示阴影": true,
    "不透明度": [0.35, 0, 1, 0.01],
    "模糊（px）": [24, 0, 80, 1],
    "宽度（%）": [68, 10, 100, 1],
    "高度（px）": [28, 2, 120, 1],
    "垂直位置（%）": [73, 0, 100, 1],
  },
  "贴图设置": {
    "_collapsed": true,
    "垂直翻转 UV": true,
  },
} satisfies DialConfig

export type Air75WorkbenchControls = ResolvedValues<typeof AIR75_WORKBENCH_CONFIG>
export type Air75Finish = "black" | "white"
export type Air75AssetKind = "model" | "base" | "rgb"

// 各配色只替换贴图，共用同一份校准后的模型。
export function getWorkbenchSources(finish: Air75Finish) {
  return {
    model: "/assets/air75/keyboard.glb",
    base: `/assets/air75/texture-${finish}-base.webp`,
    rgb: `/assets/air75/texture-${finish}-rgb.webp`,
  }
}

export type Air75AssetSources = ReturnType<typeof getWorkbenchSources>
