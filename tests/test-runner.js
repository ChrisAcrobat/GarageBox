// Tiny browser test runner shared by the logic test pages (design 9.2).
//
// Each page imports it, calls check() for every expectation and finish() at
// the end. The page title becomes "PASS n/n passed" or "FAIL n/m passed", so
// the result can be read by a headless browser too (tests/run-headless.mjs).
//
// A page must always finish, also when the code under test is missing or
// broken (design 9.2):
//   - load(path, names) imports a module dynamically; a module that cannot be
//     loaded, or a missing export, is a FAIL check (never a page that hangs on
//     a module link error, as a static import would);
//   - check() accepts a function as `actual`; if it throws, that check FAILs;
//   - section(name, fn) runs a block of checks; if it throws, one FAIL is
//     recorded and the page goes on with the next section;
//   - uncaught errors and unhandled rejections are FAIL checks, and a watchdog
//     finishes the page with a FAIL if finish() was not reached in time.

const DEFAULT_TIMEOUT_MS = 45000;

function show(value) {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

export function createSuite(title, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const results = [];
  let group = '';
  let finished = false;

  const record = (name, ok, detail) => {
    results.push({ name: group ? `${group}: ${name}` : name, ok, detail });
    if (finished) render(); // a late error still turns the title to FAIL
  };

  function render() {
    const failed = results.filter((r) => !r.ok);
    const list = document.getElementById('results');
    if (list) {
      list.textContent = '';
      for (const r of results) {
        const li = document.createElement('li');
        li.className = r.ok ? 'pass' : 'fail';
        li.textContent = r.ok ? `PASS ${r.name}` : `FAIL ${r.name}: ${r.detail}`;
        list.append(li);
      }
    }
    const summary = `${results.length - failed.length}/${results.length} passed`;
    const el = document.getElementById('summary');
    if (el) {
      el.textContent = summary;
      el.className = failed.length ? 'fail' : 'pass';
    }
    document.title = failed.length || !results.length ? `FAIL ${summary}` : `PASS ${summary}`;
    return { failed, summary };
  }

  const suite = {
    /** Starts a named group; the name prefixes the following checks. */
    group(name) {
      group = name;
    },

    /**
     * Compares `actual` with `expected` (deep, via JSON). `actual` may be a
     * function; it is called and a thrown error makes the check FAIL.
     */
    check(name, actual, expected) {
      if (typeof actual === 'function') {
        try {
          actual = actual();
        } catch (err) {
          record(name, false, `threw ${err && err.message ? err.message : err}`);
          return false;
        }
      }
      const ok = show(actual) === show(expected);
      record(name, ok, `got ${show(actual)}, expected ${show(expected)}`);
      return ok;
    },

    /** Records a failure without a comparison. */
    fail(name, detail = 'failed') {
      record(name, false, detail);
    },

    /**
     * Runs `fn` (may be async) as a named group. If it throws, one FAIL is
     * recorded ("section aborted") and the page continues.
     */
    async section(name, fn) {
      group = name;
      try {
        await fn();
      } catch (err) {
        record('section aborted', false, `threw ${err && err.message ? err.message : err}`);
        console.error(`${title} / ${name}:`, err);
      }
    },

    /**
     * Imports a module relative to the test page. Returns its namespace, or an
     * empty object if it could not be loaded. Every name in `names` that the
     * module does not export is a FAIL check.
     */
    async load(path, names = []) {
      const saved = group;
      group = 'modules';
      let mod = {};
      try {
        mod = await import(new URL(path, document.baseURI).href);
        const missing = names.filter((n) => !(n in mod));
        if (missing.length) record(`${path} exports ${missing.join(', ')}`, false, `missing export(s): ${missing.join(', ')}`);
      } catch (err) {
        record(`${path} can be loaded`, false, `import failed: ${err && err.message ? err.message : err}`);
        mod = {};
      }
      group = saved;
      return mod;
    },

    /**
     * Runs `fn` with an empty localStorage and restores the previous content
     * afterwards (settings tests must not change the developer's settings).
     */
    async withCleanStorage(fn) {
      const saved = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        saved[k] = localStorage.getItem(k);
      }
      localStorage.clear();
      try {
        return await fn();
      } finally {
        localStorage.clear();
        for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
      }
    },

    /** Writes the results and sets the title. Safe to call more than once. */
    finish() {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      const { failed, summary } = render();
      for (const r of failed) console.error(`FAIL ${r.name}: ${r.detail}`);
      console.log(`${title}: ${summary}`);
    },

    get finished() {
      return finished;
    },
  };

  window.addEventListener('error', (e) => record('uncaught error', false, String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => record('unhandled rejection', false, String(e.reason && e.reason.message ? e.reason.message : e.reason)));
  const watchdog = setTimeout(() => {
    record('page finished in time', false, `finish() not reached after ${timeoutMs / 1000} s`);
    suite.finish();
  }, timeoutMs);

  return suite;
}

/** A logical control edge as produced by the input layer. */
export function edge(name, type = 'pressed', value = type === 'released' ? 0 : 1) {
  return { kind: 'control', name, type, value };
}

/** Short, comparable form of note events, e.g. "on:52@0", "off", "bend:-2.00". */
export function summarize(events) {
  return events.map((e) => {
    switch (e.type) {
      case 'noteOn':
        return `on:${e.midi}@${e.column}${e.part ? `/${e.part}` : ''}`;
      case 'noteOff':
        return `off${e.part ? `/${e.part}` : ''}`;
      case 'bend':
        return `bend:${e.semitones.toFixed(2)}`;
      case 'volume':
        return `volume:${e.gain.toFixed(2)}`;
      case 'action':
        return `action:${e.action}`;
      case 'starPower':
        return `starPower:${e.on ? 'on' : 'off'}`;
      default:
        return e.type;
    }
  });
}
