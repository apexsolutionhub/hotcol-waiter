"use client";

import { useEffect, useRef } from "react";

/** Runs callback every delayMs while the tab is visible (Cashier live-orders pattern). */
export function useVisibleInterval(
  callback: () => void,
  delayMs: number | null,
): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (delayMs == null || delayMs <= 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState === "visible") cbRef.current();
    };

    const stop = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      if (intervalId != null) return;
      intervalId = setInterval(tick, delayMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        cbRef.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [delayMs]);
}

export const WAITER_LIVE_POLL_MS = 8_000;
