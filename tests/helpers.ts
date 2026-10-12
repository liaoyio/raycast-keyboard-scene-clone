import type { DialConfig, ResolvedValues } from "dialkit"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

interface LoadOptions {
  globals?: Record<string, unknown>
  expose?: string[]
}
export interface TestElement<Props extends object = Record<string, unknown>> {
  type: unknown
  props: Props & { children?: unknown }
  key?: string | null
}

const require = createRequire(import.meta.url)
const compiledModules = new Map<string, string>()

// 编译结果可以复用；每次加载仍创建独立上下文，隔离测试替身和模块状态。
export function loadModule<T = unknown>(file: string, modules: Record<string, unknown> = {}, { globals = {}, expose = [] }: LoadOptions = {}): T {
  const cacheKey = `${file}:${expose.join(",")}`
  if (!compiledModules.has(cacheKey)) {
    const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), "utf8")
    const extra = expose.length ? `\nexport { ${expose.join(", ")} };` : ""
    const { outputText } = ts.transpileModule(source + extra, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    })
    compiledModules.set(cacheKey, outputText)
  }
  const exports = {}
  runInNewContext(compiledModules.get(cacheKey)!, { exports, require: (name: string) => modules[name] ?? require(name), ...globals })
  return exports as T
}

// 展开文件内的 React 函数组件，断言实际控件而不是组件拆分方式。
export function nodes<Props extends object = Record<string, unknown>>(element: unknown): TestElement<Props>[] {
  if (Array.isArray(element)) { return element.flatMap(item => nodes<Props>(item)) }
  if (!element || typeof element !== "object") { return [] }
  const node = element as TestElement<Props>
  if (typeof node.type === "function") { return nodes<Props>(node.type(node.props)) }
  return [node, ...nodes<Props>(node.props.children)]
}

// 读取 Dialkit 控件初值，忽略只控制分组展示的元数据。
export function resolveControls<T extends DialConfig>(config: T): ResolvedValues<T> {
  function resolve(value: unknown): unknown {
    if (Array.isArray(value)) { return value[0] }
    if (!value || typeof value !== "object") { return value }
    if ("type" in value && value.type === "color" && "default" in value) { return value.default }
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, child]) => [key, resolve(child)]))
  }
  return resolve(config) as ResolvedValues<T>
}
