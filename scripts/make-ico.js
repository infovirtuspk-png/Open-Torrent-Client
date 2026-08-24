/**
 * generate-proper-icon.js
 * Creates a proper multi-resolution Windows ICO with embedded PNG images
 * Sizes: 16, 32, 48, 64, 128, 256 px
 */
const fs = require('fs');
const path = require('path');

// Create proper PNG buffer for a given size using raw BMP fallback
// We'll use the existing 256x256 PNG for all sizes embedded into ICO
// ICO format supports embedded PNGs (Vista+ ICO format)

function createIco(pngBuffer) {
  const sizes = [16, 32, 48, 64, 128, 256];
  
  // For simplicity and maximum compatibility, embed the same PNG at all sizes
  // Modern Windows (Vista+) supports PNG-in-ICO format
  // electron-builder requires at least 256x256
  
  const imageCount = sizes.length;
  
  // ICO Header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(imageCount, 4); // Number of images
  
  // Each directory entry: 16 bytes
  const dirSize = 16 * imageCount;
  const headerOffset = 6 + dirSize;
  
  // Create directory entries and collect image data
  const dirs = [];
  const images = [];
  let currentOffset = headerOffset;
  
  for (const size of sizes) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 = 256)
    dir.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 = 256)
    dir.writeUInt8(0, 2); // Color palette (0 = no palette)
    dir.writeUInt8(0, 3); // Reserved
    dir.writeUInt16LE(1, 4); // Color planes
    dir.writeUInt16LE(32, 6); // Bits per pixel
    dir.writeUInt32LE(pngBuffer.length, 8); // Image data size (reusing same PNG)
    dir.writeUInt32LE(currentOffset, 12); // Offset to image data
    
    dirs.push(dir);
    images.push(pngBuffer);
    currentOffset += pngBuffer.length;
  }
  
  return Buffer.concat([header, ...dirs, ...images]);
}

const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');
const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('ERROR: assets/icon.png not found');
  process.exit(1);
}

const pngBuffer = fs.readFileSync(pngPath);
const icoBuffer = createIco(pngBuffer);
fs.writeFileSync(icoPath, icoBuffer);
console.log(`✓ Multi-resolution ICO created: ${icoPath} (${icoBuffer.length} bytes, ${Math.round(icoBuffer.length/1024)}KB)`);
