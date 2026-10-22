import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import ShortageTable, { type ShortageItem } from "../ShortageTable";

vi.stubGlobal("React", React);

function makeItem(overrides: Partial<ShortageItem> = {}): ShortageItem {
  return {
    cardSlug: "fireball",
    cardName: "Fireball",
    zone: "main",
    imageUrl: null,
    requiredQuantity: 4,
    availableQuantity: 1,
    missingQuantity: 3,
    isContended: false,
    contendingDeckNames: [],
    dedicatedCopiesOwned: 0,
    sharedCopiesOwned: 1,
    friendsWithIdle: [],
    ...overrides,
  };
}

function render(
  items: ShortageItem[],
  props: Omit<React.ComponentProps<typeof ShortageTable>, "items">,
) {
  return renderToStaticMarkup(
    <I18nProvider>
      <ShortageTable items={items} {...props} />
    </I18nProvider>,
  );
}

describe("ShortageTable quantity controls", () => {
  it("renders per-copy add and remove controls alongside the fill-all shortcut", () => {
    const html = render([makeItem()], {
      onAdjustQuantity: vi.fn(),
      onAddMissing: vi.fn(),
    });

    expect(html).toContain("Remove one Fireball");
    expect(html).toContain("Add one Fireball");
    expect(html).toContain("Add all 3");
  });

  it("hides the fill-all shortcut for covered cards but keeps the stepper", () => {
    const html = render(
      [makeItem({ requiredQuantity: 4, availableQuantity: 4, missingQuantity: 0 })],
      {
        onAdjustQuantity: vi.fn(),
        onAddMissing: vi.fn(),
      },
    );

    expect(html).not.toContain("Add all");
    expect(html).toContain("Remove one Fireball");
    expect(html).toContain("Add one Fireball");
  });

  it("does not render action controls when no handlers are provided", () => {
    const html = render([makeItem()], {});

    expect(html).not.toContain("Remove one Fireball");
    expect(html).not.toContain("Add all 3");
  });
});
