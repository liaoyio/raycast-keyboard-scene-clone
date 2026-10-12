"use client"

import { DialRoot } from "dialkit"
import { useTheme } from "next-themes"

/** 使用 Dialkit 原生浮层和折叠入口，主题跟随全局设置。 */
export function DebugPanel() {
  const { resolvedTheme } = useTheme()

  return (
    <DialRoot
      productionEnabled
      defaultOpen={false}
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  )
}
