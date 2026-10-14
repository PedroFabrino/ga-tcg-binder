type Gray = Uint8Array | Uint8ClampedArray;

const COLS = 9;
const ROWS = 8;

/** 64-bit difference hash (dHash): 9x8 box-averaged grayscale, left>right per row. Returns 16 hex chars. */
export function dHash(gray: Gray, w: number, h: number): string {
  const cells: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const y0 = Math.floor((r * h) / ROWS);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * h) / ROWS));
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const x0 = Math.floor((c * w) / COLS);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * w) / COLS));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += gray[y * w + x];
          n++;
        }
      }
      row.push(sum / n);
    }
    cells.push(row);
  }
  let hex = "";
  for (let r = 0; r < ROWS; r++) {
    for (let nib = 0; nib < 2; nib++) {
      let v = 0;
      for (let b = 0; b < 4; b++) v = (v << 1) | (cells[r][nib * 4 + b] > cells[r][nib * 4 + b + 1] ? 1 : 0);
      hex += v.toString(16);
    }
  }
  return hex;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i++) d += POPCOUNT[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

export function visualSimilarity(a: string, b: string): number {
  return 1 - hamming(a, b) / 64;
}
