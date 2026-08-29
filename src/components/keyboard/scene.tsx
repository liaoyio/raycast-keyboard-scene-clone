"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { useDialKit } from "dialkit";
import * as THREE from "three";
import { useEventCallback } from "usehooks-ts";

import {
  BASE_TEXTURE_URL,
  CAMERA_LOOK_AT,
  CAMERA_START,
  CAMERA_TARGET_POSITION,
  LOCAL_PRESS_AXIS,
  MAX_FRAME_DELTA,
  MAX_PULSES,
  MODEL_URL,
  RGB_TEXTURE_URL,
} from "./constants";
import { DebugPanel } from "./debug";
import { useKeyboardInput } from "./input";
import { SCENE_CONFIG, type SceneControls } from "./scene-config";
import {
  configureKeyboardTextures,
  createKeyboardMaterial,
  createKeyboardSharedUniforms,
  type KeyboardShaderMaterial,
  type KeyboardSharedUniforms,
} from "./shaders";

export interface SceneProps {
  active?: boolean;
  inView?: boolean;
  prefersReducedMotion?: boolean;
  onReady?: () => void;
}

interface KeyboardMeshState {
  name: string;
  geometry: THREE.BufferGeometry;
  rest: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  pressAxis: THREE.Vector3;
  depth: number;
  object: THREE.Mesh | null;
  isStatic: boolean;
  material: KeyboardShaderMaterial;
}

interface CameraRigProps {
  active: boolean;
  prefersReducedMotion: boolean;
}

interface KeyboardModelProps {
  active: boolean;
  onFirstFrame: () => void;
  controls: SceneControls;
}

const CAMERA_LOOK_AT_VECTOR = new THREE.Vector3();
const PULSE_WORLD_POSITION = new THREE.Vector3();

function isMesh(
  child: THREE.Object3D,
): child is THREE.Mesh<THREE.BufferGeometry> {
  return "isMesh" in child && child.isMesh === true;
}

function CameraRig({ active, prefersReducedMotion }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const restPosition = useMemo(() => CAMERA_TARGET_POSITION.clone(), []);
  const lookAt = useMemo(() => CAMERA_LOOK_AT.clone(), []);

  useLayoutEffect(() => {
    camera.position.set(...CAMERA_START);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
  }, [camera, lookAt]);

  useLayoutEffect(() => {
    if (!active || !prefersReducedMotion) return;
    camera.position.copy(restPosition);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
  }, [active, camera, lookAt, prefersReducedMotion, restPosition]);

  useFrame((state, frameDelta) => {
    if (!active || prefersReducedMotion) return;

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA);
    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x,
      restPosition.x,
      4.5,
      delta,
    );
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      restPosition.y,
      4.5,
      delta,
    );
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      restPosition.z,
      4.5,
      delta,
    );
    state.camera.lookAt(CAMERA_LOOK_AT_VECTOR.copy(lookAt));
  });

  return null;
}

function createMeshStates(
  scene: THREE.Group,
  sharedUniforms: KeyboardSharedUniforms,
): KeyboardMeshState[] {
  const staticMaterial = createKeyboardMaterial(sharedUniforms);
  const meshes: KeyboardMeshState[] = [];

  for (const child of scene.children) {
    if (!isMesh(child)) continue;

    const isStatic = child.name === "static";

    meshes.push({
      name: child.name,
      geometry: child.geometry,
      rest: child.position.clone(),
      quaternion: child.quaternion.clone(),
      scale: child.scale.clone(),
      pressAxis: LOCAL_PRESS_AXIS.clone().applyQuaternion(child.quaternion),
      depth: 0,
      object: null,
      isStatic,
      material: isStatic
        ? staticMaterial
        : createKeyboardMaterial(sharedUniforms),
    });
  }

  return meshes;
}

function KeyboardModel({ active, onFirstFrame, controls }: KeyboardModelProps) {
  const { scene } = useGLTF(MODEL_URL);
  const [baseTexture, rgbTexture] = useTexture(
    [BASE_TEXTURE_URL, RGB_TEXTURE_URL],
    configureKeyboardTextures,
  );
  const pulseCursorRef = useRef(0);
  const hasRenderedFrameRef = useRef(false);

  const sharedUniforms = useMemo(
    () => createKeyboardSharedUniforms(baseTexture, rgbTexture),
    [baseTexture, rgbTexture],
  );

  const meshes = useMemo(
    () => createMeshStates(scene, sharedUniforms),
    [scene, sharedUniforms],
  );

  const meshByName = useMemo(
    () => new Map(meshes.map((mesh) => [mesh.name, mesh])),
    [meshes],
  );
  const supportedKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const mesh of meshes) {
      if (!mesh.isStatic) keys.add(mesh.name);
    }

    return keys;
  }, [meshes]);

  const triggerPulse = useCallback(
    (code: string) => {
      const mesh = meshByName.get(code);
      if (!mesh?.object) return;

      mesh.object.getWorldPosition(PULSE_WORLD_POSITION);

      const pulseIndex = pulseCursorRef.current;
      sharedUniforms.uPulseCenters.value[pulseIndex].set(
        PULSE_WORLD_POSITION.x,
        PULSE_WORLD_POSITION.z,
      );
      sharedUniforms.uPulseProgress.value[pulseIndex] = 0;
      pulseCursorRef.current = (pulseIndex + 1) % MAX_PULSES;
    },
    [meshByName, sharedUniforms],
  );

  const { pointerEvents, pressedKeysRef } = useKeyboardInput({
    enabled: active,
    supportedKeys,
    onPress: triggerPulse,
  });

  useEffect(() => {
    sharedUniforms.uDefaultLighting.value = controls.defaultLighting;
    sharedUniforms.uLightingIntensity.value = controls.lightingIntensity;
    sharedUniforms.uEasingStrength.value = controls.pulseEasingStrength;
    sharedUniforms.uFeather.value = controls.pulseFeather;
    sharedUniforms.uRadius.value = controls.pulseRadius;
  }, [
    controls.defaultLighting,
    controls.lightingIntensity,
    controls.pulseEasingStrength,
    controls.pulseFeather,
    controls.pulseRadius,
    sharedUniforms,
  ]);

  useEffect(
    () => () => {
      const disposedMaterials = new Set<KeyboardShaderMaterial>();

      for (const mesh of meshes) {
        if (disposedMaterials.has(mesh.material)) continue;
        disposedMaterials.add(mesh.material);
        mesh.material.dispose();
      }
    },
    [meshes],
  );

  useFrame((_, frameDelta) => {
    if (!hasRenderedFrameRef.current) {
      hasRenderedFrameRef.current = true;
      onFirstFrame();
    }

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA);

    for (let index = 0; index < MAX_PULSES; index += 1) {
      const progress = sharedUniforms.uPulseProgress.value[index];
      if (progress < 1) {
        sharedUniforms.uPulseProgress.value[index] = Math.min(
          1,
          progress + delta / controls.pulseDuration,
        );
      }
    }

    for (const mesh of meshes) {
      const targetDepth = pressedKeysRef.current.has(mesh.name)
        ? controls.keyPressDepth
        : 0;

      if (targetDepth === 0 && mesh.depth === 0) continue;

      mesh.depth = THREE.MathUtils.damp(
        mesh.depth,
        targetDepth,
        controls.advanced.keyPressDamping,
        delta,
      );
      if (targetDepth === 0 && mesh.depth < 0.00001) mesh.depth = 0;

      if (mesh.object) {
        mesh.object.position
          .copy(mesh.rest)
          .addScaledVector(mesh.pressAxis, mesh.depth);
      }

      if (!mesh.isStatic) {
        const pressDepth = Math.max(controls.keyPressDepth, 0.0001);
        const pressedAmount = Math.min(1, mesh.depth / pressDepth);
        mesh.material.uniforms.uDim.value =
          1 - pressedAmount * controls.pressedKeyDimming;
      }
    }
  });

  return (
    <group>
      {meshes.map((mesh) => (
        <mesh
          key={mesh.name}
          ref={(object) => {
            mesh.object = object;
          }}
          name={mesh.name}
          geometry={mesh.geometry}
          material={mesh.material}
          position={mesh.rest}
          quaternion={mesh.quaternion}
          scale={mesh.scale}
          {...(mesh.isStatic ? {} : pointerEvents)}
        />
      ))}
    </group>
  );
}

export default function Scene({
  active = true,
  inView = true,
  prefersReducedMotion = false,
  onReady,
}: SceneProps) {
  const controls = useDialKit("Settings", SCENE_CONFIG, {
    id: "raycast-keyboard-scene",
  });
  const [renderReady, setRenderReady] = useState(false);

  const handleFirstFrame = useEventCallback(() => {
    setRenderReady(true);
    onReady?.();
  });

  const sceneActive = active && renderReady;
  const frameloop = !renderReady || (inView && active) ? "always" : "demand";

  return (
    <>
      <div className="absolute inset-0 z-2 size-full touch-none">
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
          />
          <Suspense fallback={null}>
            <KeyboardModel
              active={sceneActive}
              onFirstFrame={handleFirstFrame}
              controls={controls}
            />
          </Suspense>
        </Canvas>
      </div>
      <DebugPanel />
    </>
  );
}

useGLTF.preload(MODEL_URL);
useTexture.preload([BASE_TEXTURE_URL, RGB_TEXTURE_URL]);
