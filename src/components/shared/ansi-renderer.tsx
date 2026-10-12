"use client"

import type { Air75SceneControls } from "@/components/shared/ansi-scene-config"
import type { KeyboardShaderMaterial, KeyboardSharedUniforms } from "@/components/shared/shaders"
import { useFrame, useThree } from "@react-three/fiber"
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react"

import * as THREE from "three"
import { useMediaQuery } from "usehooks-ts"
import { MAX_FRAME_DELTA, MAX_PULSES } from "@/components/shared/constants"
import { useKeyboardInput } from "@/components/shared/input"
import {
  createKeyboardMaterial,
  createKeyboardSharedUniforms,

} from "@/components/shared/shaders"
import { advancePulses, disposeMaterials, getAspectFov, updateLightingUniforms } from "./scene-animation"

// 保留模型尺度，按真实顶点投影对齐首页 400px 高的舞台。
const CAMERA_START = new THREE.Vector3(-0.044001, 70, 0)

// 0903 白版与 0904 黑版共用 83 键 ANSI 分区；区内按世界 X 从左到右映射。
const KEY_ROWS = {
  F区: "Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 PrintScreen Delete",
  数字: "Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace PageUp",
  字母1: "Tab KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash PageDown",
  字母2: "CapsLock KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter Home",
  字母3: "ShiftLeft KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ShiftRight ArrowUp End",
  指令区: "ControlLeft AltLeft MetaLeft Space MetaRight Fn ControlRight ArrowLeft ArrowDown ArrowRight",
}
const SUPPORTED_KEYS = new Set(Object.values(KEY_ROWS).flatMap(row => row.split(" ")))

interface MeshState {
  source: THREE.Mesh<THREE.BufferGeometry>
  code: string | undefined
  center: THREE.Vector3
  rest: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
  material: KeyboardShaderMaterial
  object: THREE.Mesh | null
  depth: number
}

export interface KeyboardRenderProfile {
  mapKeyCodes: (scene: THREE.Group) => Map<string, string>
  createMaterial: (uniforms: KeyboardSharedUniforms, source: THREE.Mesh<THREE.BufferGeometry>, interactive: boolean) => KeyboardShaderMaterial
  onPress?: (material: KeyboardShaderMaterial) => void
  advanceLight?: (material: KeyboardShaderMaterial, pressed: boolean, delta: number, reducedMotion: boolean) => boolean
  onDepthChange?: (material: KeyboardShaderMaterial, depth: number) => void
  lampPosition: (source: THREE.Mesh<THREE.BufferGeometry>) => THREE.Vector3
}

interface Air75AnsiKeyboardProps {
  active: boolean
  onReady: () => void
  controls: Air75SceneControls
  scene: THREE.Group
  base: THREE.Texture
  rgb: THREE.Texture
  fitAspect?: boolean
  profile?: KeyboardRenderProfile
}

// GLB 可包含分组和装饰节点，只处理可绘制网格。
function isMesh(object: THREE.Object3D): object is THREE.Mesh<THREE.BufferGeometry> {
  return "isMesh" in object && object.isMesh === true
}

// 键帽原点不一定居中，灯效定位需使用几何包围盒。
function getCenter(mesh: THREE.Mesh<THREE.BufferGeometry>) {
  mesh.geometry.computeBoundingBox()
  if (!mesh.geometry.boundingBox) { throw new Error(`Missing geometry: ${mesh.name}`) }
  return mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
}

// 按分组和世界坐标映射键码，拒绝不完整布局以免按键错位。
function mapKeyCodes(scene: THREE.Group) {
  scene.updateMatrixWorld(true)
  const codes = new Map<string, string>()

  for (const [name, row] of Object.entries(KEY_ROWS)) {
    const group = scene.getObjectByName(name)
    const keys = group?.children.filter(isMesh).map(mesh => ({
      mesh,
      x: getCenter(mesh).applyMatrix4(mesh.matrixWorld).x,
    }))
    const expected = row.split(" ")
    if (!keys || keys.length !== expected.length) {
      throw new Error(`Air75 ANSI ${name}: expected ${expected.length} keys, got ${keys?.length ?? 0}.`)
    }
    keys.sort((a, b) => a.x - b.x)
    keys.forEach(({ mesh }, index) => codes.set(mesh.uuid, expected[index]))
  }

  return codes
}

// 展平模型层级，同时保存世界变换及各键的独立材质。
function createMeshes(scene: THREE.Group, uniforms: KeyboardSharedUniforms, profile?: KeyboardRenderProfile) {
  const codes = profile ? profile.mapKeyCodes(scene) : mapKeyCodes(scene)
  const staticMaterial = profile ? undefined : createKeyboardMaterial(uniforms)
  const meshes: MeshState[] = []

  scene.traverse((source) => {
    if (!isMesh(source)) { return }
    const code = codes.get(source.uuid)
    const rest = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    source.matrixWorld.decompose(rest, quaternion, scale)
    meshes.push({
      source,
      code,
      rest,
      quaternion,
      scale,
      center: profile ? profile.lampPosition(source) : getCenter(source),
      material: profile?.createMaterial(uniforms, source, Boolean(code))
        ?? (code ? createKeyboardMaterial(uniforms) : staticMaterial!),
      object: null,
      depth: 0,
    })
  })

  return meshes
}

// 检查上传网格的几何边界，避免无效坐标进入着色器或世界变换。
export function validateMeshGeometry(object: THREE.Mesh<THREE.BufferGeometry>) {
  const position = object.geometry.getAttribute("position")
  const uv = object.geometry.getAttribute("uv")
  if (!position?.count || !uv || uv.itemSize !== 2 || uv.count !== position.count) {
    throw new Error(`模型中的「${object.name || "未命名网格"}」缺少有效 UV，请重新导出模型。`)
  }
  if (position.itemSize !== 3 || !object.matrixWorld.elements.every(Number.isFinite)) {
    throw new Error(`模型中的「${object.name || "未命名网格"}」包含无效几何或变换。`)
  }
  for (let index = 0; index < uv.count; index += 1) {
    if (![uv.getX(index), uv.getY(index)].every(Number.isFinite)) {
      throw new Error(`模型中的「${object.name || "未命名网格"}」包含无效 UV 坐标。`)
    }
    if (![position.getX(index), position.getY(index), position.getZ(index)].every(Number.isFinite)) {
      throw new Error(`模型中的「${object.name || "未命名网格"}」包含无效顶点。`)
    }
  }
  if ("isSkinnedMesh" in object || "isInstancedMesh" in object) {
    throw new Error("模型包含骨骼或实例网格。请导出独立键帽的静态键盘模型。")
  }
}

// 本地导入属于信任边界：在进入渲染器前检查 UV、顶点和键位布局。
export function validateAir75Scene(scene: THREE.Group) {
  scene.updateMatrixWorld(true)
  const groups = new Map<string, number>()
  scene.traverse((object) => {
    if (Object.hasOwn(KEY_ROWS, object.name)) { groups.set(object.name, (groups.get(object.name) ?? 0) + 1) }
    if (!isMesh(object)) { return }
    validateMeshGeometry(object)
  })
  if ([...groups.values()].some(count => count !== 1)) {
    throw new Error("模型包含重复的按键分组名称，请保留唯一的六个 ANSI 分组。")
  }
  try {
    mapKeyCodes(scene)
  }
  catch {
    throw new Error("模型分组不兼容。请使用包含 F区、数字、字母1、字母2、字母3、指令区的 83 键 ANSI 模型。")
  }
}

// 本次挂载拥有材质、波纹游标和首帧标记；React 只负责资源更换。
function createKeyboardRuntime(scene: THREE.Group, base: THREE.Texture, rgb: THREE.Texture, profile?: KeyboardRenderProfile) {
  const uniforms = createKeyboardSharedUniforms(base, rgb)
  const meshes = createMeshes(scene, uniforms, profile)
  const keys = new Map(meshes.filter(mesh => mesh.code).map(mesh => [mesh.code!, mesh]))
  return {
    uniforms,
    meshes,
    keys,
    supportedKeys: profile ? new Set(keys.keys()) : SUPPORTED_KEYS,
    pulsePosition: new THREE.Vector3(),
    pulseCursor: 0,
    rendered: false,
  }
}

// 展开 GLB 层级后沿模型 Y 轴按压，外层变换仍统一作用于整把键盘。
function advanceKeys(keys: Map<string, MeshState>, pressed: Set<string>, controls: Air75SceneControls, delta: number, profile?: KeyboardRenderProfile) {
  let moving = false
  const pressDepth = controls["按压深度（模型单位）"]
  for (const [code, key] of keys) {
    const target = pressed.has(code) ? pressDepth : 0
    if (key.depth !== target) {
      key.depth = THREE.MathUtils.damp(key.depth, target, controls["高级"]["按键收敛速率（s⁻¹）"], delta)
      if (Math.abs(key.depth - target) < 0.00001) { key.depth = target }
      if (key.object) { key.object.position.y = key.rest.y - key.depth }
      moving = true
    }
    const pressedAmount = Math.min(1, key.depth / Math.max(pressDepth, 0.0001))
    key.material.uniforms.uDim.value = 1 - pressedAmount * controls["按键压暗比例"]
    // 光学缓存随实际键程插值，不能在按下事件中直接切换到压到底的光路。
    profile?.onDepthChange?.(key.material, key.depth)
  }
  return moving
}

// 相机和材质调参进入渲染器，帧内状态集中在当前资源实例。
export function Air75AnsiKeyboard({ active, onReady, controls, scene, base, rgb, fitAspect = false, profile }: Air75AnsiKeyboardProps) {
  const camera = useThree(state => state.camera)
  const invalidate = useThree(state => state.invalidate)
  const aspect = useThree(state => fitAspect ? (state.size?.width ?? 1200) / Math.max(1, state.size?.height ?? 400) : 1)
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const cameraControls = controls["相机"]
  const { cameraRest, cameraLookAt } = useMemo(() => {
    return {
      cameraRest: new THREE.Vector3(
        cameraControls["终点 X（场景单位）"],
        cameraControls["终点 Y（场景单位）"],
        cameraControls["终点 Z（场景单位）"],
      ),
      cameraLookAt: new THREE.Vector3(
        cameraControls["注视点 X（场景单位）"],
        cameraControls["注视点 Y（场景单位）"],
        cameraControls["注视点 Z（场景单位）"],
      ),
    }
  }, [cameraControls])
  const runtime = useMemo(() => createKeyboardRuntime(scene, base, rgb, profile), [scene, base, rgb, profile])
  const { uniforms, meshes, keys, supportedKeys, pulsePosition } = runtime

  const press = useCallback((code: string) => {
    const key = keys.get(code)
    if (!key?.object) { return }
    if (profile?.onPress) {
      profile.onPress(key.material)
      invalidate()
      return
    }
    // 键帽原点偏在一角；波纹使用几何中心的世界坐标，与 shader 保持一致。
    key.object.localToWorld(pulsePosition.copy(key.center))
    const index = runtime.pulseCursor
    uniforms.uPulseCenters.value[index].set(pulsePosition.x, pulsePosition.z)
    uniforms.uPulseProgress.value[index] = 0
    runtime.pulseCursor = (index + 1) % MAX_PULSES
    invalidate()
  }, [keys, uniforms, pulsePosition, runtime, invalidate, profile])
  const { pointerEvents, pressedKeysRef } = useKeyboardInput({
    enabled: active,
    supportedKeys,
    onPress: press,
    onRelease: () => invalidate(),
  })

  // 相机与模型一同从 Suspense 挂载，入场不会先于资源加载开始。
  useLayoutEffect(() => {
    camera.position.copy(CAMERA_START)
    invalidate()
  }, [camera, invalidate])

  useLayoutEffect(() => {
    updateLightingUniforms(uniforms, controls)
    if (reducedMotion) { camera.position.copy(cameraRest) }
    camera.lookAt(cameraLookAt)
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = controls["相机"]["垂直视场角（°）"]
      // 工作台按原舞台 3:1 的横向视野保宽；窄屏扩展垂直视场，旧页面保留标定值。
      camera.fov = fitAspect ? getAspectFov(fov, aspect) : fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    // demand 模式空闲时停帧；任意调参都要唤醒一次，让相机、按压和材质生效。
    invalidate()
  }, [camera, cameraRest, cameraLookAt, controls, uniforms, reducedMotion, invalidate, aspect, fitAspect])

  useEffect(() => { if (active) { invalidate() } }, [active, invalidate])
  useEffect(() => () => disposeMaterials(meshes), [meshes])

  useFrame((_, frameDelta) => {
    if (!active) { return }
    const delta = Math.min(frameDelta, MAX_FRAME_DELTA)
    let moving = false

    if (!camera.position.equals(cameraRest)) {
      camera.position.lerp(cameraRest, 1 - Math.exp(-controls["相机"]["收敛速率（s⁻¹）"] * delta))
      if (camera.position.distanceToSquared(cameraRest) < 0.000001) {
        camera.position.copy(cameraRest)
      }
      camera.lookAt(cameraLookAt)
      moving = true
    }

    let lightsMoving = false
    if (profile?.advanceLight) {
      for (const [code, key] of keys) {
        if (profile.advanceLight(key.material, pressedKeysRef.current.has(code), delta, reducedMotion)) { lightsMoving = true }
      }
    }
    const pulsesMoving = advancePulses(uniforms, controls["波纹时长（s）"], delta)
    const keysMoving = advanceKeys(keys, pressedKeysRef.current, controls, delta, profile)

    if (moving || pulsesMoving || keysMoving || lightsMoving) { invalidate() }
  })

  // 任意一个实际绘制的网格都可确认首帧，避免视锥裁剪阻塞就绪。
  function markRendered() {
    if (runtime.rendered) { return }
    runtime.rendered = true
    onReady()
  }

  return (
    <group
      dispose={null}
      position={[
        controls["模型变换"]["平移 X（场景单位）"],
        controls["模型变换"]["平移 Y（场景单位）"],
        controls["模型变换"]["平移 Z（场景单位）"],
      ]}
      rotation={[
        THREE.MathUtils.degToRad(controls["模型变换"]["旋转 X（°）"]),
        THREE.MathUtils.degToRad(controls["模型变换"]["旋转 Y（°）"]),
        THREE.MathUtils.degToRad(controls["模型变换"]["旋转 Z（°）"]),
      ]}
      scale={controls["模型变换"]["统一缩放"]}
    >
      {meshes.map(mesh => (
        <mesh
          key={mesh.source.uuid}
          ref={(object) => { mesh.object = object }}
          name={mesh.code ?? mesh.source.name}
          geometry={mesh.source.geometry}
          material={mesh.material}
          position={mesh.rest}
          quaternion={mesh.quaternion}
          scale={mesh.scale}
          onAfterRender={markRendered}
          {...(mesh.code ? pointerEvents : {})}
        />
      ))}
    </group>
  )
}
