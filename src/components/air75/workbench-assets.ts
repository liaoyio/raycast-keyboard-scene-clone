import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { Air75AssetSources } from "./workbench-config"
import * as THREE from "three"

import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { validateAir75Scene } from "@/components/shared/ansi-renderer"
import { configureKeyboardTextures } from "@/components/shared/shaders"

export interface WorkbenchAssets {
  gltf: GLTF
  base: THREE.Texture
  rgb: THREE.Texture
}

// 递归检查扩展中的 URI，防止导入的模型隐式请求外部文件。
function validateEmbeddedReferences(value: unknown): void {
  if (!value || typeof value !== "object") { return }
  Object.entries(value).forEach(([key, child]) => {
    if (key === "uri" && (typeof child !== "string" || !child.startsWith("data:"))) {
      throw new Error("模型引用了外部文件。请将缓冲区与纹理嵌入同一个 GLB 后重新导入。")
    }
    validateEmbeddedReferences(child)
  })
}

// 解析前验证容器和内嵌资源，避免截断文件或外链进入 GLTFLoader。
export function validateEmbeddedGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  if (
    buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546C67
    || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength
    || view.getUint32(16, true) !== 0x4E4F534A
  ) {
    throw new Error("模型格式无效，请导入完整的 GLB 2.0 文件。")
  }
  const jsonLength = view.getUint32(12, true)
  if (!jsonLength || jsonLength % 4 !== 0 || 20 + jsonLength > buffer.byteLength) {
    throw new Error("GLB 文件不完整，请重新导出模型。")
  }
  let document: unknown
  try {
    document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)))
  }
  catch {
    throw new Error("GLB 模型描述无法解析，请重新导出模型。")
  }
  validateEmbeddedReferences(document)
}

// GLB 多个网格可能共用资源；去重后释放 GPU 对象和解码后的图片。
export function disposeAssets({ gltf, base, rgb }: Partial<WorkbenchAssets>) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>([base, rgb].filter(texture => !!texture))
  gltf?.scenes.forEach(scene => scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return }
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    meshMaterials.forEach(material => materials.add(material))
  }))
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) { textures.add(value) }
    })
    material.dispose()
  })
  geometries.forEach(geometry => geometry.dispose())
  const images = new Set([...textures].map(texture => texture.source.data))
  textures.forEach(texture => texture.dispose())
  images.forEach((image) => {
    if (image && typeof image === "object" && "close" in image && typeof image.close === "function") { image.close() }
  })
}

// 只允许随包素材和本次页面创建的本地文件 URL。
function validateSources(sources: Air75AssetSources) {
  Object.entries(sources).forEach(([kind, url]) => {
    const bundled = kind === "model"
      ? /^\/assets\/air75\/keyboard\.glb$/
      : new RegExp(`^/assets/air75/texture-(black|white)-${kind}\\.webp$`)
    if (!url.startsWith("blob:") && !bundled.test(url)) {
      throw new Error("请选择工作台默认素材或从本机导入文件。")
    }
  })
}

// 无效的键位或 UV 必须同时释放已解码网格，不能只退出加载流程。
export async function loadModel(loader: GLTFLoader, url: string, signal: AbortSignal, prepareScene: (scene: THREE.Group) => void = validateAir75Scene) {
  let gltf: GLTF | undefined
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) { throw new Error(`模型读取失败（${response.status}）。`) }
    const buffer = await response.arrayBuffer()
    validateEmbeddedGlb(buffer)
    signal.throwIfAborted()
    gltf = await loader.parseAsync(buffer, "")
    prepareScene(gltf.scene)
    return gltf
  }
  catch (error) {
    if (gltf) { disposeAssets({ gltf }) }
    if (signal.aborted) { throw error }
    if (error instanceof Error && /[\u4E00-\u9FFF]/.test(error.message)) { throw error }
    throw new Error("模型解码失败，请确认 GLB 包含完整的静态网格、法线与 UV。")
  }
}

// 浏览器图片解码无法中止；由调用者等待结束后统一处理取消和释放。
export async function loadTexture(loader: THREE.TextureLoader, url: string, label: string) {
  try {
    return await loader.loadAsync(url)
  }
  catch {
    throw new Error(`${label}读取失败，请重新选择有效的 PNG、JPG 或 WebP 图片。`)
  }
}

// 不使用全局缓存；失败或取消时也等待全部任务落定，回收成功的部分。
export async function loadWorkbenchAssets(sources: Air75AssetSources, flipY: boolean, signal: AbortSignal) {
  validateSources(sources)
  const decoder = new DRACOLoader().setDecoderPath("/assets/common/")
  const modelLoader = new GLTFLoader().setDRACOLoader(decoder)
  const textureLoader = new THREE.TextureLoader()
  const loaded: Partial<WorkbenchAssets> = {}
  try {
    const [model, base, rgb] = await Promise.allSettled([
      loadModel(modelLoader, sources.model, signal),
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
