## Parent

#29 (`docs/myp-watchlist-sync-spec.md`)

## Objective

Implement per-user `AES-256-GCM` encryption for MyP credentials (`src/lib/crypto.ts`), add `myp_login` and `myp_password_encrypted` columns to the `users` table in Turso, and build the **MyP Watchlist Auto-Sync (Optional)** section in `/settings` with a clear security explanation and a 1-click *"Clear Saved Credentials"* button.

## Context

Read [`CONTEXT.md`](../../CONTEXT.md), [`docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md`](../../docs/adr/0010-hybrid-myp-watchlist-sync-and-ledger.md), and [`docs/myp-watchlist-sync-spec.md`](../../docs/myp-watchlist-sync-spec.md) before starting.

## Deliverable

1. **AES-256-GCM Credential Encryption (`src/lib/crypto.ts`)**:
   - Derive a 32-byte key from `process.env.AUTH_SECRET` via HKDF (`sha256`, salt `ga-tcg-binder-myp-cred-v1`).
   - Implement `encryptMypPassword(plaintext: string): string` returning `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>` with a fresh 12-byte random IV per call.
   - Implement `decryptMypPassword(payload: string): string` verifying the GCM authentication tag and returning the plaintext password in memory.
2. **Schema & Server Actions (`src/db/schema.ts`, `src/db/index.ts`, `src/app/actions.ts`)**:
   - Add `mypLogin` (`text`) and `mypPasswordEncrypted` (`text`) columns to `users` (with idempotent runtime DDL migrations in `src/db/index.ts`).
   - Add `saveMypCredentialsAction(formData)` (encrypts password via `encryptMypPassword` before storing on the authenticated user's row; never logs or returns the password or ciphertext to the client).
   - Add `clearMypCredentialsAction()` (sets both `myp_login` and `myp_password_encrypted` to `NULL` on the authenticated user's row).
3. **Settings UI (`src/app/settings/page.tsx`)**:
   - Add a **MyP Watchlist Auto-Sync (Optional)** card to `/settings` displaying:
     - Current status badge (`Auto-Sync Active` when credentials are saved vs. `Manual / Browser Bridge Mode`).
     - Security & privacy notice explaining `AES-256-GCM` encryption at rest, daily pipeline usage, and zero plaintext exposure.
     - Form inputs for `MyP Login / Email` and `MyP Password` (`type="password"`, `autoComplete="new-password"`).
     - A 1-click **"Clear Saved Credentials"** button when credentials are saved.

## Out of Scope

- Executing automated FlareSolverr mutations against `mypcards.com` (covered in Ticket 04).

## Acceptance Criteria

- [ ] Unit tests in `src/lib/__tests__/crypto.test.ts` verify:
  - Round-trip `encryptMypPassword` $\rightarrow$ `decryptMypPassword` produces the exact original plaintext.
  - Encrypting the same password twice yields distinct ciphertexts (unique IV).
  - Tampering with the IV, auth tag, or ciphertext causes `decryptMypPassword` to throw an authentication error.
- [ ] Saving credentials in `/settings` stores `myp_login` and an `AES-256-GCM` payload in `myp_password_encrypted` on the user's row in Turso, and never returns `myp_password_encrypted` or the plaintext password to the browser.
- [ ] Clicking *"Clear Saved Credentials"* sets both `myp_login` and `myp_password_encrypted` to `NULL`.
- [ ] `npm test` and `npm run build` pass with zero errors.

## Blocked by

None
