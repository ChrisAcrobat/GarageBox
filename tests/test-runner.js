// Tiny browser test runner shared by the logic test pages (design 9.2).
// Each page imports it, calls check() for every expectation and finish() at
// the end. The page title becomes "PASS n/n passed" or "FAIL ..." so the
// result can be read by a headless browser too.

export function createSuite(title) {
  const results = [];
  let group = '';
  return {
    /** Starts a named group; the name prefixes the following checks. */
    group(name) {
      group = name;
    },
    check(name, actual, expected) {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({ name: group ? `${group}: ${name}` : name, ok, actual, expected });
    },
    finish() {
      const failed = results.filter((r) => !r.ok);
      const list = document.getElementById('results');
      for (const r of results) {
        const li = document.createElement('li');
        li.className = r.ok ? 'pass' : 'fail';
        li.textContent = r.ok
          ? `PASS ${r.name}`
          : `FAIL ${r.name}: got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)}`;
        list.append(li);
        if (!r.ok) console.error(li.textContent);
      }
      const summary = `${results.length - failed.length}/${results.length} passed`;
      const el = document.getElementById('summary');
      el.textContent = summary;
      el.className = failed.length ? 'fail' : 'pass';
      document.title = failed.length ? `FAIL ${summary}` : `PASS ${summary}`;
      console.log(`${title}: ${summary}`);
    },
  };
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
      default:
        return e.type;
    }
  });
}
