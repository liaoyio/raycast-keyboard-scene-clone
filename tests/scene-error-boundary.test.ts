import { expect, it } from "vitest"
import { SceneErrorBoundary } from "../src/components/shared/scene-error-boundary"

it("keeps render failures local and recovers when the scene is remounted", () => {
  const props = { children: "keyboard", fallback: "static preview" }
  const boundary = new SceneErrorBoundary(props)
  expect(boundary.render()).toBe("keyboard")

  boundary.state = SceneErrorBoundary.getDerivedStateFromError()
  expect(boundary.render()).toBe("static preview")
  expect(new SceneErrorBoundary(props).render()).toBe("keyboard")
})
