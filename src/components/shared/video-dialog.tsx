"use client"

import { useEffect, useRef } from "react"
import { useEventListener } from "usehooks-ts"
import { cn } from "@/utils/cn"

interface VideoDialogProps {
  onClose: () => void
}

// 原生模态关闭后卸载视频，焦点返回打开它的按钮。
export function VideoDialog({ onClose }: VideoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) { dialog.showModal() }
  }, [])

  // 内嵌浏览器的 iframe 可能吞掉原生 cancel，补充 Escape 关闭。
  useEventListener("keydown", (event) => {
    const dialog = dialogRef.current
    if (event.key !== "Escape" || !dialog?.open) { return }
    event.preventDefault()
    dialog.close()
  })

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Introducing the NuPhy × Raycast Keyboard"
      className={cn(
        "fixed inset-0 z-100 m-0 hidden size-full max-h-none max-w-none place-items-center border-0 bg-transparent open:grid",
        "p-6 text-inherit backdrop:bg-[rgba(7,8,10,0.8)] backdrop:backdrop-blur-[5px] max-[400.99px]:p-3.5",
      )}
    >
      <div className={cn(
        "relative rounded-xl border",
        "w-[min(1024px,calc(100vw-48px))] border-white/16 bg-[#090a0c] p-6",
        "shadow-[0_30px_100px_rgba(0,0,0,0.55)] max-[400.99px]:w-full max-[400.99px]:p-3.5",
      )}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
          className="absolute top-2 right-2 size-7 cursor-pointer border-0 bg-transparent text-2xl leading-none text-white/60"
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
  )
}
