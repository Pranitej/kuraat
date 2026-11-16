// Builds the app icons from the brand wordmark's "k" (logo-white.png, 674 x 183).
// Usage (from mobile/): node scripts/make-icons.cjs .   — re-run when the brand logo changes.
const path = require('path');
const mobile = process.argv[2];
const Jimp = require(path.join(mobile, 'node_modules', 'jimp-compact'));

const MAROON = 0x781232ff;

(async () => {
  const logo = await Jimp.read(path.join(mobile, 'assets/images/logo-white.png'));
  const { width, height } = logo.bitmap;
  // Column alpha profile: the "k" ends at the first fully transparent column run after ink starts.
  const colInk = (x) => {
    for (let y = 0; y < height; y += 1) if (logo.bitmap.data[(y * width + x) * 4 + 3] > 24) return true;
    return false;
  };
  let x0 = 0;
  while (x0 < width && !colInk(x0)) x0 += 1;
  let x1 = x0;
  while (x1 < width && colInk(x1)) x1 += 1;
  // rows with ink inside [x0, x1)
  const rowInk = (y) => {
    for (let x = x0; x < x1; x += 1) if (logo.bitmap.data[(y * width + x) * 4 + 3] > 24) return true;
    return false;
  };
  let y0 = 0;
  while (y0 < height && !rowInk(y0)) y0 += 1;
  let y1 = height - 1;
  while (y1 > y0 && !rowInk(y1)) y1 -= 1;
  const k = logo.clone().crop(x0, y0, x1 - x0, y1 - y0 + 1);
  console.log('k glyph', { x0, x1, y0, y1, w: k.bitmap.width, h: k.bitmap.height });

  const place = (canvas, glyphHeight) => {
    const g = k.clone().resize(Jimp.AUTO, glyphHeight, Jimp.RESIZE_BICUBIC);
    const left = Math.round((canvas.bitmap.width - g.bitmap.width) / 2);
    const top = Math.round((canvas.bitmap.height - g.bitmap.height) / 2);
    canvas.composite(g, left, top);
    return canvas;
  };

  // iOS / legacy icon: full-bleed maroon (the OS rounds the corners), glyph ~46 % of the height.
  const icon = place(new Jimp(1024, 1024, MAROON), 470);
  await icon.writeAsync(path.join(mobile, 'assets/icon.png'));

  // Android adaptive foreground: transparent, glyph inside the 66 % safe zone; background colour in app config.
  const fg = place(new Jimp(1024, 1024, 0x00000000), 400);
  await fg.writeAsync(path.join(mobile, 'assets/adaptive-icon.png'));

  // Native splash image: the white wordmark (shown on maroon, like screen 01).
  const splash = new Jimp(1024, 1024, 0x00000000);
  const word = logo.clone().resize(1000, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  splash.composite(word, 12, Math.round((1024 - word.bitmap.height) / 2));
  await splash.writeAsync(path.join(mobile, 'assets/splash-icon.png'));
  console.log('written icon.png, adaptive-icon.png, splash-icon.png');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
