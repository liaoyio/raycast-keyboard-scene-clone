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
  CAMERA_START,
  LOCAL_PRESS_AXIS,
  MAX_FRAME_DELTA,
  MAX_PULSES,
  MODEL_URL,
  RGB_TEXTURE_URL,
} from "./constants";
import { useKeyboardInput } from "./input";
import { useSceneControls, type SceneControls } from "./debug";
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
  controls: SceneControls["camera"];
}

interface KeyboardModelProps {
  active: boolean;
  activeRef: MutableValueRef<boolean>;
  onReadyRef: MutableValueRef<(() => void) | undefined>;
  readyRef: MutableValueRef<boolean>;
  controls: SceneControls;
}

const CANVAS_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: 2,
  touchAction: "none",
};

const CAMERA_LOOK_AT_VECTOR = new THREE.Vector3();
const PULSE_WORLD_POSITION = new THREE.Vector3();

function isMesh(child: THREE.Object3D): child is THREE.Mesh<THREE.BufferGeometry> {
  return "isMesh" in child && child.isMesh === true;
}

function CameraRig({ readyRef, activeRef, controls }: CameraRigProps) {
  useFrame((state, frameDelta) => {
    if (!readyRef.current || !activeRef.current) return;

    const delta = Math.min(frameDelta, MAX_FRAME_DELTA);
    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x,
      controls.targetX,
      controls.damping,
      delta,
    );
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      controls.targetY,
      controls.damping,
      delta,
    );
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      controls.targetZ,
      controls.damping,
      delta,
    );

    if (state.camera instanceof THREE.PerspectiveCamera) {
      if (state.camera.fov !== controls.fov) {
        state.camera.fov = controls.fov;
        state.camera.updateProjectionMatrix();
      }
    }

    state.camera.lookAt(
      CAMERA_LOOK_AT_VECTOR.set(
        controls.lookAtX,
        controls.lookAtY,
        controls.lookAtZ,
      ),
    );
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
  controls,
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
        const pressedAmount = Math.min(
          1,
          mesh.depth / pressDepth,
        );
        mesh.material.uniforms.uDim.value =
          1 - pressedAmount * controls.pressedKeyDimming;
      }
    }
  });

  return (
    <group
      position={[
        controls.model.positionX,
        controls.model.positionY,
        controls.model.positionZ,
      ]}
      rotation={[
        THREE.MathUtils.degToRad(controls.model.rotationX),
        THREE.MathUtils.degToRad(controls.model.rotationY),
        THREE.MathUtils.degToRad(controls.model.rotationZ),
      ]}
      scale={controls.model.scale}
    >
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
  const controls = useSceneControls();
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
      camera={{ position: CAMERA_START, fov: controls.camera.fov }}
      dpr={[1, 2]}
      resize={{ offsetSize: true }}
      style={CANVAS_STYLE}
    >
      <CameraRig
        readyRef={readyRef}
        activeRef={activeRef}
        controls={controls.camera}
      />
      <Suspense fallback={null}>
        <KeyboardModel
          active={active}
          activeRef={activeRef}
          onReadyRef={onReadyRef}
          readyRef={readyRef}
          controls={controls}
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
useTexture.preload([BASE_TEXTURE_URL, RGB_TEXTURE_URL]);
