import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const model = await readFile(resolve(root, 'web/assets/models/keeper.glb'));
const modelURL = 'data:model/gltf-binary;base64,' + model.toString('base64');
const result = await build({
  entryPoints: [resolve(root, 'web/play.mjs')],
  bundle: true,
  write: false,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'inline',
  plugins: [{ name: 'local-domain', setup(b) {
    b.onResolve({ filter: /^\/domain\// }, args => ({ path: resolve(root, 'src/domain', args.path.slice('/domain/'.length)) }));
  } }],
});
let html = await readFile(resolve(root, 'web/play.html'), 'utf8');
const moonPreview=await readFile(resolve(root,'web/assets/moon-sheep-preview.png'));
html=html.replaceAll('/assets/moon-sheep-preview.png','data:image/png;base64,'+moonPreview.toString('base64'));
const css = await readFile(resolve(root, 'web/play.css'), 'utf8');
html = html.replace(/<link\b[^>]*href=["'](?:\.\/|\/)?play\.css["'][^>]*>/g, '<style>' + css + '</style>');
html = html.replace(/<script\b[^>]*type=["']importmap["'][^>]*>[\s\S]*?<\/script>/g, '');
const js = 'globalThis.QIMENG_MODEL_URL=' + JSON.stringify(modelURL) + ';\n' + result.outputFiles[0].text;
const script = '<script type="module">' + js.replace(/<\/script/gi, '<\\/script') + '</script>';
const scriptPattern = /<script\b[^>]*src=["'](?:\.\/|\/)?play\.mjs["'][^>]*>\s*<\/script>/;
if (!scriptPattern.test(html)) throw new Error('Could not find play.mjs entry script');
html = html.replace(scriptPattern, () => script);
await writeFile(resolve(root, 'web/play-offline.html'), html);
await writeFile(resolve(root, 'web/index.html'), html);
console.log(`Built play-offline.html: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB; includes renderer, UI, rules and GLB model.`);
