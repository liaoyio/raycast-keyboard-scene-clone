import type { Metadata } from "next"
import { Mona_Sans } from "next/font/google"
import { MistHero } from "@/components/mist/hero"

const mona = Mona_Sans({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-mona" })

export const metadata: Metadata = {
  title: "雾透键盘 — 白光交互动画",
  description: "独立雾透键盘布局、透明键帽与上缘白光动画。",
}

/** 展示雾透活动页，标题字体仅作用于当前页面。 */
export default function MistPage() {
  return <main className={mona.variable}><MistHero /></main>
}
