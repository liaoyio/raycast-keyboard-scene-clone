# Raycast Keyboard `sceneSlot` 复刻 QA

**Findings**

- 当前无待处理的 P0、P1、P2 差异。
- [P3] Three.js 依赖警告
  - 位置：React Three Fiber 运行时。
  - 证据：桌面控制台 0 个 error，出现 `THREE.Clock` 已弃用 warning；移动端 0 个 error/warning。
  - 影响：不影响渲染、交互和构建，后续升级 R3F/Three 时需要复测。
  - 处理：本轮保留已验证版本，避免为消除非功能警告引入视觉漂移。
- [P3] 源站桌面背景图在本次浏览器捕获中请求失败
  - 位置：桌面 `sceneSlot` 的 1200 × 304 背景层。
  - 证据：源站桌面截图出现浏览器破图占位；源 CSS、资源 URL、尺寸和原始资产均已单独核验。本地实现使用该真实资源的本地副本并正常显示。
  - 影响：源站捕获中的破图属于取证环境状态，不能作为目标视觉；键盘、排版、响应式和交互对照不受影响。

## 比较目标

- 源视觉真值
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/source-desktop-1440x900.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/source-mobile-390x844.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/source-key-a-1440x900.png`
  - 在线源：`https://www.raycast.com/keyboard`
- 实现截图
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/implementation-desktop-1440x900.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/implementation-mobile-390x844.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/implementation-key-a-1440x900.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/implementation-pointer-a-1440x900.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/implementation-video-dialog-1440x900.png`
- 组合比较证据
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/comparison-desktop.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/comparison-mobile.png`
  - `/Users/liaoyi/Desktop/study/raycast-keyboard-scene-clone/qa/comparison-key-a.png`

## 视口与密度归一化

| 状态 | 源像素 | 实现像素 | CSS 视口 | 密度 |
|---|---:|---:|---:|---:|
| 桌面静止态 | 1440 × 900 | 1440 × 900 | 1440 × 900 | DPR 1 |
| 移动静止态 | 390 × 844 | 390 × 844 | 390 × 844 | DPR 1 |
| 桌面 A 键触发态 | 1440 × 900 | 1440 × 900 | 1440 × 900 | DPR 1 |

源与实现使用相同 CSS 视口、像素尺寸和 DPR，无缩放归一化。桌面截图位于页面顶部，等待首屏入场动画完成；按键态在相同首屏位置触发。

## 全视图比较

- 桌面：导航框为 1204 × 76，Hero 内容框为 1000 × 282.84375，`sceneSlot` 为 1425 × 400；源与实现的 x/y/宽高一致。
- 移动：导航框为 345 × 55，Hero 内容框为 375 × 359.84375，标题为 335 × 100，CTA 组为 356.21875 × 36，`sceneSlot` 从 y=583.84375 开始；源与实现一致。
- 响应式：1000px 时仅渲染静态图且无 Canvas；1001px 时卸载静态图并挂载 Three Canvas，断点与源站一致。

## 聚焦区域比较

- CTA：最终主按钮 208.0078125px，视频按钮 133.2109375px，间距 15px；字重、字距、价格分隔线、阴影和播放图标均与源站计算样式对齐。
- 键盘：使用同一 GLB、基础纹理、RGB 纹理和相机参数；A 键的键帽下沉、变暗和局部黄绿脉冲已在组合图中对照。
- 静态回退：移动端使用源 1447 × 595 产品图，宽度 375px，自然高度约 154.2px；与源图构图一致。
- 视频：点击后加载源站同一 YouTube embed URL 和标题，遮罩点击与关闭按钮均可关闭。

## 五项保真面

- 字体与排版：Inter；标题 50/50、500、-1.25px；副标题 18/27；CTA 14/16、500、0.2px；桌面和移动端换行一致。
- 间距与布局节奏：Hero 顶部 192px、内容 gap 16px、CTA 上间距 30px、内容底部 32px、场景 400px；源与实现的测量值一致。
- 色彩与视觉 token：背景 `#07080a`，副标题 60% 白，说明 40% 白；按钮渐变、描边式阴影、键盘红色高光及底部融合渐变已核对。
- 图像质量与资产保真：使用真实 SVG 标志、GLB、两张 2048 × 2048 烘焙纹理、1447 × 595 静态键盘图、1200 × 304 背景图和 OGG 音频精灵，无占位图或代码绘制替代品。
- 文案与内容：标题、副标题、价格、售罄说明、CTA 和视频标题与当前源站一致。

## 状态与交互验证

- 实体键盘 `A`：对应 mesh 下沉、变暗、触发 0.9s RGB 脉冲并播放对应音频切片。
- 鼠标点击 `A`：对应 mesh 触发同一反馈。
- 鼠标按住并滑过多键：A → S → D → F 连续触发，抬起后全部回弹。
- 视频按钮：弹窗打开；iframe URL/标题正确；关闭按钮有效。
- 桌面/移动断点：1000px 静态、1001px 3D。
- 控制台：0 个应用 error；桌面仅有 1 类 R3F 内部弃用 warning；无 Vite/Next 错误遮罩。

## 比较历史

### 第 1 轮

- [P2] CTA 的宽度、字重、播放图标和表面样式有漂移；移动端 CTA 被压缩为 335px，源站为 356.21875px。
- 修复：将按钮字重/字距改为 500/0.2px；按源站重建价格 span 的 700 字重、10px 右内边距和 1px 分隔线；复刻两类按钮阴影；移除移动端 flex 压缩；修正外链 SVG 的白色播放图标。
- 修复后证据：`comparison-desktop.png`、`comparison-mobile.png`；CTA 四个关键宽度与源站计算值完全一致。

### 第 2 轮

- 同尺寸组合比较未发现新的 P0/P1/P2 差异。
- `comparison-key-a.png` 确认按键定位、纹理混合和局部发光方向一致；脉冲截图的扩散范围会受捕获时点影响，运行参数已与源脚本逐项对齐。

## 实现检查清单

- [x] 桌面 3D 场景与按键/鼠标交互
- [x] 83 键音频精灵毫秒映射
- [x] RGB 世界坐标脉冲与键帽回弹
- [x] 1000/1001 响应式降级
- [x] 视频弹窗
- [x] 桌面/移动同尺寸视觉对照
- [x] 浏览器控制台检查
- [x] 生产构建与 Sites 包装测试

final result: passed
