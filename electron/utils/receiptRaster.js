const ESC = 0x1b;
const GS = 0x1d;

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function nativeBitmapToEscPos(bitmap, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const bytesPerLine = Math.ceil(safeWidth / 8);
  const raster = Buffer.alloc(bytesPerLine * safeHeight);

  for (let y = 0; y < safeHeight; y += 1) {
    for (let x = 0; x < safeWidth; x += 1) {
      const offset = (y * safeWidth + x) * 4;
      const blue = bitmap[offset] ?? 255;
      const green = bitmap[offset + 1] ?? 255;
      const red = bitmap[offset + 2] ?? 255;
      const alpha = bitmap[offset + 3] ?? 255;
      const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
      const threshold = 80 + BAYER_4X4[y % 4][x % 4] * 8;

      if (alpha > 24 && luminance < threshold) {
        const byteIndex = y * bytesPerLine + Math.floor(x / 8);
        raster[byteIndex] |= 0x80 >> (x % 8);
      }
    }
  }

  const header = Buffer.from([
    GS,
    0x76,
    0x30,
    0x00,
    bytesPerLine & 0xff,
    (bytesPerLine >> 8) & 0xff,
    safeHeight & 0xff,
    (safeHeight >> 8) & 0xff,
  ]);

  return Buffer.concat([
    Buffer.from([ESC, 0x40, ESC, 0x61, 0x01]),
    header,
    raster,
    Buffer.from([ESC, 0x61, 0x00, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x41, 0x00]),
  ]);
}

module.exports = { nativeBitmapToEscPos };
