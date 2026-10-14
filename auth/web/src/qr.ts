/**
 * QR Code, byte mode, error-correction level L, versions 1–9.
 * Enough for an otpauth URI. Mask 0. No third-party encoder, so the secret stays on this server.
 */

const ECC_L = [
  { data: 19, ecc: 7, blocks: 1 },
  { data: 34, ecc: 10, blocks: 1 },
  { data: 55, ecc: 15, blocks: 1 },
  { data: 80, ecc: 20, blocks: 1 },
  { data: 108, ecc: 26, blocks: 1 },
  { data: 136, ecc: 18, blocks: 2 },
  { data: 156, ecc: 20, blocks: 2 },
  { data: 194, ecc: 24, blocks: 2 },
  { data: 232, ecc: 30, blocks: 2 },
] as const;

const ALIGN: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
];

/** Bits left over after the codewords fill the matrix. */
const REMAINDER_BITS = [0, 7, 7, 7, 7, 7, 0, 0, 0];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!;
}

export function qrSvg(text: string): string {
  const modules = encode(text);
  const size = modules.length;
  const cell = 4;
  const quiet = 4;
  const dim = (size + quiet * 2) * cell;
  let rects = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!modules[y]?.[x]) continue;
      rects += `<rect x="${(x + quiet) * cell}" y="${(y + quiet) * cell}" width="${cell}" height="${cell}" fill="#000"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
}

function encode(text: string): boolean[][] {
  const bytes = Buffer.from(text, "utf8");
  const version = chooseVersion(bytes.length);
  const spec = ECC_L[version - 1]!;
  const size = 21 + (version - 1) * 4;
  const dark: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  drawFinder(dark, fn, 0, 0);
  drawFinder(dark, fn, size - 7, 0);
  drawFinder(dark, fn, 0, size - 7);
  drawTiming(dark, fn, size);
  drawAlignment(dark, fn, version);
  reserveFormat(fn, size);
  drawVersion(dark, fn, version, size);

  const payload = dataCodewords(bytes, spec.data);
  const perBlock = spec.data / spec.blocks;
  const blocks: number[][] = [];
  const eccs: number[][] = [];
  for (let i = 0; i < spec.blocks; i += 1) {
    const block = payload.slice(i * perBlock, (i + 1) * perBlock);
    blocks.push(block);
    eccs.push(remainder(block, spec.ecc));
  }
  placeData(dark, fn, size, interleave(blocks, eccs), REMAINDER_BITS[version - 1] ?? 0);
  placeFormat(dark, size, formatBits(1, 0));
  applyMask0(dark, fn, size);
  return dark;
}

function chooseVersion(byteLength: number): number {
  const payloadBits = 4 + 8 + byteLength * 8;
  const version = ECC_L.findIndex((item) => item.data * 8 >= payloadBits) + 1;
  if (version < 1) throw new Error("Authenticator link is too long for a QR code.");
  return version;
}

function drawFinder(dark: boolean[][], fn: boolean[][], row: number, col: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const r = row + y;
      const c = col + x;
      if (r < 0 || c < 0 || r >= dark.length || c >= dark.length) continue;
      fn[r]![c] = true;
      const edge = y === -1 || x === -1 || y === 7 || x === 7;
      const outer = y === 0 || x === 0 || y === 6 || x === 6;
      const inner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
      dark[r]![c] = !edge && (outer || inner);
    }
  }
}

function drawTiming(dark: boolean[][], fn: boolean[][], size: number) {
  for (let i = 8; i < size - 8; i += 1) {
    const on = i % 2 === 0;
    dark[6]![i] = on;
    fn[6]![i] = true;
    dark[i]![6] = on;
    fn[i]![6] = true;
  }
}

function drawAlignment(dark: boolean[][], fn: boolean[][], version: number) {
  const centers = ALIGN[version - 1] ?? [];
  const last = centers.length - 1;
  for (let rowIndex = 0; rowIndex < centers.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < centers.length; colIndex += 1) {
      const onFinder =
        (rowIndex === 0 && colIndex === 0) ||
        (rowIndex === 0 && colIndex === last) ||
        (rowIndex === last && colIndex === 0);
      if (onFinder) continue;
      const r = centers[rowIndex]!;
      const c = centers[colIndex]!;
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          fn[r + y]![c + x] = true;
          const edge = Math.abs(y) === 2 || Math.abs(x) === 2;
          dark[r + y]![c + x] = edge || (y === 0 && x === 0);
        }
      }
    }
  }
}

function reserveFormat(fn: boolean[][], size: number) {
  for (let i = 0; i < 9; i += 1) {
    fn[8]![i] = true;
    fn[i]![8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    fn[8]![size - 1 - i] = true;
    fn[size - 1 - i]![8] = true;
  }
}

function drawVersion(dark: boolean[][], fn: boolean[][], version: number, size: number) {
  if (version < 7) return;
  let data = version << 12;
  for (let i = 17; i >= 12; i -= 1) {
    if ((data >>> i) & 1) data ^= 0x1f25 << (i - 12);
  }
  const bits = (version << 12) | data;
  for (let i = 0; i < 18; i += 1) {
    const on = ((bits >>> i) & 1) === 1;
    const row = Math.floor(i / 3);
    const col = (i % 3) + size - 11;
    dark[row]![col] = on;
    fn[row]![col] = true;
    dark[col]![row] = on;
    fn[col]![row] = true;
  }
}

function dataCodewords(bytes: Buffer, capacity: number): number[] {
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  for (const byte of bytes) pushBits(bits, byte, 8);
  const capacityBits = capacity * 8;
  pushBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let b = 0; b < 8; b += 1) value = (value << 1) | (bits[i + b] ?? 0);
    out.push(value);
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (out.length < capacity) {
    out.push(pads[pad % 2]!);
    pad += 1;
  }
  return out;
}

function pushBits(bits: number[], value: number, count: number) {
  for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

/** Coefficients are highest degree first, including the leading 1. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const factor = [1, EXP[i]!];
    const next = new Array<number>(poly.length + factor.length - 1).fill(0);
    for (let a = 0; a < poly.length; a += 1) {
      for (let b = 0; b < factor.length; b += 1) {
        next[a + b] = (next[a + b] ?? 0) ^ mul(poly[a]!, factor[b]!);
      }
    }
    poly = next;
  }
  return poly;
}

function remainder(data: number[], eccLen: number): number[] {
  const gen = generator(eccLen);
  const msg = data.concat(Array<number>(eccLen).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const factor = msg[i]!;
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      msg[i + j] = (msg[i + j] ?? 0) ^ mul(gen[j]!, factor);
    }
  }
  return msg.slice(data.length);
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0;
}

function interleave(blocks: number[][], eccs: number[][]): number[] {
  const out: number[] = [];
  const longest = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < longest; i += 1) {
    for (const block of blocks) if (block[i] !== undefined) out.push(block[i]!);
  }
  const eccLen = eccs[0]?.length ?? 0;
  for (let i = 0; i < eccLen; i += 1) {
    for (const block of eccs) out.push(block[i]!);
  }
  return out;
}

function placeData(
  dark: boolean[][],
  fn: boolean[][],
  size: number,
  bytes: number[],
  remainderBits: number,
) {
  const bits: number[] = [];
  for (const byte of bytes) pushBits(bits, byte, 8);
  for (let i = 0; i < remainderBits; i += 1) bits.push(0);
  let i = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    const rows = upward
      ? Array.from({ length: size }, (_, n) => size - 1 - n)
      : Array.from({ length: size }, (_, n) => n);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (fn[row]?.[c]) continue;
        dark[row]![c] = bits[i] === 1;
        i += 1;
      }
    }
    upward = !upward;
  }
}

function applyMask0(dark: boolean[][], fn: boolean[][], size: number) {
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (fn[r]?.[c]) continue;
      if ((r + c) % 2 === 0) dark[r]![c] = !dark[r]![c];
    }
  }
}

function formatBits(ecc: number, mask: number): number {
  const data = (ecc << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function placeFormat(dark: boolean[][], size: number, bits: number) {
  for (let i = 0; i < 15; i += 1) {
    const on = ((bits >>> i) & 1) === 1;
    if (i < 6) dark[i]![8] = on;
    else if (i < 8) dark[i + 1]![8] = on;
    else dark[size - 15 + i]![8] = on;

    if (i < 8) dark[8]![size - i - 1] = on;
    else if (i < 9) dark[8]![15 - i] = on;
    else dark[8]![14 - i] = on;
  }
  dark[size - 8]![8] = true;
}
