// ledger.js
// Renders catalogue.json as a docket of overt acts, plus an open docket of leads and verify items.
// No build step. catalogue.json is the source of truth. The use field is Tim's alone.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KIND = { clipping: 'Clipping', article: 'Article', book: 'Book', family: 'Family note', place: 'Place', photo: 'Photo', person: 'Person' };
const TRUST = { primary: 'Primary', secondary: 'Secondary', family: 'Family', ai: 'AI summary', unread: 'Unread' };
const USE = { written: 'Written', blank: 'Blank' };
const SORTS = {
  filed: { name: 'Filing order', key: (e) => e.id },
  source: { name: 'Source date', key: (e) => e.source_date || '9999' },
  period: { name: 'Period covered', key: (e) => (e.period.match(/\d{4}/) || ['9999'])[0] },
  trust: { name: 'Trust', key: (e) => String(Object.keys(TRUST).indexOf(e.trust)) + e.id },
};

const state = { q: '', sort: 'filed', view: 'acts', kind: new Set(), theme: new Set(), county: new Set(), trust: new Set(), use: new Set() };
let data;

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!m) return String(y);
  const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  return `${months[m - 1]} ${day}, ${y}`;
}

function matches(e) {
  if (state.kind.size && !state.kind.has(e.kind)) return false;
  if (state.theme.size && !e.themes.some((t) => state.theme.has(t))) return false;
  if (state.county.size && !e.counties.some((c) => state.county.has(c))) return false;
  if (state.trust.size && !state.trust.has(e.trust)) return false;
  if (state.use.size && !state.use.has(e.use ? 'written' : 'blank')) return false;
  if (state.q) {
    const hay = [e.title, e.outlet, ...e.people, ...e.counties, ...e.summary, ...e.leads, ...e.verify, e.use, ...e.numbers.map((n) => n.what + ' ' + n.value)].join(' ').toLowerCase();
    if (!state.q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function shown() {
  const k = SORTS[state.sort].key;
  return data.entries.filter(matches).sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : a.id < b.id ? -1 : 1));
}

function chipRow(label, key, values, names = {}) {
  const chips = values.map((v) => `<button type="button" class="chip" data-key="${key}" data-val="${esc(v)}" aria-pressed="${state[key].has(v)}">${esc(names[v] || v)}</button>`).join('');
  return `<div class="row"><span class="lbl">${label}</span>${chips}</div>`;
}

function renderFilters() {
  const counties = [...new Set(data.entries.flatMap((e) => e.counties))].sort();
  const kinds = Object.keys(KIND).filter((k) => data.entries.some((e) => e.kind === k));
  const sorts = Object.entries(SORTS).map(([k, s]) => `<option value="${k}"${k === state.sort ? ' selected' : ''}>${s.name}</option>`).join('');
  $('#filters').innerHTML = `
    <label class="search" for="q"><span class="lbl">Search</span><input id="q" type="search" placeholder="name, place, number" value="${esc(state.q)}" autocomplete="off"></label>
    <label class="row" for="sort"><span class="lbl">Sort</span><select id="sort">${sorts}</select></label>
    ${chipRow('Kind', 'kind', kinds, KIND)}
    ${chipRow('Theme', 'theme', data.meta.themes)}
    ${chipRow('County', 'county', counties)}
    ${chipRow('Trust', 'trust', Object.keys(TRUST), TRUST)}
    ${chipRow('Use line', 'use', Object.keys(USE), USE)}
    <button type="button" class="clear" id="clear">Clear filters</button>`;
}

function actLink(e) {
  return `<a href="#act-${esc(e.id)}" data-goto="act-${esc(e.id)}">Act No. ${Number(e.id)}</a>`;
}

function renderAct(e) {
  const meta = [
    KIND[e.kind] || e.kind,
    e.outlet,
    e.source_date && (e.kind === 'family' ? `sent ${fmtDate(e.source_date)}` : fmtDate(e.source_date)),
    e.period && `covers ${e.period}`,
  ].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');

  const title = e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title);
  const facts = e.summary.map((s) => `<li>${esc(s)}</li>`).join('');
  const nums = e.numbers.length
    ? `<div class="ledger"><table><caption>Figures</caption><tbody>${e.numbers.map((x) => `<tr><td>${esc(x.what)}</td><td class="v">${esc(x.value)}</td></tr>`).join('')}</tbody></table></div>`
    : '';
  const list = (cls, head, items) => (items.length ? `<div class="${cls}"><h4>${head}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');
  const notes = list('leads', 'Leads', e.leads) + list('verify', 'Verify', e.verify);
  const use = e.use ? `<span class="filled">${esc(e.use)}</span>` : '<span class="blank" aria-label="Not written yet"></span>';
  const tags = [
    e.people.length && `People: ${e.people.join(', ')}`,
    e.counties.length && `Counties: ${e.counties.join(', ')}`,
    e.sent_by && `Sent by ${e.sent_by}, ${fmtDate(e.sent_date)}`,
  ].filter(Boolean).map(esc).join(' · ');

  return `<article class="act" id="act-${esc(e.id)}">
    <h2>Overt act No. ${Number(e.id)}</h2>
    <h3>${title}</h3>
    <span class="stamp" data-trust="${esc(e.trust)}">${esc(TRUST[e.trust] || e.trust)}</span>
    <p class="meta">${meta}</p>
    <ol class="facts">${facts}</ol>
    ${nums}
    ${notes ? `<div class="notes">${notes}</div>` : ''}
    <p class="use"><span class="lbl">Use in the game</span>${use}</p>
    <p class="tags">${tags}</p>
  </article>`;
}

function renderDocket(list) {
  const section = (cls, head, field, blurb) => {
    const rows = list.flatMap((e) => e[field].map((item) => ({ e, item })));
    if (!rows.length) return '';
    return `<section class="docket-list ${cls}">
      <h2>${head} <span class="count">${rows.length}</span></h2>
      <p class="blurb">${blurb}</p>
      <ol>${rows.map(({ e, item }) => `<li><span class="item">${esc(item)}</span><span class="from">${actLink(e)}, ${esc(e.title)}</span></li>`).join('')}</ol>
    </section>`;
  };
  const html = section('verify', 'To verify', 'verify', 'Claims to check before anything leans on them.') + section('leads', 'Open leads', 'leads', 'Sources and threads to chase down.');
  return html || '<p class="empty">Nothing open for these filters.</p>';
}

function render() {
  const list = shown();
  const isDocket = state.view === 'docket';
  $('#acts').hidden = isDocket;
  $('#docket').hidden = !isDocket;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === state.view));
  if (isDocket) $('#docket').innerHTML = renderDocket(list);
  else $('#acts').innerHTML = list.length ? list.map(renderAct).join('') : '<p class="empty">No overt acts match these filters.</p>';

  const all = data.entries;
  const leads = all.reduce((a, e) => a + e.leads.length, 0);
  const verify = all.reduce((a, e) => a + e.verify.length, 0);
  const used = all.filter((e) => e.use).length;
  $('#tally').innerHTML = `<span><b>${all.length}</b> overt acts</span><span><b>${list.length}</b> shown</span><span><b>${leads}</b> leads open</span><span><b>${verify}</b> to verify</span><span><b>${used}</b> with a use written</span>`;
  drawGutter();
}

function drawGutter() {
  const g = $('#gutter');
  if (!g || getComputedStyle(g).display === 'none') return;
  const lh = parseFloat(getComputedStyle(g).lineHeight) || 28;
  const lines = Math.ceil(g.parentElement.scrollHeight / lh);
  g.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  g.style.whiteSpace = 'pre';
}

function setView(view, target) {
  state.view = view;
  render();
  if (target) document.getElementById(target)?.scrollIntoView();
}

function fromHash() {
  const h = location.hash.slice(1);
  if (h === 'docket') setView('docket');
  else if (h.startsWith('act-')) setView('acts', h);
  else setView('acts');
}

function wire() {
  $('#filters').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'clear') {
      ['kind', 'theme', 'county', 'trust', 'use'].forEach((k) => state[k].clear());
      state.q = '';
      state.sort = 'filed';
      renderFilters(); render();
      return;
    }
    const set = state[b.dataset.key];
    set.has(b.dataset.val) ? set.delete(b.dataset.val) : set.add(b.dataset.val);
    b.setAttribute('aria-pressed', set.has(b.dataset.val));
    render();
  });
  $('#filters').addEventListener('input', (ev) => {
    if (ev.target.id === 'q') state.q = ev.target.value.trim().toLowerCase();
    else if (ev.target.id === 'sort') state.sort = ev.target.value;
    else return;
    render();
  });
  $('#views').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-view]');
    if (!b) return;
    location.hash = b.dataset.view === 'docket' ? 'docket' : 'acts';
  });
  $('#docket').addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-goto]');
    if (!a) return;
    ev.preventDefault();
    location.hash = a.dataset.goto;
  });
  addEventListener('hashchange', fromHash);
  addEventListener('resize', drawGutter);
}

async function boot() {
  try {
    const res = await fetch('catalogue.json', { cache: 'no-cache' });
    data = await res.json();
  } catch (err) {
    $('#acts').innerHTML = '<p class="empty">Could not load catalogue.json. Serve this folder over http, not from the file system.</p>';
    return;
  }
  $('#updated').textContent = fmtDate(data.meta.updated);
  renderFilters();
  wire();
  fromHash();
}

boot();
