import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../web');
const domainRoot = resolve(import.meta.dirname, '../src/domain');
const vendorRoot = resolve(import.meta.dirname, '../node_modules/three');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const base = pathname.startsWith('/domain/') ? domainRoot : pathname.startsWith('/vendor/three/') ? vendorRoot : root;
    const relative = base === domainRoot ? pathname.slice('/domain'.length) : base === vendorRoot ? pathname.slice('/vendor/three'.length) : (pathname === '/' ? '/index.html' : pathname);
    const file = resolve(base, '.' + relative);
    if (!file.startsWith(base + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Prototype server listening on port ${port}`));
