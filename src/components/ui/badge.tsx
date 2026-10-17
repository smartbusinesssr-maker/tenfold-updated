import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        muted: "bg-muted text-muted-foreground",
        outline: "shadow-border text-muted-foreground",
        line: "bg-accent text-pitch",
        win: "bg-primary/15 text-primary",
        btts: "bg-pitch/15 text-pitch",
        ou: "bg-accent text-foreground",
        cs: "shadow-border text-foreground",
        miss: "bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "muted" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
