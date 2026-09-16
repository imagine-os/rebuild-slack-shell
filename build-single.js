#!/usr/bin/env node
/* Inlines styles.css, data.js and app.js into dist/slack-shell.html so the app can be shared as one file. */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
const css = read('styles.css');
const data = read('data.js');
const app = read('app.js');

// Guard against a stray "</script>" inside inlined JS breaking the document.
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');

// Use function replacements so '$' sequences inside the assets are not treated as replacement patterns.
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>');
html = html.replace('<script src="data.js"></script>', () => '<script>\n' + safeJs(data) + '\n</script>');
html = html.replace('<script src="app.js"></script>', () => '<script>\n' + safeJs(app) + '\n</script>');

if (/href="styles\.css"|src="(data|app)\.js"/.test(html)) {
  console.error('build-single: failed to inline one or more assets');
  process.exit(1);
}

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'slack-shell.html');
fs.writeFileSync(out, html);
console.log('wrote', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
