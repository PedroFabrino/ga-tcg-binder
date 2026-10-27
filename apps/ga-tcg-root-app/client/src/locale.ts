import { resolveLocale, type SupportedLocale } from "@ga/contracts";

export function detectClientLocale(): SupportedLocale {
  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    return resolveLocale(navigator.language);
  }
  return "en";
}
