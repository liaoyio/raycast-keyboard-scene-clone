import * as THREE from "three";

// 所有运行时资源都放在 /public/assets，交由 Next.js 按原始文件直接提供。
export const MODEL_URL = "/assets/keyboard.glb";
export const BASE_TEXTURE_URL = "/assets/base.jpg";
export const RGB_TEXTURE_URL = "/assets/rgb.jpg";
export const KEY_SOUND_URL = "/assets/key-sounds.ogg";

// 以下光效参数依据 Raycast 键盘场景还原。
export const MAX_PULSES = 10;
export const PULSE_DURATION = 0.9;
export const PULSE_EASING_STRENGTH = 3;
export const PULSE_FEATHER = 0.08;
export const PULSE_RADIUS = 0.15;
export const LIGHTING_INTENSITY = 2;
export const DEFAULT_LIGHTING = 0;

// 每个键帽沿自身局部坐标系的向下轴移动，并在按下时降低亮度。
export const KEY_PRESS_DEPTH = 0.025;
export const PRESSED_KEY_DIMMING = 0.4;

// 限制单帧时间增量，避免页面从后台恢复后阻尼动画发生跳变。
export const MAX_FRAME_DELTA = 1 / 30;

export const CAMERA_START: [number, number, number] = [0, 4.5, 0];
export const CAMERA_TARGET_POSITION = new THREE.Vector3(0, 3.5, 1.5);
export const CAMERA_LOOK_AT = new THREE.Vector3(0, 0, 0);
export const LOCAL_PRESS_AXIS = new THREE.Vector3(0, -1, 0);

// 源交互只响应字母、数字和方向键。
export const SUPPORTED_KEY_CODE =
  /^(Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right))$/;
