#!/usr/bin/env node
// Usage: node finalize-site.js <siteDir> <version>
// Adds what build-site.js does not: file-index.js (audio lookup + build id), version.json, and the index.html hook.
const fs = require('fs');
const path = require('path');

const site = path.resolve(process.argv[2] || '_site');
const version = String(process.argv[3] || '').replace(/^v/i, '') || '0';
const buildId = String(Date.now());

const index = {};
(function walk(abs, rel) {
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) walk(path.join(abs, e.name), r);
    else index[r.toLowerCase()] = r;
  }
})(path.join(site, 'audio'), 'audio');

fs.writeFileSync(path.join(site, 'file-index.js'),
  `window.__QVAS_AUDIO_INDEX=${JSON.stringify(index)};window.__QVAS_BUILD=${JSON.stringify(buildId)};window.__QVAS_VERSION=${JSON.stringify(version)};`);

fs.writeFileSync(path.join(site, 'version.json'),
  JSON.stringify({ appVersion: version, buildId, builtAt: new Date().toISOString() }));

const f = path.join(site, 'index.html');
let html = fs.readFileSync(f, 'utf8');
if (!/file-index\.js/.test(html)) {
  if (!/<script src="qvas-web-shim\.js"><\/script>/.test(html)) throw new Error('index.html has no shim script tag');
  html = html.replace('<script src="qvas-web-shim.js"></script>', '<script src="file-index.js"></script>\n  <script src="qvas-web-shim.js"></script>');
  fs.writeFileSync(f, html);
}

// Regenerate the service worker for EVERY build. Previously the build ID in
// version.json changed while sw.js stayed unchanged, causing reload loops.
const crypto = require('crypto');
const template = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const baseMatch = template.match(/^const SHELL = (\[[^\n]*\]);/m);
if (!baseMatch) throw new Error('Cannot locate service worker shell list');
const originalShell = JSON.parse(baseMatch[1]);
const files = new Map();
const add = (rel) => {
  if (rel === 'sw.js' || rel.startsWith('audio/') || rel.startsWith('.')) return;
  const built = path.join(site, rel);
  const kept = path.join(__dirname, rel);
  const source = fs.existsSync(built) ? built : kept;
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 12);
  files.set(rel, { u: rel, h: hash });
};
for (const entry of originalShell) add(entry.u);
(function scan(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (rel !== 'audio') scan(path.join(dir, entry.name), rel);
    } else if (entry.isFile() && !entry.name.startsWith('.') && rel !== 'sw.js') {
      add(rel);
    }
  }
})(site);
const shell = [...files.values()].sort((a, b) => a.u.localeCompare(b.u));
const generated = template
  .replace(/build \d+/, 'build ' + buildId)
  .replace(/^const BUILD = .*;$/m, 'const BUILD = ' + JSON.stringify(buildId) + ';')
  .replace(/^const SHELL = \[[^\n]*\];/m, 'const SHELL = ' + JSON.stringify(shell) + ';');
if (!generated.includes('const BUILD = ' + JSON.stringify(buildId) + ';') ||
    !generated.includes('const SHELL = ' + JSON.stringify(shell) + ';')) {
  throw new Error('Service worker build markers could not be replaced');
}
fs.writeFileSync(path.join(site, 'sw.js'), generated);

console.log(`finalized: version ${version}, build ${buildId}, ${Object.keys(index).length} audio files indexed`);
