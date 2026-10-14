import type { Point, Quad, Rect } from "./contracts";

/** Order 4 points as [topLeft, topRight, bottomRight, bottomLeft]. */
export function orderCorners(pts: Point[]): Quad {
  if (pts.length !== 4) throw new Error("orderCorners expects exactly 4 points");
  const by = (score: (p: Point) => number, pick: "min" | "max") =>
    pts.reduce((best, p) => (pick === "min" ? score(p) < score(best) : score(p) > score(best)) ? p : best);
  return [
    by((p) => p.x + p.y, "min"),
    by((p) => p.x - p.y, "max"),
    by((p) => p.x + p.y, "max"),
    by((p) => p.x - p.y, "min"),
  ];
}

export function quadArea(q: Quad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function rectArea(r: Rect): number {
  return r.width * r.height;
}

export function maxCornerDelta(a: Quad, b: Quad): number {
  return Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));
}

/** Solve the 3x3 homography (row-major, h33 = 1) mapping src corners to dst corners. */
export function solveHomography(src: Quad, dst: Quad): number[] {
  const m: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error("Degenerate quad: homography is singular");
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 9; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [...m.map((row, i) => row[8] / row[i]), 1];
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}
