import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import LinkedAccountsPage from "../page";

vi.stubGlobal("React", React);

// Mock global fetch for SettingsLinkedAccountsSection
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ identities: [] }),
    }),
  ),
);

describe("LinkedAccountsPage", () => {
  it("renders page header and back link to /settings", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <LinkedAccountsPage />
      </I18nProvider>,
    );

    expect(html).toContain('href="/settings"');
    expect(html).toContain("Linked Accounts (Discord &amp; Root)");
    expect(html).toContain("Connect your Discord or Root accounts");
  });
});
