"use client";

import { useRef, useState } from "react";
import { useEventListener } from "usehooks-ts";
import { DialRoot } from "dialkit";

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
] as const;

export function DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const cursorRef = useRef(0);

  useEventListener("keydown", (event) => {
    if (event.repeat || enabled) return;

    const expectedCode = KONAMI_CODE[cursorRef.current];
    if (event.code === expectedCode) {
      cursorRef.current += 1;
    } else {
      cursorRef.current = event.code === KONAMI_CODE[0] ? 1 : 0;
    }

    if (cursorRef.current === KONAMI_CODE.length) {
      cursorRef.current = 0;
      setEnabled(true);
    }
  });

  return enabled ? (
    <DialRoot
      productionEnabled
      defaultOpen
      position="bottom-right"
      theme="dark"
    />
  ) : null;
}
