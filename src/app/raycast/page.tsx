import { Hero } from "@/components/raycast/hero"

/** 承载固定视口的 Raycast 场景。 */
export default function RaycastPage() {
  return (
    <div className="h-full">
      <main className="h-full">
        <Hero />
      </main>
    </div>
  )
}
