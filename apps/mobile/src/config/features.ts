import { parseFeatureFlag, DEFAULT_FEATURE_FLAGS } from "@ga/contracts";

/**
 * Mobile companion app feature flags.
 * Defaults are strictly false unless explicitly enabled via environment variables.
 */
export const FEATURES = {
  get scanner(): boolean {
    return parseFeatureFlag(process.env.EXPO_PUBLIC_FEATURE_SCANNER, DEFAULT_FEATURE_FLAGS.scanner);
  },
};
