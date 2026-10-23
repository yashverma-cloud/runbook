// Cloud runbook: enhances the pre-rendered pages with search, copy, fill-in
// placeholders and keyboard shortcuts. The pages work and read without it.

import { commands } from './commands.js';
import { playbooks } from './playbooks.js';
import { PH, esc, plural, placeholdersIn, categoryUrl, playbookUrl, groupHtml } from './render.js';

const root = document.body.dataset.root || '';

// --- Old links -----------------------------------------------------------------
// The first version routed by hash (#category/aws, #playbook/disk-full). Keep
// those links working by sending them to the real pages.

{
  const h = decodeURIComponent(location.hash.slice(1));
  const byId = new Map(commands.map((c) => [c.id, c]));
  let to = null;
  if (h.startsWith('category/')) to = `${root}${h.slice(9)}/`;
  else if (h === 'playbooks') to = `${root}playbooks/`;
  else if (h.startsWith('playbook/')) to = playbookUrl(root, h.slice(9));
  else if (h && !document.getElementById(h) && byId.has(h)) to = `${categoryUrl(root, byId.get(h).category)}#${h}`;
  if (to) location.replace(to);
}

// --- Data ------------------------------------------------------------------------

const categories = [...new Set(commands.map((c) => c.category))];
const byId = new Map(commands.map((c) => [c.id, c]));
const haystack = new Map(
  commands.map((c) => [
    c.id,
    [c.title, c.description, c.command, c.category, c.id, c.warn, c.note, ...c.tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  ]),
);

// Copy keys map a block back to its raw text, so nothing is parsed out of the HTML.
const snippets = new Map(commands.map((c) => [`c:${c.id}`, c.command]));
playbooks.forEach((p) =>
  p.steps.forEach((s, i) => {
    if (s.run) snippets.set(`r:${p.id}:${i}`, s.run);
  }),
);

// --- Placeholders ----------------------------------------------------------------
// <name> in a command is a placeholder. A value typed once is used everywhere the
// same name appears, and is kept in this browser only.

const STORE = 'runbook:placeholders';
const values = new Map();

try {
  Object.entries(JSON.parse(localStorage.getItem(STORE) || '{}')).forEach(([k, v]) => {
    if (typeof v === 'string' && v) values.set(k, v);
  });
} catch {
  // Storage blocked or corrupt: start empty.
}

function saveValues() {
  try {
    localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(values)));
  } catch {
    // Values still work for this visit.
  }
}

const filled = (text) => text.replace(PH, (m, name) => values.get(name) || m);

function showValue(name) {
  const value = values.get(name);
  document.querySelectorAll(`.ph[data-ph="${CSS.escape(name)}"]`).forEach((span) => {
    span.textContent = value || `<${name}>`;
    span.classList.toggle('filled', Boolean(value));
  });
}

const showAllValues = () => values.forEach((_, name) => showValue(name));

// --- Elements --------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const q = $('#q');
const count = $('#count');
const announce = $('#announce');
const pageView = view.innerHTML;
const pageCount = count.textContent;

function say(text) {
  announce.textContent = '';
  // A fresh change makes screen readers repeat identical messages.
  requestAnimationFrame(() => (announce.textContent = text));
}

$('#cat-select').addEventListener('change', (e) => {
  location.href = e.target.value;
});

// --- Search ----------------------------------------------------------------------
// Searches every category from any page. Clearing it brings the page back.

function search(terms) {
  const rank = (c) => {
    const title = c.title.toLowerCase();
    if (terms.every((t) => title.includes(t))) return 0;
    if (terms.every((t) => c.tags.some((tag) => tag.includes(t)))) return 1;
    return 2;
  };
  return commands
    .filter((c) => terms.every((t) => haystack.get(c.id).includes(t)))
    .map((c, i) => ({ c, r: rank(c), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

function renderSearch() {
  const query = q.value.trim();
  const url = new URL(location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);

  if (!query) {
    view.innerHTML = pageView;
    count.textContent = pageCount;
    showAllValues();
    return;
  }

  const found = search(query.toLowerCase().split(/\s+/));
  count.textContent = `${plural(found.length, 'command matches', 'commands match')} “${query}”`;
  if (!found.length) {
    view.innerHTML = '<div class="empty"><p>No commands match. Try fewer or shorter words.</p></div>';
    return;
  }
  view.innerHTML = categories
    .map((cat) => found.filter((c) => c.category === cat))
    .map((list) => (list.length ? groupHtml(list[0].category, list, { root, values }) : ''))
    .join('');
}

let timer;
q.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(renderSearch, 120);
});

// --- Copy ------------------------------------------------------------------------

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through: older browsers, or the permission was refused.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

function flash(btn, text) {
  const label = btn.firstChild;
  const original = btn.dataset.label || label.textContent;
  btn.dataset.label = original;
  label.textContent = text;
  clearTimeout(btn._t);
  btn._t = setTimeout(() => (label.textContent = original), 1600);
}

async function copyBlock(btn, block) {
  const text = filled(snippets.get(block.dataset.key));
  if (await writeClipboard(text)) {
    flash(btn, 'Copied');
    const left = placeholdersIn(text);
    say(left.length ? `Copied. Still to fill in: ${left.join(', ')}.` : 'Copied.');
  } else {
    // Last resort: select the command so the visitor can copy it by hand.
    const range = document.createRange();
    range.selectNodeContents(block.querySelector('code'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    flash(btn, 'Selected');
    say('Copy is blocked here. The command is selected; press Ctrl+C or Cmd+C.');
  }
}

async function copyLink(btn, block) {
  const c = byId.get(block.dataset.key.slice(2));
  const url = new URL(`${categoryUrl(root, c.category)}#${c.id}`, location.href).href;
  if (await writeClipboard(url)) {
    flash(btn, 'Link copied');
    say('Link copied.');
  } else {
    location.href = url;
  }
}

// --- Fill in ---------------------------------------------------------------------

function fillPanel(names) {
  const fields = names
    .map(
      (n) => `<label><span class="micro">&lt;${esc(n)}&gt;</span>
        <input type="text" data-ph-input="${esc(n)}" value="${esc(values.get(n) || '')}"
          autocomplete="off" autocapitalize="off" spellcheck="false" /></label>`,
    )
    .join('');
  return `<div class="fill-grid">${fields}</div>
    <p class="micro">Kept in this browser and used in every command with the same placeholder.
      <button type="button" class="btn" data-act="clear">Clear all values</button></p>`;
}

let panelId = 0;
function toggleFill(btn, block) {
  let panel = block.querySelector(':scope > .fill');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'fill';
    panel.id = `fill-${++panelId}`;
    panel.hidden = true;
    panel.innerHTML = fillPanel(placeholdersIn(snippets.get(block.dataset.key)));
    block.append(panel);
    btn.setAttribute('aria-controls', panel.id);
  }
  panel.hidden = !panel.hidden;
  btn.setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) panel.querySelector('input').focus();
}

view.addEventListener('input', (e) => {
  const input = e.target.closest('[data-ph-input]');
  if (!input) return;
  const name = input.dataset.phInput;
  const value = input.value.trim();
  if (value) values.set(name, value);
  else values.delete(name);
  saveValues();
  showValue(name);
  document.querySelectorAll(`[data-ph-input="${CSS.escape(name)}"]`).forEach((other) => {
    if (other !== input) other.value = input.value;
  });
});

// --- Clicks ----------------------------------------------------------------------

view.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const block = btn.closest('[data-key]');
  const act = btn.dataset.act;
  if (act === 'copy') copyBlock(btn, block);
  else if (act === 'link') copyLink(btn, block);
  else if (act === 'fill') toggleFill(btn, block);
  else if (act === 'clear') {
    const names = [...values.keys()];
    values.clear();
    saveValues();
    names.forEach(showValue);
    document.querySelectorAll('[data-ph-input]').forEach((input) => (input.value = ''));
    say('All placeholder values cleared.');
  }
});

// --- Keyboard --------------------------------------------------------------------

const typing = (el) => el.closest('input, textarea, select, [contenteditable="true"]');

document.addEventListener('keydown', (e) => {
  if ((e.key === '/' && !typing(e.target)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    q.focus();
    q.select();
  }
});

q.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  if (q.value) {
    q.value = '';
    renderSearch();
  } else {
    q.blur();
  }
});

// --- Start -----------------------------------------------------------------------

showAllValues();
const initial = new URLSearchParams(location.search).get('q');
if (initial) {
  q.value = initial;
  renderSearch();
}
document.documentElement.classList.add('js');
