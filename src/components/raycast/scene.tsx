"use client"

import type { SceneControls } from "@/components/raycast/scene-config"
import type { KeyboardShaderMaterial, KeyboardSharedUniforms } from "@/components/shared/shaders"
import { useGLTF, useTexture } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useDialKit } from "dialkit"

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react"
import * as THREE from "three"

import { BASE_TEXTURE_URL, MODEL_URL, RGB_TEXTURE_URL, SCENE_CONFIG } from "@/components/raycast/scene-config"
import {
  CAMERA_LOOK_AT,
  CAMERA_START,
  LOCAL_PRESS_AXIS,
  MAX_FRAME_DELTA,
  MAX_PULSES,
} from "@/components/shared/constants"
import { DebugPanel } from "@/components/shared/debug"
import { useKeyboardInput } from "@/components/shared/input"
import { advancePulses, disposeMaterials, getAspectFov, updateLightingUniforms } from "@/components/shared/scene-animation"
import {
  configureKeyboardTextures,
  createKeyboardMaterial,
  createKeyboardSharedUniforms,

} from "@/components/shared/shaders"

export interface SceneProps {
  active?: boolean
  inView?: boolean
  prefersReducedMotion?: boolean
}

interface KeyboardMeshState {
  name: string
  geometry: THREE.BufferGeometry
  rest: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
  pressAxis: THREE.Vector3
  depth: number
  object: THREE.Mesh | null
  isStatic: boolean
  material: KeyboardShaderMaterial
}

interface CameraRigProps {
  active: boolean
  prefersReducedMotion: boolean
  controls: SceneControls["相机"]
}

interface KeyboardModelProps {
  active: boolean
  onFirstFrame: () => void
  controls: SceneControls
}

// 忽略 GLB 中的分组节点，保留原始独立网格。
function isMesh(
  child: THREE.Object3D,
): child is THREE.Mesh<THREE.BufferGeometry> {
  return "isMesh" in child && child.isMesh === true
}

// 相机仅响应入场和显式调参，鼠标移动不改变取景。
function CameraRig({ active, prefersReducedMotion, controls }: CameraRigProps) {
  const camera = useThree(state => state.camera)
  const aspect = useThree(state => (state.size?.width ?? 1200) / Math.max(1, state.size?.height ?? 400))
  const { target, lookAt } = useMemo(() => ({
    target: new THREE.Vector3(controls["终点 X（场景单位）"], controls["终点 Y（场景单位）"], controls["终点 Z（场景单位）"]),
    lookAt: new THREE.Vector3(controls["注视点 X（场景单位）"], controls["注视点 Y（场景单位）"], controls["注视点 Z（场景单位）"]),
  }), [controls])

  useLayoutEffect(() => {
    camera.position.set(...CAMERA_START)
    camera.lookAt(CAMERA_LOOK_AT)
    camera.updateMatrixWorld()
  }, [camera])

  useLayoutEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      // 窄预览框保留水平视野，宽画幅沿用原始校准。
      camera.fov = getAspectFov(controls["垂直视场角（°）"], aspect)
      camera.updateProjectionMatrix()
    }

    if (!active || !prefersReducedMotion) { return }
    camera.position.copy(target)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld()
  }, [active, camera, controls, prefersReducedMotion, aspect, target, lookAt])

  useFrame((state, frameDelta) => {
    if (!active || prefersReducedMotion) { return }

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA)
    state.camera.position.lerp(target, 1 - Math.exp(-controls["收敛速率（s⁻¹）"] * delta))
    state.camera.lookAt(lookAt)
  })

  return null
}

// 保存模型原始变换，静态外壳共享材质，键帽独立压暗。
function createMeshStates(
  scene: THREE.Group,
  sharedUniforms: KeyboardSharedUniforms,
): KeyboardMeshState[] {
  const staticMaterial = createKeyboardMaterial(sharedUniforms)
  return scene.children.filter(isMesh).map((child) => {
    const isStatic = child.name === "static"
    return {
      name: child.name,
      geometry: child.geometry,
      rest: child.position.clone(),
      quaternion: child.quaternion.clone(),
      scale: child.scale.clone(),
      pressAxis: LOCAL_PRESS_AXIS.clone().applyQuaternion(child.quaternion),
      depth: 0,
      object: null,
      isStatic,
      material: isStatic ? staticMaterial : createKeyboardMaterial(sharedUniforms),
    }
  })
}

// 每个资源实例独立持有运行时数据，避免帧更新触发 React 渲染。
function createKeyboardRuntime(scene: THREE.Group, base: THREE.Texture, rgb: THREE.Texture) {
  const sharedUniforms = createKeyboardSharedUniforms(base, rgb)
  const meshes = createMeshStates(scene, sharedUniforms)
  return {
    sharedUniforms,
    meshes,
    meshByName: new Map(meshes.map(mesh => [mesh.name, mesh])),
    supportedKeys: new Set(meshes.filter(mesh => !mesh.isStatic).map(mesh => mesh.name)),
    pulsePosition: new THREE.Vector3(),
    pulseCursor: 0,
    rendered: false,
  }
}

// 按压沿各键的局部轴移动；外壳与键帽保持原来的材质规则。
function advanceKeys(meshes: KeyboardMeshState[], pressed: Set<string>, controls: SceneControls, delta: number) {
  for (const mesh of meshes) {
    const targetDepth = pressed.has(mesh.name) ? controls["按压深度（模型单位）"] : 0
    if (targetDepth === 0 && mesh.depth === 0) { continue }
    mesh.depth = THREE.MathUtils.damp(mesh.depth, targetDepth, controls["高级"]["按键收敛速率（s⁻¹）"], delta)
    if (targetDepth === 0 && mesh.depth < 0.00001) { mesh.depth = 0 }
    mesh.object?.position.copy(mesh.rest).addScaledVector(mesh.pressAxis, mesh.depth)
    if (mesh.isStatic) { continue }
    const pressedAmount = Math.min(1, mesh.depth / Math.max(controls["按压深度（模型单位）"], 0.0001))
    mesh.material.uniforms.uDim.value = 1 - pressedAmount * controls["按键压暗比例"]
  }
}

// 加载器拥有模型和贴图；本组件只创建和释放着色材质。
function KeyboardModel({ active, onFirstFrame, controls }: KeyboardModelProps) {
  const { scene } = useGLTF(MODEL_URL)
  const [baseTexture, rgbTexture] = useTexture(
    [BASE_TEXTURE_URL, RGB_TEXTURE_URL],
    configureKeyboardTextures,
  )
  const runtime = useMemo(
    () => createKeyboardRuntime(scene, baseTexture, rgbTexture),
    [scene, baseTexture, rgbTexture],
  )
  const { meshes, sharedUniforms, meshByName, supportedKeys, pulsePosition } = runtime

  const triggerPulse = useCallback(
    (code: string) => {
      const mesh = meshByName.get(code)
      if (!mesh?.object) { return }

      mesh.object.getWorldPosition(pulsePosition)

      const pulseIndex = runtime.pulseCursor
      sharedUniforms.uPulseCenters.value[pulseIndex].set(
        pulsePosition.x,
        pulsePosition.z,
      )
      sharedUniforms.uPulseProgress.value[pulseIndex] = 0
      runtime.pulseCursor = (pulseIndex + 1) % MAX_PULSES
    },
    [meshByName, sharedUniforms, pulsePosition, runtime],
  )

  const { pointerEvents, pressedKeysRef } = useKeyboardInput({
    enabled: active,
    supportedKeys,
    onPress: triggerPulse,
  })

  useEffect(() => {
    updateLightingUniforms(sharedUniforms, controls)
  }, [controls, sharedUniforms])
  useEffect(() => () => disposeMaterials(meshes), [meshes])

  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, MAX_FRAME_DELTA)
    advancePulses(sharedUniforms, controls["波纹时长（s）"], delta)
    advanceKeys(meshes, pressedKeysRef.current, controls, delta)
  })

  // 实际网格绘制后才揭开舞台，避免把“开始一帧”误认为“完成首帧”。
  function markRendered() {
    if (runtime.rendered) { return }
    runtime.rendered = true
    onFirstFrame()
  }

  return (
    <group
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
          key={mesh.name}
          ref={(object) => {
            mesh.object = object
          }}
          name={mesh.name}
          geometry={mesh.geometry}
          material={mesh.material}
          position={mesh.rest}
          quaternion={mesh.quaternion}
          scale={mesh.scale}
          onAfterRender={markRendered}
          {...(mesh.isStatic ? {} : pointerEvents)}
        />
      ))}
    </group>
  )
}

// 唯一首帧状态控制入场与输入，离屏或播放视频时停止连续绘制。
export default function Scene({
  active = true,
  inView = true,
  prefersReducedMotion = false,
}: SceneProps) {
  const controls = useDialKit("渲染设置", SCENE_CONFIG, {
    id: "raycast-keyboard-scene",
  })
  const [renderReady, setRenderReady] = useState(false)

  const sceneActive = active && renderReady
  const frameloop = !renderReady || (inView && active) ? "always" : "demand"

  return (
    <>
      <div className="absolute inset-0 z-2 size-full touch-none" aria-busy={!renderReady}>
        <Canvas
          flat
          aria-label="Interactive 3D rendering of the Raycast mechanical keyboard"
          camera={{ position: CAMERA_START, fov: 20 }}
          className="size-full"
          dpr={[1, 1.75]}
          frameloop={frameloop}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          resize={{ offsetSize: true }}
          role="img"
        >
          <CameraRig
            active={sceneActive}
            prefersReducedMotion={prefersReducedMotion}
            controls={controls["相机"]}
          />
          <Suspense fallback={null}>
            <KeyboardModel
              active={sceneActive}
              onFirstFrame={() => setRenderReady(true)}
              controls={controls}
            />
          </Suspense>
        </Canvas>
      </div>
      <DebugPanel />
    </>
  )
}

useGLTF.preload(MODEL_URL)
useTexture.preload([BASE_TEXTURE_URL, RGB_TEXTURE_URL])
