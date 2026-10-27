import { useMemo } from "react";
import {
  createTranslator,
  resolveLocale,
  type SupportedLocale,
  type Translator,
} from "@ga/contracts";

export function useTranslator(locale?: SupportedLocale): Translator {
  return useMemo(() => createTranslator(resolveLocale(locale)), [locale]);
}
