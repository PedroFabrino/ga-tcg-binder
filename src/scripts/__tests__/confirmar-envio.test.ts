import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  toMypCarrier,
  fillAndValidateConfirmarEnvioForm,
} from "../fulfillment-helpers";

describe("MyP Shipping Confirmation Form Bridge (src/scripts/fulfillment-helpers.ts)", () => {
  it("maps carriers to official MyP options correctly", () => {
    expect(toMypCarrier("loggi")).toBe("loggi");
    expect(toMypCarrier("jadlog")).toBe("jadlog");
    expect(toMypCarrier("correios")).toBe("correios");
    expect(toMypCarrier("unknown")).toBe("outro");
    expect(toMypCarrier("")).toBe("outro");
    expect(toMypCarrier(null)).toBe("outro");
  });

  it("verifies expected form elements exist in real myp-confirmar-envio.html fixture", () => {
    const htmlPath = path.resolve(process.cwd(), "myp-confirmar-envio.html");
    const html = fs.readFileSync(htmlPath, "utf-8");

    expect(html).toContain('id="transportadorapedido"');
    expect(html).toContain('id="pedido-numerorastreiopedido"');
    expect(html).toContain('id="btn-confirmar-envio"');
    expect(html).toContain('id="w0"');
    expect(html).toContain('"loggi"');
    expect(html).toContain('"jadlog"');
    expect(html).toContain('"correios"');
  });

  it("fills and validates the form in Assisted Validation Mode without submitting", () => {
    const mockSelect = { value: "", dispatchEvent: vi.fn() };
    const mockInput = { value: "", dispatchEvent: vi.fn() };
    const mockSubmitBtn = { disabled: true };
    const mockForm = { submit: vi.fn() };

    const mockDoc = {
      querySelector: (sel: string) => {
        if (sel === "#transportadorapedido") return mockSelect;
        if (sel === "#pedido-numerorastreiopedido") return mockInput;
        if (sel === "#btn-confirmar-envio") return mockSubmitBtn;
        if (sel === "#w0") return mockForm;
        return null;
      },
    };

    const result = fillAndValidateConfirmarEnvioForm(mockDoc, {
      orderId: "653380",
      carrier: "loggi",
      trackingCode: "BR991122LOGGI",
      autoSubmit: false,
    });

    expect(result.success).toBe(true);
    expect(result.mappedCarrier).toBe("loggi");
    expect(result.submitted).toBe(false);

    expect(mockSelect.value).toBe("loggi");
    expect(mockInput.value).toBe("BR991122LOGGI");
    expect(mockSubmitBtn.disabled).toBe(false);
    expect(mockForm.submit).not.toHaveBeenCalled();
    expect(mockSelect.dispatchEvent).toHaveBeenCalled();
    expect(mockInput.dispatchEvent).toHaveBeenCalledTimes(2); // input and blur
  });

  it("submits the form in Batch Auto-Submit Mode", () => {
    const mockSelect = { value: "", dispatchEvent: vi.fn() };
    const mockInput = { value: "", dispatchEvent: vi.fn() };
    const mockSubmitBtn = { disabled: true };
    const mockForm = { submit: vi.fn() };

    const mockDoc = {
      querySelector: (sel: string) => {
        if (sel === "#transportadorapedido") return mockSelect;
        if (sel === "#pedido-numerorastreiopedido") return mockInput;
        if (sel === "#btn-confirmar-envio") return mockSubmitBtn;
        if (sel === "#w0") return mockForm;
        return null;
      },
    };

    const result = fillAndValidateConfirmarEnvioForm(mockDoc, {
      orderId: "653380",
      carrier: "correios",
      trackingCode: "NL123456789BR",
      autoSubmit: true,
    });

    expect(result.success).toBe(true);
    expect(result.mappedCarrier).toBe("correios");
    expect(result.submitted).toBe(true);
    expect(mockForm.submit).toHaveBeenCalled();
  });
});
