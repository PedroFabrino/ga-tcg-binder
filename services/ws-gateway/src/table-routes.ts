const TABLE_PATH = /^\/(?:t|ws\/table)\/([A-Za-z0-9_-]+)/;

/** The upper-cased table code from a `/t/:code` or `/ws/table/:code` path. */
export function tableCodeFromPath(pathname: string): string | null {
  const match = pathname.match(TABLE_PATH);
  return match ? match[1].toUpperCase() : null;
}
