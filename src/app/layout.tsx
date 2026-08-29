import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

import "./globals.css";
import "dialkit/styles.css";

const inter = localFont({
  src: "../../public/fonts/inter-latin.woff2",
  display: "swap",
  style: "normal",
  weight: "100 900",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "The Raycast Keyboard",
  description:
    "A low-profile mechanical keyboard designed for instant access to your favorite commands.",
  icons: {
    icon: "/favicon.png",
  },
};

type Props = { children: ReactNode };

export default function RootLayout({ children }: Props) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, "min-w-80 bg-page antialiased")}
    >
      <body className="min-h-screen min-w-80 overflow-x-hidden bg-page font-sans text-white">
        {children}
      </body>
    </html>
  );
}
