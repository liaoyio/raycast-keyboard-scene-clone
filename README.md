# Raycast Keyboard Scene — Next.js 复刻

这是一个使用 **Next.js App Router + TypeScript + Tailwind CSS + React Three Fiber** 编写的可读源码项目。

仓库没有引用 Raycast 线上已经压缩的 JavaScript。浏览器里的 `_next/static/*.js` 是 `next build` 自动生成的部署产物，实际业务逻辑都在 `src/` 中。

## 从哪里开始读

```text
public/
└── fonts/
    └── inter-latin.woff2          # 由 next/font/local 编译和预加载的 Inter 可变字体
src/
├── app/
│   ├── globals.css                # Tailwind 导入、主题 token 和命名 keyframes
│   ├── layout.tsx                 # 页面元数据、next/font/local 和全局布局
│   └── page.tsx                   # 首页 Server Component，仅负责组装页面
├── components/keyboard/           # 键盘页面的 UI 和领域交互
│   ├── button.tsx                 # 链接/按钮的共享 Tailwind 变体
│   ├── nav.tsx                    # 响应式顶部导航
│   ├── hero.tsx                   # Hero、1000/1001px 断点和场景加载
│   ├── video-dialog.tsx           # 视频弹窗
│   ├── scene.tsx                  # React Three Fiber 场景和键帽动画
│   ├── scene-error-boundary.tsx   # 场景资源或 WebGL 失败时的局部降级
│   ├── input.ts                   # 实体键盘与指针输入的领域状态机
│   ├── audio.ts                   # AudioContext 音频精灵资源生命周期
│   ├── shaders.ts                 # RGB 扩散 GLSL Shader
│   ├── constants.ts               # 相机、脉冲、按压等参数
│   ├── debug.tsx                  # 场景参数调试面板
│   └── sound-map.ts               # 83 键音频切片时间表
└── utils/
    └── cn.ts                       # 基于 cnfast 的条件 Tailwind 类合并工具
```

## 样式与 Hooks 边界

`src/app/globals.css` 是项目自有样式的唯一 CSS 入口，只保留 Tailwind CSS 导入、`@theme` token 和命名 `@keyframes`。布局、间距、颜色、响应式、状态及伪元素样式都直接由各组件的 Tailwind utilities 表达；只在条件类合并时使用 `src/utils/cn.ts` 的 `cn`，由 `cnfast` 负责条件展开与 Tailwind 冲突合并。

媒体查询、可视区观察、通用事件监听和页面滚动锁定使用 `usehooks-ts`。`input.ts` 的 `useKeyboardInput` 与 `audio.ts` 的 `useKeyAudio` 保留为项目内 Hook，因为它们分别封装了多输入源所有权状态机和 Web Audio 资源生命周期，而不是对通用 React/浏览器行为的薄封装。

实体键盘输入不会接管链接、按钮、表单控件等交互目标。焦点位于非交互内容时，方向键与 Space 可以驱动键盘光效，同时保留浏览器的原生滚动。

## 交互链路

```text
KeyboardEvent.code / 鼠标命中 mesh
  → 更新按键按压状态
  → 键帽沿局部轴下沉并变暗
  → 播放对应音频切片
  → 把按键世界坐标写入 Shader
  → 基础纹理与 RGB 纹理按扩散圆形 mask 混合
```

更完整的实现原理、Shader 数学、输入状态机、性能取舍与验证清单见：

- [键盘交互实现拆解](docs/keyboard-interaction.md)

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 验证

```bash
npm run typecheck
npm run build
npm run test:sites
npx react-doctor@latest
```

`next build` 使用官方 `output: "export"` 生成静态站点，再由 `scripts/prepare-sites-build.mjs` 整理成 Sites 托管所需目录。Inter 字体固定在 `public/fonts/`，由 `next/font/local` 在构建时生成带 hash 的字体资源并自动预加载，不依赖 Google Fonts。二进制 GLB、纹理和音频位于 `public/assets/`，实现逻辑仍然全部保留为 TypeScript 源码。
