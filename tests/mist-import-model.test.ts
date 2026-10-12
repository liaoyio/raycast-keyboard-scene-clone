import type { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { it } from "vitest"
import { loadModule } from "./helpers"

interface DracoMesh {
  num_points: () => number
  num_faces: () => number
}
interface DracoValues {
  GetValue: (index: number) => number
}
interface DracoAttribute {
  num_components: () => number
}
interface DracoDecoder {
  DecodeArrayToMesh: (buffer: Int8Array, length: number, mesh: DracoMesh) => { ok: () => boolean }
  GetAttributeByUniqueId: (mesh: DracoMesh, id: number) => DracoAttribute
  GetAttributeFloatForAllPoints: (mesh: DracoMesh, attribute: DracoAttribute, values: DracoValues) => void
  GetFaceFromMesh: (mesh: DracoMesh, face: number, values: DracoValues) => void
}
interface DracoModule {
  Decoder: new () => DracoDecoder
  Mesh: new () => DracoMesh
  DracoFloat32Array: new () => DracoValues
  DracoInt32Array: new () => DracoValues
  destroy: (object: unknown) => void
}

const require = createRequire(import.meta.url)
const draco = require("draco3d") as { createDecoderModule: () => Promise<DracoModule> }

const renderer = loadModule<typeof import("../src/components/shared/ansi-renderer")>("shared/ansi-renderer.tsx", {
  "three": THREE,
  "@/components/shared/constants": {},
  "@/components/shared/input": {},
  "@/components/shared/shaders": {},
  "./import-model": {},
  "./scene-animation": {},
})
const profile = loadModule<typeof import("../src/components/mist/keyboard-profile")>("mist/keyboard-profile.ts", {
  "three": THREE,
  "@/components/shared/shaders": {},
  "./import-model": {},
})
const adapter = loadModule<typeof import("../src/components/mist/import-model")>("mist/import-model.ts", {
  "three": THREE,
  "@/components/shared/ansi-renderer": renderer,
  "./keyboard-profile": profile,
})
const config = loadModule<typeof import("../src/components/mist/scene-config")>("mist/scene-config.ts", {
  "@/components/raycast/scene-config": loadModule("raycast/scene-config.ts", {
    "@/components/shared/constants": loadModule("shared/constants.ts", { three: THREE }),
  }),
  "@/components/shared/ansi-scene-config": loadModule("shared/ansi-scene-config.ts"),
})

// 使用现有 Draco WASM 在内存解码真实交付模型，不生成转换文件或调用浏览器。
function decodeGeometry(module: DracoModule, buffer: ArrayBuffer, ids: Record<string, number>) {
  const decoder = new module.Decoder()
  const mesh = new module.Mesh()
  const status = decoder.DecodeArrayToMesh(new Int8Array(buffer), buffer.byteLength, mesh)
  const geometry = new THREE.BufferGeometry()
  try {
    assert.ok(status.ok())
    for (const [name, id] of Object.entries(ids)) {
      const attribute = decoder.GetAttributeByUniqueId(mesh, id)
      const values = new module.DracoFloat32Array()
      try {
        decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)
        const array = Float32Array.from({ length: mesh.num_points() * attribute.num_components() }, (_, index) => values.GetValue(index))
        geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.num_components()))
      }
      finally { module.destroy(values) }
    }
    const face = new module.DracoInt32Array()
    try {
      const indices = new Uint32Array(mesh.num_faces() * 3)
      for (let index = 0; index < mesh.num_faces(); index += 1) {
        decoder.GetFaceFromMesh(mesh, index, face)
        indices.set([face.GetValue(0), face.GetValue(1), face.GetValue(2)], index * 3)
      }
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    }
    finally { module.destroy(face) }
    return geometry
  }
  catch (error) { geometry.dispose(); throw error }
  finally { module.destroy(status); module.destroy(mesh); module.destroy(decoder) }
}

let rawModel: Promise<THREE.Group> | undefined

// 保留 GLTFLoader 的节点与材质解析，仅将 Worker 解码替换为同版本的 Node WASM。
async function model() {
  rawModel ??= (async () => {
    const module = await draco.createDecoderModule()
    const decoder = {
      preload() { return this },
      decodeDracoFile(buffer: ArrayBuffer, callback: (geometry: THREE.BufferGeometry) => void, ids: Record<string, number>) {
        callback(decodeGeometry(module, buffer, ids))
      },
    } as unknown as DRACOLoader
    const buffer = new Uint8Array(readFileSync(new URL("../public/assets/mist/ux-0923/wt.glb", import.meta.url))).buffer
    return (await new GLTFLoader().setDRACOLoader(decoder).parseAsync(buffer, "")).scene
  })()
  const scene = (await rawModel).clone(true)
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return }
    object.geometry = object.geometry.clone()
    object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone()
  })
  return scene
}

// 测试拥有场景中的几何与材质，与上传加载器使用相同的去重释放责任。
function disposeScene(scene: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return }
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material) }
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
}

// 三角循环移位不改变朝向；镜像后的反向绕序必须与真实源三角逐一相符。
function triangleKey(a: number, b: number, c: number) {
  if (b < a && b <= c) { return `${b},${c},${a}` }
  if (c < a && c < b) { return `${c},${a},${b}` }
  return `${a},${b},${c}`
}

it("0923 import separates 83 real caps and preserves every triangle, original UV, and mirrored normal", async () => {
  const scene = await model()
  const source = scene.getObjectByName("轴芯")
  assert.ok(source instanceof THREE.Mesh)
  const geometry = source.geometry
  const { position, normal, uv } = geometry.attributes
  const indices = geometry.getIndex()!
  let originalDisposed = 0; let materialDisposed = 0
  geometry.addEventListener("dispose", () => { originalDisposed += 1 })
  const sourceMaterial = source.material
  assert.ok(sourceMaterial instanceof THREE.Material)
  sourceMaterial.addEventListener("dispose", () => { materialDisposed += 1 })
  const originals = new Map<string, number>()
  const canonical = new Uint32Array(position.count)
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const tuple = [Math.fround(position.getX(vertex) - 14.25), position.getY(vertex), Math.fround(-position.getZ(vertex) - 4.75), normal.getX(vertex), normal.getY(vertex), -normal.getZ(vertex), uv.getX(vertex), uv.getY(vertex)].join(",")
    if (!originals.has(tuple)) { originals.set(tuple, vertex) }
    canonical[vertex] = originals.get(tuple)!
  }
  const triangles = new Map<string, number>()
  for (let triangle = 0; triangle < indices.count; triangle += 3) {
    const key = triangleKey(canonical[indices.getX(triangle)], canonical[indices.getX(triangle + 2)], canonical[indices.getX(triangle + 1)])
    triangles.set(key, (triangles.get(key) ?? 0) + 1)
  }
  adapter.prepareMistImportScene(scene)
  assert.equal(originalDisposed, 1)
  assert.equal(materialDisposed, 0, "split meshes continue owning the shared embedded material")
  assert.equal(scene.children.length, 84)
  const codes = adapter.mapMistImportedKeyCodes(scene)
  assert.equal(codes.size, 83)
  assert.equal(new Set(codes.values()).size, 83)
  let triangleCount = 0
  for (const object of scene.children) {
    assert.ok(object instanceof THREE.Mesh)
    assert.equal(object.material, sourceMaterial)
    const { position: p, normal: n, uv: texture } = object.geometry.attributes
    const localVertices = new Uint32Array(p.count)
    for (let vertex = 0; vertex < p.count; vertex += 1) {
      const tuple = [p.getX(vertex), p.getY(vertex), p.getZ(vertex), n.getX(vertex), n.getY(vertex), n.getZ(vertex), texture.getX(vertex), texture.getY(vertex)].join(",")
      const original = originals.get(tuple)
      assert.notEqual(original, undefined, "all position/normal/UV tuples must originate from the uploaded model")
      localVertices[vertex] = original!
    }
    const output = object.geometry.getIndex()!
    for (let triangle = 0; triangle < output.count; triangle += 3) {
      const key = triangleKey(localVertices[output.getX(triangle)], localVertices[output.getX(triangle + 1)], localVertices[output.getX(triangle + 2)])
      const remaining = triangles.get(key) ?? 0
      assert.ok(remaining > 0, "import cannot drop, duplicate, or reverse any source triangle")
      triangles.set(key, remaining - 1)
    }
    triangleCount += output.count / 3
  }
  assert.equal(triangleCount, 362901)
  assert.ok([...triangles.values()].every(count => count === 0))
  const staticMesh = scene.getObjectByName("static") as THREE.Mesh
  assert.equal(staticMesh.geometry.getIndex()!.count / 3, 156365)
  assert.equal(codes.has(staticMesh.uuid), false)
  const layout = JSON.parse(readFileSync(new URL("./fixtures/mist-key-layout.json", import.meta.url), "utf8")) as { keys: { code: string, center: number[] }[] }
  for (const key of layout.keys) {
    const cap = scene.getObjectByName(key.code) as THREE.Mesh
    cap.geometry.computeBoundingBox()
    const center = cap.geometry.boundingBox!.getCenter(new THREE.Vector3())
    center.toArray().forEach((value, index) => assert.ok(Math.abs(value - key.center[index]) < 0.000003, key.code))
  }
  disposeScene(scene)
  assert.equal(materialDisposed, 1)
}, 15000)

// 小型独立命名模型覆盖导入信任边界，不依赖 Blender 白光专用属性。
function namedScene() {
  const scene = new THREE.Group()
  const group = new THREE.Group()
  group.position.set(1, 2, 3)
  scene.add(group)
  for (const code of profile.MIST_KEY_ROWS.flatMap(row => row.split(" "))) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    mesh.name = code
    group.add(mesh)
  }
  return scene
}

it("named Mist imports preserve authored transforms without requiring native optical masks", () => {
  const scene = namedScene()
  const escape = scene.getObjectByName("Escape") as THREE.Mesh
  escape.position.set(4, 5, 6)
  escape.scale.set(2, 3, 4)
  scene.updateMatrixWorld(true)
  const matrix = escape.matrixWorld.clone()
  const geometry = escape.geometry
  adapter.prepareMistImportScene(scene)
  assert.ok(escape.matrixWorld.equals(matrix))
  assert.equal(escape.geometry, geometry)
  assert.equal(escape.geometry.getAttribute("_white_mask"), undefined)
  assert.equal(adapter.mapMistImportedKeyCodes(scene).get(escape.uuid), "Escape")
  disposeScene(scene)
})

it("imports reject duplicate keys, unknown meshes, invalid geometry, and unsupported merged layouts", async () => {
  const edits: [(mesh: THREE.Mesh) => void, RegExp][] = [
    [(mesh) => { mesh.name = "F1" }, /重复/],
    [(mesh) => { mesh.name = "unknown" }, /对应键码/],
    [(mesh) => { mesh.geometry.getAttribute("uv").setX(0, Number.NaN) }, /UV/],
    [(mesh) => { mesh.geometry.getAttribute("position").setX(0, Number.POSITIVE_INFINITY) }, /顶点/],
    [(mesh) => { mesh.geometry.getAttribute("normal").setZ(0, Number.NaN) }, /法线/],
    [(mesh) => { mesh.geometry.deleteAttribute("normal") }, /法线/],
    [(mesh) => { mesh.geometry.setIndex([0, 1, 99999]) }, /越界/],
    [(mesh) => { mesh.geometry.setIndex([0, 1]) }, /不完整/],
  ]
  for (const [edit, error] of edits) {
    const scene = namedScene()
    edit(scene.getObjectByName("Escape") as THREE.Mesh)
    assert.throws(() => adapter.prepareMistImportScene(scene), error)
    disposeScene(scene)
  }
  const unknown = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  mesh.name = "轴芯"
  unknown.add(mesh)
  assert.throws(() => adapter.prepareMistImportScene(unknown), /合并模型不兼容/)
  assert.equal(mesh.parent, unknown, "rejected imports must remain reachable for loader cleanup")
  disposeScene(unknown)
  const altered = await model()
  const source = altered.getObjectByName("轴芯") as THREE.Mesh
  source.geometry.getAttribute("position").setY(0, 2)
  let disposed = 0
  source.geometry.addEventListener("dispose", () => { disposed += 1 })
  assert.throws(() => adapter.prepareMistImportScene(altered), /布局|独立键帽/)
  assert.equal(disposed, 0, "failed preparation leaves original assets owned by the loader")
  assert.equal(source.parent, altered)
  disposeScene(altered)
  assert.equal(disposed, 1)
})

// 真实 1012 GLB 的节点变换与包围盒，保留作者分组及重复对象名。
function grouped1012Scene() {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/mist-1012-layout.json", import.meta.url), "utf8")) as {
    nodes: { name: string, mesh?: number, children?: number[], translation?: number[], rotation?: number[], scale?: number[] }[]
    bounds: [number[], number[]][]
  }
  const nodes = fixture.nodes.map((node) => {
    const object = node.mesh === undefined ? new THREE.Group() : new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    object.name = node.name
    if (object instanceof THREE.Mesh) {
      const [min, max] = fixture.bounds[node.mesh!]
      object.geometry.scale(...max.map((value, index) => value - min[index]) as [number, number, number])
      object.geometry.translate(...max.map((value, index) => (value + min[index]) / 2) as [number, number, number])
    }
    if (node.translation) { object.position.fromArray(node.translation) }
    if (node.rotation) { object.quaternion.fromArray(node.rotation) }
    if (node.scale) { object.scale.fromArray(node.scale) }
    return object
  })
  fixture.nodes.forEach((node, index) => node.children?.forEach(child => nodes[index].add(nodes[child])))
  const scene = new THREE.Group()
  scene.add(...nodes.filter(node => !node.parent))
  return scene
}

it("1012 authored groups import all 83 keys and retain 10 static meshes at the calibrated scale", () => {
  const scene = grouped1012Scene()
  adapter.prepareMistImportScene(scene)
  assert.equal(adapter.mapMistImportedKeyCodes(scene).size, 83)
  assert.equal(scene.children.length, 93)
  const layout = JSON.parse(readFileSync(new URL("./fixtures/mist-key-layout.json", import.meta.url), "utf8")) as { keys: { code: string, center: number[] }[] }
  for (const key of layout.keys) {
    const cap = scene.getObjectByName(key.code) as THREE.Mesh
    const center = new THREE.Box3().setFromObject(cap).getCenter(new THREE.Vector3())
    center.toArray().forEach((value, index) => assert.ok(Math.abs(value - key.center[index]) < 0.03, `${key.code} axis ${index}: ${value}`))
  }
  disposeScene(scene)
})

it("default 1012 GLB retains every triangle and UV while importing its authored groups", async () => {
  const bytes = new Uint8Array(readFileSync(new URL("../public/assets/mist/keyboard-1012.glb", import.meta.url))).buffer
  const module = await draco.createDecoderModule()
  const decoder = {
    preload() { return this },
    decodeDracoFile(buffer: ArrayBuffer, callback: (geometry: THREE.BufferGeometry) => void, ids: Record<string, number>) {
      callback(decodeGeometry(module, buffer, ids))
    },
  } as unknown as DRACOLoader
  const scene = (await new GLTFLoader().setDRACOLoader(decoder).parseAsync(bytes, "")).scene
  let triangles = 0
  const uv = new Map<string, number>()
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return }
    triangles += (object.geometry.getIndex()?.count ?? object.geometry.getAttribute("position").count) / 3
    const values = object.geometry.getAttribute("uv")
    for (let index = 0; index < values.count; index += 1) {
      const key = `${values.getX(index)},${values.getY(index)}`
      uv.set(key, (uv.get(key) ?? 0) + 1)
    }
  })
  adapter.prepareMistImportScene(scene)
  assert.equal(adapter.mapMistImportedKeyCodes(scene).size, 83)
  let importedTriangles = 0
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return }
    importedTriangles += object.geometry.getIndex()!.count / 3
    const values = object.geometry.getAttribute("uv")
    for (let index = 0; index < values.count; index += 1) {
      const key = `${values.getX(index)},${values.getY(index)}`
      assert.ok((uv.get(key) ?? 0) > 0)
      uv.set(key, uv.get(key)! - 1)
    }
  })
  assert.equal(importedTriangles, triangles)
  assert.ok([...uv.values()].every(count => count === 0))
  // 实际帽内上层顶点的扫程能发现照搬 Raycast 键程造成的轴顶穿插。
  const escape = scene.getObjectByName("Escape") as THREE.Mesh<THREE.BufferGeometry>
  const positions = escape.geometry.getAttribute("position")
  const sample = new THREE.Vector3(-14.24021, 0.719619, -4.79364)
  const point = new THREE.Vector3()
  let distance = Infinity
  const origin = new THREE.Vector3()
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).applyMatrix4(escape.matrixWorld)
    const difference = point.distanceToSquared(sample)
    if (difference < distance) { distance = difference; origin.copy(point) }
  }
  assert.ok(distance < 0.000001, "probe must originate from the real keycap geometry")
  const structure = scene.children.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh && object.name === "static")
  for (const mesh of structure) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { material.side = THREE.DoubleSide }
  }
  const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0.000001, config.MIST_SCENE_CONFIG["按压深度（模型单位）"][0])
  assert.equal(ray.intersectObjects(structure).length, 0, "default key travel must stop above the axis surface")
  ray.far = 0.25
  assert.ok(ray.intersectObjects(structure).length > 0, "the check must detect the previous scaled-depth collision")
  disposeScene(scene)
}, 15000)
