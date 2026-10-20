import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsMypSection } from "../SettingsMypSection";
import { I18nProvider } from "@/lib/i18n";

vi.stubGlobal("React", React);

function render(overrides: Partial<React.ComponentProps<typeof SettingsMypSection>> = {}) {
  return renderToStaticMarkup(
    <I18nProvider>
      <SettingsMypSection
        mypUsername=""
        setMypUsername={vi.fn()}
        mypLogin=""
        setMypLogin={vi.fn()}
        mypPassword=""
        setMypPassword={vi.fn()}
        mypAutoWatchlistEnabled={false}
        setMypAutoWatchlistEnabled={vi.fn()}
        sellerModeEnabled={false}
        setSellerModeEnabled={vi.fn()}
        hasSavedMypCredentials={false}
        loading={false}
        clearingCreds={false}
        onClearCredentials={vi.fn()}
        {...overrides}
      />
    </I18nProvider>
  );
}

describe("SettingsMypSection Seller Mode", () => {
  it("offers Seller Mode before any MyP credentials are saved", () => {
    expect(render()).toContain("Enable Seller Mode");
  });

  it("reflects an enabled Seller Mode", () => {
    const html = render({ sellerModeEnabled: true });
    expect(html).toMatch(/<input[^>]*checked[^>]*>/);
  });
});
