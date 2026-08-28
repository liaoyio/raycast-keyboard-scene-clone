"use client";

import { useEffect, useRef } from "react";

interface VideoDialogProps {
  onClose: () => void;
}

export function VideoDialog({ onClose }: VideoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dialog.open) dialog.close();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="video-backdrop"
      aria-label="Introducing the NuPhy × Raycast Keyboard"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="video-dialog">
        <button
          className="dialog-close"
          type="button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
        <iframe
          src="https://www.youtube.com/embed/73pdeHCGerA?autoplay=1&rel=0"
          title="Introducing the NuPhy × Raycast Keyboard: Limited Edition"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </dialog>
  );
}
