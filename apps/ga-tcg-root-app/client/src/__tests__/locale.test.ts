import { describe, expect, it, afterEach, beforeEach } from "vitest";
import {
  detectClientLocale,
  getStoredUserLocale,
  setStoredUserLocale,
  resolveEffectiveLocale,
  USER_LOCALE_STORAGE_KEY,
} from "../locale";

describe("detectClientLocale", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("resolves pt-BR when navigator.language is pt-BR", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "pt-BR" },
      configurable: true,
      writable: true,
    });
    expect(detectClientLocale()).toBe("pt-BR");
  });

  it("resolves pt-BR when navigator.language is pt", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "pt" },
      configurable: true,
      writable: true,
    });
    expect(detectClientLocale()).toBe("pt-BR");
  });

  it("falls back to en when navigator.language is en-US or unrecognized", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "es-ES" },
      configurable: true,
      writable: true,
    });
    expect(detectClientLocale()).toBe("en");
  });

  it("falls back to en when navigator is undefined", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(detectClientLocale()).toBe("en");
  });
});

describe("localStorage and effective locale resolution", () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, val);
    },
    clear: () => {
      store.clear();
    },
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
      writable: true,
    });
  });

  it("stores and retrieves user locale from localStorage", () => {
    expect(getStoredUserLocale()).toBeNull();
    setStoredUserLocale("pt-BR");
    expect(getStoredUserLocale()).toBe("pt-BR");
    setStoredUserLocale("en");
    expect(getStoredUserLocale()).toBe("en");
  });

  it("resolveEffectiveLocale prioritizes user choice over community and browser", () => {
    expect(
      resolveEffectiveLocale({
        userChoice: "pt-BR",
        communityLocale: "en",
        browserLocale: "en",
      })
    ).toBe("pt-BR");
  });

  it("resolveEffectiveLocale falls back to community broadcastLocale when user choice is not set", () => {
    expect(
      resolveEffectiveLocale({
        userChoice: null,
        communityLocale: "pt-BR",
        browserLocale: "en",
      })
    ).toBe("pt-BR");
  });

  it("resolveEffectiveLocale falls back to browser locale when community broadcastLocale is missing", () => {
    expect(
      resolveEffectiveLocale({
        userChoice: null,
        communityLocale: null,
        browserLocale: "pt-BR",
      })
    ).toBe("pt-BR");
  });
});
