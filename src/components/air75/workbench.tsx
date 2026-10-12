"use client"

import type { ComponentProps } from "react"
import type { Air75AssetKind, Air75AssetSources, Air75Finish, Air75WorkbenchControls } from "@/components/air75/workbench-config"
import type { LocalAsset } from "@/components/shared/asset-input"
import { DialRoot, useDialKitController } from "dialkit"
import dynamic from "next/dynamic"
import { useEffect, useReducer, useRef } from "react"

import { useEventListener } from "usehooks-ts"
import {
  AIR75_WORKBENCH_CONFIG,

  getWorkbenchSources,
  getWorkbenchStage,
} from "@/components/air75/workbench-config"

import { Settings } from "@/components/icons"
import { AssetInput, validateAssetFile } from "@/components/shared/asset-input"
import { cn } from "@/utils/cn"

const WorkbenchScene = dynamic(() => import("@/components/air75/workbench-scene"), {
  ssr: false,
  loading: () => <p className="absolute inset-0 grid place-items-center text-sm opacity-50">正在准备预览…</p>,
})

interface AssetSelection { finish: Air75Finish, uploads: Partial<Record<Air75AssetKind, LocalAsset>> }
interface WorkbenchState {
  drawerOpen: boolean
  selection: AssetSelection
  fileError: string
  replay: number
}
type WorkbenchAction
  = | { type: "drawer", open: boolean }
    | { type: "finish", finish: Air75Finish }
    | { type: "asset", kind: Air75AssetKind, asset?: LocalAsset }
    | { type: "error", message: string }
    | { type: "replay" }
interface SettingsPanelProps {
  selection: AssetSelection
  sources: Air75AssetSources
  fileError: string
  onClose: () => void
  onFinish: (finish: Air75Finish) => void
  onAsset: (kind: Air75AssetKind, file?: File) => void
  onReset: () => void
}

const INITIAL_STATE: WorkbenchState = {
  drawerOpen: false,
  selection: { finish: "black", uploads: {} },
  fileError: "",
  replay: 0,
}

// 一次用户操作同步相关字段；切换配色时清除上传素材和旧错误。
function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "drawer": return { ...state, drawerOpen: action.open }
    case "finish": return { ...state, selection: { finish: action.finish, uploads: {} }, fileError: "" }
    case "asset": return {
      ...state,
      selection: { ...state.selection, uploads: { ...state.selection.uploads, [action.kind]: action.asset } },
      fileError: "",
    }
    case "error": return { ...state, fileError: action.message }
    case "replay": return { ...state, replay: state.replay + 1 }
  }
}

// 工作台普通操作共用按钮样式；浮动设置入口保留专用尺寸。
function ToolButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-lg border border-current/15 px-3 py-2 text-xs font-medium",
        "transition-colors hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-default disabled:opacity-30",
        className,
      )}
      {...props}
    />
  )
}

// 光晕跟随实际键盘投影，左右开关与底部阴影分别受控。
function StageTreatment({ controls }: { controls: Air75WorkbenchControls }) {
  const shadow = controls["底部阴影"]
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {(["左侧背景", "右侧背景"] as const).map(side => controls["舞台背景"][side] && (
        // eslint-disable-next-line next/no-img-element -- 该背景是随投影尺寸变化的原始装饰素材。
        <img
          key={side}
          src="/assets/common/stage-background.webp"
          alt=""
          className={cn(
            "absolute bottom-[var(--glow-bottom,0px)] left-[var(--glow-left,50%)]",
            "h-auto w-[var(--glow-width,100%)] max-w-none -translate-x-1/2",
            side === "左侧背景" ? "[clip-path:inset(0_50%_0_0)]" : "[clip-path:inset(0_0_0_50%)]",
          )}
          style={{ maskImage: "linear-gradient(to bottom, black 34%, transparent)" }}
        />
      ))}
      {shadow["显示阴影"]
        ? (
            <div
              data-testid="stage-shadow"
              className="absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-black"
              style={{
                top: `${shadow["垂直位置（%）"]}%`,
                width: `${shadow["宽度（%）"]}%`,
                height: shadow["高度（px）"],
                opacity: shadow["不透明度"],
                filter: `blur(${shadow["模糊（px）"]}px)`,
              }}
            />
          )
        : null}
    </div>
  )
}

// 抽屉只展示配置，资源替换和参数重置由工作台统一处理。
function SettingsPanel({ selection, sources, fileError, onClose, onFinish, onAsset, onReset }: SettingsPanelProps) {
  return (
    <aside
      id="air75-settings"
      aria-label="模型动画配置"
      onKeyDown={(event) => {
        if (event.key === "Escape") { onClose() }
        event.stopPropagation()
      }}
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-full max-w-[380px] overflow-y-auto",
        "border-l border-current/10 bg-[#131313] shadow-2xl group-data-[theme=white]:bg-white",
      )}
    >
      <div className="space-y-5 border-b border-current/10 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">素材配置</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] opacity-35">Dialkit 2.0</span>
            <ToolButton aria-label="关闭设置抽屉" onClick={onClose}>关闭</ToolButton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-current/5 p-1" role="group" aria-label="键盘配色">
          {(["black", "white"] as const).map(finish => (
            <button
              key={finish}
              type="button"
              aria-pressed={selection.finish === finish}
              onClick={() => onFinish(finish)}
              className={cn(
                "cursor-pointer rounded-lg py-2.5 text-xs opacity-45",
                "aria-pressed:bg-[#303030] aria-pressed:opacity-100 aria-pressed:shadow-sm",
                "group-data-[theme=white]:aria-pressed:bg-white focus-visible:outline-2",
              )}
            >
              {finish === "black" ? "黑色" : "白色"}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <AssetInput kind="model" label="模型 GLB" source={sources.model} uploaded={selection.uploads.model} onChange={onAsset} />
          <AssetInput kind="base" label="Base UV" source={sources.base} uploaded={selection.uploads.base} onChange={onAsset} />
          <AssetInput kind="rgb" label="RGB 灯光 UV" source={sources.rgb} uploaded={selection.uploads.rgb} onChange={onAsset} />
        </div>
        {fileError ? <p role="alert" className="text-xs text-red-500">{fileError}</p> : null}
        <p className="text-[10px] leading-relaxed opacity-40">文件仅在本机预览，刷新后恢复。切换配色会换回对应内置素材，保留动效参数。支持 GLB 与 PNG / JPG / WebP，单个文件上限 50 MB。</p>
      </div>

      <div className="p-3">
        <DialRoot mode="inline" productionEnabled theme={selection.finish === "white" ? "light" : "dark"} />
      </div>
      <div className="space-y-4 px-5 pb-6">
        <ToolButton className="w-full" onClick={onReset}>恢复截图默认参数</ToolButton>
        <details className="text-[11px] leading-relaxed opacity-45">
          <summary className="cursor-pointer">如何对照灯光与 UV</summary>
          <p className="mt-2">将常亮权重设为 1、混合增益设为 1，可检查完整 RGB 贴图；常亮权重设为 0 后测试按键波纹。UV 方向不符时，在贴图设置中切换垂直翻转。</p>
          <p className="mt-2">模型需保留当前 Air75 的 83 键分组和 UV。底部阴影为舞台投影效果；贴图中已烘焙的阴影不会被此开关移除。</p>
          <p className="mt-2">随包黑色 Base 与 RGB 的上盖 UV 岛布局有差异，需由渲染组确认是否同版；调高混合增益无法修复 UV 错位。</p>
        </details>
      </div>
    </aside>
  )
}

// 工作台统一管理素材选择与操作状态，设置面板和场景只消费当前配置。
export function Air75Workbench() {
  const [{ drawerOpen, selection, fileError, replay }, dispatch] = useReducer(workbenchReducer, INITIAL_STATE)
  const stageRef = useRef<HTMLDivElement>(null)
  const ownedUrlsRef = useRef(new Set<string>())
  const dial = useDialKitController("渲染设置", AIR75_WORKBENCH_CONFIG, { id: "nuphy-air75-workbench" })
  const controls = dial.values
  const defaults = getWorkbenchSources(selection.finish)
  const sources = {
    model: selection.uploads.model?.url ?? defaults.model,
    base: selection.uploads.base?.url ?? defaults.base,
    rgb: selection.uploads.rgb?.url ?? defaults.rgb,
  }
  const flipY = controls["贴图设置"]["垂直翻转 UV"]

  // 操作按钮后把焦点还给舞台，让物理键盘继续触发灯效。
  function focusStage() {
    stageRef.current?.focus({ preventScroll: true })
  }

  // 关闭后恢复舞台焦点，避免按键仍被配置控件接收。
  function closeDrawer() {
    dispatch({ type: "drawer", open: false })
    focusStage()
  }

  // 重播只更换动画实例，不重新加载素材。
  function replayEntrance() {
    dispatch({ type: "replay" })
    focusStage()
  }

  // 重置动效时保留当前配色，并恢复对应舞台默认值。
  function resetControls() {
    dial.resetValues()
    dial.setValues({ 舞台背景: getWorkbenchStage(selection.finish) })
    focusStage()
  }

  useEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !drawerOpen) { return }
    event.stopImmediatePropagation()
    closeDrawer()
  })

  // 页面拥有本地文件 URL；场景独立拥有解码后的 GPU 资源。
  useEffect(() => {
    const urls = ownedUrlsRef.current
    return () => { urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [])

  // 回收当前版本不再使用的 URL；尚在加载的场景由自己的生命周期收尾。
  function releaseUrl(asset?: LocalAsset) {
    if (!asset) { return }
    URL.revokeObjectURL(asset.url)
    ownedUrlsRef.current.delete(asset.url)
  }

  // 通过校验后才替换资源，保留现有预览的失败恢复入口。
  function replaceAsset(kind: Air75AssetKind, file?: File) {
    const message = validateAssetFile(kind, file)
    if (message) {
      dispatch({ type: "error", message })
      return
    }
    const asset = file ? { name: file.name, url: URL.createObjectURL(file) } : undefined
    if (asset) { ownedUrlsRef.current.add(asset.url) }
    releaseUrl(selection.uploads[kind])
    dispatch({ type: "asset", kind, asset })
    focusStage()
  }

  // 保留调过的灯效，只切换素材及配色对应的舞台背景。
  function selectFinish(finish: Air75Finish) {
    if (finish === selection.finish) { return }
    Object.values(selection.uploads).forEach(releaseUrl)
    dispatch({ type: "finish", finish })
    dial.setValues({ 舞台背景: getWorkbenchStage(finish) })
    focusStage()
  }

  return (
    <main
      lang="zh-CN"
      data-drawer={drawerOpen ? "open" : "closed"}
      data-theme={selection.finish === "white" ? "white" : "dark"}
      style={{ backgroundColor: controls["舞台背景"]["网页背景颜色"] }}
      className="group min-h-svh text-[#ededed] data-[theme=white]:text-[#242424] lg:h-svh lg:overflow-hidden"
    >
      <section className="relative flex min-h-[620px] min-w-0 flex-col lg:h-full lg:min-h-0" aria-label="Air75 实时预览">
        <button
          type="button"
          aria-label="模型动画设置"
          aria-expanded={drawerOpen}
          aria-controls="air75-settings"
          title="模型动画设置"
          className={cn(
            "fixed right-[118px] top-[26px] z-40 grid size-[42px] cursor-pointer place-items-center",
            "rounded-full border border-nav-border bg-nav-button/95 text-nav-foreground backdrop-blur-md",
            "transition-colors hover:bg-nav-hover focus-visible:outline-2",
            "focus-visible:outline-offset-2 focus-visible:outline-nav-accent",
          )}
          onClick={() => drawerOpen ? closeDrawer() : dispatch({ type: "drawer", open: true })}
        >
          <Settings aria-hidden="true" className="size-[18px]" />
        </button>

        <div className="flex flex-1 flex-col justify-center py-10 lg:py-6">
          <div className="relative z-10 px-6 text-center">
            <p className="text-[10px] font-medium tracking-[0.24em] opacity-40">模型与动效工作台</p>
            <h1 className="mt-4 text-[clamp(36px,4vw,58px)] leading-none font-medium tracking-[-0.04em]">Air75 V3</h1>
            <p className="mt-4 text-sm opacity-45">每一次调整，都在键盘上看见。</p>
          </div>

          <div
            ref={stageRef}
            tabIndex={-1}
            aria-label="键盘交互舞台"
            className="relative mt-5 h-[var(--stage-height)] w-full [--stage-height:clamp(250px,39vh,440px)] outline-none"
            data-testid="keyboard-stage"
          >
            <StageTreatment controls={controls} />
            <WorkbenchScene sources={sources} controls={controls} flipY={flipY} replay={replay} />
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 px-6">
            <p className="rounded-full border border-current/10 bg-current/[0.025] px-4 py-2 text-[11px] opacity-55">按下键盘，或在键帽上拖动，测试 RGB 波纹</p>
            <ToolButton onClick={replayEntrance}>重播入场</ToolButton>
          </div>
        </div>

        <footer className="px-6 pb-6 lg:px-9">
          <details className="border-t border-current/10 pt-4">
            <summary className="cursor-pointer text-[11px] opacity-50">查看渲染组原图</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["unlit", "lit"] as const).map(mode => (
                <figure key={mode} className="rounded-lg border border-current/10 p-2">
                  {/* eslint-disable-next-line next/no-img-element -- 保留渲染组原图用于逐像素比对。 */}
                  <img src={`/assets/air75/render-${selection.finish}-${mode}.webp`} alt={mode === "unlit" ? "渲染组未亮灯参考图" : "渲染组亮灯参考图"} className="h-28 w-full object-contain" />
                  <figcaption className="text-center text-[10px] opacity-40">
                    {mode === "unlit" ? "未亮灯" : "亮灯"}
                    {" "}
                    · 随包参考图
                  </figcaption>
                </figure>
              ))}
            </div>
          </details>
        </footer>
      </section>

      {drawerOpen && (
        <SettingsPanel
          selection={selection}
          sources={sources}
          fileError={fileError}
          onClose={closeDrawer}
          onFinish={selectFinish}
          onAsset={replaceAsset}
          onReset={resetControls}
        />
      )}
    </main>
  )
}
