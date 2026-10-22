/**
 * Formats a `YYYY-MM-DD` date string without timezone drift.
 *
 * Dates are parsed at local noon (`T12:00:00`) so that every timezone within
 * ±12 hours of UTC renders the same calendar day, instead of shifting back a
 * day in negative offsets (e.g. America/Sao_Paulo).
 */
export function formatIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
