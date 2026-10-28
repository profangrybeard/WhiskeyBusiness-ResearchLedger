// ledger.js
// Renders catalogue.json as a filterable list of sources, plus an open docket of leads and verify items.
// No build step. catalogue.json is the source of truth. The use field is Tim's alone.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KIND = { clipping: 'Clipping', article: 'Article', book: 'Book', family: 'Family note', place: 'Place', photo: 'Photo', person: 'Person' };
const TRUST = { primary: 'Primary', secondary: 'Secondary', family: 'Family', ai: 'AI summary', unread: 'Unread' };
const USE = { blank: 'Not written', written: 'Written' };
const SORTS = {
  filed: { name: 'Number', key: (e) => e.id },
  source: { name: 'Source date', key: (e) => e.source_date || '9999' },
  period: { name: 'Period covered', key: (e) => (e.period.match(/\d{4}/) || ['9999'])[0] },
  trust: { name: 'Trust', key: (e) => String(Object.keys(TRUST).indexOf(e.trust)) },
};
const GROUPS = ['kind', 'trust', 'theme', 'county', 'use'];

const state = { q: '', sort: 'filed', view: 'sources', open: new Set(), kind: new Set(), trust: new Set(), theme: new Set(), county: new Set(), use: new Set() };
let data;

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!m) return String(y);
  const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  return `${months[m - 1]} ${day}, ${y}`;
}

const valuesOf = {
  kind: (e) => [e.kind],
  trust: (e) => [e.trust],
  theme: (e) => e.themes,
  county: (e) => e.counties,
  use: (e) => [e.use ? 'written' : 'blank'],
};

function matches(e, skip) {
  for (const g of GROUPS) {
    if (g === skip || !state[g].size) continue;
    if (!valuesOf[g](e).some((v) => state[g].has(v))) return false;
  }
  if (state.q) {
    const hay = [e.title, e.outlet, ...e.people, ...e.counties, ...e.summary, ...e.leads, ...e.verify, e.use, ...e.numbers.map((n) => n.what + ' ' + n.value)].join(' ').toLowerCase();
    if (!state.q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function shown() {
  const k = SORTS[state.sort].key;
  return data.entries.filter((e) => matches(e)).sort((a, b) => {
    const x = k(a), y = k(b);
    return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1;
  });
}

// ---------- filters ----------

function options(group) {
  if (group === 'kind') return Object.keys(KIND).filter((k) => data.entries.some((e) => e.kind === k)).map((k) => [k, KIND[k]]);
  if (group === 'trust') return Object.entries(TRUST);
  if (group === 'use') return Object.entries(USE);
  if (group === 'theme') return data.meta.themes.map((t) => [t, t[0].toUpperCase() + t.slice(1)]);
  return [...new Set(data.entries.flatMap((e) => e.counties))].sort().map((c) => [c, c]);
}

const LABEL = { kind: 'Kind', trust: 'Trust', theme: 'Theme', county: 'County', use: 'Use line' };

function renderFilters() {
  const groups = GROUPS.map((g) => {
    const pool = data.entries.filter((e) => matches(e, g));
    const opts = options(g).map(([v, name]) => {
      const n = pool.filter((e) => valuesOf[g](e).includes(v)).length;
      const id = `f-${g}-${v}`;
      return `<label class="opt${n ? '' : ' zero'}" for="${esc(id)}"><input type="checkbox" id="${esc(id)}" data-key="${g}" data-val="${esc(v)}"${state[g].has(v) ? ' checked' : ''}>${esc(name)}<span class="n">${n}</span></label>`;
    }).join('');
    return `<fieldset><legend class="field-label">${LABEL[g]}</legend>${opts}</fieldset>`;
  }).join('');
  $('#filters').innerHTML = `
    <div><label class="field-label" for="q">Search</label><input id="q" type="search" placeholder="Name, place, figure" value="${esc(state.q)}" autocomplete="off"></div>
    ${groups}
    <button type="button" class="text-btn" id="clear">Clear filters</button>`;
  const active = GROUPS.reduce((a, g) => a + state[g].size, 0) + (state.q ? 1 : 0);
  $('#filter-count').textContent = active ? `(${active})` : '';
}

function updateCounts() {
  // Re-count without rebuilding the inputs, so focus and typing are kept.
  for (const g of GROUPS) {
    const pool = data.entries.filter((e) => matches(e, g));
    document.querySelectorAll(`input[data-key="${g}"]`).forEach((inp) => {
      const n = pool.filter((e) => valuesOf[g](e).includes(inp.dataset.val)).length;
      const lab = inp.closest('.opt');
      lab.querySelector('.n').textContent = n;
      lab.classList.toggle('zero', !n);
    });
  }
  const active = GROUPS.reduce((a, g) => a + state[g].size, 0) + (state.q ? 1 : 0);
  $('#filter-count').textContent = active ? `(${active})` : '';
}

// ---------- sources ----------

function renderSource(e) {
  const isOpen = state.open.has(e.id);
  const meta = [
    KIND[e.kind] || e.kind,
    e.outlet,
    e.source_date && (e.kind === 'family' ? `sent ${fmtDate(e.source_date)}` : fmtDate(e.source_date)),
    e.period && `covers ${e.period}`,
  ].filter(Boolean).map(esc).join(' · ');

  const marks = [
    e.numbers.length && `<span>${e.numbers.length} figure${e.numbers.length > 1 ? 's' : ''}</span>`,
    e.leads.length && `<span>${e.leads.length} lead${e.leads.length > 1 ? 's' : ''}</span>`,
    e.verify.length && `<span class="v">${e.verify.length} to verify</span>`,
    e.use ? '<span class="use-set">use</span>' : '<span class="use-blank">use</span>',
  ].filter(Boolean).join('');

  let detail = '';
  if (isOpen) {
    const list = (cls, head, items) => (items.length ? `<div class="${cls}"><h4>${head}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');
    const figs = e.numbers.length
      ? `<div><h4>Figures</h4><table class="figs"><tbody>${e.numbers.map((x) => `<tr><td>${esc(x.what)}</td><td class="val">${esc(x.value)}</td></tr>`).join('')}</tbody></table></div>`
      : '';
    const who = [
      e.people.length && `<div><b>People</b> ${esc(e.people.join(', '))}</div>`,
      e.counties.length && `<div><b>Counties</b> ${esc(e.counties.join(', '))}</div>`,
      e.sent_by && `<div><b>Sent by</b> ${esc(e.sent_by)}, ${esc(fmtDate(e.sent_date))}</div>`,
    ].filter(Boolean).join('');
    detail = `<div class="detail" id="d-${esc(e.id)}">
      <div class="notes">
        ${e.url ? `<a class="open-src" href="${esc(e.url)}" target="_blank" rel="noopener">Open the source ↗</a>` : ''}
        <ul>${e.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div class="aside">
        ${figs}
        ${list('verify', 'Verify', e.verify)}
        ${list('leads', 'Leads', e.leads)}
        ${who ? `<div class="who">${who}</div>` : ''}
      </div>
      <div class="use"><h4>Use in the game</h4>${e.use ? `<p>${esc(e.use)}</p>` : '<p class="blank">Not written yet.</p>'}</div>
    </div>`;
  }

  return `<article class="src" id="act-${esc(e.id)}">
    <button type="button" class="row" data-toggle="${esc(e.id)}" aria-expanded="${isOpen}" aria-controls="d-${esc(e.id)}">
      <span class="no">${esc(e.id)}</span>
      <span class="headline"><span class="title">${esc(e.title)}</span><span class="meta">${meta}</span></span>
      <span class="side"><span class="trust" data-trust="${esc(e.trust)}">${esc(TRUST[e.trust] || e.trust)}</span><span class="marks">${marks}</span></span>
    </button>
    ${detail}
  </article>`;
}

// ---------- docket ----------

function renderDocket(list) {
  const section = (cls, head, field, sub) => {
    const rows = list.flatMap((e) => e[field].map((item) => ({ e, item })));
    if (!rows.length) return '';
    return `<section class="dock ${cls}">
      <h2>${head} <span class="n">${rows.length}</span></h2>
      <p class="sub">${sub}</p>
      <div class="dock-table"><table>
        <thead><tr><th>Item</th><th>Source</th></tr></thead>
        <tbody>${rows.map(({ e, item }) => `<tr><td class="item">${esc(item)}</td><td class="from"><a href="#act-${esc(e.id)}">No. ${esc(e.id)}</a><span>${esc(e.title)}</span></td></tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  };
  return section('verify', 'To verify', 'verify', 'Check these before anything in the game leans on them.')
    + section('leads', 'Open leads', 'leads', 'Sources and threads to chase down.')
    || '<p class="empty">Nothing open for these filters.</p>';
}

// ---------- page ----------

function renderStats() {
  const all = data.entries;
  const leads = all.reduce((a, e) => a + e.leads.length, 0);
  const verify = all.reduce((a, e) => a + e.verify.length, 0);
  const used = all.filter((e) => e.use).length;
  $('#stats').innerHTML = `
    <button type="button" class="stat" data-go="sources"><b>${all.length}</b><span>sources</span></button>
    <button type="button" class="stat warn" data-go="docket"><b>${verify}</b><span>to verify</span></button>
    <button type="button" class="stat" data-go="docket"><b>${leads}</b><span>open leads</span></button>
    <button type="button" class="stat" data-go="blank"><b>${used} of ${all.length}</b><span>uses written</span></button>`;
}

function render() {
  const list = shown();
  const docket = state.view === 'docket';
  $('#list').hidden = docket;
  $('#docket').hidden = !docket;
  $('#expand').hidden = docket;
  $('#sort').closest('.sort').hidden = docket;
  document.querySelectorAll('#views [data-view]').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === state.view));
  if (docket) {
    $('#docket').innerHTML = renderDocket(list);
    const n = list.reduce((a, e) => a + e.leads.length + e.verify.length, 0);
    $('#shown').textContent = `${n} open item${n === 1 ? '' : 's'}`;
  } else {
    $('#list').innerHTML = list.length ? list.map(renderSource).join('') : '<p class="empty">No sources match these filters.</p>';
    $('#shown').textContent = `${list.length} of ${data.entries.length}`;
    const allOpen = list.length && list.every((e) => state.open.has(e.id));
    $('#expand').textContent = allOpen ? 'Collapse all' : 'Expand all';
  }
}

function openEntry(id) {
  state.view = 'sources';
  state.open.add(id);
  if (!data.entries.find((e) => e.id === id && matches(e))) {
    GROUPS.forEach((g) => state[g].clear());
    state.q = '';
    renderFilters();
  }
  render();
  const el = document.getElementById(`act-${id}`);
  if (el) {
    el.scrollIntoView({ block: 'start' });
    el.classList.add('flash');
  }
}

function fromHash() {
  const h = location.hash.slice(1);
  if (h === 'docket') { state.view = 'docket'; render(); }
  else if (h.startsWith('act-')) openEntry(h.slice(4));
  else { state.view = 'sources'; render(); }
}

function wire() {
  const filters = $('#filters');
  filters.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!t.dataset.key) return;
    const set = state[t.dataset.key];
    t.checked ? set.add(t.dataset.val) : set.delete(t.dataset.val);
    updateCounts(); render();
  });
  filters.addEventListener('input', (ev) => {
    if (ev.target.id !== 'q') return;
    state.q = ev.target.value.trim().toLowerCase();
    updateCounts(); render();
  });
  filters.addEventListener('click', (ev) => {
    if (ev.target.id !== 'clear') return;
    GROUPS.forEach((g) => state[g].clear());
    state.q = '';
    renderFilters(); render();
  });
  $('#sort').addEventListener('change', (ev) => { state.sort = ev.target.value; render(); });
  $('#expand').addEventListener('click', () => {
    const list = shown();
    const allOpen = list.every((e) => state.open.has(e.id));
    list.forEach((e) => (allOpen ? state.open.delete(e.id) : state.open.add(e.id)));
    render();
  });
  $('#list').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-toggle]');
    if (!b) return;
    const id = b.dataset.toggle;
    state.open.has(id) ? state.open.delete(id) : state.open.add(id);
    render();
    document.querySelector(`[data-toggle="${id}"]`)?.focus();
  });
  $('#views').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-view]');
    if (b) location.hash = b.dataset.view;
  });
  $('#stats').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-go]');
    if (!b) return;
    if (b.dataset.go === 'blank') {
      GROUPS.forEach((g) => state[g].clear());
      state.q = '';
      state.use.add('blank');
      renderFilters();
      location.hash === '#sources' ? render() : (location.hash = 'sources');
    } else {
      location.hash = b.dataset.go;
    }
  });
  addEventListener('hashchange', fromHash);
  const wide = matchMedia('(min-width: 861px)');
  const syncPanel = () => { if (wide.matches) $('#filters-panel').open = true; };
  wide.addEventListener('change', syncPanel);
  syncPanel();
}

async function boot() {
  try {
    const res = await fetch('catalogue.json', { cache: 'no-cache' });
    data = await res.json();
  } catch (err) {
    $('#list').innerHTML = '<p class="empty">Could not load catalogue.json. Serve this folder over http, not from the file system.</p>';
    return;
  }
  $('#updated').textContent = fmtDate(data.meta.updated);
  $('#sort').innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');
  renderStats();
  renderFilters();
  wire();
  fromHash();
}

boot();
