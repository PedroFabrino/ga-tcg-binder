interface SettingsPayload {
  user?: {
    hasShippingCapability?: boolean;
    hasVendorCapability?: boolean;
    mypUsername?: string | null;
  } | null;
}

/** Reads the shipping capability flag from a `GET /api/settings` response body (`{ user: {...} }`). */
export function readShippingCapability(payload: unknown): boolean {
  const user = (payload as SettingsPayload | null | undefined)?.user;
  return user?.hasShippingCapability === true;
}

/** Reads the vendor capability flag from a `GET /api/settings` response body (`{ user: {...} }`). */
export function readVendorCapability(payload: unknown): boolean {
  const user = (payload as SettingsPayload | null | undefined)?.user;
  return user?.hasVendorCapability === true;
}

/** Reads the configured MyP username from a `GET /api/settings` response body (`{ user: {...} }`). */
export function readMypUsername(payload: unknown): string | null {
  const user = (payload as SettingsPayload | null | undefined)?.user;
  return typeof user?.mypUsername === "string" && user.mypUsername.trim().length > 0
    ? user.mypUsername.trim()
    : null;
}
