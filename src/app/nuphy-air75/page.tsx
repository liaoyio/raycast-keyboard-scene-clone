import type { Metadata } from "next"

import { Air75Workbench } from "@/components/air75/workbench"

export const metadata: Metadata = {
  title: "NuPhy Air75 — 模型与动效工作台",
  description: "导入 Air75 模型与 Base / RGB 贴图，实时校验渲染和调节键盘动效。",
}

/** 进入 Air75 模型与灯效工作台。 */
export default function NuphyAir75Page() {
  return <Air75Workbench />
}
