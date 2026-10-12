"use client"

import type { CSSProperties } from "react"
import type { MistUvSources } from "./import-assets"
import type { AssetKind, LocalAsset } from "@/components/shared/asset-input"
import { DialRoot, useDialKitController } from "dialkit"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useEffect, useReducer, useRef } from "react"
import { useEventListener, useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import { Settings } from "@/components/icons"
import { AssetInput, validateAssetFile } from "@/components/shared/asset-input"
import { SceneErrorBoundary } from "@/components/shared/scene-error-boundary"
import { cn } from "@/utils/cn"
import { MIST_1012_SOURCES, MIST_SCENE_CONFIG, MIST_UV_SOURCES } from "./scene-config"

const MistScene = dynamic(() => import("@/components/mist/scene"), { ssr: false })

interface MistWorkbenchState {
  drawerOpen: boolean
  preset: "1012" | "uv"
  uploads: Partial<Record<AssetKind, LocalAsset>>
  error: string
}
type MistWorkbenchAction
  = | { type: "drawer", open: boolean }
    | { type: "preset", preset: MistWorkbenchState["preset"] }
    | { type: "assets", assets: Partial<Record<AssetKind, LocalAsset | undefined>> }
    | { type: "error", message: string }
interface SettingsPanelProps {
  state: MistWorkbenchState
  sources: MistUvSources
  onClose: () => void
  onPreset: (preset: MistWorkbenchState["preset"]) => void
  onAsset: (kind: AssetKind, file?: File) => void
  onFiles: (files: File[]) => void
  onReset: () => void
}

// 素材选择与错误同步更新；导入任一文件进入两态 UV 模式。
function mistWorkbenchReducer(state: MistWorkbenchState, action: MistWorkbenchAction): MistWorkbenchState {
  switch (action.type) {
    case "drawer": return { ...state, drawerOpen: action.open }
    case "preset": return { ...state, preset: action.preset, uploads: {}, error: "" }
    case "assets": return { ...state, uploads: { ...state.uploads, ...action.assets }, error: "" }
    case "error": return { ...state, error: action.message }
  }
}

// 批量导入只按明确文件名识别角色；无法判定的图片交给对应的独立入口。
function classifyMistFiles(files: File[]): Partial<Record<AssetKind, File>> {
  const result: Partial<Record<AssetKind, File>> = {}
  for (const file of files) {
    const kind = /\.glb$/i.test(file.name)
      ? "model"
      : /base|unlit|基础|底色/i.test(file.name)
        ? "base"
        : /rgb|light|亮灯|灯光/i.test(file.name) ? "rgb" : undefined
    if (!kind) { throw new Error(`无法识别「${file.name}」，请使用下方对应的 UV 替换入口。`) }
    const error = validateAssetFile(kind, file)
    if (error) { throw new Error(error) }
    if (result[kind]) { throw new Error("每次只能导入一个 GLB、一张 Base UV 和一张灯光 UV。") }
    result[kind] = file
  }
  return result
}

// 回退图由当前未亮灯场景生成，保持材质亮度与舞台投影。
function StaticKeyboard() {
  return <Image src="/assets/mist/render-idle.png" alt="Air75 V3 Moonbow Edition" width={808} height={400} className="mx-auto h-full w-auto max-w-full object-contain" priority />
}

// 设置覆盖页面右侧，原生颜色控件和参数面板使用同一个 Dialkit 配置。
function SettingsPanel({ state, sources, onClose, onPreset, onAsset, onFiles, onReset }: SettingsPanelProps) {
  const { resolvedTheme } = useTheme()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus({ preventScroll: true }), [])
  return (
    <aside
      id="mist-settings"
      aria-label="雾透模型与 UV 设置"
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-full max-w-[380px] overflow-y-auto text-left",
        "border-l border-nav-border bg-nav-background text-nav-foreground shadow-2xl",
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape") { onClose() }
        event.stopPropagation()
      }}
    >
      <div className="space-y-4 border-b border-nav-border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">模型与 UV</h2>
          <button ref={closeRef} type="button" aria-label="关闭雾透设置" onClick={onClose} className="cursor-pointer rounded-md px-2 py-1 text-xs hover:bg-nav-hover focus-visible:outline-2">关闭</button>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-nav-control p-1" role="group" aria-label="内置雾透素材">
          {(["1012", "uv"] as const).map(preset => (
            <button
              key={preset}
              type="button"
              aria-pressed={state.preset === preset && !Object.values(state.uploads).some(Boolean)}
              onClick={() => onPreset(preset)}
              className={cn(
                "cursor-pointer rounded-lg py-2.5 text-xs opacity-50",
                "aria-pressed:bg-nav-button aria-pressed:opacity-100 aria-pressed:shadow-sm focus-visible:outline-2",
              )}
            >
              {preset === "1012" ? "1012 UV" : "0923 UV"}
            </button>
          ))}
        </div>
        <label
          className={cn(
            "block cursor-pointer rounded-xl border border-dashed border-current/20 p-4 text-center text-xs",
            "hover:bg-nav-hover focus-within:outline-2",
          )}
          onDragOver={event => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); onFiles(Array.from(event.dataTransfer.files)) }}
        >
          快速导入 GLB 与 UV
          <span className="mt-1.5 block text-[10px] opacity-50">点击多选，或将模型、Base、RGB 文件拖到这里</span>
          <input
            type="file"
            multiple
            accept=".glb,.png,.jpg,.jpeg,.webp"
            aria-label="快速导入模型与 UV"
            className="sr-only"
            onChange={(event) => { onFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = "" }}
          />
        </label>
        <div className="space-y-2">
          <AssetInput kind="model" label="模型 GLB" source={sources.model} uploaded={state.uploads.model} onChange={onAsset} />
          <AssetInput kind="base" label="Base UV" source={sources.base} uploaded={state.uploads.base} onChange={onAsset} />
          <AssetInput kind="rgb" label="灯光 UV" source={sources.rgb} uploaded={state.uploads.rgb} onChange={onAsset} />
        </div>
        {state.error && <p role="alert" className="text-xs text-red-500">{state.error}</p>}
        <p className="text-[11px] leading-relaxed opacity-50">导入文件会切换到 Base / 灯光 UV 预览；未替换的文件使用当前选中的内置素材。文件仅在本机预览，刷新后恢复，单个文件不超过 50 MB。</p>
      </div>
      <div className="p-3"><DialRoot mode="inline" productionEnabled theme={resolvedTheme === "dark" ? "dark" : "light"} /></div>
      <div className="space-y-3 px-5 pb-6 text-[11px] leading-relaxed">
        <button type="button" onClick={onReset} className="w-full cursor-pointer rounded-lg border border-nav-border py-2.5 hover:bg-nav-hover focus-visible:outline-2">恢复默认参数</button>
        <p className="opacity-50">模型支持 1012 六行分组、0923 原始合并网格，或按雾透 83 键键码命名的独立键帽。两态 UV 使用图片已有的灯光外观，按键触发扩散波纹与下沉。</p>
      </div>
    </aside>
  )
}

// 页面拥有本地 URL，场景拥有解码资源；切换背景或开关设置不改变舞台尺寸。
export function MistHero() {
  const desktop = useMediaQuery("(min-width: 1001px)", { initializeWithValue: false })
  const [{ drawerOpen, preset, uploads, error }, dispatch] = useReducer(mistWorkbenchReducer, {
    drawerOpen: false,
    preset: "1012",
    uploads: {},
    error: "",
  })
  const stageRef = useRef<HTMLDivElement>(null)
  const urlsRef = useRef(new Set<string>())
  const { ref, isIntersecting } = useIntersectionObserver({ rootMargin: "120px 0px" })
  const dial = useDialKitController("渲染设置", MIST_SCENE_CONFIG, { id: "air75-mist-scene" })
  const builtInSources = preset === "1012" ? MIST_1012_SOURCES : MIST_UV_SOURCES
  const sources = {
    model: uploads.model?.url ?? builtInSources.model,
    base: uploads.base?.url ?? builtInSources.base,
    rgb: uploads.rgb?.url ?? builtInSources.rgb,
  }

  // 输入和关闭设置后恢复舞台焦点，继续接收实体键盘按键。
  function focusStage() { stageRef.current?.focus({ preventScroll: true }) }
  function closeDrawer() { dispatch({ type: "drawer", open: false }); focusStage() }
  useEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !drawerOpen || event.defaultPrevented) { return }
    event.stopImmediatePropagation()
    closeDrawer()
  })
  useEffect(() => {
    const urls = urlsRef.current
    return () => { urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [])

  // 释放页面创建的 URL，已解码的旧场景仍由渲染器保留到替换成功。
  function releaseAsset(asset?: LocalAsset) {
    if (!asset) { return }
    URL.revokeObjectURL(asset.url)
    urlsRef.current.delete(asset.url)
  }

  // 批量文件先全部校验，再一次切换素材，避免半组替换或额外加载。
  function applyFiles(files: Partial<Record<AssetKind, File | undefined>>) {
    const assets: Partial<Record<AssetKind, LocalAsset>> = {}
    for (const kind of Object.keys(files) as AssetKind[]) {
      const file = files[kind]
      const message = validateAssetFile(kind, file)
      if (message) { dispatch({ type: "error", message }); return }
    }
    for (const kind of Object.keys(files) as AssetKind[]) {
      const file = files[kind]
      const asset = file ? { name: file.name, url: URL.createObjectURL(file) } : undefined
      if (asset) { urlsRef.current.add(asset.url) }
      assets[kind] = asset
      releaseAsset(uploads[kind])
    }
    dispatch({ type: "assets", assets })
    focusStage()
  }

  // 未明确命名的 UV 通过单张入口导入，不猜测 Base 与亮灯的对应关系。
  function importFiles(files: File[]) {
    if (!files.length) { return }
    try { applyFiles(classifyMistFiles(files)) }
    catch (error) { dispatch({ type: "error", message: error instanceof Error ? error.message : "文件导入失败。" }) }
  }

  // 切换内置整套素材保留调参，回收已替换的本地 URL。
  function selectPreset(next: MistWorkbenchState["preset"]) {
    Object.values(uploads).forEach(releaseAsset)
    dispatch({ type: "preset", preset: next })
    focusStage()
  }

  return (
    <section
      className={cn("relative min-h-svh overflow-hidden text-center text-[#30363a]", "pt-[clamp(96px,13svh,120px)] pb-12")}
      style={{
        "backgroundColor": dial.values.页面背景颜色,
        "backgroundImage": dial.values.背景渐变.启用渐变
          ? `linear-gradient(${dial.values.背景渐变["方向（°）"]}deg, ${dial.values.页面背景颜色}, ${dial.values.背景渐变.终点颜色})`
          : "none",
        "--color-page": dial.values.页面背景颜色,
      } as CSSProperties}
      aria-labelledby="mist-title"
    >
      <button
        type="button"
        aria-label="雾透模型与 UV 设置"
        aria-expanded={drawerOpen}
        aria-controls="mist-settings"
        title="雾透模型与 UV 设置"
        className={cn(
          "fixed right-[118px] top-[26px] z-40 grid size-[42px] cursor-pointer place-items-center",
          "rounded-full border border-nav-border bg-nav-button/95 text-nav-foreground backdrop-blur-md",
          "transition-colors hover:bg-nav-hover focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
        onClick={() => drawerOpen ? closeDrawer() : dispatch({ type: "drawer", open: true })}
      >
        <Settings aria-hidden="true" className="size-[18px]" />
      </button>
      <header className="relative z-10 mx-auto mb-10 flex max-w-250 flex-col items-center gap-3 px-5">
        <h1
          id="mist-title"
          className={cn(
            "animate-[hero-enter_600ms_ease-out_100ms_both] text-[clamp(26px,3vw,32px)] leading-tight font-normal tracking-[-0.02em]",
            "motion-reduce:animate-none",
          )}
        >
          Air75 V3 Moonbow Edition (月虹)
        </h1>
        <p className="animate-[hero-enter_600ms_ease-out_200ms_both] text-sm text-[#71797e] motion-reduce:animate-none">白光透过雾透键帽，柔和亮起。</p>
      </header>
      <div ref={ref}>
        <div ref={stageRef} tabIndex={-1} aria-label="雾透键盘交互舞台" className="relative h-100 w-full outline-none">
          {desktop || preset === "uv" || Object.values(uploads).some(Boolean)
            ? (
                <SceneErrorBoundary key={preset} fallback={<div className="absolute inset-0"><StaticKeyboard /></div>}>
                  <MistScene active={isIntersecting} controls={dial.values} sources={sources} />
                </SceneErrorBoundary>
              )
            : <div className="absolute inset-0"><StaticKeyboard /></div>}
        </div>
      </div>
      {drawerOpen && <SettingsPanel state={{ drawerOpen, preset, uploads, error }} sources={sources} onClose={closeDrawer} onPreset={selectPreset} onAsset={(kind, file) => applyFiles({ [kind]: file })} onFiles={importFiles} onReset={() => { dial.resetValues(); focusStage() }} />}
    </section>
  )
}
