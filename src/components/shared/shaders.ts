import * as THREE from "three"

import {
  DEFAULT_LIGHTING,
  LIGHTING_INTENSITY,
  MAX_PULSES,
  PULSE_EASING_STRENGTH,
  PULSE_FEATHER,
  PULSE_RADIUS,
} from "@/components/shared/constants"

interface Uniform<T> { value: T }

export interface KeyboardSharedUniforms {
  uBaseMap: Uniform<THREE.Texture>
  uRgbMap: Uniform<THREE.Texture>
  uPulseCenters: Uniform<THREE.Vector2[]>
  uPulseProgress: Uniform<number[]>
  uDefaultLighting: Uniform<number>
  uLightingIntensity: Uniform<number>
  uEasingStrength: Uniform<number>
  uFeather: Uniform<number>
  uRadius: Uniform<number>
}

export interface KeyboardMaterialUniforms extends KeyboardSharedUniforms {
  uDim: Uniform<number>
}

export type KeyboardShaderMaterial = THREE.ShaderMaterial & {
  uniforms: KeyboardMaterialUniforms
}

export const KEYBOARD_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vWorldXZ;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPosition.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

export const KEYBOARD_FRAGMENT_SHADER = /* glsl */ `
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
`

/** 统一素材色彩空间和 UV 方向，保持 Base 与灯光贴图一致。 */
export function configureKeyboardTexture(texture: THREE.Texture): void {
  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
}

/** 批量配置同一场景的贴图。 */
export function configureKeyboardTextures(textures: THREE.Texture[]): void {
  textures.forEach(configureKeyboardTexture)
}

/** 所有键帽共享波纹参数，避免每次按键逐材质复制状态。 */
export function createKeyboardSharedUniforms(
  baseTexture: THREE.Texture,
  rgbTexture: THREE.Texture,
): KeyboardSharedUniforms {
  return {
    uBaseMap: { value: baseTexture },
    uRgbMap: { value: rgbTexture },
    uPulseCenters: {
      value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector2()),
    },
    uPulseProgress: { value: Array.from<number>({ length: MAX_PULSES }).fill(1) },
    uDefaultLighting: { value: DEFAULT_LIGHTING },
    uLightingIntensity: { value: LIGHTING_INTENSITY },
    uEasingStrength: { value: PULSE_EASING_STRENGTH },
    uFeather: { value: PULSE_FEATHER },
    uRadius: { value: PULSE_RADIUS },
  }
}

/** 每个键帽独立持有压暗值，其余灯效参数共用。 */
export function createKeyboardMaterial(
  sharedUniforms: KeyboardSharedUniforms,
): KeyboardShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uDim: { value: 1 },
    },
    vertexShader: KEYBOARD_VERTEX_SHADER,
    fragmentShader: KEYBOARD_FRAGMENT_SHADER,
    toneMapped: false,
  }) as KeyboardShaderMaterial
}
