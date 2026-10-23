// Cloud runbook: HTML rendering shared by tools/build.mjs (pre-rendered pages)
// and app.js (search results). Pure functions: no DOM, no storage.

export const PH = /<([a-z][a-z0-9_.:/-]*)>/gi;
const NONE = new Map();

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ESC[ch]);

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const placeholdersIn = (text) => [...new Set([...text.matchAll(PH)].map((m) => m[1]))];

// URLs relative to the page: root is '', '../' or '../../'.
export const categoryUrl = (root, cat) => `${root}${slug(cat)}/`;
export const playbookUrl = (root, id) => `${root}playbooks/${id}/`;

function wordHtml(word, values) {
  let html = '';
  let last = 0;
  for (const m of word.matchAll(PH)) {
    const name = m[1];
    const value = values.get(name);
    html += esc(word.slice(last, m.index));
    html += `<span class="ph${value ? ' filled' : ''}" data-ph="${esc(name)}">${esc(value || m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return html + esc(word.slice(last));
}

// Each word is its own box, so a line breaks between words and never inside a
// flag such as --recursive (unless one word is wider than the whole line).
export const codeHtml = (text, values = NONE) =>
  text
    .split(/(\s+)/)
    .map((part, i) => (i % 2 ? esc(part) : part && `<span class="w">${wordHtml(part, values)}</span>`))
    .join('');

function actionsHtml(text, label, withLink, tags) {
  const phs = placeholdersIn(text);
  const hidden = `<span class="visually-hidden">: ${esc(label)}</span>`;
  return `
    <div class="actions">
      <button type="button" class="btn" data-act="copy">Copy${hidden}</button>
      ${withLink ? `<button type="button" class="btn" data-act="link">Copy link${hidden}</button>` : ''}
      ${
        phs.length
          ? `<button type="button" class="btn" data-act="fill" aria-expanded="false">Fill in ${phs.length === 1 ? 'placeholder' : `${phs.length} placeholders`}${hidden}</button>`
          : ''
      }
      ${tags && tags.length ? `<p class="micro tags">${tags.map(esc).join(', ')}</p>` : ''}
    </div>`;
}

// anchor: the page lists this command, so it carries its id and links to itself.
// Otherwise (inside a playbook) it links to its category page.
export function commandHtml(c, { root = '', anchor = true, values = NONE } = {}) {
  const href = anchor ? `#${esc(c.id)}` : `${categoryUrl(root, c.category)}#${esc(c.id)}`;
  return `
    <article class="cmd"${anchor ? ` id="${esc(c.id)}"` : ''} data-key="c:${esc(c.id)}">
      <h3><a href="${href}">${esc(c.title)}</a></h3>
      <p class="desc">${esc(c.description)}</p>
      ${c.warn ? `<p class="caution"><strong>Caution.</strong> ${esc(c.warn)}</p>` : ''}
      <pre class="code"><code>${codeHtml(c.command, values)}</code></pre>
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
      ${actionsHtml(c.command, c.title, true, c.tags)}
    </article>`;
}

export function groupHtml(cat, list, { root = '', values = NONE } = {}) {
  const id = `g-${slug(cat)}`;
  return `
    <section class="group" aria-labelledby="${id}">
      <h2 id="${id}"><a href="${categoryUrl(root, cat)}">${esc(cat)}</a><span class="n">${list.length}</span></h2>
      ${list.map((c) => commandHtml(c, { root, values })).join('')}
    </section>`;
}

export function playbookListHtml(playbooks, { root = '' } = {}) {
  return `
    <ul class="pb-list">
      ${playbooks
        .map(
          (p) => `<li>
            <h2><a href="${playbookUrl(root, p.id)}">${esc(p.title)}</a></h2>
            <p>${esc(p.summary)}</p>
            <p class="micro">${plural(p.steps.length, 'step', 'steps')}</p>
          </li>`,
        )
        .join('')}
    </ul>`;
}

export function playbookHtml(p, byId, { root = '', values = NONE } = {}) {
  const steps = p.steps.map((s, i) => {
    let body = `<p class="step-text">${esc(s.text)}</p>`;
    if (s.cmd) {
      body += `<div class="ref">${commandHtml(byId.get(s.cmd), { root, anchor: false, values })}</div>`;
    } else if (s.run) {
      body += `<div class="ref cmd" data-key="r:${esc(p.id)}:${i}">
        ${s.warn ? `<p class="caution"><strong>Caution.</strong> ${esc(s.warn)}</p>` : ''}
        <pre class="code"><code>${codeHtml(s.run, values)}</code></pre>
        ${actionsHtml(s.run, s.text, false, null)}
      </div>`;
    }
    return `<li>${body}</li>`;
  });
  return `<ol class="steps">${steps.join('')}</ol>`;
}
