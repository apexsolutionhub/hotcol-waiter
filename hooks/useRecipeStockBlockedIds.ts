"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStationIngredientStocks,
  type StationIngredientStock,
} from "@/lib/api";
import {
  isRecipeStationStockBlocked,
  maxRecipeServingsAvailable,
} from "@/lib/recipeStationAvailability";

type MenuLike = {
  id: number;
  category?: string | null;
  type?: string | null;
  recipeJson?: unknown;
};

/**
 * Polls station stock so menu cards stay aligned after stock-outs
 * (same behavior as hotcol-user cashier).
 */
export function useRecipeStockBlockedIds(
  items: MenuLike[],
  opts?: { enabled?: boolean; pollMs?: number },
) {
  const enabled = opts?.enabled === true;
  const pollMs = opts?.pollMs ?? 12_000;
  const [stocks, setStocks] = useState<StationIngredientStock[]>([]);

  const load = useCallback(async () => {
    if (!enabled) {
      setStocks([]);
      return;
    }
    try {
      const rows = await fetchStationIngredientStocks();
      setStocks(Array.isArray(rows) ? rows : []);
    } catch {
      /* keep prior */
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    };
    const id = window.setInterval(tick, pollMs);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [enabled, load, pollMs]);

  const blockedIds = useMemo(() => {
    const set = new Set<number>();
    if (!enabled) return set;
    for (const item of items) {
      if (isRecipeStationStockBlocked(item, stocks, true)) {
        set.add(item.id);
      }
    }
    return set;
  }, [enabled, items, stocks]);

  const maxServingsById = useMemo(() => {
    const map = new Map<number, number>();
    if (!enabled) return map;
    for (const item of items) {
      map.set(item.id, maxRecipeServingsAvailable(item, stocks, true));
    }
    return map;
  }, [enabled, items, stocks]);

  return {
    blockedIds,
    maxServingsById,
    stocks,
    reload: load,
  };
}
