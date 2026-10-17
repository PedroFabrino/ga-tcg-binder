import { describe, it, expect } from "vitest";
import { encryptMypPassword, decryptMypPassword } from "../crypto";

describe("AES-256-GCM Credential Encryption (src/lib/crypto.ts)", () => {
  it("encrypts and decrypts a password cleanly", () => {
    const raw = "SuperSecretMyPPass123!";
    const encrypted = encryptMypPassword(raw);

    expect(encrypted).not.toBe(raw);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptMypPassword(encrypted);
    expect(decrypted).toBe(raw);
  });

  it("produces unique ciphertexts and IVs for the same password", () => {
    const raw = "RepeatedPassword99";
    const enc1 = encryptMypPassword(raw);
    const enc2 = encryptMypPassword(raw);

    expect(enc1).not.toBe(enc2);
    expect(enc1.split(":")[0]).not.toBe(enc2.split(":")[0]); // Distinct IVs
    expect(decryptMypPassword(enc1)).toBe(raw);
    expect(decryptMypPassword(enc2)).toBe(raw);
  });

  it("fails decryption when authentication tag or ciphertext is tampered with", () => {
    const raw = "TamperMe";
    const encrypted = encryptMypPassword(raw);
    const [ivHex, authTagHex, cipherHex] = encrypted.split(":");

    // Tamper with ciphertext
    const tamperedCipher = cipherHex.slice(0, -2) + (cipherHex.slice(-2) === "aa" ? "bb" : "aa");
    const tamperedPayload = `${ivHex}:${authTagHex}:${tamperedCipher}`;

    expect(() => decryptMypPassword(tamperedPayload)).toThrow();

    // Tamper with auth tag
    const tamperedTag = authTagHex.slice(0, -2) + (authTagHex.slice(-2) === "11" ? "22" : "11");
    const tamperedTagPayload = `${ivHex}:${tamperedTag}:${cipherHex}`;

    expect(() => decryptMypPassword(tamperedTagPayload)).toThrow();
  });

  it("throws on malformed payload format", () => {
    expect(() => decryptMypPassword("invalid-payload")).toThrow();
    expect(() => decryptMypPassword("part1:part2")).toThrow();
  });
});
