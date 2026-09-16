/**
 * Recipe ↔ station-stock availability (Cafe + Inventory).
 * Keep aligned with hotcol-user/lib/recipeStationAvailability.ts
 */

import { parseMenuRecipe } from "@/lib/cafeRecipe";
import { isBarStationOrder } from "@/lib/cafeOrderStation";
import type { StationIngredientStock } from "@/lib/api";

export function normalizeIngredientNameKey(name: string): string {
  return String(name || "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeKitchenBarStationKey(raw: string): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!s) return "OTHER";
  if (s === "chef" || s === "kitchen" || s === "chef (kitchen)") return "KITCHEN";
  if (s === "bar" || s === "barista") return "BAR";
  const up = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (up === "CHEF" || up === "KITCHEN") return "KITCHEN";
  if (up === "BAR") return "BAR";
  return up || "OTHER";
}

export function recipeStationForMenuItem(item: {
  category?: string | null;
  type?: string | null;
}): "KITCHEN" | "BAR" {
  return isBarStationOrder(item) ? "BAR" : "KITCHEN";
}

export function buildStationOnHandMap(
  stocks: StationIngredientStock[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of stocks) {
    const station = normalizeKitchenBarStationKey(s.station);
    if (station !== "KITCHEN" && station !== "BAR") continue;
    const key = `${station}\t${normalizeIngredientNameKey(s.itemName)}`;
    const prev = map.get(key) || 0;
    map.set(
      key,
      Math.round((prev + (Number(s.amount) || 0) + Number.EPSILON) * 100) / 100,
    );
  }
  return map;
}

export function evaluateRecipeStationAvailability(opts: {
  item: {
    name?: string;
    category?: string | null;
    type?: string | null;
    recipeJson?: unknown;
  };
  stocks: StationIngredientStock[];
  servings?: number;
}): {
  ok: boolean;
  servingsAvailable: number;
} {
  const servings = Math.max(1, Math.floor(Number(opts.servings) || 1));
  const station = recipeStationForMenuItem(opts.item);
  const recipe = parseMenuRecipe(opts.item.recipeJson);
  if (!recipe?.ingredients?.length) {
    return {
      ok: true,
      servingsAvailable: Number.POSITIVE_INFINITY,
    };
  }

  const onHandMap = buildStationOnHandMap(opts.stocks);
  let servingsAvailable = Number.POSITIVE_INFINITY;
  let ok = true;

  for (const ing of recipe.ingredients) {
    const per = Number(ing.amount) || 0;
    if (!(per > 0)) continue;
    const key = `${station}\t${normalizeIngredientNameKey(ing.name)}`;
    const onHand = onHandMap.get(key) || 0;
    const needed = Math.round((per * servings + Number.EPSILON) * 100) / 100;
    if (needed > onHand + 1e-9) ok = false;
    const canMake = Math.floor(onHand / per + Number.EPSILON);
    servingsAvailable = Math.min(servingsAvailable, canMake);
  }

  if (!Number.isFinite(servingsAvailable)) servingsAvailable = 0;

  return {
    ok,
    servingsAvailable: Math.max(0, servingsAvailable),
  };
}

export function isRecipeStationStockBlocked(
  item: {
    category?: string | null;
    type?: string | null;
    recipeJson?: unknown;
  },
  stocks: StationIngredientStock[],
  enforce: boolean,
): boolean {
  if (!enforce) return false;
  const recipe = parseMenuRecipe(item.recipeJson);
  if (!recipe?.ingredients?.length) return false;
  return !evaluateRecipeStationAvailability({ item, stocks, servings: 1 }).ok;
}

export function maxRecipeServingsAvailable(
  item: {
    category?: string | null;
    type?: string | null;
    recipeJson?: unknown;
  },
  stocks: StationIngredientStock[],
  enforce: boolean,
): number {
  if (!enforce) return Number.POSITIVE_INFINITY;
  const recipe = parseMenuRecipe(item.recipeJson);
  if (!recipe?.ingredients?.length) return Number.POSITIVE_INFINITY;
  return evaluateRecipeStationAvailability({ item, stocks, servings: 1 })
    .servingsAvailable;
}
