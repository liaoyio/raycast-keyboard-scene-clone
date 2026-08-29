# Raycast Keyboard Hero 设计验收记录

这份记录保存 2026-08-29 完成的视觉与交互回归。它回答三个问题：页面是否保持参考实现的布局和层级，3D 场景在装载与失败时是否稳定，键盘与移动菜单是否可以正常操作。

这是本机验收归档。截图保存在 Codex 工作目录，没有提交到本仓库，因此 GitHub 和其他机器不能直接打开文中图片。如果后续要将这份记录作为公开验收证据，应把最终截图迁入 `docs/assets/qa/` 并改用相对链接。

结论：通过。已测试状态中没有待处理的 P0、P1 或 P2 问题，文末保留两项不阻塞发布的 P3 说明。

## 验收对象

- 线上版本：<https://raycast-keyboard-scene-clone.oooyi.chatgpt.site/>
- 视觉与交互参考：本次验收保存在本机证据目录中的参考截图
- 参考桌面截图：`qa-reference-1440x900.png`
- 参考移动端截图：`qa-reference-879x900-closed.png`、`qa-reference-879x900-open.png`
- 证据目录：`/Users/liaoyi/.codex/visualizations/2026/08/29/01a04c33-8ab8-7143-a230-8a2de66330b6/raycast-audit`

本次对照的范围是导航、Hero 文案与 CTA、键盘舞台、响应式菜单、首帧装载和错误降级。所有截图的 device scale factor 均为 1。

## 代码范围

| 部分           | 文件                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| 页面与全局入口 | `src/app/page.tsx`、`src/app/layout.tsx`、`src/app/globals.css`             |
| 导航与控件     | `src/components/keyboard/nav.tsx`、`button.tsx`、`video-dialog.tsx`         |
| Hero 与场景    | `src/components/keyboard/hero.tsx`、`scene.tsx`、`scene-error-boundary.tsx` |
| 输入与声音     | `src/components/keyboard/input.ts`、`audio.ts`                              |
| 条件类合并     | `src/utils/cn.ts`，底层使用 `cnfast`                                        |

`globals.css` 只包含 Tailwind 入口、主题变量和命名关键帧。组件布局、断点和状态样式均由 Tailwind utilities 表达；动态类通过共享的 `cn` 合并。媒体查询、可视区、事件监听和滚动锁定使用 `usehooks-ts`，项目内仅保留输入状态机和 Web Audio 生命周期两个领域 Hook。

## 截图矩阵

下表文件名均相对于上述本机证据目录。

| 视口       | 状态                 | 证据                                                      | 结果 |
| ---------- | -------------------- | --------------------------------------------------------- | ---- |
| 1440 × 900 | 桌面，3D 场景就绪    | `qa-comparison-production-1440x900-final.png`             | 通过 |
| 1440 × 900 | 导航与 Hero 局部对照 | `qa-focus-nav-hero-production-final.png`                  | 通过 |
| 879 × 900  | 移动菜单关闭         | `qa-comparison-production-879x900-closed-final.png`       | 通过 |
| 879 × 900  | 移动菜单打开         | `qa-comparison-production-879x900-open-final.png`         | 通过 |
| 320 × 900  | 最窄布局             | `qa-production-320x900-final.png`                         | 通过 |
| 1440 × 900 | 冷启动时间线         | `qa-cold-load-sequence.jpg` 及 0/100/500/1500/4000ms 分帧 | 通过 |
| 1440 × 900 | 强制 GLB 加载失败    | `qa-scene-error-fallback-1440x900.png`                    | 通过 |

## 视觉对照

1440 × 900 桌面截图中，页头容器、Hero 垂直节奏、标题宽度、CTA 尺寸与间距、售罄提示、场景背景、键盘比例和底部渐隐均与参考实现对齐。Inter 使用仓库内字体文件加载，消除了系统回退字体造成的文字宽度偏差。

879 × 900 下，关闭状态的页头、标题换行、CTA、提示文字和静态键盘位置一致。打开菜单后，遮罩范围、背景模糊、链接节奏、分隔线和登录入口保持参考层级。

320 × 900 下未出现横向滚动。两个 CTA 改为纵向排列，宽度均为 250px；静态键盘仍在视口内，没有截断页面主内容。

`Watch video` 使用低对比度深色表面和 25% 白色描边。键盘桌面舞台固定为 400px 高，Three.js 初始化前后不会改变页面几何。

## 装载与错误降级

冷启动分帧结果：

- 0–100ms：Canvas 尚未创建，桌面舞台保留 400px 占位并保持透明；移动端静态图在桌面断点下为 `display: none`。
- 500ms：Canvas 已创建，背景和模型作为同一层开始淡入。
- 1500ms 起：场景完全可见，`aria-busy=false`，键盘尺寸与位置保持稳定。

这个流程没有出现“大尺寸静态图先显示，再替换成较小 3D 模型”的闪跳。

强制把 GLB 地址改为不存在的资源后，局部 Error Boundary 在同一个 400px 舞台中显示尺寸匹配的 WebP。Hero 文案、CTA 和页面路由没有被场景错误中断。

## 交互检查

- 点击 `Watch video` 可以打开原生 dialog 和 YouTube iframe，按 Escape 关闭。
- 焦点位于普通页面内容时，方向键和 Space 会驱动 3D 键盘，同时保留浏览器原生滚动。
- 链接、按钮、表单控件、`contenteditable`、`role="button"` 和 `role="link"` 不会触发场景输入。
- 实体键盘与鼠标同时占用同一键时，必须等两个输入源都释放，键帽才会回弹。
- macOS Command 组合键丢失普通键 `keyup` 时，会在 Meta 松开后清理非修饰键所有权。
- 场景停用时会清空已按下状态并停止接收新的有效输入；Mesh 不再绑定指针处理。
- 879px 移动菜单打开后锁定页面滚动，`aria-expanded=true`；Escape 关闭菜单、恢复滚动并把焦点还给触发按钮。
- 1000px 使用静态 WebP，不创建 Canvas；1001px 起挂载 3D 场景。
- 场景离开视口或视频打开后，输入停用；首帧完成的 Canvas 切换为 demand 渲染。

## 运行时记录

正常线上预览：

- 桌面端只有一条依赖警告：React Three Fiber 仍使用已弃用的 `THREE.Clock`；没有应用错误。
- 879px 与 320px 下控制台无消息。

强制 GLB 失败测试会产生预期内的 404 和 WebGL context loss。它们只属于故障注入场景，不能计入正常运行错误。

## 已修复问题

| 级别 | 问题                                          | 处理                                                      |
| ---- | --------------------------------------------- | --------------------------------------------------------- |
| P1   | 桌面 SSR 先显示大静态键盘，再换成较小模型     | 固定 400px 舞台、预设相机、等待首帧并整层淡入             |
| P1   | 中间宽度和移动端导航缺少完整行为              | 重建三档响应式导航，补齐语义、滚动锁定、Escape 和焦点恢复 |
| P1   | 场景资源错误可能进入路由级错误页              | 增加局部 Error Boundary 和尺寸匹配的静态图                |
| P2   | `Watch video` 表面、描边与交互态偏离参考      | 统一按钮变体，补齐 hover、active、focus-visible           |
| P2   | 远程字体失败导致标题宽度漂移                  | 改用 `next/font/local` 加载仓库内 Inter                   |
| P2   | Hero 后的空白占位造成移动端宽度损失和多余滚动 | 删除占位，并复查 320px、879px 的 scroll width             |

## 保留说明

- P3：自动化键盘操作时，关闭按钮的 focus ring 比参考实现更明显。这是有意保留的无障碍焦点提示，不影响鼠标静止状态。
- P3：`THREE.Clock` 弃用警告来自当前 React Three Fiber 依赖，没有观察到视觉或功能影响。

最终结果：通过。
