#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const nextExport = path.join(root, "out")
const dist = path.join(root, "dist")
const worker = path.join(root, "worker", "index.js")
const hosting = path.join(root, ".openai", "hosting.json")

for (const file of [path.join(nextExport, "index.html"), worker, hosting]) {
  if (!existsSync(file)) { throw new Error(`Missing Sites build input: ${file}`) }
}

// 输入齐全后只重建生成目录，源素材仍由 out 和 public 持有。
rmSync(dist, { recursive: true, force: true })
// Blender 是离线源工程，不由网页加载，也不能作为超大静态文件发布。
cpSync(nextExport, path.join(dist, "client"), { recursive: true, filter: source => !source.endsWith(".blend") })
mkdirSync(path.join(dist, "server"), { recursive: true })
mkdirSync(path.join(dist, ".openai"), { recursive: true })
copyFileSync(worker, path.join(dist, "server", "index.js"))
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"))

console.log("Prepared Next.js static export for Sites hosting")
