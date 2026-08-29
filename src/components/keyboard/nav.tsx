"use client";

import type { AnchorHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { useEventListener, useMediaQuery, useScrollLock } from "usehooks-ts";

import { Apple, RaycastLogo, RaycastMark } from "@/components/icons";
import { cn } from "@/utils/cn";

import { Button } from "./button";

const navigation = [
  { label: "Store", href: "https://www.raycast.com/store" },
  { label: "Pro", href: "https://www.raycast.com/pro" },
  { label: "AI", href: "https://www.raycast.com/ai" },
  { label: "iOS", href: "https://www.raycast.com/ios" },
  { label: "Windows", href: "https://www.raycast.com/windows" },
  { label: "Teams", href: "https://www.raycast.com/teams" },
  { label: "Enterprise", href: "https://www.raycast.com/enterprise" },
  { label: "Blog", href: "https://www.raycast.com/blog" },
  { label: "Pricing", href: "https://www.raycast.com/pricing" },
] as const;

function NavigationLink({
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "block whitespace-nowrap rounded-md px-2 py-3 text-sm leading-[17px] font-medium tracking-[0.2px] text-[#9c9c9d] transition-colors duration-200 ease-in-out hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white/90 motion-reduce:transition-none min-[880px]:max-[1180.99px]:px-1.5",
        className,
      )}
      {...props}
    />
  );
}

interface NavigationToggleLineProps {
  position: "top" | "middle" | "bottom";
}

function NavigationToggleLine({ position }: NavigationToggleLineProps) {
  return (
    <span
      className={cn(
        "absolute left-1/2 block h-px w-full -translate-x-1/2 -translate-y-1/2 bg-white/90 [transition:top_500ms_ease,rotate_500ms_ease,opacity_250ms_ease] motion-reduce:transition-none",
        position === "top" &&
          "top-[10%] group-data-[menu-open=true]/navigation:top-1/2 group-data-[menu-open=true]/navigation:-rotate-45",
        position === "middle" &&
          "top-1/2 group-data-[menu-open=true]/navigation:opacity-0",
        position === "bottom" &&
          "top-[90%] group-data-[menu-open=true]/navigation:top-1/2 group-data-[menu-open=true]/navigation:rotate-45",
      )}
    />
  );
}

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useMediaQuery("(min-width: 880px)", {
    defaultValue: false,
    initializeWithValue: false,
  });

  useScrollLock({ autoLock: menuOpen, widthReflow: false });

  useEventListener("keydown", (event) => {
    if (!menuOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      toggleRef.current?.focus();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      navigationRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      ) ?? [],
    ).filter((element) => element.offsetParent !== null);
    const firstElement = focusableElements.at(0);
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });

  useEffect(() => {
    if (isDesktop) setMenuOpen(false);
  }, [isDesktop]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className="group/navigation pointer-events-none fixed top-0 left-0 z-50 flex w-full justify-center px-4 pt-4 overscroll-contain data-[menu-open=true]:pointer-events-auto data-[menu-open=true]:max-h-dvh data-[menu-open=true]:min-h-dvh data-[menu-open=true]:overflow-y-auto data-[menu-open=true]:pb-6"
      data-menu-open={menuOpen}
    >
      <nav
        ref={navigationRef}
        className="pointer-events-auto grid h-auto max-h-[58px] w-full max-w-[1204px] self-start grid-cols-1 grid-rows-[24px_auto_auto] overflow-hidden rounded-2xl border border-white/[0.06] bg-[linear-gradient(137deg,rgba(17,18,20,0.75)_4.87%,rgba(12,13,15,0.9)_75.88%)] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-[5px] transition-[max-height] duration-300 ease-in-out group-data-[menu-open=true]/navigation:max-h-[1000px] motion-reduce:transition-none min-[880px]:relative min-[880px]:flex min-[880px]:h-[76px] min-[880px]:max-h-[76px] min-[880px]:items-center min-[880px]:justify-center min-[880px]:overflow-visible min-[880px]:px-8"
        aria-label="Primary navigation"
      >
        <div className="flex w-full items-center justify-between min-[880px]:absolute min-[880px]:top-1/2 min-[880px]:left-8 min-[880px]:w-auto min-[880px]:-translate-y-1/2 min-[880px]:justify-center">
          <a
            className="group flex h-6 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white/90"
            href="https://www.raycast.com/"
            aria-label="Raycast"
          >
            <span className="hidden size-6 overflow-hidden transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none min-[880px]:block min-[1064px]:hidden">
              <RaycastMark className="block size-6" aria-hidden="true" />
            </span>
            <span className="block h-6 w-[93px] overflow-hidden transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none min-[880px]:hidden min-[1064px]:block">
              <RaycastLogo className="block h-6 w-[93px]" aria-hidden="true" />
            </span>
          </a>

          <button
            ref={toggleRef}
            className="relative m-0 h-4 w-6 cursor-pointer border-0 bg-transparent p-0 [transition:rotate_500ms_ease,opacity_300ms_ease] group-data-[menu-open=true]/navigation:rotate-180 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white/90 motion-reduce:transition-none min-[880px]:hidden"
            type="button"
            aria-controls="primary-navigation-links"
            aria-expanded={menuOpen}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setMenuOpen((open) => !open)}
          >
            <NavigationToggleLine position="top" />
            <NavigationToggleLine position="middle" />
            <NavigationToggleLine position="bottom" />
          </button>
        </div>

        <div id="primary-navigation-links" className="contents">
          <div className="invisible flex flex-col gap-1 pt-12 pb-8 group-data-[menu-open=true]/navigation:visible min-[880px]:visible min-[880px]:flex-row min-[880px]:items-center min-[880px]:gap-4 min-[880px]:p-0 min-[880px]:max-[1180.99px]:gap-1.5">
            {navigation.map(({ label, href }) => (
              <NavigationLink key={label} href={href} onClick={closeMenu}>
                {label}
              </NavigationLink>
            ))}
          </div>

          <div className="invisible flex border-t border-white/10 pt-8 group-data-[menu-open=true]/navigation:visible min-[880px]:visible min-[880px]:absolute min-[880px]:top-1/2 min-[880px]:right-8 min-[880px]:h-full min-[880px]:-translate-y-1/2 min-[880px]:items-center min-[880px]:border-0 min-[880px]:p-0">
            <div className="flex items-center gap-6 min-[880px]:hidden min-[1064px]:flex">
              <NavigationLink
                href="https://www.raycast.com/users/sign_in"
                onClick={closeMenu}
              >
                Log in
              </NavigationLink>
              <div className="hidden min-[1064px]:block">
                <Button
                  variant="light"
                  href="https://www.raycast.com/download/mac"
                  onClick={closeMenu}
                >
                  <Apple className="block size-4" aria-hidden="true" />
                  Download
                </Button>
              </div>
            </div>

            <div className="hidden items-center min-[880px]:flex min-[1064px]:hidden">
              <Button
                variant="light"
                href="https://www.raycast.com/users/sign_in"
              >
                Log in
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
