import { useState } from "react";
import { cn } from "@/lib/utils";

export function TeamMark({
  name,
  src,
  size = "md",
}: {
  name: string;
  src: string | null;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(!src);
  const dim = size === "sm" ? "size-7" : "size-9";
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  if (failed) {
    return (
      <span
        className={cn(
          dim,
          "inline-flex shrink-0 items-center justify-center rounded-md bg-accent font-display text-sm text-foreground",
        )}
        aria-hidden
      >
        {letter}
      </span>
    );
  }
  return (
    <img
      src={src ?? undefined}
      alt=""
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      className={cn(
        dim,
        "shrink-0 rounded-md bg-accent object-contain outline outline-1 -outline-offset-1 outline-white/10",
      )}
    />
  );
}
