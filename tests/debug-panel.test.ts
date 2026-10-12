import assert from "node:assert/strict"
import { it } from "vitest"
import { loadModule } from "./helpers"

it("dialkit native entry is mounted by default and initially collapsed", () => {
  let resolvedTheme = "light"
  const { DebugPanel } = loadModule<typeof import("../src/components/shared/debug")>("shared/debug.tsx", {
    "dialkit": { DialRoot: "DialRoot" },
    "next-themes": { useTheme: () => ({ resolvedTheme }) },
  })
  const root = DebugPanel()
  assert.equal(root.type, "DialRoot")
  assert.equal(root.props.productionEnabled, true)
  assert.equal(root.props.defaultOpen, false)
  assert.equal(root.props.onOpenChange, undefined)
  assert.equal(root.props.theme, "light")
  resolvedTheme = "dark"
  assert.equal(DebugPanel().props.theme, "dark")
})
