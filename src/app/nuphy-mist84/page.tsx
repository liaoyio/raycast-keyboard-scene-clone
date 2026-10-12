import type { Metadata } from "next"
import { MistHero } from "@/components/mist/hero"

export const metadata: Metadata = {
  title: "雾透键盘 — 白光交互动画",
  description: "独立雾透键盘布局、透明键帽与上缘白光动画。",
}

/** 展示雾透键盘与 Blender 演示入口。 */
export default function MistPage() {
  return <main><MistHero /></main>
}
