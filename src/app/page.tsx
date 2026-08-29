import { Hero } from "@/components/keyboard/hero";
import { Nav } from "@/components/keyboard/nav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-page">
      <Nav />
      <main>
        <Hero />
      </main>
    </div>
  );
}
