"use client"

export type AssetKind = "model" | "base" | "rgb"
export interface LocalAsset { url: string, name: string }
interface AssetInputProps {
  kind: AssetKind
  label: string
  source: string
  uploaded?: LocalAsset
  onChange: (kind: AssetKind, file?: File) => void
}

// 在创建 URL 之前检查上传边界，失败时保留正在使用的素材。
export function validateAssetFile(kind: AssetKind, file?: File) {
  if (!file) { return "" }
  if (!file.size || file.size > 50 * 1024 * 1024) { return "请选择非空文件，单个文件不超过 50 MB。" }
  const extension = kind === "model" ? /\.glb$/i : /\.(png|jpe?g|webp)$/i
  if (extension.test(file.name)) { return "" }
  return kind === "model" ? "模型请选择 GLB 文件。" : "贴图请选择 PNG、JPG 或 WebP 图片。"
}

// 本地上传可反复选择同一文件，预览保持浏览器原生 blob URL。
export function AssetInput({ kind, label, source, uploaded, onChange }: AssetInputProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-current/10 p-2.5">
      <label className="group/asset flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        {kind === "model"
          ? (
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-current/5 font-mono text-[10px] opacity-60">GLB</span>
            )
          : (
              // eslint-disable-next-line next/no-img-element -- 本地上传使用临时 blob URL，不经过图片优化服务。
              <img src={source} alt={`${label} 当前贴图`} className="size-11 shrink-0 rounded-md bg-black object-contain" />
            )}
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">{label}</span>
          <span className="mt-1 block truncate text-[10px] opacity-45" title={uploaded?.name}>{uploaded?.name ?? "使用内置素材"}</span>
        </span>
        <span
          className="rounded-md bg-current/5 px-2 py-1.5 text-[11px] group-hover/asset:bg-current/10 group-focus-within/asset:outline-2"
        >
          替换
        </span>
        <input
          type="file"
          className="sr-only"
          aria-label={`导入 ${label}`}
          accept={kind === "model" ? ".glb" : ".png,.jpg,.jpeg,.webp"}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) { onChange(kind, file) }
            event.currentTarget.value = ""
          }}
        />
      </label>
      {uploaded ? <button type="button" className="cursor-pointer text-[11px] opacity-50 hover:opacity-100" aria-label={`恢复内置${label}`} onClick={() => onChange(kind)}>恢复</button> : null}
    </div>
  )
}
