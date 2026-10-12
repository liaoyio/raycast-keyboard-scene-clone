import { cn } from "@/utils/cn"

// 复用 Orb 的九点径向脉冲，仅保留雾透加载所需的图标。
export function MistLoadingIndicator() {
  return (
    <span role="status" aria-label="正在加载键盘" className="pointer-events-none absolute inset-x-0 top-full mx-auto mt-3 block size-5 text-[#888888]">
      <span aria-hidden="true" className="absolute top-0 left-0 grid size-6 origin-top-left scale-[0.833333] grid-cols-3 gap-1 p-0.5">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-1 rounded-full bg-current opacity-25",
              "scale-[0.4] animate-[mist-orb-swell_1.6s_cubic-bezier(0.4,0,0.2,1)_infinite]",
              "motion-reduce:scale-100 motion-reduce:animate-none motion-reduce:opacity-60",
            )}
            style={{ animationDelay: `${Math.round(Math.hypot(index % 3 - 1, Math.floor(index / 3) - 1) * 260)}ms` }}
          />
        ))}
      </span>
    </span>
  )
}
