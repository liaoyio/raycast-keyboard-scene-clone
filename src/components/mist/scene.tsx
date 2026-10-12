"use client"

import type { MistUvSources } from "./import-assets"
import type { MistSceneControls } from "./scene-config"
import type { WorkbenchAssets } from "@/components/air75/workbench-assets"
import { Canvas } from "@react-three/fiber"
import { Suspense, useEffect, useState } from "react"
import { disposeAssets } from "@/components/air75/workbench-assets"
import { MIST_RENDER_PROFILE } from "@/components/mist/keyboard-profile"
import { Air75AnsiKeyboard } from "@/components/shared/ansi-renderer"
import { loadMistUvAssets } from "./import-assets"
import { MIST_1012_SOURCES } from "./scene-config"

interface MistSceneProps {
  active?: boolean
  controls: MistSceneControls
  sources?: MistUvSources
}
interface PreviewState {
  assets?: WorkbenchAssets
  ready: boolean
  loading: boolean
  error: string
}

// 默认光路保留 glTF 的 UV 方向和共享 CPU 缓存，只释放本组件创建的 GPU 视图。
// 新素材校验成功后才替换场景，加载失败保留当前预览；取消的结果立即释放。
export default function MistScene({ active = true, controls, sources = MIST_1012_SOURCES }: MistSceneProps) {
  const [state, setState] = useState<PreviewState>({ ready: false, loading: false, error: "" })
  const { model, base, rgb } = sources
  const flipY = controls["UV 预览"]["垂直翻转 UV"]
  useEffect(() => {
    const controller = new AbortController()
    // eslint-disable-next-line react/set-state-in-effect -- 外部素材开始加载时保留旧场景，并同步加载提示。
    setState(current => ({ ...current, loading: true, error: "" }))
    loadMistUvAssets({ model, base, rgb }, flipY, controller.signal).then((assets) => {
      if (controller.signal.aborted) { disposeAssets(assets); return }
      setState({ assets, ready: false, loading: false, error: "" })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) { return }
      setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : "素材加载失败，请重新导入。" }))
    })
    return () => controller.abort()
  }, [model, base, rgb, flipY])
  useEffect(() => () => { if (state.assets) { disposeAssets(state.assets) } }, [state.assets])
  const assets = state.assets
  const ready = state.ready
  return (
    <div className="absolute inset-0 size-full touch-none" aria-busy={!ready || state.loading}>
      <Canvas
        flat
        camera={{ position: [0, 70, 0], fov: 12.144878 }}
        className="opacity-0 transition-opacity duration-500 data-[ready=true]:opacity-100 motion-reduce:transition-none"
        data-ready={ready}
        dpr={[1, 1.75]}
        frameloop="demand"
        gl={{ antialias: true, powerPreference: "high-performance" }}
        resize={{ offsetSize: true }}
        role="img"
        aria-label="雾透键盘模型与 UV 交互预览"
      >
        <Suspense fallback={null}>
          {assets && (
            <Air75AnsiKeyboard
              key={assets.gltf.scene.uuid}
              active={active}
              controls={controls}
              profile={MIST_RENDER_PROFILE}
              fitAspect
              scene={assets.gltf.scene}
              base={assets.base}
              rgb={assets.rgb}
              onReady={() => setState(current => current.assets === assets && !current.ready ? { ...current, ready: true } : current)}
            />
          )}
        </Suspense>
      </Canvas>
      {state.loading && <p role="status" className="pointer-events-none absolute inset-x-0 bottom-0 text-xs text-[#71797e]">正在加载模型与 UV…</p>}
      {state.error && (
        <p role="alert" className="absolute inset-x-0 bottom-0 px-6 text-xs text-red-600">
          {state.error}
          {" "}
          当前预览已保留。
        </p>
      )}
    </div>
  )
}
