/** Minimal menu recipe parse — mirrors BackEnd/lib/cafeRecipe.js */

export type MenuRecipeIngredient = {
  name: string;
  amount: number;
  measuredBy: string;
  unitPrice: number;
};

export type MenuRecipe = {
  ingredients: MenuRecipeIngredient[];
};

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseMenuRecipe(raw: unknown): MenuRecipe | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const ingredients = (value as MenuRecipe).ingredients;
  if (!Array.isArray(ingredients) || ingredients.length === 0) return null;

  const parsed: MenuRecipeIngredient[] = [];
  for (const row of ingredients) {
    if (!row || typeof row !== "object") continue;
    const name = String((row as MenuRecipeIngredient).name ?? "").trim();
    if (!name) continue;
    parsed.push({
      name,
      amount: asNumber((row as MenuRecipeIngredient).amount),
      measuredBy: String(
        (row as MenuRecipeIngredient).measuredBy ?? "",
      ).trim(),
      unitPrice: asNumber((row as MenuRecipeIngredient).unitPrice),
    });
  }

  return parsed.length > 0 ? { ingredients: parsed } : null;
}
