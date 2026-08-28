import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import KEY_SOUND_MAP, { SOUND_KEY_ALIASES } from "./keySoundMap.js";

const MODEL_URL = "/assets/keyboard.glb";
const BASE_TEXTURE_URL = "/assets/base.jpg";
const RGB_TEXTURE_URL = "/assets/rgb.jpg";
const KEY_SOUND_URL = "/assets/key-sounds.ogg";

const MAX_PULSES = 10;
const PULSE_DURATION = 0.9;
const PULSE_EASING_STRENGTH = 3;
const PULSE_FEATHER = 0.08;
const PULSE_RADIUS = 0.15;
const LIGHTING_INTENSITY = 2;
const DEFAULT_LIGHTING = 0;
const KEY_PRESS_DEPTH = 0.025;
const PRESSED_KEY_DIMMING = 0.4;
const MAX_FRAME_DELTA = 1 / 30;

const CAMERA_START = [0, 4.5, 0];
const CAMERA_TARGET_POSITION = new THREE.Vector3(0, 3.5, 1.5);
const CAMERA_LOOK_AT = new THREE.Vector3(0, 0, 0);
const LOCAL_PRESS_AXIS = new THREE.Vector3(0, -1, 0);

const SUPPORTED_KEY_CODE = /^(Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right))$/;
const LETTER_KEY_CODE = /^Key[A-Z]$/;
const LETTER_SOUND_SLICES = Object.entries(KEY_SOUND_MAP)
  .filter(([code]) => LETTER_KEY_CODE.test(code))
  .map(([, slices]) => slices);

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vWorldXZ;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPosition.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #define MAX_PULSES ${MAX_PULSES}

  uniform sampler2D uBaseMap;
  uniform sampler2D uRgbMap;
  uniform vec2 uPulseCenters[MAX_PULSES];
  uniform float uPulseProgress[MAX_PULSES];
  uniform float uDefaultLighting;
  uniform float uLightingIntensity;
  uniform float uEasingStrength;
  uniform float uFeather;
  uniform float uRadius;
  uniform float uDim;

  varying vec2 vUv;
  varying vec2 vWorldXZ;

  void main() {
    float pulse = 0.0;

    for (int index = 0; index < MAX_PULSES; index++) {
      float progress = clamp(uPulseProgress[index], 0.0, 1.0);
      float easedProgress = 1.0 - pow(1.0 - progress, uEasingStrength);
      float expandingRadius = mix(0.0, uRadius, easedProgress);
      float distanceToPulse = length(vWorldXZ - uPulseCenters[index]);
      float featheredCircle = 1.0 - smoothstep(
        expandingRadius,
        expandingRadius + uFeather,
        distanceToPulse
      );
      float ageFade = 1.0 - easedProgress;
      pulse = max(pulse, featheredCircle * ageFade);
    }

    vec3 baseColor = texture2D(uBaseMap, vUv).rgb;
    vec3 rgbColor = texture2D(uRgbMap, vUv).rgb;
    float pulseLight = pulse * uLightingIntensity;
    float lightingMix = mix(pulseLight, uLightingIntensity, uDefaultLighting);
    vec3 color = mix(baseColor, rgbColor, lightingMix) * uDim;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function configureTexture(texture) {
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
}

function configureTextures(textures) {
  textures.forEach(configureTexture);
}

function makeKeyboardMaterial(sharedUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uDim: { value: 1 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    toneMapped: false,
  });
}

function useKeyAudio() {
  const contextRef = useRef(null);
  const bufferRef = useRef(null);
  const gainRef = useRef(null);
  const sourcesRef = useRef(new Set());

  useEffect(() => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) return undefined;

    const controller = new AbortController();
    const context = new AudioContextConstructor();
    const gain = context.createGain();
    let disposed = false;

    gain.gain.value = 3;
    gain.connect(context.destination);
    contextRef.current = context;
    gainRef.current = gain;

    fetch(KEY_SOUND_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load key sounds (${response.status})`);
        }
        return response.arrayBuffer();
      })
      .then((audioData) => context.decodeAudioData(audioData))
      .then((buffer) => {
        if (!disposed) bufferRef.current = buffer;
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          bufferRef.current = null;
        }
      });

    return () => {
      disposed = true;
      controller.abort();

      for (const source of sourcesRef.current) {
        try {
          source.stop();
        } catch {
          // A source that already ended cannot be stopped again in every browser.
        }
        source.disconnect();
      }

      sourcesRef.current.clear();
      bufferRef.current = null;
      gain.disconnect();
      contextRef.current = null;
      gainRef.current = null;
      void context.close().catch(() => {});
    };
  }, []);

  return useCallback((code, phase) => {
    const context = contextRef.current;
    const buffer = bufferRef.current;
    const gain = gainRef.current;

    if (!context || !buffer || !gain) return;

    const slices =
      KEY_SOUND_MAP[code] ??
      KEY_SOUND_MAP[SOUND_KEY_ALIASES[code]] ??
      LETTER_SOUND_SLICES[Math.floor(Math.random() * LETTER_SOUND_SLICES.length)];
    const slice = slices?.[phase];

    if (!slice) return;

    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    const [startMilliseconds, endMilliseconds] = slice;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    sourcesRef.current.add(source);
    source.onended = () => {
      sourcesRef.current.delete(source);
      source.disconnect();
    };
    source.start(
      context.currentTime,
      startMilliseconds / 1000,
      (endMilliseconds - startMilliseconds) / 1000,
    );
  }, []);
}

function useKeyboardInput({ enabled, onPress, onRelease }) {
  const keyboardKeysRef = useRef(new Set());
  const pointerKeysRef = useRef(new Set());
  const pressedKeysRef = useRef(new Set());
  const pointerKeyRef = useRef(null);
  const pointerDownRef = useRef(false);
  const handlersRef = useRef({ onPress, onRelease });
  const playSound = useKeyAudio();

  handlersRef.current = { onPress, onRelease };

  const press = useCallback((code) => {
    if (pressedKeysRef.current.has(code)) return;

    pressedKeysRef.current.add(code);
    playSound(code, 0);
    handlersRef.current.onPress?.(code);
  }, [playSound]);

  const release = useCallback((code, silent = false) => {
    if (!pressedKeysRef.current.has(code)) return;

    pressedKeysRef.current.delete(code);
    if (!silent) playSound(code, 1);
    handlersRef.current.onRelease?.(code);
  }, [playSound]);

  const releasePointerKeys = useCallback(() => {
    for (const code of pointerKeysRef.current) {
      if (!keyboardKeysRef.current.has(code)) release(code);
    }

    pointerKeysRef.current.clear();
    pointerKeyRef.current = null;
    pointerDownRef.current = false;
  }, [release]);

  const releaseAll = useCallback(() => {
    for (const code of pressedKeysRef.current) release(code, true);

    keyboardKeysRef.current.clear();
    pointerKeysRef.current.clear();
    pointerKeyRef.current = null;
    pointerDownRef.current = false;
  }, [release]);

  useEffect(() => {
    if (!enabled) {
      releaseAll();
      return undefined;
    }

    const controller = new AbortController();
    const listenerOptions = { signal: controller.signal };

    window.addEventListener("keydown", (event) => {
      if (!SUPPORTED_KEY_CODE.test(event.code)) return;

      keyboardKeysRef.current.add(event.code);
      press(event.code);
    }, listenerOptions);

    window.addEventListener("keyup", (event) => {
      if (!SUPPORTED_KEY_CODE.test(event.code)) return;

      keyboardKeysRef.current.delete(event.code);
      if (!pointerKeysRef.current.has(event.code)) release(event.code);
    }, listenerOptions);

    window.addEventListener("pointerup", releasePointerKeys, listenerOptions);
    window.addEventListener("pointercancel", releasePointerKeys, listenerOptions);
    window.addEventListener("blur", releaseAll, listenerOptions);
    document.addEventListener("visibilitychange", releaseAll, listenerOptions);

    return () => {
      controller.abort();
      releaseAll();
    };
  }, [enabled, press, release, releaseAll, releasePointerKeys]);

  const enterPointerKey = useCallback((event) => {
    event.stopPropagation();

    const code = event.object.name;
    if (!code || code === "static" || pointerKeyRef.current === code) return;

    const previousCode = pointerKeyRef.current;
    if (previousCode) {
      pointerKeysRef.current.delete(previousCode);
      if (!keyboardKeysRef.current.has(previousCode)) release(previousCode);
    }

    pointerKeyRef.current = code;
    pointerKeysRef.current.add(code);
    press(code);
  }, [press, release]);

  return {
    pressedKeysRef,
    pointerEvents: useMemo(() => ({
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        pointerDownRef.current = true;
        enterPointerKey(event);
      },
      onPointerMove: (event) => {
        if (pointerDownRef.current || (event.buttons & 1) !== 0) {
          enterPointerKey(event);
        }
      },
      onPointerOver: (event) => {
        if (pointerDownRef.current || (event.buttons & 1) !== 0) {
          enterPointerKey(event);
        }
      },
      onPointerUp: releasePointerKeys,
      onPointerCancel: releasePointerKeys,
    }), [enterPointerKey, releasePointerKeys]),
  };
}

function CameraRig({ readyRef, activeRef }) {
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

function KeyboardModel({ active, activeRef, onReadyRef, readyRef }) {
  const { scene } = useGLTF(MODEL_URL);
  const [baseTexture, rgbTexture] = useTexture(
    [BASE_TEXTURE_URL, RGB_TEXTURE_URL],
    configureTextures,
  );
  const pulseCursorRef = useRef(0);

  const sharedUniforms = useMemo(() => ({
    uBaseMap: { value: baseTexture },
    uRgbMap: { value: rgbTexture },
    uPulseCenters: {
      value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector2()),
    },
    uPulseProgress: { value: Array(MAX_PULSES).fill(1) },
    uDefaultLighting: { value: DEFAULT_LIGHTING },
    uLightingIntensity: { value: LIGHTING_INTENSITY },
    uEasingStrength: { value: PULSE_EASING_STRENGTH },
    uFeather: { value: PULSE_FEATHER },
    uRadius: { value: PULSE_RADIUS },
  }), [baseTexture, rgbTexture]);

  const meshes = useMemo(() => {
    const staticMaterial = makeKeyboardMaterial(sharedUniforms);

    return scene.children
      .filter((child) => child.isMesh)
      .map((child) => {
        const isStatic = child.name === "static";

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
          material: isStatic ? staticMaterial : makeKeyboardMaterial(sharedUniforms),
        };
      });
  }, [scene, sharedUniforms]);

  const meshByName = useMemo(
    () => new Map(meshes.map((mesh) => [mesh.name, mesh])),
    [meshes],
  );

  const triggerPulse = useCallback((code) => {
    const mesh = meshByName.get(code);
    if (!mesh) return;

    const pulseIndex = pulseCursorRef.current;
    sharedUniforms.uPulseCenters.value[pulseIndex].set(mesh.rest.x, mesh.rest.z);
    sharedUniforms.uPulseProgress.value[pulseIndex] = 0;
    pulseCursorRef.current = (pulseIndex + 1) % MAX_PULSES;
  }, [meshByName, sharedUniforms]);

  const { pointerEvents, pressedKeysRef } = useKeyboardInput({
    enabled: active,
    onPress: triggerPulse,
  });

  useEffect(() => () => {
    const disposedMaterials = new Set();

    for (const mesh of meshes) {
      if (disposedMaterials.has(mesh.material)) continue;
      disposedMaterials.add(mesh.material);
      mesh.material.dispose();
    }
  }, [meshes]);

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
      const targetDepth = pressedKeysRef.current.has(mesh.name) ? KEY_PRESS_DEPTH : 0;

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
        mesh.material.uniforms.uDim.value = 1 - pressedAmount * PRESSED_KEY_DIMMING;
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

export default function KeyboardScene({ active = true, onReady }) {
  const readyRef = useRef(false);
  const activeRef = useRef(active);
  const onReadyRef = useRef(onReady);

  activeRef.current = active;
  onReadyRef.current = onReady;

  return (
    <Canvas
      flat
      camera={{ position: CAMERA_START, fov: 20 }}
      dpr={[1, 2]}
      resize={{ offsetSize: true }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 2,
        touchAction: "none",
      }}
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
