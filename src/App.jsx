import { lazy, Suspense, useState, useSyncExternalStore } from "react";

const KeyboardScene = lazy(() => import("./KeyboardScene.jsx"));
const DESKTOP_QUERY = "(min-width: 1001px)";

function subscribeToDesktopQuery(callback) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getServerDesktopSnapshot() {
  return false;
}

function useDesktopScene() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
}

function RaycastNav() {
  const links = ["Store", "Pro", "AI", "iOS", "Windows", "Teams", "Enterprise", "Blog", "Pricing"];

  return (
    <header className="nav-shell">
      <nav className="navbar" aria-label="Primary navigation">
        <a className="brand" href="https://www.raycast.com/" aria-label="Raycast">
          <img src="/assets/raycast-logo.svg" alt="Raycast" />
        </a>
        <div className="nav-links">
          {links.map((link) => (
            <a key={link} href={`https://www.raycast.com/${link.toLowerCase()}`}>
              {link}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <a className="login-link" href="https://www.raycast.com/users/sign_in">Log in</a>
          <a className="download-button" href="https://www.raycast.com/download/mac">
            <img src="/assets/apple.svg" alt="" aria-hidden="true" />
            Download
          </a>
        </div>
        <button className="menu-button" type="button" aria-label="Open navigation menu">
          <span />
          <span />
          <span />
        </button>
      </nav>
    </header>
  );
}

function VideoDialog({ onClose }) {
  return (
    <div
      className="video-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Introducing the NuPhy × Raycast Keyboard"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="video-dialog">
        <iframe
          src="https://www.youtube.com/embed/73pdeHCGerA?autoplay=1&rel=0"
          title="Introducing the NuPhy × Raycast Keyboard: Limited Edition"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        <button className="dialog-close" type="button" aria-label="Close" onClick={onClose}>×</button>
      </div>
    </div>
  );
}

export function App() {
  const isDesktop = useDesktopScene();
  const [sceneReady, setSceneReady] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="page-shell">
      <RaycastNav />
      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-content">
            <div className="enter-item logos-wrap">
              <img className="collab-logos" src="/assets/raycast-nuphy.svg" alt="Raycast and NuPhy" />
            </div>
            <h1 id="page-title" className="enter-item">The Raycast Keyboard</h1>
            <p className="enter-item hero-subtitle">
              A low-profile mechanical keyboard designed for instant access to your favorite commands.
            </p>
            <div className="enter-item hero-actions">
              <a
                className="waitlist-button"
                href="https://nuphy.com/products/nuphy-air75-v3-raycast-edition?utm_source=raycast&utm_medium=partnership&utm_campaign=raycast_edition_launch&utm_content=store"
              >
                <span className="old-price">$149.95</span>
                Join the waitlist
              </a>
              <button className="video-button" type="button" aria-expanded={videoOpen} onClick={() => setVideoOpen(true)}>
                <img src="/assets/play.svg" alt="" aria-hidden="true" />
                Watch video
              </button>
            </div>
            <p className="enter-item shipping-notice">
              <span>Sold out.</span> Join the waitlist for the next batch.
            </p>
          </div>

          <div className="sceneSlot styles-module__u2wRGq__sceneSlot">
            <div className="static-scene">
              <img className="scene-bg" src="/assets/scene-bg.webp" alt="" aria-hidden="true" />
              <img className="static-keyboard" src="/assets/keyboard-static.png" alt="Raycast mechanical keyboard" />
            </div>
            {isDesktop ? (
              <div className={`scene ${sceneReady ? "scene-ready" : ""}`}>
                <img className="scene-bg" src="/assets/scene-bg.webp" alt="" aria-hidden="true" />
                <Suspense fallback={null}>
                  <KeyboardScene onReady={() => setSceneReady(true)} />
                </Suspense>
              </div>
            ) : null}
          </div>
        </section>
        <div className="after-hero" aria-hidden="true" />
      </main>
      {videoOpen ? <VideoDialog onClose={() => setVideoOpen(false)} /> : null}
    </div>
  );
}
