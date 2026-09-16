/** Shared kitchen/bar routing — mirrors BackEnd/lib/cafeOrderStation.js */

export function orderCategoryKey(category: string | null | undefined) {
  return String(category ?? "")
    .trim()
    .toLowerCase();
}

export function isKitchenStationOrder(order: {
  category?: string | null;
  type?: string | null;
}) {
  const c = orderCategoryKey(order?.category);
  if (
    c === "food" ||
    c === "others" ||
    c === "kitchen" ||
    c === "chef" ||
    c === "meal" ||
    c === "meals"
  ) {
    return true;
  }
  const t = String(order?.type ?? "")
    .trim()
    .toLowerCase();
  if (
    t === "bar" ||
    t === "beverage" ||
    t === "drink" ||
    t === "drinks" ||
    t === "barista"
  ) {
    return false;
  }
  if (t === "kitchen" || t === "food" || t === "chef") return true;
  return false;
}

export function isBarStationOrder(order: {
  category?: string | null;
  type?: string | null;
}) {
  const c = orderCategoryKey(order?.category);
  if (
    c === "beverage" ||
    c === "drink" ||
    c === "drinks" ||
    c === "bar" ||
    c === "barista"
  ) {
    return true;
  }
  const t = String(order?.type ?? "")
    .trim()
    .toLowerCase();
  return (
    t === "bar" ||
    t === "beverage" ||
    t === "drink" ||
    t === "drinks" ||
    t === "barista"
  );
}
