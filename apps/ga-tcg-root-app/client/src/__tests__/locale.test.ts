import { describe, expect, it, afterEach } from "vitest";
import { detectClientLocale } from "../locale";

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
