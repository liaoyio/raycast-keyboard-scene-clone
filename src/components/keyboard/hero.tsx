"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { createElement, useEffect, useState, type ReactNode } from "react";
import {
  useEventCallback,
  useIntersectionObserver,
  useMediaQuery,
} from "usehooks-ts";

import { Play, RaycastNuphyLogo } from "@/components/icons";
import { cn } from "@/utils/cn";

import { Button } from "./button";
import { SceneErrorBoundary } from "./scene-error-boundary";
import { VideoDialog } from "./video-dialog";

const Scene = dynamic(() => import("./scene"), {
  loading: () => null,
  ssr: false,
});

type HeroEntranceElement = "div" | "h1" | "p";
type HeroEntranceDelay = 100 | 200 | 300 | 400 | 500;

interface HeroEntranceProps {
  as: HeroEntranceElement;
  children: ReactNode;
  className?: string;
  delay: HeroEntranceDelay;
  id?: string;
}

function HeroEntrance({
  as,
  children,
  className,
  delay,
  id,
}: HeroEntranceProps) {
  return createElement(
    as,
    {
      className: cn(
        "animate-[hero-enter_600ms_ease-out_both] opacity-0 data-[delay=100]:[animation-delay:100ms] data-[delay=200]:[animation-delay:200ms] data-[delay=300]:[animation-delay:300ms] data-[delay=400]:[animation-delay:400ms] data-[delay=500]:[animation-delay:500ms] motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none motion-reduce:blur-none",
        className,
      ),
      "data-delay": delay,
      id,
    },
    children,
  );
}

function SceneBackground() {
  return (
    <Image
      className="pointer-events-none absolute bottom-0 left-1/2 z-0 block h-auto w-full max-w-[1200px] -translate-x-1/2 animate-[background-enter_600ms_ease-out_400ms_both] opacity-0 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:-translate-x-1/2 motion-reduce:blur-none"
      src="/assets/scene-bg.webp"
      alt=""
      aria-hidden="true"
      width={1200}
      height={304}
      loading="eager"
    />
  );
}

export function Hero() {
  const isDesktop = useMediaQuery("(min-width: 1001px)", {
    defaultValue: false,
    initializeWithValue: false,
  });
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
    {
      defaultValue: false,
      initializeWithValue: false,
    },
  );
  const { ref: sceneRef, isIntersecting: inView } = useIntersectionObserver({
    rootMargin: "120px 0px",
  });
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const markSceneReady = useEventCallback(() => {
    setSceneFailed(false);
    setSceneReady(true);
  });
  const markSceneFailed = useEventCallback(() => {
    setSceneReady(false);
    setSceneFailed(true);
  });

  useEffect(() => {
    if (isDesktop) return;
    setSceneReady(false);
    setSceneFailed(false);
  }, [isDesktop]);

  const sceneVisible = sceneReady || sceneFailed;

  return (
    <>
      <section
        className="w-full pt-48 text-center max-[400.99px]:pt-[164px]"
        aria-labelledby="page-title"
      >
        <div className="relative mx-auto mb-8 flex w-full max-w-[1000px] flex-col items-center justify-center gap-4 px-5 max-[640.99px]:px-4">
          <HeroEntrance as="div" className="h-[33.9px] w-[95px]" delay={100}>
            <RaycastNuphyLogo
              className="block h-[30px] w-[95px] opacity-40"
              aria-label="Raycast and NuPhy"
            />
          </HeroEntrance>

          <HeroEntrance
            as="h1"
            id="page-title"
            className="m-0 text-[50px] leading-none font-medium tracking-[-0.025em] text-white max-[640.99px]:max-w-[430px] max-[640.99px]:text-[44px] max-[640.99px]:leading-[1.04] max-[400.99px]:max-w-[300px] max-[400.99px]:text-[40px] max-[350.99px]:text-[38px]"
            delay={200}
          >
            The Raycast Keyboard
          </HeroEntrance>

          <HeroEntrance
            as="p"
            className="mx-auto max-w-[460px] text-lg leading-[1.5] font-normal text-pretty text-white/60"
            delay={300}
          >
            A low-profile mechanical keyboard designed for instant access to
            your favorite commands.
          </HeroEntrance>

          <HeroEntrance
            as="div"
            className="mt-[30px] flex min-h-9 items-center justify-center gap-[15px] max-[400.99px]:mt-[22px] max-[400.99px]:w-full max-[400.99px]:max-w-[250px] max-[400.99px]:flex-col"
            delay={400}
          >
            <Button
              className="max-[400.99px]:w-full"
              variant="light"
              href="https://nuphy.com/products/nuphy-air75-v3-raycast-edition?utm_source=raycast&utm_medium=partnership&utm_campaign=raycast_edition_launch&utm_content=store"
            >
              <span className="border-r border-black/20 pr-2.5 font-bold line-through">
                $149.95
              </span>
              Join the waitlist
            </Button>
            <Button
              className="max-[400.99px]:w-full"
              variant="dark"
              type="button"
              aria-expanded={videoOpen}
              onClick={() => setVideoOpen(true)}
            >
              <Play className="size-4" aria-hidden="true" />
              Watch video
            </Button>
          </HeroEntrance>

          <HeroEntrance
            as="p"
            className="text-[13px] leading-[1.15] text-white/40"
            delay={500}
          >
            <span className="text-white">Sold out.</span> Join the waitlist for
            the next batch.
          </HeroEntrance>
        </div>

        <div className="relative w-full min-[1001px]:h-[400px]">
          <div
            ref={sceneRef}
            className="invisible relative isolate hidden h-[400px] w-full overflow-hidden opacity-0 [transition:opacity_500ms_ease-out,visibility_0s_linear_500ms] data-[visible=true]:visible data-[visible=true]:opacity-100 data-[visible=true]:[transition:opacity_500ms_ease-out,visibility_0s] motion-reduce:[transition:none] motion-reduce:data-[visible=true]:[transition:none] min-[1001px]:block after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:z-5 after:h-[200px] after:w-full after:bg-[linear-gradient(to_bottom,rgba(7,8,10,0),var(--color-page)_100%)] after:content-['']"
            data-visible={sceneVisible}
            aria-busy={isDesktop && !sceneVisible}
          >
            <SceneBackground />

            {isDesktop ? (
              <SceneErrorBoundary
                onError={markSceneFailed}
                fallback={
                  <div className="absolute inset-0 z-2 grid place-items-start overflow-hidden">
                    <Image
                      className="block h-auto w-[min(1060px,100%)] max-w-none -translate-y-2.5"
                      src="/assets/keyboard-static.webp"
                      alt="Raycast mechanical keyboard"
                      width={1447}
                      height={595}
                    />
                  </div>
                }
              >
                <Scene
                  active={inView && !videoOpen}
                  inView={inView}
                  prefersReducedMotion={prefersReducedMotion}
                  onReady={markSceneReady}
                />
              </SceneErrorBoundary>
            ) : null}
          </div>

          <div className="pointer-events-none relative isolate mt-4 block w-full min-[1001px]:hidden">
            <SceneBackground />
            <Image
              className="relative z-1 block h-auto w-full"
              src="/assets/keyboard-static.webp"
              alt="Raycast mechanical keyboard"
              width={1447}
              height={595}
              loading="eager"
            />
          </div>
        </div>
      </section>

      {videoOpen ? <VideoDialog onClose={() => setVideoOpen(false)} /> : null}
    </>
  );
}
