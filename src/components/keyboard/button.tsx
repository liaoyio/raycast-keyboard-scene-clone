import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/utils/cn";

type ButtonVariant = "light" | "dark";

interface CommonProps {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
}

type LinkButtonProps = CommonProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "children" | "className" | "href"
  > & { href: string };

type NativeButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: never;
  };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

export function Button({
  children,
  className,
  variant = "light",
  ...elementProps
}: ButtonProps) {
  const buttonClassName = cn(
    "inline-flex h-9 touch-manipulation cursor-pointer appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 px-3 py-2 text-center text-sm leading-4 font-medium tracking-[0.2px] no-underline transition-[background-color,background-image,box-shadow,scale] duration-200 ease-in-out data-[variant=light]:bg-[#e6e6e6] data-[variant=light]:text-[#2f3031] data-[variant=light]:shadow-[0_0_0_2px_rgba(0,0,0,0.5),0_0_14px_rgba(255,255,255,0.19),inset_0_-1px_0.4px_rgba(0,0,0,0.2),inset_0_1px_0.4px_#fff] data-[variant=light]:hover:bg-white data-[variant=dark]:bg-transparent data-[variant=dark]:bg-[linear-gradient(rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.1)_100%)] data-[variant=dark]:text-white data-[variant=dark]:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.2)] data-[variant=dark]:hover:bg-[linear-gradient(rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.14)_100%)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white/95 disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100",
    className,
  );

  if (elementProps.href !== undefined) {
    return (
      <a
        {...elementProps}
        className={buttonClassName}
        data-slot="button"
        data-variant={variant}
      >
        {children}
      </a>
    );
  }

  const { type = "button", ...buttonProps } = elementProps;

  return (
    <button
      {...buttonProps}
      className={buttonClassName}
      data-slot="button"
      data-variant={variant}
      type={type}
    >
      {children}
    </button>
  );
}
