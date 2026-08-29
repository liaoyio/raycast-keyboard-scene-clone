"use client";

import { useEffect, useRef } from "react";
import { useEventListener } from "usehooks-ts";

interface VideoDialogProps {
  onClose: () => void;
}

export function VideoDialog({ onClose }: VideoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  // Embedded browser surfaces do not always forward native dialog cancel
  // events while the iframe owns focus, so keep Escape deterministic.
  useEventListener("keydown", (event) => {
    const dialog = dialogRef.current;

    if (event.key !== "Escape" || !dialog?.open) return;

    event.preventDefault();
    dialog.close();
  });

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-100 m-0 hidden size-full max-h-none max-w-none place-items-center border-0 bg-transparent p-6 text-inherit open:grid backdrop:bg-[rgba(7,8,10,0.8)] backdrop:backdrop-blur-[5px] max-[400.99px]:p-3.5"
      aria-label="Introducing the NuPhy × Raycast Keyboard"
      onClose={onClose}
    >
      <div className="relative w-[min(1024px,calc(100vw-48px))] rounded-xl border border-white/16 bg-[#090a0c] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)] max-[400.99px]:w-full max-[400.99px]:p-3.5">
        <button
          className="absolute top-2 right-2 size-7 cursor-pointer border-0 bg-transparent text-2xl leading-none text-white/60"
          type="button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
        <iframe
          className="block aspect-video w-full border-0 bg-[#242424]"
          src="https://www.youtube.com/embed/73pdeHCGerA?autoplay=1&rel=0"
          title="Introducing the NuPhy × Raycast Keyboard: Limited Edition"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </dialog>
  );
}
