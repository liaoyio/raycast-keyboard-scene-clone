"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import {
  BASE_TEXTURE_URL,
  CAMERA_LOOK_AT,
  CAMERA_START,
  CAMERA_TARGET_POSITION,
  KEY_PRESS_DEPTH,
  LOCAL_PRESS_AXIS,
  MAX_FRAME_DELTA,
  MAX_PULSES,
  MODEL_URL,
  PRESSED_KEY_DIMMING,
  PULSE_DURATION,
  RGB_TEXTURE_URL,
} from "./constants";
import { useKeyboardInput } from "./input";
import {
  configureKeyboardTextures,
  createKeyboardMaterial,
  createKeyboardSharedUniforms,
  type KeyboardShaderMaterial,
  type KeyboardSharedUniforms,
} from "./shaders";

export interface SceneProps {
  active?: boolean;
  onReady?: () => void;
}

type MutableValueRef<T> = { current: T };

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
  readyRef: MutableValueRef<boolean>;
  activeRef: MutableValueRef<boolean>;
}

interface KeyboardModelProps {
  active: boolean;
  activeRef: MutableValueRef<boolean>;
  onReadyRef: MutableValueRef<(() => void) | undefined>;
  readyRef: MutableValueRef<boolean>;
}

const CANVAS_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 2,
  touchAction: "none",
};

function isMesh(child: THREE.Object3D): child is THREE.Mesh<THREE.BufferGeometry> {
  return "isMesh" in child && child.isMesh === true;
}

function CameraRig({ readyRef, activeRef }: CameraRigProps) {
  useFrame((state, frameDelta) => {
    if (!readyRef.current || !activeRef.current) return;

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA);
    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x,
      CAMERA_TARGET_POSITION.x,
      4.5,
      delta,
    );
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      CAMERA_TARGET_POSITION.y,
      4.5,
      delta,
    );
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      CAMERA_TARGET_POSITION.z,
      4.5,
      delta,
    );
    state.camera.lookAt(CAMERA_LOOK_AT);
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

function KeyboardModel({
  active,
  activeRef,
  onReadyRef,
  readyRef,
}: KeyboardModelProps) {
  const { scene } = useGLTF(MODEL_URL);
  const [baseTexture, rgbTexture] = useTexture(
    [BASE_TEXTURE_URL, RGB_TEXTURE_URL],
    configureKeyboardTextures,
  );
  const pulseCursorRef = useRef(0);

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

  const triggerPulse = useCallback(
    (code: string) => {
      const mesh = meshByName.get(code);
      if (!mesh) return;

      const pulseIndex = pulseCursorRef.current;
      sharedUniforms.uPulseCenters.value[pulseIndex].set(
        mesh.rest.x,
        mesh.rest.z,
      );
      sharedUniforms.uPulseProgress.value[pulseIndex] = 0;
      pulseCursorRef.current = (pulseIndex + 1) % MAX_PULSES;
    },
    [meshByName, sharedUniforms],
  );

  const { pointerEvents, pressedKeysRef } = useKeyboardInput({
    enabled: active,
    onPress: triggerPulse,
  });

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
    if (!readyRef.current) {
      readyRef.current = true;
      activeRef.current = active;
      onReadyRef.current?.();
    }

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA);

    for (let index = 0; index < MAX_PULSES; index += 1) {
      const progress = sharedUniforms.uPulseProgress.value[index];
      if (progress < 1) {
        sharedUniforms.uPulseProgress.value[index] = Math.min(
          1,
          progress + delta / PULSE_DURATION,
        );
      }
    }

    for (const mesh of meshes) {
      const targetDepth = pressedKeysRef.current.has(mesh.name)
        ? KEY_PRESS_DEPTH
        : 0;

      if (targetDepth === 0 && mesh.depth === 0) continue;

      mesh.depth = THREE.MathUtils.damp(mesh.depth, targetDepth, 55, delta);
      if (targetDepth === 0 && mesh.depth < 0.00001) mesh.depth = 0;

      if (mesh.object) {
        mesh.object.position
          .copy(mesh.rest)
          .addScaledVector(mesh.pressAxis, mesh.depth);
      }

      if (!mesh.isStatic) {
        const pressedAmount = Math.min(1, mesh.depth / KEY_PRESS_DEPTH);
        mesh.material.uniforms.uDim.value =
          1 - pressedAmount * PRESSED_KEY_DIMMING;
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
  onReady,
}: SceneProps) {
  const readyRef = useRef(false);
  const activeRef = useRef(active);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  return (
    <Canvas
      flat
      camera={{ position: CAMERA_START, fov: 20 }}
      dpr={[1, 2]}
      resize={{ offsetSize: true }}
      style={CANVAS_STYLE}
    >
      <CameraRig readyRef={readyRef} activeRef={activeRef} />
      <Suspense fallback={null}>
        <KeyboardModel
          active={active}
          activeRef={activeRef}
          onReadyRef={onReadyRef}
          readyRef={readyRef}
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
useTexture.preload([BASE_TEXTURE_URL, RGB_TEXTURE_URL]);
