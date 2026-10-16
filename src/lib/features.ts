import { parseFeatureFlag, DEFAULT_FEATURE_FLAGS } from "@ga/contracts";

/**
 * Global web application feature flags.
 * Defaults are strictly false unless explicitly enabled via environment variables.
 */
export const FEATURES = {
  get scanner(): boolean {
    return parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_SCANNER, DEFAULT_FEATURE_FLAGS.scanner);
  },
};
