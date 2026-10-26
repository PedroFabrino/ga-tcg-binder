import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { SettingsLinkedAccountsSection } from "../SettingsLinkedAccountsSection";

vi.stubGlobal("React", React);

vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ identities: [] }),
    }),
  ),
);

describe("SettingsLinkedAccountsSection", () => {
  it("renders card title when hideHeader is false", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <SettingsLinkedAccountsSection hideHeader={false} />
      </I18nProvider>,
    );

    expect(html).toContain("Linked Accounts (Discord &amp; Root)");
    expect(html).toContain("Connect your Discord or Root accounts");
    expect(html).toContain("Generate Pairing Code");
  });

  it("omits inner header when hideHeader is true", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <SettingsLinkedAccountsSection hideHeader={true} />
      </I18nProvider>,
    );

    expect(html).not.toContain("Linked Accounts (Discord &amp; Root)");
    expect(html).toContain("Generate Pairing Code");
  });
});
