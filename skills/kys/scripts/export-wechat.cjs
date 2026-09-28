const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

async function main() {
  const [input, output, prefix, ...options] = process.argv.slice(2);
  const config = { '--width': 1080, '--scale': 1, '--target-height': 2800 };
  for (let i=0; i<options.length; i+=2) {
    if (!(options[i] in config) || !/^\d+$/.test(options[i+1] || '')) throw new Error('Invalid export option');
    config[options[i]] = Number(options[i+1]);
  }
  const width=config['--width'], scale=config['--scale'], targetHeight=config['--target-height'];
  if (width<360 || width>1200 || scale<1 || scale>3 || targetHeight<800) throw new Error('Invalid dimensions');
  if (!input || !output || !prefix || /[\\/:*?"<>|]/.test(prefix)) throw new Error('Provide HTML, output directory and a valid filename prefix');
  const source = path.resolve(input);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile() || !/\.html?$/i.test(source)) throw new Error('HTML input file does not exist or is not HTML');
  let runtime;
  if (process.env.QUOTE_PLAYWRIGHT_MODULE) runtime = require(process.env.QUOTE_PLAYWRIGHT_MODULE);
  else { try { runtime = require('playwright-core'); } catch { runtime = require('playwright'); } }
  const { chromium } = runtime;
  const browser = await chromium.launch({ headless: true, ...(process.env.QUOTE_BROWSER_EXECUTABLE ? { executablePath: process.env.QUOTE_BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1600 }, deviceScaleFactor: scale });
    await page.route('**/*', route => /^(https?:)?\/\//.test(route.request().url()) ? route.abort() : route.continue());
    await page.goto(pathToFileURL(source).href);
    await page.evaluate(() => {
      for (const img of document.images) if (img.getAttribute('src') && !img.getAttribute('src').startsWith('data:image/')) throw new Error('Embed images as data URI before export');
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) if (!link.href.startsWith('data:')) throw new Error('Embed styles before export');
    });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).filter(i => i.getAttribute('src')).map(i => i.decode())); });
    const layout = await page.evaluate(() => {
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('Horizontal overflow');
      const blocks = Array.from(document.querySelectorAll('table,img,.template,.box,.callout,.goal,.evidence,.stats,.card')).map(e => {
        const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY };
      });
      const headings = Array.from(document.querySelectorAll('h2')).map(e => e.getBoundingClientRect().top + scrollY);
      const points = Array.from(document.querySelectorAll('section,h2,h3,.template,.evidence,.card')).map(e => {
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
    while (layout.height - bounds.at(-1) > targetHeight) {
      const start = bounds.at(-1);
      const candidates = layout.points.filter(y => y > start);
      const within = candidates.filter(y => y <= start + targetHeight);
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
    files.push({ name: full, width: width * scale, height: layout.height * scale });
    for (let i = 0; i < bounds.length - 1; i++) {
      const name = `${prefix}-微信${i + 1}.png`, height = bounds[i + 1] - bounds[i];
      await page.screenshot({ path: path.join(target, name), fullPage: true, clip: { x: 0, y: bounds[i], width, height } });
      files.push({ name, width: width * scale, height: height * scale, y: bounds[i] });
    }
    const manifest = { sourceName: path.basename(source), sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), files, oversizedParts: files.slice(1).filter(f => f.height > (targetHeight + 400) * scale).map(f => f.name) };
    const zipName = `${prefix}-图片.zip`;
    require('child_process').execFileSync(process.env.QUOTE_PYTHON_EXECUTABLE || 'python3', ['-c',
      'import sys,zipfile,pathlib; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(root/sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(root/n,n) for n in sys.argv[3:]]; z.close()',
      target, zipName, ...files.map(f => f.name)]);
    manifest.archive = zipName;
    manifest.widthCss = width; manifest.scale = scale;
    fs.writeFileSync(path.join(target, `${prefix}-manifest.json`), JSON.stringify(manifest, null, 2), 'utf8');
    console.log(JSON.stringify({ parts: files.length - 1, height: layout.height, oversizedParts: manifest.oversizedParts }));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
