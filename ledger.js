// ledger.js
// Renders the research ledger: sources, open docket, MLA 9 bibliography, Tim's questions, and the AI log.
// No build step. catalogue.json is the source of truth for sources.
// The use and design fields, questions, and every "why" in the AI log are Tim's alone.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KIND = { clipping: 'Clipping', article: 'Article', scholarship: 'Scholarship', book: 'Book', family: 'Family note', place: 'Place', photo: 'Photo', person: 'Person' };
const TRUST = { primary: 'Primary', secondary: 'Secondary', family: 'Family', fiction: 'Fiction', ai: 'AI summary', unread: 'Unread' };
const USE = { blank: 'Not written', written: 'Written' };
const CHECKED = { unchecked: 'Not checked', checked: 'Checked by Tim' };
const FEELING = { outlaw: 'Outlaw', pride: 'Pride in the product', trust: 'Trust', none: 'None yet' };
const SCALE = { family: 'Family', county: 'County', state: 'State', federal: 'Federal' };
const SORTS = {
  filed: { name: 'Number', key: (e) => e.id },
  source: { name: 'Source date', key: (e) => e.source_date || '9999' },
  period: { name: 'Period covered', key: (e) => (e.period.match(/\d{4}/) || ['9999'])[0] },
  trust: { name: 'Trust', key: (e) => String(Object.keys(TRUST).indexOf(e.trust)) },
};
const GROUPS = ['feeling', 'scale', 'kind', 'trust', 'checked', 'theme', 'county', 'use'];
const VIEWS = ['sources', 'docket', 'bibliography', 'questions', 'ailog'];
const REPO = 'https://github.com/profangrybeard/WhiskeyBusiness-MashEdition/commit/';

const state = { q: '', sort: 'filed', view: 'sources', open: new Set(), feeling: new Set(), scale: new Set(), kind: new Set(), trust: new Set(), checked: new Set(), theme: new Set(), county: new Set(), use: new Set() };
let data, questions = [], ailog = [];

// ---------- dates and citations ----------

const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!m) return String(y);
  return `${MLA_MONTHS[m - 1]} ${day}, ${y}`;
}
function mlaDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!m) return String(y);
  if (!day) return `${MLA_MONTHS[m - 1]} ${y}`;
  return `${day} ${MLA_MONTHS[m - 1]} ${y}`;
}

// MLA 9. Returns { html, text } so it can be shown with italics and copied as plain text.
function mla(e) {
  const c = e.cite || {};
  const parts = []; // [html, text] pairs, joined below
  const push = (h, t = h) => parts.push([h, t]);
  const end = (s) => (/[.?!]$/.test(s) ? s : s + '.');

  if (c.author) push(esc(end(c.author)), end(c.author));
  if (c.type === 'book') {
    if (!c.title) { push('Title not yet known.', 'Title not yet known.'); return { html: parts.map((p) => p[0]).join(' '), text: parts.map((p) => p[1]).join(' ') }; }
    push(`<i>${esc(c.title)}</i>.`, `${c.title}.`);
    const pub = [c.publisher, c.date].filter(Boolean).join(', ');
    if (pub) push(esc(pub + '.'), pub + '.');
    return { html: parts.map((p) => p[0]).join(' '), text: parts.map((p) => p[1]).join(' ') };
  }
  if (c.title) {
    const t = end(c.title);
    push(`“${esc(t)}”`, `“${t}”`);
  }
  if (c.type === 'email') {
    const r = `Received by ${c.recipient || 'Tim Lindsey'}, ${mlaDate(c.date)}.`;
    push(esc(r), r);
  } else {
    const seg = [];
    if (c.container) {
      const place = c.place ? ` [${c.place}]` : '';
      seg.push([`<i>${esc(c.container)}</i>${esc(place)}`, `${c.container}${place}`]);
    }
    if (c.publisher && c.publisher !== c.container) seg.push([esc(c.publisher), c.publisher]);
    if (c.date) seg.push([esc(mlaDate(c.date)), mlaDate(c.date)]);
    if (c.pages) seg.push([esc(`p. ${c.pages}`), `p. ${c.pages}`]);
    if (!c.database && c.url) seg.push([esc(c.url), c.url]);
    if (seg.length) push(seg.map((s) => s[0]).join(', ') + '.', seg.map((s) => s[1]).join(', ') + '.');
    if (c.database) push(`<i>${esc(c.database)}</i>${c.url ? ', ' + esc(c.url) : ''}.`, `${c.database}${c.url ? ', ' + c.url : ''}.`);
    if (c.accessed) push(esc(`Accessed ${mlaDate(c.accessed)}.`), `Accessed ${mlaDate(c.accessed)}.`);
  }
  return { html: parts.map((p) => p[0]).join(' '), text: parts.map((p) => p[1]).join(' ') };
}

function sortKey(text) {
  return text.replace(/^[“"]/, '').replace(/^(The|A|An) /, '').toLowerCase();
}

async function copy(html, text, btn) {
  const done = (msg) => { const old = btn.textContent; btn.textContent = msg; setTimeout(() => (btn.textContent = old), 1600); };
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    done('Copied');
  } catch {
    done('Select and copy');
  }
}

// ---------- filtering ----------

const valuesOf = {
  scale: (e) => { const s = [...new Set((e.bears_on || []).filter((b) => b.scale).map((b) => b.scale))]; return s.length ? s : ['none']; },
  feeling: (e) => { const f = [...new Set((e.bears_on || []).map((b) => b.feeling))]; return f.length ? f : ['none']; },
  kind: (e) => [e.kind],
  trust: (e) => [e.trust],
  checked: (e) => [e.ai && e.ai.checked_on ? 'checked' : 'unchecked'],
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
    const hay = [e.title, e.outlet, ...e.people, ...e.counties, ...e.summary, ...e.leads, ...e.verify, e.use, mla(e).text, ...(e.reading || []).map((r) => 'p. ' + r.page + ' ' + (r.note || '')), ...(e.bears_on || []).map((b) => [b.feeling, b.scale, b.willingness, b.evidence].join(' ')), ...e.numbers.map((n) => n.what + ' ' + n.value)].join(' ').toLowerCase();
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

function options(group) {
  if (group === 'kind') return Object.keys(KIND).filter((k) => data.entries.some((e) => e.kind === k)).map((k) => [k, KIND[k]]);
  if (group === 'trust') return Object.entries(TRUST);
  if (group === 'use') return Object.entries(USE);
  if (group === 'checked') return Object.entries(CHECKED);
  if (group === 'feeling') return Object.entries(FEELING);
  if (group === 'scale') return Object.entries(SCALE);
  if (group === 'theme') return data.meta.themes.map((t) => [t, t[0].toUpperCase() + t.slice(1)]);
  return [...new Set(data.entries.flatMap((e) => e.counties))].sort().map((c) => [c, c]);
}

const LABEL = { feeling: 'Bears on', scale: 'Trust scale', kind: 'Kind', trust: 'Trust', checked: 'Summary', theme: 'Theme', county: 'County', use: 'Use line' };

function activeCount() {
  return GROUPS.reduce((a, g) => a + state[g].size, 0) + (state.q ? 1 : 0);
}

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
  $('#filter-count').textContent = activeCount() ? `(${activeCount()})` : '';
}

function updateCounts() {
  for (const g of GROUPS) {
    const pool = data.entries.filter((e) => matches(e, g));
    document.querySelectorAll(`input[data-key="${g}"]`).forEach((inp) => {
      const n = pool.filter((e) => valuesOf[g](e).includes(inp.dataset.val)).length;
      const lab = inp.closest('.opt');
      lab.querySelector('.n').textContent = n;
      lab.classList.toggle('zero', !n);
    });
  }
  $('#filter-count').textContent = activeCount() ? `(${activeCount()})` : '';
}

// ---------- sources ----------

function provenance(e) {
  const a = e.ai || {};
  if (!a.summarized_by) return '<p class="prov">Not summarized yet.</p>';
  const checked = a.checked_on
    ? `<span class="ok">Checked against the original by ${esc(a.checked_by_tim || 'Tim')}, ${esc(fmtDate(a.checked_on))}.</span>`
    : '<span class="no-check">Not yet checked against the original. Treat as a lead, not evidence.</span>';
  return `<p class="prov">Summary by ${esc(a.summarized_by)}, ${esc(fmtDate(a.summarized_on))}, from ${esc(a.from)}. ${checked}</p>`;
}

function bears(e) {
  const b = e.bears_on || [];
  if (!b.length) return '';
  return `<div class="bears"><h4>Bears on</h4><ul>${b.map((x) => `<li><span class="feel" data-feel="${esc(x.feeling)}">${esc([x.feeling, x.scale, x.willingness].filter(Boolean).join(' · '))}</span> ${esc(x.evidence)}</li>`).join('')}</ul><p class="tagnote">Claude's tagging, unconfirmed. What to make of it goes in the use line.</p></div>`;
}

function renderSource(e) {
  const isOpen = state.open.has(e.id);
  const meta = [
    KIND[e.kind] || e.kind,
    e.outlet,
    e.source_date && (e.kind === 'family' ? `sent ${fmtDate(e.source_date)}` : fmtDate(e.source_date)),
    e.period && `covers ${e.period}`,
  ].filter(Boolean).map(esc).join(' · ');

  const unchecked = !(e.ai && e.ai.checked_on);
  const feels = valuesOf.feeling(e).filter((f) => f !== 'none');
  const marks = [
    ...feels.map((f) => `<span class="feel" data-feel="${f}">${f}</span>`),
    e.numbers.length && `<span>${e.numbers.length} figure${e.numbers.length > 1 ? 's' : ''}</span>`,
    e.leads.length && `<span>${e.leads.length} lead${e.leads.length > 1 ? 's' : ''}</span>`,
    e.verify.length && `<span class="v">${e.verify.length} to verify</span>`,
    (e.reading || []).length && `<span>${e.reading.length} page note${e.reading.length > 1 ? 's' : ''}</span>`,
    unchecked ? '<span class="unchecked" title="Summary not checked against the original">unchecked</span>' : '<span class="checked">checked</span>',
    e.use ? '<span class="use-set">use</span>' : '<span class="use-blank">use</span>',
  ].filter(Boolean).join('');

  let detail = '';
  if (isOpen) {
    const cite = mla(e);
    const list = (cls, head, items) => (items.length ? `<div class="${cls}"><h4>${head}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');
    const figs = e.numbers.length
      ? `<div><h4>Figures</h4><table class="figs"><tbody>${e.numbers.map((x) => `<tr><td>${esc(x.what)}</td><td class="val">${esc(x.value)}</td></tr>`).join('')}</tbody></table></div>`
      : '';
    const who = [
      e.people.length && `<div><b>People</b> ${esc(e.people.join(', '))}</div>`,
      e.counties.length && `<div><b>Counties</b> ${esc(e.counties.join(', '))}</div>`,
      e.sent_by && `<div><b>Sent by</b> ${esc(e.sent_by)}, ${esc(fmtDate(e.sent_date))}</div>`,
    ].filter(Boolean).join('');
    const design = (e.design || []).length
      ? `<ul>${e.design.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
      : '<p class="blank">No design links yet.</p>';
    detail = `<div class="detail" id="d-${esc(e.id)}">
      <div class="notes">
        ${e.url ? `<a class="open-src" href="${esc(e.url)}" target="_blank" rel="noopener">Open the source ↗</a>` : ''}
        ${provenance(e)}
        <ul>${e.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div class="aside">
        ${bears(e)}
        ${figs}
        ${list('verify', 'Verify', e.verify)}
        ${list('leads', 'Leads', e.leads)}
        ${who ? `<div class="who">${who}</div>` : ''}
      </div>
      <div class="cite">
        <h4>Works cited · MLA 9</h4>
        <p class="mla">${cite.html}</p>
        <button type="button" class="text-btn" data-copy="${esc(e.id)}">Copy citation</button>
        ${e.cite && !e.cite.archive && e.cite.url ? '<span class="arch">No archived copy yet.</span>' : ''}
      </div>
      ${(e.reading || []).length ? `<div class="use"><h4>Reading notes · Tim</h4><ul class="reading">${[...e.reading].sort((x, y) => (parseInt(x.page) || 0) - (parseInt(y.page) || 0)).map((r) => `<li><b>p. ${esc(r.page)}</b> ${esc(r.note || '')}${r.quote_on_file ? ' <span class="qf">quote on file</span>' : ''}${(r.lenses || []).map((l) => ` <span class="feel" data-feel="${esc(l)}">${esc(l)}</span>`).join('')}</li>`).join('')}</ul></div>` : ''}
      <div class="use"><h4>Use in the game</h4>${e.use ? `<p>${esc(e.use)}</p>` : '<p class="blank">Not written yet.</p>'}</div>
      <div class="use"><h4>Design links</h4>${design}</div>
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

// ---------- bibliography ----------

function renderBibliography(list) {
  if (!list.length) return '<p class="empty">No sources match these filters.</p>';
  const items = list.map((e) => ({ e, c: mla(e) })).sort((a, b) => (sortKey(a.c.text) < sortKey(b.c.text) ? -1 : 1));
  const unchecked = list.filter((e) => !(e.ai && e.ai.checked_on)).length;
  return `<section class="biblio">
    <div class="biblio-head">
      <div><h2>Works Cited</h2><p class="sub">MLA 9, alphabetical. Follows the filters on the left.${unchecked ? ` ${unchecked} of ${list.length} summaries not yet checked against the original.` : ''}</p></div>
      <button type="button" class="btn" id="copy-all">Copy all</button>
    </div>
    <ol class="works">${items.map(({ e, c }) => `<li><span class="mla">${c.html}</span> <a class="to" href="#act-${esc(e.id)}">No. ${esc(e.id)}</a></li>`).join('')}</ol>
  </section>`;
}

// ---------- questions ----------

function renderQuestions() {
  const how = `<p class="sub">Tim's research questions, in his words exactly as captured. Two ways to add one: send it in a chat with Claude, or email yourself with <b>WB Q</b> at the start of the subject. The nightly run files those.</p>`;
  if (!questions.length) return `<section class="plain"><h2>Questions</h2>${how}<p class="empty-inline">No questions captured yet.</p></section>`;
  return `<section class="plain"><h2>Questions <span class="n">${questions.length}</span></h2>${how}
    <ol class="qs">${questions.map((q) => `<li><p class="q">${esc(q.text)}</p><p class="qmeta">${esc(q.id)} · ${esc(q.tier || 'tier not set')} · answered by ${esc(q.answered_by || 'not set')} · ${esc(fmtDate(q.captured))} · via ${esc(q.via)} · ${esc(q.status)}${(q.sources || []).length ? ' · ' + q.sources.map((s) => `<a href="#act-${esc(s)}">No. ${esc(s)}</a>`).join(', ') : ''}</p></li>`).join('')}</ol>
  </section>`;
}

// ---------- AI log ----------

function renderAiLog() {
  const typeName = { direction: 'Direction Log', resistance: 'Record of Resistance' };
  const rows = ailog.map((x) => `<li class="log ${esc(x.type)}">
      <div class="log-head"><span class="tag">${esc(typeName[x.type] || x.type)}</span><span class="log-id">${esc(x.id)} · ${esc(fmtDate(x.date))}</span><span class="outcome">${esc(x.outcome)}</span></div>
      <dl>
        <dt>Asked</dt><dd>${esc(x.asked)}</dd>
        <dt>AI produced</dt><dd>${esc(x.produced)}</dd>
        ${x.instead ? `<dt>Instead</dt><dd>${esc(x.instead)}</dd>` : ''}
        <dt>Why</dt><dd>${x.why ? `<span class="tim">${esc(x.why)}</span>` : '<span class="blank">For Tim to write.</span>'}</dd>
        ${(x.commits || []).length ? `<dt>Commits</dt><dd>${x.commits.map((c) => `<a href="${REPO}${esc(c)}" target="_blank" rel="noopener">${esc(c)}</a>`).join(', ')}</dd>` : ''}
      </dl>
    </li>`).join('');
  return `<section class="plain"><h2>AI log</h2>
    <p class="sub">AI use for this ledger, in the AI 201 ESF format. Direction Log entries say what was asked, what the AI produced, and what was kept, changed or rejected. Records of Resistance mark the moments Tim rejected the output. Every why line is Tim's own words.</p>
    <ol class="logs">${rows}</ol></section>`;
}

// ---------- page ----------

function renderStats() {
  const all = data.entries;
  const verify = all.reduce((a, e) => a + e.verify.length, 0);
  const checked = all.filter((e) => e.ai && e.ai.checked_on).length;
  const used = all.filter((e) => e.use).length;
  const feel = (f) => all.filter((e) => valuesOf.feeling(e).includes(f)).length;
  $('#stats').innerHTML = `
    <button type="button" class="stat" data-go="sources"><b>${all.length}</b><span>sources</span></button>
    <button type="button" class="stat feel-stat" data-feel="outlaw" data-go="feel-outlaw"><b>${feel('outlaw')}</b><span>bear on outlaw</span></button>
    <button type="button" class="stat feel-stat" data-feel="pride" data-go="feel-pride"><b>${feel('pride')}</b><span>bear on pride</span></button>
    <button type="button" class="stat feel-stat" data-feel="trust" data-go="feel-trust"><b>${feel('trust')}</b><span>bear on trust</span></button>
    <button type="button" class="stat warn" data-go="docket"><b>${verify}</b><span>to verify</span></button>
    <button type="button" class="stat" data-go="unchecked"><b>${checked} of ${all.length}</b><span>checked by Tim</span></button>
    <button type="button" class="stat" data-go="blank"><b>${used} of ${all.length}</b><span>uses written</span></button>
    <button type="button" class="stat" data-go="questions"><b>${questions.length}</b><span>questions</span></button>`;
}

function renderPrimary() {
  const q = questions.find((x) => x.tier === 'primary');
  const el = $('#primary');
  if (!q) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="pq-label">Primary question</span><q class="pq">${esc(q.text)}</q><span class="pq-who">Tim, ${esc(fmtDate(q.captured))}</span>`;
}

function render() {
  const list = shown();
  const v = state.view;
  const panes = { sources: '#list', docket: '#docket', bibliography: '#biblio', questions: '#questions', ailog: '#ailog' };
  Object.entries(panes).forEach(([k, sel]) => ($(sel).hidden = k !== v));
  $('#expand').hidden = v !== 'sources';
  $('#sort').closest('.sort').hidden = v !== 'sources';
  document.querySelectorAll('#views [data-view]').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v));
  const filtersApply = ['sources', 'docket', 'bibliography'].includes(v);
  $('.rail').classList.toggle('muted', !filtersApply);

  if (v === 'docket') {
    $('#docket').innerHTML = renderDocket(list);
    const n = list.reduce((a, e) => a + e.leads.length + e.verify.length, 0);
    $('#shown').textContent = `${n} open item${n === 1 ? '' : 's'}`;
  } else if (v === 'bibliography') {
    $('#biblio').innerHTML = renderBibliography(list);
    $('#shown').textContent = `${list.length} of ${data.entries.length}`;
  } else if (v === 'questions') {
    $('#questions').innerHTML = renderQuestions();
    $('#shown').textContent = '';
  } else if (v === 'ailog') {
    $('#ailog').innerHTML = renderAiLog();
    $('#shown').textContent = `${ailog.length} entries`;
  } else {
    $('#list').innerHTML = list.length ? list.map(renderSource).join('') : '<p class="empty">No sources match these filters.</p>';
    $('#shown').textContent = `${list.length} of ${data.entries.length}`;
    const allOpen = list.length && list.every((e) => state.open.has(e.id));
    $('#expand').textContent = allOpen ? 'Collapse all' : 'Expand all';
  }
}

function clearFilters() {
  GROUPS.forEach((g) => state[g].clear());
  state.q = '';
}

function openEntry(id) {
  state.view = 'sources';
  state.open.add(id);
  if (!data.entries.find((e) => e.id === id && matches(e))) { clearFilters(); renderFilters(); }
  render();
  const el = document.getElementById(`act-${id}`);
  if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); }
}

function fromHash() {
  const h = location.hash.slice(1);
  if (h.startsWith('act-')) return openEntry(h.slice(4));
  state.view = VIEWS.includes(h) ? h : 'sources';
  render();
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
    clearFilters(); renderFilters(); render();
  });
  $('#sort').addEventListener('change', (ev) => { state.sort = ev.target.value; render(); });
  $('#expand').addEventListener('click', () => {
    const list = shown();
    const allOpen = list.every((e) => state.open.has(e.id));
    list.forEach((e) => (allOpen ? state.open.delete(e.id) : state.open.add(e.id)));
    render();
  });
  $('#list').addEventListener('click', (ev) => {
    const cp = ev.target.closest('[data-copy]');
    if (cp) {
      const e = data.entries.find((x) => x.id === cp.dataset.copy);
      const c = mla(e);
      copy(c.html, c.text, cp);
      return;
    }
    const b = ev.target.closest('[data-toggle]');
    if (!b) return;
    const id = b.dataset.toggle;
    state.open.has(id) ? state.open.delete(id) : state.open.add(id);
    render();
    document.querySelector(`[data-toggle="${id}"]`)?.focus();
  });
  $('#biblio').addEventListener('click', (ev) => {
    if (ev.target.id !== 'copy-all') return;
    const items = shown().map((e) => mla(e)).sort((a, b) => (sortKey(a.text) < sortKey(b.text) ? -1 : 1));
    copy(`<p>Works Cited</p>${items.map((c) => `<p>${c.html}</p>`).join('')}`, ['Works Cited', ...items.map((c) => c.text)].join('\n\n'), ev.target);
  });
  $('#views').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-view]');
    if (b) location.hash = b.dataset.view;
  });
  $('#stats').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-go]');
    if (!b) return;
    const go = b.dataset.go;
    if (go.startsWith('feel-')) {
      clearFilters();
      state.feeling.add(go.slice(5));
      renderFilters();
      location.hash === '#sources' ? render() : (location.hash = 'sources');
    } else if (go === 'blank' || go === 'unchecked') {
      clearFilters();
      (go === 'blank' ? state.use : state.checked).add(go === 'blank' ? 'blank' : 'unchecked');
      renderFilters();
      location.hash === '#sources' ? render() : (location.hash = 'sources');
    } else {
      location.hash = go;
    }
  });
  addEventListener('hashchange', fromHash);
  const wide = matchMedia('(min-width: 861px)');
  const syncPanel = () => { if (wide.matches) $('#filters-panel').open = true; };
  wide.addEventListener('change', syncPanel);
  syncPanel();
}

async function load(file) {
  const res = await fetch(file, { cache: 'no-cache' });
  if (!res.ok) throw new Error(file);
  return res.json();
}

async function boot() {
  try {
    data = await load('catalogue.json');
  } catch {
    $('#list').innerHTML = '<p class="empty">Could not load catalogue.json. Serve this folder over http, not from the file system.</p>';
    return;
  }
  try { questions = (await load('questions.json')).questions || []; } catch { questions = []; }
  try { ailog = (await load('ai-log.json')).entries || []; } catch { ailog = []; }
  $('#updated').textContent = fmtDate(data.meta.updated);
  $('#sort').innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');
  renderPrimary();
  renderStats();
  renderFilters();
  wire();
  fromHash();
}

boot();
