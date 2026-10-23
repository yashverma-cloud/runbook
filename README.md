# Cloud runbook

A searchable reference of generic DevOps, SRE and cloud commands, with short playbooks for common incidents.

Live: https://yashverma-cloud.github.io/yv-cloud-runbook/

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
| `style.css` | All styles; the colours and type follow https://yashverma-cloud.github.io/ |
| `fonts/` | Overpass and Overpass Mono, self-hosted (SIL OFL 1.1) |

No third-party hosts and no dependencies. The generated pages are committed, so GitHub Pages serves the files as they are.

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

A push to `main` deploys the repository root to GitHub Pages through `.github/workflows/deploy.yml`. The workflow first runs `node tools/build.mjs --check` and stops if the committed pages don't match the data.

## Licence

MIT. The fonts are under the SIL Open Font License 1.1 (`fonts/Overpass-LICENSE.txt`).
