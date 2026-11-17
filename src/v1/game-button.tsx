"use client";

import Link from "next/link";
import type { ComponentProps, PointerEvent } from "react";

type Skin = {
  tone?: "primary" | "secondary" | "urgent";
};
type ButtonProps = Skin & ComponentProps<"button"> & { href?: never };
type LinkProps = Skin & ComponentProps<typeof Link> & { href: string };

function tap(event: PointerEvent<HTMLElement>) {
  if (
    event.isPrimary &&
    event.button === 0 &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigator.vibrate?.(9);
  }
}

export function GameButton(props: ButtonProps | LinkProps) {
  if (props.href !== undefined) {
    const { tone, className = "", onPointerDown, ...rest } = props;
    return (
      <Link
        {...rest}
        className={`game-button ${className}`}
        data-tone={
          tone ?? (className.includes("primary") ? "primary" : "secondary")
        }
        onPointerDown={(event) => {
          tap(event);
          onPointerDown?.(event);
        }}
      />
    );
  }
  const { tone, className = "", onPointerDown, href, ...rest } = props;
  return (
    <button
      {...rest}
      className={`game-button ${className}`}
      data-tone={
        tone ?? (className.includes("primary") ? "primary" : "secondary")
      }
      onPointerDown={(event) => {
        tap(event);
        onPointerDown?.(event);
      }}
    />
  );
}
