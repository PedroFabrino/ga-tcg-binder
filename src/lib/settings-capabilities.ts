interface SettingsPayload {
  user?: { hasShippingCapability?: boolean } | null;
}

/** Reads the shipping capability flag from a `GET /api/settings` response body (`{ user: {...} }`). */
export function readShippingCapability(payload: unknown): boolean {
  const user = (payload as SettingsPayload | null | undefined)?.user;
  return user?.hasShippingCapability === true;
}
