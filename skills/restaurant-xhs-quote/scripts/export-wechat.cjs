const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

async function main() {
  const [input, output, prefix] = process.argv.slice(2);
  if (!input || !output || !prefix || /[\\/:*?"<>|]/.test(prefix)) throw new Error('Provide HTML, output directory and a valid filename prefix');
  const source = path.resolve(input);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile() || !/\.html?$/i.test(source)) throw new Error('HTML input file does not exist or is not HTML');
  const { chromium } = require(process.env.QUOTE_PLAYWRIGHT_MODULE || 'playwright-core');
  const browser = await chromium.launch({ headless: true, ...(process.env.QUOTE_BROWSER_EXECUTABLE ? { executablePath: process.env.QUOTE_BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1600 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(source).href);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(i => i.decode())); });
    const layout = await page.evaluate(() => {
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('Horizontal overflow');
      const blocks = Array.from(document.querySelectorAll('table,img,.template,.box,.callout,.goal,.evidence,.stats')).map(e => {
        const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY };
      });
      const headings = Array.from(document.querySelectorAll('h2')).map(e => e.getBoundingClientRect().top + scrollY);
      const points = Array.from(document.querySelectorAll('h2,h3,.template,.evidence')).map(e => {
        const top = e.getBoundingClientRect().top + scrollY;
        // Keep a section heading and introduction with its first image/card.
        if (e.matches('.template,.evidence') && headings.some(y => top > y && top - y < 400)) return -1;
        let y = Math.floor(top - 8);
        if (blocks.some(b => y > b.top && y < b.bottom)) y = Math.ceil(top);
        return y;
      }).filter(y => y > 0 && !blocks.some(b => y > b.top && y < b.bottom));
      return { height: document.documentElement.scrollHeight, points: [...new Set(points)].sort((a,b) => a-b) };
    });
    const bounds = [0];
    while (layout.height - bounds.at(-1) > 2800) {
      const start = bounds.at(-1);
      const candidates = layout.points.filter(y => y > start);
      const within = candidates.filter(y => y <= start + 2800);
      const next = within.at(-1) || candidates[0];
      if (!next || next >= layout.height) break;
      bounds.push(next);
    }
    bounds.push(layout.height);
    const target = path.resolve(output);
    fs.mkdirSync(target, { recursive: true });
    const files = [];
    const full = `${prefix}-完整长图.png`;
    await page.screenshot({ path: path.join(target, full), fullPage: true });
    files.push({ name: full, width: 1080, height: layout.height });
    for (let i = 0; i < bounds.length - 1; i++) {
      const name = `${prefix}-微信${i + 1}.png`, height = bounds[i + 1] - bounds[i];
      await page.screenshot({ path: path.join(target, name), fullPage: true, clip: { x: 0, y: bounds[i], width: 1080, height } });
      files.push({ name, width: 1080, height, y: bounds[i] });
    }
    const manifest = { sourceName: path.basename(source), sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), files, oversizedParts: files.slice(1).filter(f => f.height > 3200).map(f => f.name) };
    fs.writeFileSync(path.join(target, `${prefix}-manifest.json`), JSON.stringify(manifest, null, 2), 'utf8');
    console.log(JSON.stringify({ parts: files.length - 1, height: layout.height, oversizedParts: manifest.oversizedParts }));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
