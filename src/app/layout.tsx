import type { Metadata } from "next"
import type { ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import localFont from "next/font/local"

import { SiteShell } from "@/components/site/site-shell"

import { cn } from "@/utils/cn"

import "./globals.css"
import "dialkit/styles.css"

const inter = localFont({
  src: "../../public/fonts/inter-latin.woff2",
  display: "swap",
  style: "normal",
  weight: "100 900",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "The Raycast Keyboard",
  description:
    "A low-profile mechanical keyboard designed for instant access to your favorite commands.",
  icons: {
    icon: "/favicon.png",
  },
}

interface Props { children: ReactNode }

/** 加载公共字体、全局主题和版本导航布局。 */
export default function RootLayout({ children }: Props) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(inter.variable, "group/site min-w-80 overscroll-none bg-nav-background antialiased")}
    >
      <body className="min-h-screen min-w-80 overflow-x-hidden overscroll-none bg-nav-background font-sans text-white">
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          <SiteShell>{children}</SiteShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
