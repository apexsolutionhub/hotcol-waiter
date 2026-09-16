"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LiveDateTimeClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = format(now, "HH");
  const minutes = format(now, "mm");
  const seconds = format(now, "ss");
  const timeLabel = `${hours}:${minutes}:${seconds}`;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center justify-end px-0.5 sm:px-2",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex max-w-full min-w-0 shrink items-center gap-1.5 rounded-full border border-border/60",
          "bg-linear-to-r from-muted/50 via-muted/30 to-muted/50",
          "px-2 py-1 shadow-sm ring-1 ring-black/3 backdrop-blur-sm",
          "dark:from-muted/40 dark:via-muted/25 dark:to-muted/40 dark:ring-white/5",
          "sm:gap-2.5 sm:shrink-0 sm:px-3 sm:py-1.5",
        )}
        role="timer"
        aria-label={`Today ${format(now, "PPPP")}, ${timeLabel}`}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary sm:h-7 sm:w-7"
          aria-hidden
        >
          <Clock3 className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-primary sm:px-2 sm:text-[10px]">
            {format(now, "EEE")}
          </span>
          <span className="min-w-0 truncate text-[11px] font-medium text-foreground/90 sm:text-xs">
            <span className="md:hidden">{format(now, "MMM d")}</span>
            <span className="hidden md:inline">
              {format(now, "MMMM d")}
              <span className="font-normal text-muted-foreground">
                , {format(now, "yyyy")}
              </span>
            </span>
          </span>
        </span>
        <span
          className="h-3.5 w-px shrink-0 bg-linear-to-b from-transparent via-border to-transparent sm:h-4"
          aria-hidden
        />
        <span className="flex shrink-0 items-center gap-px rounded-md bg-background/80 px-1.5 py-0.5 font-mono tabular-nums tracking-tight shadow-xs ring-1 ring-border/50 sm:gap-0.5 sm:px-2 sm:py-1">
          <span className="inline-block min-w-[1.5ch] text-center text-[13px] font-semibold leading-none text-foreground sm:text-sm">
            {hours}
          </span>
          <span className="mx-px select-none text-[11px] text-muted-foreground/35 sm:text-xs">
            :
          </span>
          <span className="inline-block min-w-[1.5ch] text-center text-[13px] font-semibold leading-none text-foreground sm:text-sm">
            {minutes}
          </span>
          <span className="mx-px select-none text-[11px] text-muted-foreground/35 sm:text-xs">
            :
          </span>
          <span className="inline-block min-w-[1.5ch] text-center text-[11px] font-medium leading-none text-muted-foreground/90 sm:text-xs">
            {seconds}
          </span>
        </span>
      </div>
    </div>
  );
}
