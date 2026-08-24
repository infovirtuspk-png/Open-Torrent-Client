const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function writePNG(filePath, width, height, pixelsFn) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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
  IHDR[8] = 8;  // 8-bit depth
  IHDR[9] = 6;  // RGBA format
  IHDR[10] = 0; IHDR[11] = 0; IHDR[12] = 0;

  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelsFn(x, y, width, height);
      row.push(r, g, b, a);
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

const outPath = path.join(__dirname, '..', 'assets', 'icon.png');
const size = 256;

writePNG(outPath, size, size, (x, y, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  const radius = w * 0.46;

  // Outer transparent region
  if (dist > radius) {
    return [0, 0, 0, 0];
  }

  // Rounded squircle container with dark tech gradient background
  const t = y / h;
  let r = Math.round(15 + t * 15);
  let g = Math.round(23 + t * 25);
  let b = Math.round(42 + t * 45);
  let a = 255;

  // Outer glowing ring
  const ringInner = radius * 0.88;
  const ringOuter = radius * 0.98;
  if (dist >= ringInner && dist <= ringOuter) {
    r = 56; g = 189; b = 248; // accent cyan-blue glow
  }

  // Centered BitTorrent Download Arrow
  const arrowStemW = w * 0.12;
  const arrowStemTop = h * 0.25;
  const arrowStemBot = h * 0.58;

  const arrowHeadTop = h * 0.52;
  const arrowHeadBot = h * 0.76;
  const arrowHeadW = w * 0.28;

  let isArrow = false;
  // Stem
  if (y >= arrowStemTop && y <= arrowStemBot && Math.abs(x - cx) <= arrowStemW) {
    isArrow = true;
  }
  // Head triangle
  if (y >= arrowHeadTop && y <= arrowHeadBot) {
    const frac = (y - arrowHeadTop) / (arrowHeadBot - arrowHeadTop);
    const curW = arrowHeadW * (1 - frac);
    if (Math.abs(x - cx) <= curW) {
      isArrow = true;
    }
  }

  if (isArrow) {
    r = 255; g = 255; b = 255; // White vibrant arrow
  }

  return [r, g, b, a];
});

console.log('✓ High-res application icon generated at assets/icon.png');
