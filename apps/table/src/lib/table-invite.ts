/** The credentials the host keeps so it can re-show the opponent's invite link. */
export interface TableInvite {
  p2Token: string;
  viewerToken: string;
}

/** The part of `Storage` this module needs; tests pass a small fake. */
export interface InviteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = "gt.invite.";

export function tableInviteStorageKey(code: string): string {
  return `${STORAGE_PREFIX}${code.toUpperCase()}`;
}

export function isTableInvite(value: unknown): value is TableInvite {
  if (typeof value !== "object" || value === null) return false;
  const invite = value as Record<string, unknown>;
  return (
    typeof invite.p2Token === "string" &&
    invite.p2Token.length > 0 &&
    typeof invite.viewerToken === "string" &&
    invite.viewerToken.length > 0
  );
}

export function readTableInvite(
  code: string,
  storage: Pick<InviteStorage, "getItem"> | null
): TableInvite | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(tableInviteStorageKey(code));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTableInvite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTableInvite(
  code: string,
  invite: TableInvite,
  storage: Pick<InviteStorage, "setItem"> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(tableInviteStorageKey(code), JSON.stringify(invite));
  } catch {
    // Private mode or a full quota: the host can still share the link this visit.
  }
}
