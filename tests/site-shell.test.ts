import assert from "node:assert/strict"
import { it } from "vitest"
import { loadModule } from "./helpers"

interface LayoutState { collapsed: boolean, mobileOpen: boolean, fullscreen: boolean }
const { layoutReducer } = loadModule<{ layoutReducer: (state: LayoutState, action: { type: "close-navigation" }) => LayoutState }>("site/site-shell.tsx", {
  "next-themes": {},
  "next/link": {},
  "next/navigation": {},
  "usehooks-ts": {},
  "@/components/icons": {},
  "@/utils/cn": {},
}, { expose: ["layoutReducer"] })

it("navigation links close both desktop and mobile navigation without changing fullscreen", () => {
  for (const fullscreen of [false, true]) {
    assert.deepEqual({ ...layoutReducer({ collapsed: false, mobileOpen: true, fullscreen }, { type: "close-navigation" }) }, {
      collapsed: true,
      mobileOpen: false,
      fullscreen,
    })
  }
})
