import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;
const SALT = "ga-tcg-binder-myp-cred-v1";
const INFO = "aes-256-gcm-key";

/**
 * Derives a 32-byte AES-256 key from AUTH_SECRET via HKDF-SHA256.
 */
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET environment variable is strictly required in production");
    }
  }
  const effectiveSecret = secret || "ga-tcg-binder-dev-test-secret-do-not-use-in-prod";
  return Buffer.from(
    crypto.hkdfSync("sha256", effectiveSecret, SALT, INFO, 32)
  );
}

/**
 * Encrypts a plaintext password using AES-256-GCM with a random 12-byte IV.
 * Returns payload in `<ivHex>:<authTagHex>:<cipherHex>` format.
 */
export function encryptMypPassword(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM payload in `<ivHex>:<authTagHex>:<cipherHex>` format.
 * Throws if the format is invalid or if the authentication tag verification fails.
 */
export function decryptMypPassword(payload: string): string {
  if (!payload || typeof payload !== "string") {
    throw new Error("Invalid encrypted payload");
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid payload format. Expected <ivHex>:<authTagHex>:<cipherHex>");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Corrupted IV or authentication tag in encrypted payload");
  }

  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
