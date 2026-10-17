import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Calendar({ className, classNames, ...props }: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      weekStartsOn={1}
      className={cn("p-1", className)}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-medium",
        nav: "flex items-center",
        button_previous:
          "absolute left-1 size-8 rounded-md hover:bg-accent inline-flex items-center justify-center",
        button_next:
          "absolute right-1 size-8 rounded-md hover:bg-accent inline-flex items-center justify-center",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 text-[11px] font-medium uppercase tracking-wide",
        week: "flex w-full mt-1",
        day: "size-9 text-center text-sm p-0 relative",
        day_button:
          "size-9 rounded-md p-0 font-normal hover:bg-accent inline-flex items-center justify-center",
        selected: "bg-primary text-primary-foreground hover:bg-primary rounded-md",
        today: "shadow-border",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
