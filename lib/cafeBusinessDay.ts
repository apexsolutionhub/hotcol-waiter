/** Client-side café business day — mirrors Backend/lib/cafeBusinessDay.js */
export const CAFE_BUSINESS_TIMEZONE = "Africa/Addis_Ababa";

export function cafeBusinessDateYmd(
  dateInput: Date | string | number,
): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAFE_BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isSameCafeBusinessDay(
  dateInput: Date | string | number,
  ref: Date | string | number = new Date(),
): boolean {
  const a = cafeBusinessDateYmd(dateInput);
  const b = cafeBusinessDateYmd(ref);
  return a !== "" && a === b;
}
