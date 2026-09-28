// Builds COME HOME into a single self-contained index.html (JS, CSS and fonts inlined)
// so the game runs by simply opening the file — no server, no network.
//
//   node tools/build.mjs          one-off build
//   node tools/build.mjs --watch  rebuild on change
import * as esbuild from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const out = path.join(root, 'index.html');

async function inlineFonts(css) {
  const fontDir = path.join(src, 'assets', 'fonts');
  const files = (await readdir(fontDir)).filter((f) => f.endsWith('.woff2'));
  for (const f of files) {
    const b64 = (await readFile(path.join(fontDir, f))).toString('base64');
    css = css.split(`url('assets/fonts/${f}')`).join(`url(data:font/woff2;base64,${b64})`);
  }
  return css;
}

async function build() {
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [path.join(src, 'main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020'],
    write: false,
    legalComments: 'none',
    logLevel: 'warning',
  });
  let js = result.outputFiles[0].text;
  js = js.replace(/<\/script/gi, '<\\/script');
  const css = await inlineFonts(await readFile(path.join(src, 'style.css'), 'utf8'));
  const html = await readFile(path.join(src, 'index.html'), 'utf8');
  const page = html
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);
  await writeFile(out, page);
  console.log(`built index.html (${(page.length / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms`);
}

await build();

if (process.argv.includes('--watch')) {
  let timer = null;
  watch(src, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  });
  console.log('watching src/ …');
}
