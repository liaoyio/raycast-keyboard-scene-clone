# Raycast Keyboard Scene — Next.js 复刻

这是一个使用 **Next.js App Router + TypeScript + React Three Fiber** 编写的可读源码项目。

仓库没有引用 Raycast 线上已经压缩的 JavaScript。浏览器里的 `_next/static/*.js` 是 `next build` 自动生成的部署产物，实际业务逻辑都在 `src/` 中。

## 从哪里开始读

```text
src/
├── app/
│   ├── layout.tsx                 # 页面元数据、next/font/google 和全局布局
│   └── page.tsx                   # 首页 Server Component，仅负责组装页面
└── components/keyboard/           # 键盘页面的 UI、交互和样式统一维护在这里
    ├── styles.css                 # 键盘页面全部布局和视觉样式
    ├── Nav.tsx                    # 顶部导航
    ├── Hero.tsx                   # Hero、1000/1001px 断点和场景加载
    ├── VideoDialog.tsx            # 视频弹窗
    ├── Scene.tsx                  # React Three Fiber 场景和键帽动画
    ├── input.ts                   # 实体键盘、点击和拖过多键输入
    ├── shaders.ts                 # RGB 扩散 GLSL Shader
    ├── audio.ts                   # AudioContext 音频精灵播放器
    ├── constants.ts               # 相机、脉冲、按压等参数
    └── soundMap.ts                # 83 键音频切片时间表
```

## 交互链路

```text
KeyboardEvent.code / 鼠标命中 mesh
  → 更新按键按压状态
  → 键帽沿局部轴下沉并变暗
  → 播放对应音频切片
  → 把按键世界坐标写入 Shader
  → 基础纹理与 RGB 纹理按扩散圆形 mask 混合
```

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

`next build` 使用官方 `output: "export"` 生成静态站点，再由 `scripts/prepare-sites-build.mjs` 整理成 Sites 托管所需目录。Inter 通过 `next/font/google` 声明，仓库不保存字体文件。二进制 GLB、纹理和音频位于 `public/assets/`，实现逻辑仍然全部保留为 TypeScript 源码。
