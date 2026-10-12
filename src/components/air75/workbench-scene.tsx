"use client"

import type { WorkbenchAssets } from "./workbench-assets"
import type { Air75AssetSources } from "./workbench-config"
import type { Air75SceneControls } from "@/components/shared/ansi-scene-config"

import { Canvas, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"

import { Air75AnsiKeyboard } from "@/components/shared/ansi-renderer"
import { SceneErrorBoundary } from "@/components/shared/scene-error-boundary"
import { disposeAssets, loadWorkbenchAssets } from "./workbench-assets"

interface WorkbenchSceneProps {
  sources: Air75AssetSources
  controls: Air75SceneControls
  flipY?: boolean
  replay?: number
}
type LoadState
  = | { status: "loading" }
    | { status: "error", message: string }
    | { status: "loaded", assets: WorkbenchAssets, ready: boolean }

const BOX_CORNERS = [
  ["min", "min", "min"],
  ["min", "min", "max"],
  ["min", "max", "min"],
  ["min", "max", "max"],
  ["max", "min", "min"],
  ["max", "min", "max"],
  ["max", "max", "min"],
  ["max", "max", "max"],
] as const

// 投影包围盒的八个角点；归一化结果不受 Canvas 像素密度影响。
function projectBounds(box: THREE.Box3, point: THREE.Vector3, camera: THREE.Camera) {
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity
  BOX_CORNERS.forEach(([x, y, z]) => {
    point.set(box[x].x, box[y].y, box[z].z).project(camera)
    left = Math.min(left, point.x)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, 1 - point.y)
  })
  return { left, right, bottom }
}

// 用实际投影边界定位背景，避免背景比例与相机、模型缩放脱节。
function ProjectedBackdrop() {
  const geometry = useMemo(() => ({ box: new THREE.Box3(), point: new THREE.Vector3() }), [])
  useFrame(({ scene, camera, size, gl }) => {
    const stage = gl.domElement.closest<HTMLElement>("[data-testid=\"keyboard-stage\"]")
    if (!stage) { return }
    scene.updateMatrixWorld(true)
    geometry.box.setFromObject(scene)
    if (geometry.box.isEmpty()) { return }
    const { left, right, bottom } = projectBounds(geometry.box, geometry.point, camera)
    // Raycast 素材宽 1200，键盘参考宽 1060；保持两者的相对比例。
    stage.style.setProperty("--glow-width", `${(right - left) * size.width / 2 * 1200 / 1060}px`)
    stage.style.setProperty("--glow-left", `${(left + right + 2) * size.width / 4}px`)
    stage.style.setProperty("--glow-bottom", `${size.height * (1 - bottom / 2)}px`)
  })
  return null
}

// 加载提示和素材错误都留在当前舞台范围内。
function SceneNotice({ error, children }: { error?: boolean, children: React.ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm leading-6 text-current/60" role={error ? "alert" : "status"}>{children}</div>
}

// 单个加载状态涵盖错误、GPU 资源与首帧显示，控制参数变化无需重载。
function WorkbenchScene({ sources, controls, flipY = true, replay = 0 }: WorkbenchSceneProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const { model, base, rgb } = sources

  // 一个 effect 管理这组素材的完整生命周期；参数调整只更新受控场景，不重新加载。
  useEffect(() => {
    const controller = new AbortController()
    let assets: WorkbenchAssets | undefined
    // eslint-disable-next-line react/set-state-in-effect -- Fast Refresh 会保留引用旧 GPU 资源的状态，必须先卸载它们。
    setState({ status: "loading" })
    loadWorkbenchAssets({ model, base, rgb }, flipY, controller.signal).then((loaded) => {
      if (controller.signal.aborted) {
        disposeAssets(loaded)
        return
      }
      assets = loaded
      setState({ status: "loaded", assets, ready: false })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) { return }
      setState({ status: "error", message: error instanceof Error ? error.message : "素材加载失败，请重新导入。" })
    })
    return () => {
      controller.abort()
      if (assets) { disposeAssets(assets) }
    }
  }, [model, base, rgb, flipY])

  if (state.status === "error") { return <SceneNotice error>{state.message}</SceneNotice> }
  const loading = state.status === "loading" || !state.ready
  return (
    <div className="absolute inset-0 size-full touch-none" aria-busy={loading}>
      {state.status === "loaded" && (
        <Canvas
          flat
          camera={{ position: [-0.044001, 70, 0], fov: controls["相机"]["垂直视场角（°）"] }}
          className="opacity-0 transition-opacity duration-300 data-[ready=true]:opacity-100"
          data-ready={state.ready}
          dpr={[1, 1.75]}
          frameloop="demand"
          gl={{ antialias: true, powerPreference: "high-performance" }}
          resize={{ offsetSize: true }}
          fallback={<SceneNotice error>浏览器无法启动 WebGL，请开启硬件加速后重试。</SceneNotice>}
          role="img"
          aria-label="NuPhy Air75 模型与 UV 交互预览"
        >
          <Air75AnsiKeyboard
            key={`${state.assets.gltf.scene.uuid}|${replay}`}
            active
            fitAspect
            controls={controls}
            scene={state.assets.gltf.scene}
            base={state.assets.base}
            rgb={state.assets.rgb}
            onReady={() => setState(current => current.status === "loaded" && !current.ready ? { ...current, ready: true } : current)}
          />
          <ProjectedBackdrop />
        </Canvas>
      )}
      {loading && <SceneNotice>正在加载模型与 UV…</SceneNotice>}
    </div>
  )
}

// 更换任一资源时重建边界，清除旧错误和首帧状态；重播只重建键盘动画。
export default function Air75WorkbenchScene(props: WorkbenchSceneProps) {
  const key = `${props.sources.model}|${props.sources.base}|${props.sources.rgb}|${props.flipY ?? true}`
  return (
    <SceneErrorBoundary key={key} fallback={<SceneNotice error>场景无法渲染，请检查模型与 UV，重新导入后再试。</SceneNotice>}>
      <WorkbenchScene {...props} />
    </SceneErrorBoundary>
  )
}
