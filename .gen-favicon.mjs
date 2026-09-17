import { chromium } from 'playwright';
import fs from 'fs';

const svg = fs.readFileSync('public/favicon.svg', 'utf-8');

const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent;}
  svg{display:block;}
</style></head><body>${svg}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 69, height: 50 } });
await page.setContent(html);
const el = await page.$('svg');

const sizes = [16, 32, 48];
const pngBuffers = [];
for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size } });
  const p = await ctx.newPage();
  // scale the icon to a square canvas, padding to keep aspect ratio, centered
  const wrapHtml = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;width:${size}px;height:${size}px;}
    .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;}
    svg{width:${size}px;height:${Math.round(size * 50 / 69)}px;}
  </style></head><body><div class="wrap">${svg}</div></body></html>`;
  await p.setContent(wrapHtml);
  const buf = await p.screenshot({ omitBackground: true });
  pngBuffers.push({ size, buf });
  await ctx.close();
}
await browser.close();

for (const { size, buf } of pngBuffers) {
  fs.writeFileSync(`.favicon-${size}.png`, buf);
}

// --- Minimal ICO writer: embeds PNG images directly (supported since Vista) ---
function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageBuffers = [];

  for (const { size, buf } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    offset += buf.length;
    dirEntries.push(entry);
    imageBuffers.push(buf);
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

const ico = buildIco(pngBuffers.map(({ size, buf }) => ({ size, buf })));
fs.writeFileSync('public/favicon.ico', ico);
console.log('favicon.ico written:', ico.length, 'bytes');
