import { Hero } from "@/components/keyboard/Hero";
import { Nav } from "@/components/keyboard/Nav";

export default function HomePage() {
  return (
    <div className="page-shell">
      <Nav />
      <main>
        <Hero />
        <div className="after-hero" aria-hidden="true" />
      </main>
    </div>
  );
}
