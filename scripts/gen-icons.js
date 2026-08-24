/**
 * Pure Node.js PNG icon generator for Open Torrent Client.
 * Generates 32x32 PNG icons for tray states: idle, downloading, seeding, paused, error.
 * Uses raw PNG bytes (no external canvas dependency).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function writePNG(filePath, width, height, pixelsFn) {
  const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

  function crc32(buf) {
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR[8] = 8;  // bit depth
  IHDR[9] = 2;  // color type: RGB
  IHDR[10] = 0; IHDR[11] = 0; IHDR[12] = 0;

  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelsFn(x, y, width, height);
      row.push(r, g, b);
    }
    rawRows.push(Buffer.from(row));
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);

  const parts = [
    PNG_SIGNATURE,
    chunk('IHDR', IHDR),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ];
  fs.writeFileSync(filePath, Buffer.concat(parts));
}

// Helper: draw circle
function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

// Helper: draw arrow shape (downward)
function drawArrowDown(x, y, w, h) {
  const cx = Math.round(w * 0.5);
  const stemW = Math.round(w * 0.18);
  const stemTop = Math.round(h * 0.2);
  const stemBot = Math.round(h * 0.58);
  const headTop = Math.round(h * 0.52);
  const headBot = Math.round(h * 0.8);
  const headW = Math.round(w * 0.36);

  // Stem
  if (y >= stemTop && y <= stemBot && x >= cx - stemW && x <= cx + stemW) return true;
  // Arrowhead triangle
  if (y > headTop && y <= headBot) {
    const frac = (y - headTop) / (headBot - headTop);
    const halfW = Math.round(headW * (1 - frac));
    if (x >= cx - halfW && x <= cx + halfW) return true;
  }
  return false;
}

const outDir = path.join(__dirname, '..', 'assets');

// --- IDLE / Default Icon (dark BG with down-arrow) ---
writePNG(path.join(outDir, 'tray.png'), 32, 32, (x, y, w, h) => {
  if (x === 0 || y === 0 || x === w-1 || y === h-1) return [40, 50, 70];
  if (drawArrowDown(x, y, w, h)) return [56, 189, 248]; // accent blue
  return [22, 34, 55]; // dark bg
});

// --- DOWNLOADING (vibrant blue) ---
writePNG(path.join(outDir, 'tray_downloading.png'), 32, 32, (x, y, w, h) => {
  if (x === 0 || y === 0 || x === w-1 || y === h-1) return [2, 132, 199];
  if (drawArrowDown(x, y, w, h)) return [255, 255, 255];
  return [2, 132, 199]; // accent blue fill
});

// --- SEEDING (green up-arrow) ---
writePNG(path.join(outDir, 'tray_seeding.png'), 32, 32, (x, y, w, h) => {
  const cx = Math.round(w * 0.5);
  const stemW = Math.round(w * 0.18);
  const stemTop = Math.round(h * 0.4);
  const stemBot = Math.round(h * 0.78);
  const headTop = Math.round(h * 0.18);
  const headBot = Math.round(h * 0.46);
  const headW = Math.round(w * 0.36);

  let arrow = false;
  if (y >= stemTop && y <= stemBot && x >= cx - stemW && x <= cx + stemW) arrow = true;
  if (y >= headTop && y < headBot) {
    const frac = (y - headTop) / (headBot - headTop);
    const halfW = Math.round(headW * frac);
    if (x >= cx - halfW && x <= cx + halfW) arrow = true;
  }

  if (x === 0 || y === 0 || x === w-1 || y === h-1) return [5, 150, 105];
  if (arrow) return [255, 255, 255];
  return [5, 150, 105]; // green fill
});

// --- PAUSED (yellow pause bars) ---
writePNG(path.join(outDir, 'tray_paused.png'), 32, 32, (x, y, w, h) => {
  const bar1L = Math.round(w * 0.22), bar1R = Math.round(w * 0.42);
  const bar2L = Math.round(w * 0.58), bar2R = Math.round(w * 0.78);
  const barT = Math.round(h * 0.25), barB = Math.round(h * 0.75);

  if (x === 0 || y === 0 || x === w-1 || y === h-1) return [180, 120, 0];
  if (y >= barT && y <= barB && ((x >= bar1L && x <= bar1R) || (x >= bar2L && x <= bar2R))) return [255, 255, 255];
  return [217, 119, 6]; // amber fill
});

// --- ERROR (red X) ---
writePNG(path.join(outDir, 'tray_error.png'), 32, 32, (x, y, w, h) => {
  const t = 3;
  const diag1 = Math.abs((x - y) - (w/2 - h/2)) < t && x > 4 && x < w-5 && y > 4 && y < h-5;
  const diag2 = Math.abs((x + y) - (w/2 + h/2)) < t && x > 4 && x < w-5 && y > 4 && y < h-5;

  if (x === 0 || y === 0 || x === w-1 || y === h-1) return [180, 30, 30];
  if (diag1 || diag2) return [255, 255, 255];
  return [220, 38, 38]; // red fill
});

console.log('✓ All tray icons generated in assets/');
