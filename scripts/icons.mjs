// Jednokratno: crta ikonu aplikacije (top na zelenoj podlozi) kao PNG bez vanjskih biblioteka.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// Oblik topa u jedinicama 0..100 (pravokutnici + trapez)
const rects = [
  [26, 78, 74, 86], [30, 72, 70, 78],          // postolje
  [26, 22, 74, 34],                            // vrh
  [26, 14, 34, 22], [42, 14, 58, 22], [66, 14, 74, 22], // zupci
];
function inside(x, y) {
  for (const [x0, y0, x1, y1] of rects) if (x >= x0 && x < x1 && y >= y0 && y < y1) return true;
  if (y >= 34 && y < 72) { const t = (y - 34) / 38; const half = 13 + t * 4; return Math.abs(x - 50) < half; }
  return false;
}
function png(size, file) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = [14, 102, 85], fg = [255, 255, 255], S = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const ux = ((x + (sx + 0.5) / S) / size) * 100, uy = ((y + (sy + 0.5) / S) / size) * 100;
        if (inside(ux, uy)) hit++;
      }
      const a = hit / (S * S), o = y * (size * 4 + 1) + 1 + x * 4;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(bg[i] * (1 - a) + fg[i] * a);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
png(192, "docs/icon-192.png");
png(512, "docs/icon-512.png");
