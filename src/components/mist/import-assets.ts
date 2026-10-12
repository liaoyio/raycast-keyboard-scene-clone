import type { WorkbenchAssets } from "@/components/air75/workbench-assets"
import * as THREE from "three"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { disposeAssets, loadModel, loadTexture } from "@/components/air75/workbench-assets"
import { configureKeyboardTextures } from "@/components/shared/shaders"
import { prepareMistImportScene } from "./import-model"
import { MIST_1012_SOURCES, MIST_UV_SOURCES } from "./scene-config"

export type MistUvSources = typeof MIST_UV_SOURCES

// 只读取本页随包素材和浏览器创建的本地 URL，不接受远程模型外链。
export async function loadMistUvAssets(sources: MistUvSources, flipY: boolean, signal: AbortSignal) {
  for (const kind of ["model", "base", "rgb"] as const) {
    if (!sources[kind].startsWith("blob:") && sources[kind] !== MIST_UV_SOURCES[kind] && sources[kind] !== MIST_1012_SOURCES[kind]) {
      throw new Error("请选择内置素材或从本机导入文件。")
    }
  }
  const decoder = new DRACOLoader().setDecoderPath("/assets/common/")
  const modelLoader = new GLTFLoader().setDRACOLoader(decoder)
  const textureLoader = new THREE.TextureLoader()
  const loaded: Partial<WorkbenchAssets> = {}
  try {
    const [model, base, rgb] = await Promise.allSettled([
      loadModel(modelLoader, sources.model, signal, prepareMistImportScene),
      loadTexture(textureLoader, sources.base, "Base UV"),
      loadTexture(textureLoader, sources.rgb, "灯光 UV"),
    ])
    loaded.gltf = model.status === "fulfilled" ? model.value : undefined
    loaded.base = base.status === "fulfilled" ? base.value : undefined
    loaded.rgb = rgb.status === "fulfilled" ? rgb.value : undefined
    signal.throwIfAborted()
    if (model.status === "rejected") { throw model.reason }
    if (base.status === "rejected") { throw base.reason }
    if (rgb.status === "rejected") { throw rgb.reason }
    const assets = { gltf: model.value, base: base.value, rgb: rgb.value }
    configureKeyboardTextures([assets.base, assets.rgb])
    assets.base.flipY = assets.rgb.flipY = flipY
    return assets
  }
  catch (error) {
    disposeAssets(loaded)
    throw error
  }
  finally {
    decoder.dispose()
  }
}
