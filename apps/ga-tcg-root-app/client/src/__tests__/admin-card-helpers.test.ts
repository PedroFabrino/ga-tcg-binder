import { describe, expect, it } from "vitest";
import { createTranslator } from "@ga/contracts";
import { pickInitialChannelId, resolveAdminErrorMessage } from "../components/admin-card-helpers";
import type { AdminSettingsResponse } from "../types";

describe("admin-card-helpers", () => {
  const tEn = createTranslator("en");
  const tPt = createTranslator("pt-BR");

  describe("pickInitialChannelId", () => {
    it("returns empty string when settings is undefined", () => {
      expect(pickInitialChannelId(undefined)).toBe("");
    });

    it("returns broadcastChannelId when present", () => {
      const settings: AdminSettingsResponse = {
        isAdmin: true,
        broadcastChannelId: "ch-broadcast-1",
        broadcastChannelName: "market",
        textChannels: [
          { id: "ch-first", name: "general" },
          { id: "ch-broadcast-1", name: "market" },
        ],
      };
      expect(pickInitialChannelId(settings)).toBe("ch-broadcast-1");
    });

    it("falls back to the first text channel when broadcastChannelId is empty", () => {
      const settings: AdminSettingsResponse = {
        isAdmin: true,
        broadcastChannelId: "",
        broadcastChannelName: "",
        textChannels: [
          { id: "ch-first", name: "general" },
          { id: "ch-second", name: "rules" },
        ],
      };
      expect(pickInitialChannelId(settings)).toBe("ch-first");
    });

    it("falls back to the first text channel when the configured channel no longer exists", () => {
      const settings: AdminSettingsResponse = {
        isAdmin: true,
        broadcastChannelId: "ch-deleted",
        broadcastChannelName: "gone",
        textChannels: [{ id: "ch-first", name: "general" }],
      };
      expect(pickInitialChannelId(settings)).toBe("ch-first");
    });

    it("returns empty string when no text channels exist and broadcastChannelId is empty", () => {
      const settings: AdminSettingsResponse = {
        isAdmin: true,
        broadcastChannelId: "",
        broadcastChannelName: "",
        textChannels: [],
      };
      expect(pickInitialChannelId(settings)).toBe("");
    });
  });

  describe("resolveAdminErrorMessage", () => {
    it("translates FORBIDDEN in en and pt-BR", () => {
      expect(resolveAdminErrorMessage("FORBIDDEN", tEn)).toBe(
        "You do not have permission to manage community settings"
      );
      expect(resolveAdminErrorMessage("FORBIDDEN", tPt)).toBe(
        "Você não tem permissão para gerenciar configurações da comunidade"
      );
    });

    it("translates CHANNEL_NOT_FOUND in en and pt-BR", () => {
      expect(resolveAdminErrorMessage("CHANNEL_NOT_FOUND", tEn)).toBe(
        "Selected channel was not found"
      );
      expect(resolveAdminErrorMessage("CHANNEL_NOT_FOUND", tPt)).toBe(
        "O canal selecionado não foi encontrado"
      );
    });

    it("translates INVALID_CHANNEL in en and pt-BR", () => {
      expect(resolveAdminErrorMessage("INVALID_CHANNEL", tEn)).toBe(
        "Invalid channel selected"
      );
      expect(resolveAdminErrorMessage("INVALID_CHANNEL", tPt)).toBe(
        "Canal selecionado inválido"
      );
    });

    it("falls back to general saveError when error code is empty or undefined", () => {
      expect(resolveAdminErrorMessage(undefined, tEn)).toBe(
        "Failed to update broadcast channel"
      );
      expect(resolveAdminErrorMessage("", tEn)).toBe(
        "Failed to update broadcast channel"
      );
    });

    it("uses the provided fallback key for unmapped empty errors", () => {
      expect(
        resolveAdminErrorMessage(undefined, tEn, "communityAdmin.provisionError")
      ).toBe("Failed to provision market channels");
    });

    it("preserves custom unmapped error messages", () => {
      expect(resolveAdminErrorMessage("Custom server timeout", tEn)).toBe(
        "Custom server timeout"
      );
    });
  });
});
