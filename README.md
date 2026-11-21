# FocusCaseX Marketplace

The **public extension hub** for FocusCaseX — and the **API mediator** every FocusCaseX client reads.

The clinical app itself lives in the private [`stromplayz/FocusCaseX`](https://github.com/stromplayz/FocusCaseX)
repo. Everything users can extend the app with — **capsules, plugins, themes, templates, snippets** — plus the
**mandatory core layer** is published *here*, on a public repo served through GitHub Pages. The app never depends
on its own repo for updates: it pulls from this site.

**Live site → <https://stromplayz.github.io/FocusCaseX-Marketplace/>**

---

## The API mediator contract

Two static JSON endpoints (no server, no build — plain files on Pages):

### `api/core.json` — the mandatory core (fetched on every app boot)

```jsonc
{
  "schema": "fcx.market.core.v1",
  "version": "2.0.0",              // the core version stamp
  "flags": { ... },                // remote feature flags
  "announcement": {                 // rendered by the core-announcement surface
    "id": "core-v2-2026-11",
    "title": "Update v2 is live",
    "level": "update",
    "action": { "label": "DOWNLOAD UPDATE V2", "kind": "core-pull" }
  },
  "corePlugins": [                  // pulled by the core-updater on user confirmation
    { "id": "core-ui", "version": "2.0.0",
      "files": { "manifest": "plugins/core-ui/manifest.json", "main": "plugins/core-ui/main.js" },
      "enable": true }
  ],
  "coreCss": []                     // site-relative CSS files applied as the core layer
}
```

### `api/registry.json` — the catalog (rebuilt by `scripts/build-registry.mjs`)

Every published item with metadata + a `files` map. The app merges it into its in-app Marketplace:
remote-only items become first-class installable cards; version bumps drive update badges.

### Assets — pulled on demand

`plugins/<id>/main.js`, `capsules/<id>/spec.mdui`, `themes/<id>.json`, `templates/<id>.md`, `snippets/*.css` —
raw files fetched only when an install/update needs them.

---

## The core update flow

```
app boot ──▶ fetch api/core.json (stale-while-revalidate)
             │
             ├─ flags + featured picks applied
             ├─ announcement ──▶ core-announcement banner (pixel-art)
             │                        │
             │                        ▼ user confirms
             │                   core-updater: check ▶ pull corePlugins + coreCss
             │                        ▶ install (disk, or in-memory on read-only hosts)
             │                        ▶ enable ──▶ core-ui customization is live
             └─ no redeploys: publish here, clients pull on their next boot
```

**Core plugins are ordinary plugins once installed** — they run through the same plugin host + CSS system as any
extension. That's the point of Update v2: *core-ui modification rides the plugin system*, so the app's default
chrome (settings, sidebar, left/right panels, tabs) can evolve entirely from this repo.

## Publishing a new item

1. Add the asset folder(s): `plugins/<id>/`, `capsules/<id>/`, `themes/<id>.json`, `templates/<id>.md`, `snippets/*.css`.
2. Add its entry to **`catalog.json`** (metadata + `files` map, site-relative paths).
3. Rebuild the registry and commit:

   ```bash
   node scripts/build-registry.mjs
   git add -A && git commit -m "publish: <id>" && git push
   ```

   Pages redeploys automatically; every client sees it on its next boot.

## Syncing from the private app repo

The private repo carries `scripts/publish-marketplace.mjs` (run via `npm run sync:marketplace`): it copies the
app's bundled plugins, capsules and snippets into this repo, refreshes `catalog.json` metadata, rebuilds the
registry and pushes — keeping both repos in lockstep.

## Repo layout

```
api/core.json            the mandatory core (version, flags, announcement, corePlugins, coreCss)
api/registry.json        generated catalog — never hand-edit
catalog.json             the hand-edited source of truth for item metadata
plugins/  capsules/  themes/  templates/  snippets/    the assets
scripts/build-registry.mjs    registry builder (validates every referenced file)
index.html               this landing page (also renders the live catalog)
.nojekyll                serve everything as-is
```

## License

MIT — see [LICENSE](LICENSE).
