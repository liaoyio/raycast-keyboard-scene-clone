# Raycast Keyboard Scene

一个用 Next.js、React Three Fiber 和 Tailwind CSS 重建 Raycast Keyboard Hero 的学习项目。当前站点通过左侧导航展示 Raycast、Mist 84 雾透版本和 NuPhy Air75 渲染工作台，保留各版本的键盘交互与灯光效果。右上提供全屏预览和浅色／暗黑切换。

站点布局参考 [Rare UI](https://www.rareui.com/components/codeblock)（[源码](https://github.com/swamimalode07/rare-ui)），导航与预览容器在本项目中独立实现。

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
- Raycast 和雾透页在 1000px 及以下使用静态图，不挂载 Three.js 场景；
- 固定桌面场景尺寸、首帧就绪信号和局部错误降级；
- 离开视口或打开视频时暂停输入与持续帧循环；
- `prefers-reduced-motion`、键盘焦点和原生滚动行为适配；
- Raycast 默认显示 Dialkit 原生入口；Mist 和 Air75 设置抽屉提供素材替换和 inline 调参。

Mist 页面默认使用 2026-10-12 提供的 GLB 与 Base／RGB 两态 UV 示例，支持切换 `0923 UV`、单文件替换和批量导入。灯效与 Raycast 对齐，使用扩散波纹并保留键程，支持背景颜色与两色渐变调节；原「雾透白灯」五层缓存方案已移除。Blender 工程仅在本地保留为历史制作源，由 Git 忽略，不随网站发布。

本项目围绕键盘 Hero 交互、版本预览和素材工作台展开，不包含完整官网、购买流程、键盘固件或真实硬件通信。

## 体验交互

桌面端打开在线预览后，可以这样测试：

1. 点击任意键帽，观察位移、声音和 RGB 脉冲是否同时触发；
2. 按住鼠标拖过多枚键帽，检查旧键释放和新键接管；
3. 使用实体键盘输入，模型会按 `KeyboardEvent.code` 查找同名 Mesh；
4. 点击右上角 Dialkit 原生入口，展开实时调参面板；
5. 把窗口缩到 1000px，再放大到 1001px，观察静态图与 3D 场景切换。

## 技术栈

| 模块       | 选择                                            |
| ---------- | ----------------------------------------------- |
| 应用框架   | Next.js 16 App Router、React 19、TypeScript 5.9 |
| 样式       | Tailwind CSS 4、`cn`、`next-themes`                |
| 3D         | Three.js、React Three Fiber、Drei               |
| 声音       | Web Audio API、OGG 音频精灵                     |
| 调参       | Dialkit                                         |
| 通用 Hooks | `usehooks-ts`                                   |
| 检查与测试 | ESLint、TypeScript、Vitest                       |
| 部署       | Next.js 静态导出、OpenAI Sites 托管适配         |

## 本地运行

建议使用 Node.js 24 LTS（24.15.0 及以上）和 npm。Next.js 的最低要求是 20.9.0，但当前 Vitest 5 和 Lint 依赖要求更高；其中 `eslint-plugin-jsdoc` 声明支持 `^22.22.2 || >=24.15.0`。依赖版本由 `package-lock.json` 锁定。

本轮类型检查、Lint、构建和测试在 Node.js 24.13.0 上通过，但该版本低于部分依赖声明的范围，安装时仍会出现 engine 警告。新环境请使用上述推荐版本。

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
| `npm run lint`            | 检查源码、脚本和测试的规则与格式                         |
| `npm run lint:fix`        | 自动修复可安全调整的 Lint 与格式问题                     |
| `npm test`               | 使用 Vitest 运行全仓回归测试；Sites 用例需要先完成 build |
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
├── app/                         # 页面入口；首页跳转到 /raycast
│   ├── raycast/
│   ├── nuphy-mist84/
│   └── nuphy-air75/
├── components/
│   ├── raycast/                 # Raycast Hero、场景和配置
│   ├── mist/                    # 雾透 Hero、场景和键位映射
│   ├── air75/                   # 工作台、资源加载和调参
│   ├── shared/                  # 输入、音频、渲染和视频弹窗
│   ├── site/                    # 版本导航与预览布局
│   └── icons/
└── utils/
public/assets/
├── raycast/                     # Raycast 页面素材
├── mist/                        # 雾透页面素材
├── air75/                       # 工作台模型、黑白贴图和渲染图
└── common/                      # 背景、声音和 Draco 解码器
```

模型、纹理、声音和静态图位于 `public/assets/`。共用的背景、按键声音和 Draco 解码器集中在 `public/assets/common/`；各页面的专用素材分别放在对应目录；Mist 的 `ux-0923/` 保留用户指定的原目录与文件名。贴图以 `texture-` 开头，渲染图以 `render-` 开头，演示素材以 `demo-` 开头。完整的输入状态机、按压计算、Shader 数学、加载策略和排错方法见[《Raycast 键盘交互实现拆解》](docs/keyboard-interaction.md)。Mist 的旧光学制作记录见[《雾透键盘动画适配》](docs/mist-keyboard-adaptation.md)；旧 Air75 V3 的素材测量保存在[历史分析](docs/air75-asset-and-animation-analysis.md)中。

## 代码约定

- 自有源码、脚本和测试使用 kebab-case；Next.js 约定名称和第三方分发文件保持原名。
- 组件样式使用 Tailwind utilities。`globals.css` 保留主题变量、命名关键帧及已注明原因的 Dialkit 兼容规则。
- 条件类使用共享 `cn()`。超过 150 字符的 `className` 按用途分段，避免长模板字符串和大段样式常量。
- 类型超过四个字段时移出函数签名。紧密相关的小组件放在同一模块，资源加载等独立职责再拆文件；函数注释用简短中文说明职责或限制。
- 媒体查询、事件监听、可视区观察等通用行为优先使用 `usehooks-ts`。项目内 Hook 只保留输入状态机、Web Audio 生命周期这类领域逻辑。
- 输入和资源生命周期集中管理。高频逐帧数据放在运行时对象和 Shader uniform 中；React state 只保存影响组件树的状态，派生值直接计算。

## 提交改动

提交前至少运行：

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Sites 定向检查可单独运行 `npm run test:sites`。模型、光晕、主题或输入有改动时，还需在浏览器核对对应页面；自动检查不能证明画面已经一致。

## 素材与许可证

Raycast、NuPhy 及相关品牌标识、`public/assets/` 内的 3D 模型、纹理、静态渲染和按键录音，其权利归各自权利人所有。本仓库仅将它们用于技术学习和效果验证；公开分发或商业使用前，需要自行确认授权范围。相关权利人如需移除素材，可以通过 [GitHub Issues](https://github.com/liaoyio/raycast-keyboard-scene-clone/issues) 联系维护者。

`public/fonts/inter-latin.woff2` 使用开源、可商用的 Inter 字体。

仓库目前没有 `LICENSE` 文件，也尚未为项目原创源码选择开源许可证。如果要以开源项目的方式对外发布，需要先明确源码许可边界；素材权利仍需单独处理。
