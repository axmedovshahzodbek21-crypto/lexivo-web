// Generates icon-192.png and icon-512.png using pure Node.js (no extra deps)
import { createWriteStream } from 'fs';
import { deflateSync } from 'zlib';

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
    table[i] = v;
  }
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u32be(n) {
  return Buffer.from([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = u32be(data.length);
  const crc = u32be(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size) {
  // Background: #6C63FF (Lexivo purple)
  const R = 0x6C, G = 0x63, B = 0xFF;
  // Letter "L" drawn as white pixels (simple bitmap)
  const cx = Math.floor(size * 0.30), cy = Math.floor(size * 0.20);
  const sw = Math.max(1, Math.floor(size * 0.12)); // stroke width
  const lh = Math.floor(size * 0.60); // letter height
  const lw = Math.floor(size * 0.35); // letter width (horizontal bar)

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < size; x++) {
      const inVert = x >= cx && x < cx + sw && y >= cy && y < cy + lh;
      const inHoriz = y >= cy + lh - sw && y < cy + lh && x >= cx && x < cx + lw;
      if (inVert || inHoriz) {
        row.push(255, 255, 255); // white
      } else {
        row.push(R, G, B); // purple
      }
    }
    rows.push(Buffer.from(row));
  }

  const raw = deflateSync(Buffer.concat(rows));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([u32be(size), u32be(size), Buffer.from([8, 2, 0, 0, 0])]));
  const idat = chunk('IDAT', raw);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

for (const size of [192, 512]) {
  const png = makePNG(size);
  createWriteStream(`public/icon-${size}.png`).write(png);
  console.log(`Created public/icon-${size}.png`);
}
