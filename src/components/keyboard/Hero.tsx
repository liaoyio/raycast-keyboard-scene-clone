"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useState, useSyncExternalStore } from "react";

import { VideoDialog } from "./VideoDialog";

const DESKTOP_QUERY = "(min-width: 1001px)";
const Scene = dynamic(() => import("./Scene"), {
  loading: () => null,
  ssr: false,
});

function subscribeToDesktopQuery(callback: () => void) {
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
  return useSyncExternalStore(subscribeToDesktopQuery, getDesktopSnapshot, getServerDesktopSnapshot);
}

export function Hero() {
  const isDesktop = useDesktopScene();
  const [sceneReady, setSceneReady] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const markSceneReady = useCallback(() => setSceneReady(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  return (
    <>
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-content">
          <div className="enter-item logos-wrap">
            <Image
              className="collab-logos"
              src="/assets/raycast-nuphy.svg"
              alt="Raycast and NuPhy"
              width={95}
              height={30}
              priority
            />
          </div>

          <h1 id="page-title" className="enter-item">
            The Raycast Keyboard
          </h1>

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
              <Image src="/assets/play.svg" alt="" aria-hidden="true" width={16} height={16} />
              Watch video
            </button>
          </div>

          <p className="enter-item shipping-notice">
            <span>Sold out.</span> Join the waitlist for the next batch.
          </p>
        </div>

        <div
          className={`sceneSlot styles-module__u2wRGq__sceneSlot ${sceneReady ? "scene-slot-ready" : ""}`}
        >
          <div className="static-scene">
            <Image
              className="scene-bg"
              src="/assets/scene-bg.webp"
              alt=""
              aria-hidden="true"
              width={1200}
              height={304}
              loading="eager"
            />
            <Image
              className="static-keyboard"
              src="/assets/keyboard-static.png"
              alt="Raycast mechanical keyboard"
              width={1447}
              height={595}
              priority
            />
          </div>

          {isDesktop ? (
            <div className={`scene ${sceneReady ? "scene-ready" : ""}`}>
              <Image
                className="scene-bg"
                src="/assets/scene-bg.webp"
                alt=""
                aria-hidden="true"
                width={1200}
                height={304}
                loading="eager"
              />
              <Scene onReady={markSceneReady} />
            </div>
          ) : null}
        </div>
      </section>

      {videoOpen ? <VideoDialog onClose={closeVideo} /> : null}
    </>
  );
}
