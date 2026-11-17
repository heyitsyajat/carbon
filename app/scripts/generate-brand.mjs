#!/usr/bin/env node
/**
 * Generates the Carbon mark from a single set of geometry constants:
 *   build/logo-light.svg   burgundy mark for light surfaces
 *   build/logo-dark.svg    peach mark for dark surfaces
 *   build/logo-mono.svg    currentColor mark for UI and the website
 *   build/icon.png         512px burgundy app tile
 *   build/mark-{16,32,48,64,128,256,512}.png
 *   build/icon.ico         Windows installer icon (PNG-compressed entries)
 *
 * The mark is a hexagonal ring — a carbon ring with one peach "bond" bead.
 */
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
const websiteDir = path.resolve(root, '../website/public/brand');

const COLORS = {
  burgundy: '#7A1F33',
  peach: '#F4A58A',
  paper: '#FBEFE8',
  cream: '#FFF7F3',
};

/* ------------------------------- geometry -------------------------------- */

const VIEW = 48;
const CX = 24;
const CY = 24;
const R = 17.5;
const THICK = 4.6;
const GAP_START = 0.36;
const GAP_END = 0.64;
const BEAD_R = 3.05;

const vertices = Array.from({ length: 6 }, (_, index) => {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
});

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const v = vertices;
const start = lerp(v[0], v[1], GAP_START);
const end = lerp(v[0], v[1], GAP_END);
const BEAD = lerp(v[0], v[1], 0.5);

const ringPath = [
  `M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
  `L ${v[1].x.toFixed(3)} ${v[1].y.toFixed(3)}`,
  `L ${v[2].x.toFixed(3)} ${v[2].y.toFixed(3)}`,
  `L ${v[3].x.toFixed(3)} ${v[3].y.toFixed(3)}`,
  `L ${v[4].x.toFixed(3)} ${v[4].y.toFixed(3)}`,
  `L ${v[5].x.toFixed(3)} ${v[5].y.toFixed(3)}`,
  `L ${v[0].x.toFixed(3)} ${v[0].y.toFixed(3)}`,
  `L ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
].join(' ');

function svgDocument({ ink, beadColor, background = null, size = 48 }) {
  const pad = background ? 2 : 0;
  const bg = background
    ? `<rect x="${pad}" y="${pad}" width="${48 - pad * 2}" height="${48 - pad * 2}" rx="11" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="Carbon">
  <title>Carbon</title>
  ${bg}
  <path d="${ringPath}" fill="none" stroke="${ink}" stroke-width="${THICK}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${BEAD.x.toFixed(3)}" cy="${BEAD.y.toFixed(3)}" r="${BEAD_R}" fill="${beadColor}"/>
</svg>
`;
}

/* --------------------------------- raster -------------------------------- */

const distanceToSegment = (px, py, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
};

const ringSegments = [];
for (let index = 0; index < 6; index += 1) {
  const from = index === 0 ? start : vertices[index];
  const to = vertices[(index + 1) % 6];
  if (index === 0) {
    ringSegments.push([from, vertices[1]]);
    continue;
  }
  if (index === 5) {
    ringSegments.push([vertices[5], vertices[0]]);
    ringSegments.push([vertices[0], end]);
    continue;
  }
  ringSegments.push([from, to]);
}

const roundedRectAlpha = (x, y, cx, cy, halfW, halfH, radius) => {
  const dx = Math.abs(x - cx) - (halfW - radius);
  const dy = Math.abs(y - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  const dist = outside + inside - radius;
  return Math.min(1, Math.max(0, 0.5 - dist));
};

function renderMark(size, { tile }) {
  const scale = size / VIEW;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = (x + 0.5) / scale;
      const py = (y + 0.5) / scale;
      let distance = Infinity;
      for (const [a, b] of ringSegments) {
        distance = Math.min(distance, distanceToSegment(px, py, a, b));
      }
      const ring = Math.max(0, Math.min(1, THICK / 2 - distance + 0.35));
      const beadCoverage = Math.max(0, Math.min(1, BEAD_R - Math.hypot(px - BEAD.x, py - BEAD.y) + 0.35));

      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      if (tile) {
        const tileAlpha = roundedRectAlpha(px, py, CX, CY, 22, 22, 10.5);
        if (tileAlpha > 0) {
          const inkMark = ring > 0 ? COLORS.peach : null;
          const beadColor = beadCoverage > 0 ? COLORS.cream : null;
          const color = beadColor ?? inkMark ?? COLORS.burgundy;
          [r, g, b] = hexToRgb(color);
          alpha = tileAlpha * 255;
          // Anti-aliased mark blended over the burgundy tile.
          const coverage = Math.max(ring, beadCoverage);
          if (coverage > 0) {
            const base = hexToRgb(COLORS.burgundy);
            r = base[0] + (r - base[0]) * coverage;
            g = base[1] + (g - base[1]) * coverage;
            b = base[2] + (b - base[2]) * coverage;
          }
        }
      } else {
        const coverage = Math.max(ring, beadCoverage);
        if (coverage > 0) {
          const color = beadCoverage > 0 ? COLORS.peach : COLORS.burgundy;
          [r, g, b] = hexToRgb(color);
          alpha = Math.round(255 * coverage);
        }
      }
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(r);
      pixels[index + 1] = Math.round(g);
      pixels[index + 2] = Math.round(b);
      pixels[index + 3] = Math.round(alpha);
    }
  }
  return encodePng(size, pixels);
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/* ---------------------------------- png ---------------------------------- */

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------- ico ---------------------------------- */

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(entries.length * 16);
  let offset = 6 + directory.length;
  entries.forEach((entry, index) => {
    const base = index * 16;
    directory[base] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 2] = 0;
    directory[base + 3] = 0;
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(entry.data.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.data.length;
  });
  return Buffer.concat([header, directory, ...entries.map((entry) => entry.data)]);
}

/* --------------------------------- write --------------------------------- */

mkdirSync(buildDir, { recursive: true });
mkdirSync(websiteDir, { recursive: true });

writeFileSync(path.join(buildDir, 'logo-light.svg'), svgDocument({ ink: COLORS.burgundy, beadColor: COLORS.peach }));
writeFileSync(path.join(buildDir, 'logo-dark.svg'), svgDocument({ ink: COLORS.peach, beadColor: COLORS.peach }));
writeFileSync(path.join(buildDir, 'logo-mono.svg'), svgDocument({ ink: 'currentColor', beadColor: 'currentColor' }));

const sizes = [16, 32, 48, 64, 128, 256, 512];
const pngs = new Map();
for (const size of sizes) {
  const data = renderMark(size, { tile: true });
  pngs.set(size, data);
  writeFileSync(path.join(buildDir, `mark-${size}.png`), data);
}
writeFileSync(path.join(buildDir, 'icon.png'), pngs.get(512));
writeFileSync(
  path.join(buildDir, 'icon.ico'),
  encodeIco([16, 32, 48, 64, 128, 256].map((size) => ({ size, data: pngs.get(size) }))),
);

for (const name of ['logo-light.svg', 'logo-dark.svg', 'logo-mono.svg', 'icon.png', 'mark-256.png', 'mark-512.png', 'icon.ico']) {
  copyFileSync(path.join(buildDir, name), path.join(websiteDir, name));
}

process.stdout.write(`[brand] wrote SVG, ${sizes.join('/')} px PNGs and icon.ico\n`);
