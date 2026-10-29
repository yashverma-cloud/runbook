# Cloud runbook

A searchable reference of generic DevOps, SRE and cloud commands, with short playbooks for common incidents.

Live: https://runbook.yashverma.cloud/

- Search across titles, descriptions, commands and tags (`/` or `Ctrl+K` to focus, `Esc` to clear).
- A page for every category (`/kubernetes/`) and playbook (`/playbooks/disk-full/`), and a link for every command (`/kubernetes/#k8s-drain-node`). Searches can be shared too (`/?q=drain`).
- Every page is pre-rendered, so it reads without JavaScript and search engines see the commands; `sitemap.xml` lists the pages.
- Placeholders such as `<pod-name>` can be filled in once; every command that uses them, and every copy, picks up the value. Values stay in your browser.
- Risky commands carry a caution saying what they destroy and how to check first.

## Files

| File | What it holds |
|---|---|
| `commands.js` | The commands, one entry per line |
| `playbooks.js` | The playbooks |
| `render.js` | HTML for commands and playbooks, shared by the build and the page script |
| `tools/build.mjs` | Writes the pages below from the data, and checks the data |
| `index.html`, `<category>/`, `playbooks/`, `404.html`, `sitemap.xml` | Generated: do not edit by hand |
| `app.js` | Search, copy, fill-in placeholders and keyboard shortcuts on top of the pages |
| `style.css` | All styles; the tokens, colours and type are copied from https://yashverma.cloud/ (the source commit is noted at the top of the file) |
| `fonts/` | Archivo and B612 Mono, self-hosted (SIL OFL 1.1) |
| `_headers` | Security and caching headers for Cloudflare Pages |

No dependencies, and no third-party hosts except Cloudflare Web Analytics (injected by Pages; allowed in `_headers`). The generated pages are committed, so Cloudflare Pages serves the files as they are.

## Adding a command

Add one line to `commands.js`, in its category's block:

```js
{ id: "k8s-cordon", category: "Kubernetes", title: "Cordon a node", description: "Marks a node unschedulable; running pods stay where they are.", command: "kubectl cordon <node-name>", tags: ["nodes", "maintenance"] },
```

- `id` is part of a public URL: keep it stable once published.
- Write placeholders as `<name>`; reuse an existing name (`<namespace>`, `<pod-name>`) where it means the same thing.
- Add `warn: "..."` to anything that deletes, overwrites, forces or exposes something, saying what it does and how to check first.
- Add `note: "..."` for context such as version differences or costs.

A playbook step is `{ text, cmd }`, where `cmd` is a command `id`, or `{ text, run }` for a one-off command; `warn` works on steps too.

Then rebuild the pages and commit them with the data:

```sh
node tools/build.mjs
```

The build stops with a list of problems if the data is wrong (a duplicate id, a playbook step pointing at a missing command). It needs Node 20 or later and nothing else.

## Preview

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. Opened straight from disk, the pages read fine but search, copy and fill-in don't work, because browsers do not load JavaScript modules from `file://`.

## Deploy

Cloudflare Pages deploys the repository root through its Git integration: a merge to `main` deploys to production, and every pull request gets a preview deployment, linked from its checks. Its build command is `node tools/build.mjs --check`, so a deploy stops if the committed pages don't match the data; `.github/workflows/pr-check.yml` runs the same check on every pull request.

To roll back, roll back to the previous production deployment in the Cloudflare dashboard, then revert the commit through a pull request.

The runbook used to live at `yashverma-cloud.github.io/yv-cloud-runbook/`. Those addresses redirect to the same pages here.

## Licence

MIT. The fonts are under the SIL Open Font License 1.1 (`fonts/OFL-archivo.txt`, `fonts/OFL-b612mono.txt`).
