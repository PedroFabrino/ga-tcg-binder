import { resolveLocale, type SupportedLocale } from "@ga/contracts";

export const USER_LOCALE_STORAGE_KEY = "ga_root_app_locale";

export function detectClientLocale(): SupportedLocale {
  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    return resolveLocale(navigator.language);
  }
  return "en";
}

export function getStoredUserLocale(): SupportedLocale | null {
  try {
    if (typeof localStorage !== "undefined") {
      const val = localStorage.getItem(USER_LOCALE_STORAGE_KEY);
      if (val === "en" || val === "pt-BR") {
        return val;
      }
    }
  } catch {
    // Ignore storage errors in private browsing/sandboxes
  }
  return null;
}

export function setStoredUserLocale(locale: SupportedLocale): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USER_LOCALE_STORAGE_KEY, locale);
    }
  } catch {
    // Ignore storage errors in private browsing/sandboxes
  }
}

export interface ResolveEffectiveLocaleOptions {
  userChoice?: SupportedLocale | null;
  communityLocale?: string | null;
  browserLocale?: SupportedLocale;
}

export function resolveEffectiveLocale({
  userChoice,
  communityLocale,
  browserLocale,
}: ResolveEffectiveLocaleOptions = {}): SupportedLocale {
  if (userChoice === "en" || userChoice === "pt-BR") {
    return userChoice;
  }
  if (communityLocale === "en" || communityLocale === "pt-BR") {
    return communityLocale;
  }
  return browserLocale ?? detectClientLocale();
}
