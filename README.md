# Raycast Keyboard Scene

一个用 Next.js、React Three Fiber 和 Tailwind CSS 重建 Raycast Keyboard Hero 的学习项目。它聚焦首屏导航、3D 键盘、实体键盘映射、机械键音、RGB 扩散光效，以及桌面与移动端之间的降级策略。

[在线体验](https://raycast-keyboard-scene-clone.oooyi.chatgpt.site/)

> 本项目与 Raycast、NuPhy 没有隶属或授权关系。它用于学习和验证 Web 端 3D 产品交互；仓库中的品牌标识、模型、纹理、静态渲染和录音素材不属于本项目原创内容。

## 为什么做这个项目

我先在 [The Raycast Keyboard 产品页](https://www.raycast.com/keyboard)看到了这段 Hero：按下实体键盘或画面里的键帽，3D 模型会同步下沉，机械键音和 RGB 光效紧接着出现。视觉、输入和声音在一次按键里连成了完整反馈。

后来我读到 Raycast 设计工程师 Thomas Cullen 写的 [制作过程](https://x.com/thomasauros/status/2092977737837244583)。文章讲到了 Blender 模型整理、以 `KeyboardEvent.code` 命名 Mesh、双纹理烘焙、逐键录音和 Shader 光效。这些公开线索给出了清晰的学习路径，于是有了这个复刻。

仓库没有引用 Raycast 线上压缩后的 JavaScript，业务逻辑都保留在 `src/`。当前实现使用 Next.js、TypeScript 和 Tailwind CSS；原作文章使用 TSL 描述光效，本项目则用 GLSL `ShaderMaterial` 完成双纹理混合。

## 已实现

- 桌面端可交互 3D 键盘，支持点击、按住拖动和实体键盘输入；
- 键帽沿自身局部轴下沉，并随键程改变亮度；
- 单个 OGG 音频精灵提供 83 组按下、松开声音切片；
- 最多 10 个并发 RGB 脉冲在 GPU 中计算；
- 响应式导航、移动菜单、视频弹窗和键盘舞台；
- 1000px 及以下使用静态 WebP，不挂载 Three.js 场景；
- 固定桌面场景尺寸、首帧就绪信号和局部错误降级；
- 离开视口或打开视频时暂停输入与持续帧循环；
- `prefers-reduced-motion`、键盘焦点和原生滚动行为适配；
- Konami Code 调出 Dialkit 参数面板。

本项目只复刻产品页的导航和 Hero，不包含完整官网、购买流程、键盘固件、配置软件或真实硬件通信。

## 体验交互

桌面端打开在线预览后，可以这样测试：

1. 点击任意键帽，观察位移、声音和 RGB 脉冲是否同时触发；
2. 按住鼠标拖过多枚键帽，检查旧键释放和新键接管；
3. 使用实体键盘输入，模型会按 `KeyboardEvent.code` 查找同名 Mesh；
4. 输入 `↑ ↑ ↓ ↓ ← → ← → B A`，打开 Dialkit 实时调参；
5. 把窗口缩到 1000px，再放大到 1001px，观察静态图与 3D 场景切换。

## 技术栈

| 模块       | 选择                                            |
| ---------- | ----------------------------------------------- |
| 应用框架   | Next.js 16 App Router、React 19、TypeScript 5.9 |
| 样式       | Tailwind CSS 4、`cnfast`                        |
| 3D         | Three.js、React Three Fiber、Drei               |
| 声音       | Web Audio API、OGG 音频精灵                     |
| 调参       | Dialkit                                         |
| 通用 Hooks | `usehooks-ts`                                   |
| 部署       | Next.js 静态导出、OpenAI Sites 托管适配         |

## 本地运行

需要 Node.js 20.9.0 或更高版本以及 npm。这个下限来自当前安装的 Next.js 16.3.3；依赖版本由 `package-lock.json` 锁定。

```bash
npm ci
npm run dev
```

开发服务器默认运行在 <http://localhost:3000>。

## 常用命令

| 命令                      | 用途                                                     |
| ------------------------- | -------------------------------------------------------- |
| `npm run dev`             | 启动 Next.js 开发服务器                                  |
| `npm run typecheck`       | 运行 TypeScript 类型检查，不生成文件                     |
| `npm run build`           | 静态导出站点，并整理 Sites 托管产物                      |
| `npm run test:sites`      | 检查 Sites Worker 的静态资源与回退契约；需要先完成 build |
| `npx react-doctor@latest` | 扫描 React 项目的结构、性能和可维护性问题                |

构建成功后，应生成以下交付文件：

```text
dist/
├── client/index.html
├── server/index.js
└── .openai/hosting.json
```

## 项目结构

```text
src/
├── app/
│   ├── globals.css              # Tailwind 入口、主题变量和命名关键帧
│   ├── layout.tsx               # 元数据、本地字体和根布局
│   └── page.tsx                 # 首页 Server Component
├── components/keyboard/
│   ├── nav.tsx                  # 响应式导航和移动菜单
│   ├── hero.tsx                 # Hero、断点、装载和降级交接
│   ├── scene.tsx                # R3F 场景、模型和逐帧动画
│   ├── input.ts                 # 实体键盘与指针输入状态机
│   ├── audio.ts                 # Web Audio 资源生命周期
│   ├── shaders.ts               # RGB 扩散 GLSL Shader
│   ├── scene-config.ts          # Dialkit 可调参数
│   └── sound-map.ts             # 音频精灵切片表
├── components/icons/            # 页面使用的本地图标组件
└── utils/cn.ts                  # 基于 cnfast 的条件类合并
public/
├── assets/                       # GLB、纹理、音频和静态渲染
└── fonts/                        # next/font/local 使用的 Inter 字体
```

模型、纹理、声音和静态图位于 `public/assets/`。完整的输入状态机、按压计算、Shader 数学、加载策略和排错方法见[《Raycast 键盘交互实现拆解》](docs/keyboard-interaction.md)，本机视觉回归记录见[《设计验收记录》](design-qa.md)。

## 代码约定

- 所有 `.ts`、`.tsx` 文件使用 kebab-case 命名；Next.js 约定文件继续使用 `page.tsx`、`layout.tsx` 这类框架名称。
- 组件样式使用 Tailwind utilities。`globals.css` 只保留 Tailwind 入口、主题变量和无法用 utility 表达的命名关键帧。
- 动态或较长的条件类使用 `src/utils/cn.ts`，不要手写模板字符串拼接，也不要把大段 class 声明成常量。
- 媒体查询、事件监听、可视区观察等通用行为优先使用 `usehooks-ts`。项目内 Hook 只保留输入状态机、Web Audio 生命周期这类领域逻辑。
- 高频逐帧数据放在 ref、Three 对象和 Shader uniform 中；React state 只承载需要影响组件树的低频状态。

## 提交改动

提交前至少运行：

```bash
npm run typecheck
npm run build
npm run test:sites
npx react-doctor@latest
```

## 素材与许可证

Raycast、NuPhy 及相关品牌标识、`public/assets/` 内的 3D 模型、纹理、静态渲染和按键录音，其权利归各自权利人所有。本仓库仅将它们用于技术学习和效果验证；公开分发或商业使用前，需要自行确认授权范围。相关权利人如需移除素材，可以通过 [GitHub Issues](https://github.com/liaoyio/raycast-keyboard-scene-clone/issues) 联系维护者。

`public/fonts/inter-latin.woff2` 使用开源、可商用的 Inter 字体。

仓库目前没有 `LICENSE` 文件，也尚未为项目原创源码选择开源许可证。如果要以开源项目的方式对外发布，需要先明确源码许可边界；素材权利仍需单独处理。
