import { describe, it, expect } from "vitest";
import { orderCorners, quadArea, maxCornerDelta, solveHomography, applyHomography } from "./geometry";
import { laplacianVariance, glareRatio, evaluateFrame } from "./quality-gate";
import { DEFAULT_QUALITY_GATE, Quad } from "./contracts";

const rectQuad = (x: number, y: number, w: number, h: number): Quad => [
  { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
];

describe("geometry", () => {
  it("orders shuffled corners as TL, TR, BR, BL", () => {
    const [tl, tr, br, bl] = rectQuad(10, 20, 100, 140);
    expect(orderCorners([br, tl, bl, tr])).toEqual([tl, tr, br, bl]);
  });

  it("computes quad area", () => {
    expect(quadArea(rectQuad(0, 0, 10, 20))).toBe(200);
  });

  it("computes max corner delta", () => {
    const a = rectQuad(0, 0, 10, 10);
    const b = rectQuad(3, 4, 10, 10);
    expect(maxCornerDelta(a, b)).toBeCloseTo(5);
  });

  it("homography maps source corners to destination corners", () => {
    const src: Quad = [{ x: 12, y: 8 }, { x: 310, y: 20 }, { x: 300, y: 450 }, { x: 5, y: 430 }];
    const dst = rectQuad(0, 0, 630, 880);
    const h = solveHomography(src, dst);
    src.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(dst[i].x, 3);
      expect(q.y).toBeCloseTo(dst[i].y, 3);
    });
  });
});

describe("pixel metrics", () => {
  const w = 20, h = 20;
  it("flat image has zero laplacian variance, checkerboard is sharp", () => {
    const flat = new Uint8Array(w * h).fill(128);
    const checker = new Uint8Array(w * h).map((_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0);
    expect(laplacianVariance(flat, w, h)).toBe(0);
    expect(laplacianVariance(checker, w, h)).toBeGreaterThan(1000);
  });

  it("glare ratio counts pixels above threshold inside quad only", () => {
    const gray = new Uint8Array(w * h).fill(100);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) gray[y * w + x] = 255;
    // quad covers left-top 10x10 plus another 10x10 of normal pixels
    const q = rectQuad(0, 0, 20, 10);
    expect(glareRatio(gray, w, h, q, 250)).toBeCloseTo(0.5, 1);
  });
});

describe("evaluateFrame", () => {
  const guide = { x: 0, y: 0, width: 100, height: 140 };
  const good = rectQuad(5, 5, 90, 126); // ~81% coverage
  const base = { guide, quad: good, sharpness: 500, glare: 0, timestamp: 0 };
  const cfg = DEFAULT_QUALITY_GATE;

  it("returns no_card without quad", () => {
    const m = evaluateFrame({ ...base, quad: null }, null, cfg);
    expect(m.verdict).toBe("no_card");
    expect(m.stableFrames).toBe(0);
  });

  it("requires 3 consecutive stable frames then becomes ready", () => {
    let prev = evaluateFrame(base, null, cfg);
    expect(prev.verdict).toBe("hold");
    prev = evaluateFrame(base, prev, cfg);
    expect(prev.verdict).toBe("hold");
    prev = evaluateFrame(base, prev, cfg);
    expect(prev.stableFrames).toBe(3);
    expect(prev.verdict).toBe("ready");
  });

  it("rejects low coverage", () => {
    const m = evaluateFrame({ ...base, quad: rectQuad(0, 0, 50, 70) }, null, cfg);
    expect(m.verdict).toBe("hold");
    expect(m.stableFrames).toBe(0);
  });

  it("flags unstable when corners move >= 8px", () => {
    const first = evaluateFrame(base, null, cfg);
    const m = evaluateFrame({ ...base, quad: rectQuad(15, 5, 90, 126) }, first, cfg);
    expect(m.verdict).toBe("unstable");
    expect(m.stableFrames).toBe(0);
  });

  it("flags blurry frames", () => {
    const m = evaluateFrame({ ...base, sharpness: 10 }, null, cfg);
    expect(m.verdict).toBe("blurry");
  });

  it("emits a non-blocking glare hint instead of ready", () => {
    let prev = evaluateFrame({ ...base, glare: 0.2 }, null, cfg);
    prev = evaluateFrame({ ...base, glare: 0.2 }, prev, cfg);
    prev = evaluateFrame({ ...base, glare: 0.2 }, prev, cfg);
    expect(prev.verdict).toBe("glare");
    expect(prev.hint).toMatch(/glare/i);
  });
});
