"use client"

import type { ComponentProps, ReactNode } from "react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useReducer } from "react"
import { useEventListener, useIsClient, useMediaQuery } from "usehooks-ts"

import { FullscreenIcon, SidebarIcon, ThemeIcon } from "@/components/icons"
import { cn } from "@/utils/cn"

interface LayoutState { collapsed: boolean, mobileOpen: boolean, fullscreen: boolean }
type LayoutAction
  = | { type: "toggle-navigation", desktop: boolean }
    | { type: "close-navigation" }
    | { type: "toggle-fullscreen" }
    | { type: "escape" }
interface SidebarProps {
  open: boolean
  mobileOpen: boolean
  pathname: string
  onToggle: () => void
  onClose: () => void
}

const versionGroups = [
  {
    title: "NuPhy Air75",
    items: [
      { href: "/raycast", label: "Raycast Keyboard" },
      { href: "/nuphy-air75", label: "NuPhy Air75 调试台" },
    ],
  },
  {
    title: "Air75 Moonbow Edition",
    items: [{ href: "/nuphy-mist84", label: "Air75 V3 月虹" }],
  },
]

// 桌面折叠状态独立保留，退出全屏时恢复进入前的布局。
function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case "toggle-navigation":
      return action.desktop
        ? { ...state, collapsed: !state.collapsed }
        : { ...state, mobileOpen: !state.mobileOpen }
    case "close-navigation":
      return { ...state, collapsed: true, mobileOpen: false }
    case "toggle-fullscreen":
      return { ...state, fullscreen: !state.fullscreen, mobileOpen: false }
    case "escape":
      return { ...state, fullscreen: false, mobileOpen: false }
  }
}

// 导航和全屏共用一个状态源；页面内容继续由各自路由管理。
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const desktop = useMediaQuery("(min-width: 1024px)", { initializeWithValue: false })
  const [state, dispatch] = useReducer(layoutReducer, {
    collapsed: true,
    mobileOpen: false,
    fullscreen: false,
  })
  const open = !state.fullscreen && (desktop ? !state.collapsed : state.mobileOpen)

  useEventListener("keydown", ({ key }) => {
    if (key === "Escape") { dispatch({ type: "escape" }) }
  })

  return (
    <div data-open={open} data-fullscreen={state.fullscreen} className="group/site min-h-dvh bg-nav-background text-nav-foreground [--sidebar-width:300px]">
      {!state.fullscreen && (
        <VersionSidebar
          open={open}
          mobileOpen={!desktop && state.mobileOpen}
          pathname={pathname}
          onToggle={() => dispatch({ type: "toggle-navigation", desktop })}
          onClose={() => dispatch({ type: "close-navigation" })}
        />
      )}
      <div
        className={cn(
          "group-data-[open=true]/site:lg:pl-[calc(var(--sidebar-width)+8px)] group-data-[fullscreen=true]/site:p-0",
          "transition-[padding] duration-300 motion-reduce:transition-none",
        )}
      >
        <div className={cn(
          "relative overflow-hidden group-data-[fullscreen=true]/site:rounded-none",
          pathname === "/raycast"
            ? "h-dvh bg-page"
            : "min-h-[calc(100dvh-16px)] bg-nav-preview group-data-[fullscreen=true]/site:min-h-dvh",
        )}
        >
          <PreviewToolbar fullscreen={state.fullscreen} onToggleFullscreen={() => dispatch({ type: "toggle-fullscreen" })} />
          {children}
        </div>
      </div>
    </div>
  )
}

// 侧栏关闭时保留退场动画，同时禁止不可见链接获得焦点。
function VersionSidebar({ open, mobileOpen, pathname, onToggle, onClose }: SidebarProps) {
  return (
    <>
      <button
        type="button"
        aria-label={open ? "收起版本导航" : "展开版本导航"}
        aria-expanded={open}
        aria-controls="version-sidebar"
        onClick={onToggle}
        className={cn(
          "group/sidebar fixed left-6 top-6 z-50 grid size-11 place-items-center rounded-[14px] bg-nav-toggle text-nav-muted",
          "transition-[transform,color] duration-200 hover:text-nav-foreground active:scale-95 motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-accent",
        )}
      >
        <SidebarIcon aria-hidden="true" className="size-5" />
      </button>
      {mobileOpen && (
        <button aria-label="关闭版本导航" onClick={onClose} className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm lg:hidden" />
      )}
      <aside
        id="version-sidebar"
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 -translate-x-full overflow-y-auto bg-nav-background px-8 pb-8 pt-25 lg:w-[var(--sidebar-width)]",
          "transition-transform duration-300 group-data-[open=true]/site:translate-x-0 motion-reduce:transition-none",
        )}
      >
        <h2 className="mb-5 text-lg font-normal">🎮 Playground</h2>
        <nav aria-label="键盘版本" className="flex flex-col gap-7">
          {versionGroups.map(({ title, items }) => (
            <section key={title}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-nav-muted">{title}</h3>
              <ul className="relative">
                {items.map(({ href, label }, index) => (
                  <li key={href} className="relative h-9.5">
                    {pathname === href && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-4.75 left-0 w-3 rounded-bl-lg border-b border-l border-dashed border-nav-accent"
                        style={{ height: index * 38 + 19 }}
                      />
                    )}
                    <Link
                      href={href}
                      aria-current={pathname === href ? "page" : undefined}
                      onClick={onClose}
                      className="flex h-full items-center pl-5 text-sm text-nav-muted transition-colors hover:text-nav-foreground aria-[current=page]:text-nav-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
    </>
  )
}

// 工具按钮共用交互样式，尺寸与原生 Dialkit 入口对齐。
function ToolbarButton({ title, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cn(
        "group/tool flex size-8 items-center justify-center rounded-full bg-nav-control text-nav-foreground",
        "transition-[transform,background-color] duration-200 hover:bg-nav-hover active:scale-90 motion-reduce:transition-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-accent",
      )}
      {...props}
    />
  )
}

// 主题由 next-themes 持有；客户端就绪后才允许切换，避免首屏状态不一致。
function PreviewToolbar({ fullscreen, onToggleFullscreen }: { fullscreen: boolean, onToggleFullscreen: () => void }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useIsClient()
  const dark = mounted && resolvedTheme === "dark"

  return (
    <div className="fixed right-6 top-6 z-30 flex gap-1 rounded-2xl border border-nav-border bg-nav-button/95 p-1.5 backdrop-blur-md">
      <ToolbarButton title={fullscreen ? "退出全屏预览" : "全屏预览"} aria-pressed={fullscreen} onClick={onToggleFullscreen}>
        <FullscreenIcon
          aria-hidden="true"
          className="size-4 transition-transform duration-300 group-aria-pressed/tool:rotate-180 motion-reduce:transition-none"
        />
      </ToolbarButton>
      <ToolbarButton title={dark ? "切换浅色" : "切换暗黑"} aria-pressed={dark} disabled={!mounted} onClick={() => setTheme(dark ? "light" : "dark")}>
        <ThemeIcon aria-hidden="true" className="size-4" />
      </ToolbarButton>
    </div>
  )
}
