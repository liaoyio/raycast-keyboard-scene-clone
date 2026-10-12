import { redirect } from "next/navigation"

/** 默认进入 Raycast 键盘预览。 */
export default function HomePage() {
  redirect("/raycast")
}
