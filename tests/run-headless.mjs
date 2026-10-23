#!/usr/bin/env node
// Runs every tests/*.test.html page in headless Chromium and reports the
// result (design 9.2, 10). Used by the `test` job of .github/workflows/pages.yml
// and runnable locally. Developer tool only: the app itself needs no Node.js.
//
// Each page sets its title to "PASS ..." or "FAIL ..." when it is done (see
// tests/test-runner.js). All pages are opened at the same time in one browser,
// each in its own browser context (so their localStorage does not mix).
//
// Usage:
//   node tests/run-headless.mjs [options] [page ...]
//     --base-url <url>   use an already running server for the repository root
//                        (default: start a small static server on a free port)
//     --timeout <ms>     time per page to reach PASS/FAIL (default 60000)
//     --browser <path>   Chromium/Chrome executable (default: Playwright's own;
//                        also read from the CHROME_PATH environment variable)
//     page ...           only these pages, e.g. guitar.test.html
//
// Needs the `playwright` (or `playwright-core`) package and a Chromium browser:
//   npm install --no-save playwright && npx playwright install chromium
// Exit code: 0 when every page passed, 1 on any FAIL or timeout, 2 on setup errors.

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(TESTS_DIR, '..');

function parseArgs(argv) {
  const opts = { baseUrl: null, timeout: 60000, browser: process.env.CHROME_PATH || null, pages: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url') opts.baseUrl = argv[++i];
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (a === '--browser') opts.browser = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts.pages.push(a.replace(/^.*[\\/]/, ''));
  }
  return opts;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/** A minimal static file server for the repository root (local runs). */
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = normalize(join(ROOT, path));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) throw Object.assign(new Error('outside root'), { code: 'ENOENT' });
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

async function loadChromium() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const mod = await import(name);
      return (mod.default || mod).chromium;
    } catch {
      // try the next package
    }
  }
  throw new Error('Neither "playwright" nor "playwright-core" is installed (npm install --no-save playwright).');
}

async function runPage(browser, url, timeout) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`page error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  const result = { title: '', fails: [], errors, timedOut: false, passed: false };
  try {
    await page.goto(url, { waitUntil: 'load', timeout });
    await page.waitForFunction(() => /^(PASS|FAIL)/.test(document.title), null, { timeout, polling: 100 });
    // A short grace period, so a late error can still turn the page to FAIL.
    await page.waitForTimeout(200);
    result.title = await page.title();
    result.fails = await page.$$eval('#results li.fail', (els) => els.map((el) => el.textContent));
    result.passed = result.title.startsWith('PASS');
  } catch (err) {
    result.timedOut = true;
    result.title = (await page.title().catch(() => '')) || '(no title)';
    result.fails = await page.$$eval('#results li.fail', (els) => els.map((el) => el.textContent)).catch(() => []);
    errors.push(`no PASS/FAIL title within ${timeout / 1000} s (${err.message.split('\n')[0]})`);
  } finally {
    await context.close().catch(() => {});
  }
  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: node tests/run-headless.mjs [--base-url URL] [--timeout MS] [--browser PATH] [page ...]');
    return 0;
  }
  let pages = (await readdir(TESTS_DIR)).filter((f) => f.endsWith('.test.html')).sort();
  if (opts.pages.length) {
    const unknown = opts.pages.filter((p) => !pages.includes(p));
    if (unknown.length) {
      console.error(`Unknown test page(s): ${unknown.join(', ')}`);
      return 2;
    }
    pages = pages.filter((p) => opts.pages.includes(p));
  }
  if (!pages.length) {
    console.error('No tests/*.test.html pages found.');
    return 2;
  }

  let server = null;
  let baseUrl = opts.baseUrl;
  if (!baseUrl) {
    server = await startServer();
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
  }
  if (!baseUrl.endsWith('/')) baseUrl += '/';

  const chromium = await loadChromium();
  const browser = await chromium.launch({
    headless: true,
    executablePath: opts.browser || undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  console.log(`Running ${pages.length} test page(s) from ${baseUrl}tests/ in ${browser.version ? `Chromium ${browser.version()}` : 'Chromium'}\n`);

  let results;
  try {
    results = await Promise.all(pages.map(async (p) => [p, await runPage(browser, `${baseUrl}tests/${p}`, opts.timeout)]));
  } finally {
    await browser.close().catch(() => {});
    server?.close();
  }

  let bad = 0;
  for (const [p, r] of results) {
    const status = r.passed ? 'PASS' : r.timedOut ? 'TIMEOUT' : 'FAIL';
    if (!r.passed) bad++;
    console.log(`${status.padEnd(7)} ${p.padEnd(24)} ${r.title}`);
    for (const f of r.fails) console.log(`          ${f}`);
    if (!r.passed) for (const e of r.errors) console.log(`          [${e}]`);
  }
  console.log(`\n${results.length - bad}/${results.length} page(s) passed.`);
  return bad ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);
