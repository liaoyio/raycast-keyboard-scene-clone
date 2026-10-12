import * as THREE from "three"
import { validateMeshGeometry } from "@/components/shared/ansi-renderer"
import { MIST_KEY_ROWS } from "./keyboard-profile"

interface ConnectedPart {
  bounds: THREE.Box3
  triangles: number[]
}

// 导入模型只接受真实 Mist 键位；PNG 路径无需 Blender 专用白光遮罩。
export function mapMistImportedKeyCodes(scene: THREE.Group) {
  scene.updateMatrixWorld(true)
  const remaining = new Set(MIST_KEY_ROWS.flatMap(row => row.split(" ")))
  const codes = new Map<string, string>()
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return }
    validateMeshGeometry(object)
    validateNormalsAndTriangles(object.geometry)
    if (object.name === "static") { return }
    if (!remaining.delete(object.name)) {
      throw new Error(`雾透键帽名称重复或无对应键码：${object.name || "未命名网格"}`)
    }
    codes.set(object.uuid, object.name)
  })
  if (remaining.size) {
    throw new Error(`导入模型应有 83 个独立雾透键帽，实际 ${codes.size} 个。请选择 ux-0923 模型，或按 Mist 键码命名键帽。`)
  }
  return codes
}

// 法线与索引也属于导入边界，不能让无效三角进入分键或渲染过程。
function validateNormalsAndTriangles(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position")
  const normal = geometry.getAttribute("normal")
  if (!normal || normal.itemSize !== 3 || normal.count !== position.count) {
    throw new Error("导入模型缺少与顶点对应的有效法线，请重新导出 GLB。")
  }
  for (let index = 0; index < normal.count; index += 1) {
    if (![normal.getX(index), normal.getY(index), normal.getZ(index)].every(Number.isFinite)) {
      throw new Error("导入模型包含无效法线。")
    }
  }
  const indices = geometry.getIndex()
  if ((indices?.count ?? position.count) % 3 !== 0) {
    throw new Error("导入模型包含不完整的三角形。")
  }
  if (!indices) { return }
  for (let index = 0; index < indices.count; index += 1) {
    const value = indices.getX(index)
    if (!Number.isInteger(value) || value < 0 || value >= position.count) {
      throw new Error("导入模型包含越界的三角索引。")
    }
  }
}

// 只按完全相同的位置跨越 UV 断缝，不焊接临近但分离的帽壁与轴体。
function connectedParts(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position")
  const indices = geometry.getIndex()!
  const parents = Uint32Array.from({ length: position.count }, (_, index) => index)
  const ranks = new Uint8Array(position.count)
  function root(index: number): number {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]]
      index = parents[index]
    }
    return index
  }
  function join(a: number, b: number) {
    let first = root(a); let second = root(b)
    if (first === second) { return }
    if (ranks[first] < ranks[second]) { [first, second] = [second, first] }
    parents[second] = first
    if (ranks[first] === ranks[second]) { ranks[first] += 1 }
  }
  const coincident = new Map<string, number>()
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const key = `${position.getX(vertex)},${position.getY(vertex)},${position.getZ(vertex)}`
    const previous = coincident.get(key)
    if (previous === undefined) { coincident.set(key, vertex) }
    else { join(previous, vertex) }
  }
  for (let index = 0; index < indices.count; index += 3) {
    join(indices.getX(index), indices.getX(index + 1))
    join(indices.getX(index), indices.getX(index + 2))
  }
  const parts = new Map<number, ConnectedPart>()
  const point = new THREE.Vector3()
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const id = root(vertex)
    let part = parts.get(id)
    if (!part) {
      part = { bounds: new THREE.Box3(), triangles: [] }
      parts.set(id, part)
    }
    part.bounds.expandByPoint(point.fromBufferAttribute(position, vertex))
  }
  for (let index = 0; index < indices.count; index += 3) {
    parts.get(root(indices.getX(index)))!.triangles.push(index)
  }
  return [...parts.values()]
}

// 0923 原模型局部 Z 与发布模型相反；镜像时同步法线与绕序，保留原 UV 断缝。
function extractGeometry(source: THREE.BufferGeometry, triangles: number[]) {
  const indices = source.getIndex()!
  const position = source.getAttribute("position")
  const normal = source.getAttribute("normal")
  const uv = source.getAttribute("uv")
  const vertices = new Map<number, number>()
  const outputIndices = new Uint32Array(triangles.length * 3)
  let cursor = 0
  for (const triangle of triangles) {
    for (const corner of [0, 2, 1]) {
      const index = indices.getX(triangle + corner)
      let local = vertices.get(index)
      if (local === undefined) { local = vertices.size; vertices.set(index, local) }
      outputIndices[cursor++] = local
    }
  }
  const positions = new Float32Array(vertices.size * 3)
  const normals = new Float32Array(vertices.size * 3)
  const uvs = new Float32Array(vertices.size * 2)
  for (const [sourceIndex, target] of vertices) {
    positions[target * 3] = position.getX(sourceIndex) - 14.25
    positions[target * 3 + 1] = position.getY(sourceIndex)
    positions[target * 3 + 2] = -position.getZ(sourceIndex) - 4.75
    normals[target * 3] = normal.getX(sourceIndex)
    normals[target * 3 + 1] = normal.getY(sourceIndex)
    normals[target * 3 + 2] = -normal.getZ(sourceIndex)
    uvs[target * 2] = uv.getX(sourceIndex)
    uvs[target * 2 + 1] = uv.getY(sourceIndex)
  }
  return new THREE.BufferGeometry()
    .setAttribute("position", new THREE.BufferAttribute(positions, 3))
    .setAttribute("normal", new THREE.BufferAttribute(normals, 3))
    .setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
    .setIndex(new THREE.BufferAttribute(outputIndices, 1))
}

// shortcut: 仅分离已核实的 ux-0923 合并结构；新增合并模型须先核对真实键帽与布局。
function split0923Scene(scene: THREE.Group, source: THREE.Mesh<THREE.BufferGeometry>) {
  const geometry = source.geometry
  validateMeshGeometry(source)
  validateNormalsAndTriangles(geometry)
  if (geometry.getAttribute("position").count !== 318191 || geometry.getIndex()?.count !== 1088703) {
    throw new Error("合并模型不兼容。请选择 ux-0923 原模型，或导入 83 个独立命名的 Mist 键帽。")
  }
  const parts = connectedParts(geometry)
  const caps = parts.filter(({ bounds }) => bounds.min.y >= 0.15 && bounds.min.y <= 0.18
    && bounds.max.y >= 0.76 && bounds.max.y <= 0.83
    && Math.abs(bounds.max.z - bounds.min.z - 1.83) < 0.02)
  const rows: ConnectedPart[][] = MIST_KEY_ROWS.map(() => [])
  for (const cap of caps) {
    const z = -(cap.bounds.min.z + cap.bounds.max.z) / 2 - 4.75
    const row = Math.round((z + 4.788) / 1.899807)
    if (!rows[row] || Math.abs(z - (-4.788 + row * 1.899807)) > 0.02) {
      throw new Error("合并模型的键帽位置不符合 ux-0923 布局。")
    }
    rows[row].push(cap)
  }
  if (parts.length !== 191 || caps.length !== 83 || caps.reduce((count, cap) => count + cap.triangles.length, 0) !== 206536
    || rows.some((row, index) => row.length !== MIST_KEY_ROWS[index].split(" ").length)) {
    throw new Error("合并模型的独立键帽或六行布局不符合 ux-0923，未进行键位猜测。")
  }
  const meshes: THREE.Mesh<THREE.BufferGeometry>[] = []
  try {
    rows.forEach((row, rowIndex) => {
      row.sort((a, b) => a.bounds.min.x + a.bounds.max.x - b.bounds.min.x - b.bounds.max.x)
      row.forEach((cap, keyIndex) => {
        const mesh = new THREE.Mesh(extractGeometry(geometry, cap.triangles), source.material)
        mesh.name = MIST_KEY_ROWS[rowIndex].split(" ")[keyIndex]
        meshes.push(mesh)
      })
    })
    const capSet = new Set(caps)
    const staticMesh = new THREE.Mesh(extractGeometry(geometry, parts.filter(part => !capSet.has(part)).flatMap(part => part.triangles)), source.material)
    staticMesh.name = "static"
    meshes.push(staticMesh)
  }
  catch (error) {
    meshes.forEach(mesh => mesh.geometry.dispose())
    throw error
  }
  // 材质仍由新网格持有；只释放已从加载器场景移除的原合并几何。
  scene.clear()
  scene.position.set(0, 0, 0)
  scene.quaternion.identity()
  scene.scale.set(1, 1, 1)
  scene.matrixAutoUpdate = true
  scene.add(...meshes)
  scene.updateMatrixWorld(true)
  geometry.dispose()
}

// shortcut: 仅适配已核对的 1012 六行分组；新的作者布局须另行核对键位。
function prepare1012Scene(scene: THREE.Group, meshes: THREE.Mesh<THREE.BufferGeometry>[]) {
  const names = ["F区", "数字区", "字母区1", "字母区2", "字母区3", "功能区"]
  const caps = new Map<THREE.Mesh<THREE.BufferGeometry>, string>()
  for (const [row, name] of names.entries()) {
    const groups: THREE.Object3D[] = []
    scene.traverse((object) => { if (object.name === name) { groups.push(object) } })
    const keys = groups[0]?.children.filter((object): object is THREE.Mesh<THREE.BufferGeometry> => object instanceof THREE.Mesh)
    const codes = MIST_KEY_ROWS[row].split(" ")
    if (groups.length !== 1 || !keys || keys.length !== codes.length) {
      throw new Error(`1012 雾透模型的「${name}」分组不完整。`)
    }
    keys.sort((a, b) => new THREE.Box3().setFromObject(a).getCenter(new THREE.Vector3()).x
      - new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3()).x)
    keys.forEach((key, index) => caps.set(key, codes[index]))
  }
  if (meshes.length !== 93 || caps.size !== 83) { throw new Error("1012 雾透模型的键帽或静态结构数量不符。") }
  for (const mesh of meshes) {
    validateMeshGeometry(mesh)
    validateNormalsAndTriangles(mesh.geometry)
  }
  const escape = [...caps].find(([, code]) => code === "Escape")![0]
  const anchor = new THREE.Box3().setFromObject(escape).getCenter(new THREE.Vector3())
  // 作者文件的键距为 19，网页键距约 1.9；前后轴反向，以 Escape 对齐既有舞台。
  const transform = new THREE.Matrix4().makeScale(0.1, 0.1, -0.1)
  transform.setPosition(-14.245680898427963 - anchor.x * 0.1, 0.47189539670944214 - anchor.y * 0.1, -4.787716388702393 + anchor.z * 0.1)
  const output: THREE.Mesh<THREE.BufferGeometry>[] = []
  try {
    for (const source of meshes) {
      const geometry = source.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform, source.matrixWorld))
      const indices = geometry.getIndex()
      // 镜像后反转绕序；非索引几何先生成顺序索引，UV 与法线仍跟随原顶点。
      if (!indices) { geometry.setIndex(Array.from({ length: geometry.getAttribute("position").count }, (_, index) => index)) }
      const index = geometry.getIndex()!
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        const second = index.getX(triangle + 1)
        index.setX(triangle + 1, index.getX(triangle + 2))
        index.setX(triangle + 2, second)
      }
      const mesh = new THREE.Mesh(geometry, source.material)
      mesh.name = caps.get(source) ?? "static"
      output.push(mesh)
    }
  }
  catch (error) { output.forEach(mesh => mesh.geometry.dispose()); throw error }
  scene.clear()
  scene.position.set(0, 0, 0)
  scene.quaternion.identity()
  scene.scale.set(1, 1, 1)
  scene.add(...output)
  scene.updateMatrixWorld(true)
  new Set(meshes.map(mesh => mesh.geometry)).forEach(geometry => geometry.dispose())
}

// 仅修改加载器独占的场景；分键后所有新几何继续由该场景的资源清理负责。
export function prepareMistImportScene(scene: THREE.Group): void {
  scene.updateMatrixWorld(true)
  const meshes: THREE.Mesh<THREE.BufferGeometry>[] = []
  scene.traverse((object) => { if (object instanceof THREE.Mesh) { meshes.push(object) } })
  if (meshes.length === 1 && meshes[0].name === "轴芯") { split0923Scene(scene, meshes[0]) }
  if (scene.getObjectByName("雾透键帽_0921")) { prepare1012Scene(scene, meshes) }
  mapMistImportedKeyCodes(scene)
}
