import assert from "node:assert/strict"
import { access } from "node:fs/promises"
import { it } from "vitest"
import worker from "../worker/index.js"

it("serves existing static assets without a fallback", async () => {
  const calls: string[] = []
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request: Request) => {
        calls.push(new URL(request.url).pathname)
        return new Response("asset", { status: 200 })
      },
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["/assets/app.js"])
})

it("falls back to index.html for an unknown app route", async () => {
  const calls: string[] = []
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request: Request) => {
          const url = new URL(request.url)
          calls.push(url.pathname + url.search)
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          })
        },
      },
    },
  )

  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"])
})

it("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1
          return new Response("missing", { status: 404 })
        },
      },
    })

    assert.equal(response.status, 404)
    assert.equal(calls, 1)
  }
})

it("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url))
  await access(new URL("../dist/server/index.js", import.meta.url))
  await access(new URL("../dist/.openai/hosting.json", import.meta.url))
  await access(new URL("../dist/client/assets/mist/keyboard-1012.glb", import.meta.url))
  await access(new URL("../dist/client/assets/mist/texture-base-1012.png", import.meta.url))
  await assert.rejects(access(new URL("../dist/client/assets/mist/mist-moonbow-bright-white.blend", import.meta.url)), { code: "ENOENT" })
})
