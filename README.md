<div align="center">

# FocusCaseX Marketplace

**The public distribution layer of [FocusCaseX](https://github.com/stromplayz/FocusCaseX)** — one open registry for every capsule, plugin, theme and template, served as a zero-cost API by GitHub Pages.

[![GitHub Pages](https://img.shields.io/website?url=https%3A%2F%2Fstromplayz.github.io%2FFocusCaseX-Marketplace%2F&label=Pages&style=flat-square)](https://stromplayz.github.io/FocusCaseX-Marketplace/)
[![Registry](https://img.shields.io/badge/registry-58%20items-10b981?style=flat-square)](api/registry.json)
[![Core](https://img.shields.io/badge/core-v1.0.0-06b6d4?style=flat-square)](api/core.json)
[![Validate](https://img.shields.io/github/actions/workflow/status/stromplayz/FocusCaseX-Marketplace/validate.yml?branch=main&label=validate&style=flat-square)](../../actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-8b94a7?style=flat-square)](LICENSE)

</div>

---

## Why this repo exists

The FocusCaseX app ships a beautiful in-app Marketplace — but its catalog was bundled inside the app, so any catalog or content change required an app redeploy. This repo breaks that coupling:

- **One public home** for all marketplace content — users can browse capsules, plugins, themes, templates and snippets right here, no app install needed.
- **An API mediator**: GitHub Pages serves the catalog as static JSON with open CORS. The app consumes `api/core.json` + `api/registry.json` from this site — never from its own private repo.
- **Auto-updates without redeploying the app**: change content here (via the sync script), and every running FocusCaseX client picks it up on its next boot.

```
┌────────────────────┐        sync script         ┌─────────────────────────────┐
│  FocusCaseX (app)  │ ─── scripts/sync- ───────▶ │  FocusCaseX-Marketplace     │
│  private repo      │     marketplace.mts        │  this public repo           │
└─────────┬──────────┘                            └──────────────┬──────────────┘
          │  app boot                                             │ GitHub Pages
          │  ① GET api/core.json  (mandatory, cached SWR)         ▼
          │  ② GET api/registry.json (merge + update badges)   JSON API
          └────────────────────────────────────────────────▶  ● CORS: *
```

## Live endpoints

Base URL: `https://stromplayz.github.io/FocusCaseX-Marketplace/`

| Endpoint | Schema | Purpose |
| --- | --- | --- |
| [`api/core.json`](api/core.json) | `fcx.market.core.v1` | **Mandatory core config** — version, `minAppVersion`, feature `flags`, `announcement`, `featured` picks, `autoEnableCapsules`. Fetched at every app boot; edits propagate to all clients without an app redeploy. |
| [`api/registry.json`](api/registry.json) | `fcx.market.registry.v1` | Full catalog: `counts`, `items[]` (the `MarketItem` contract + a `files` map of asset paths), `snippets[]`. Drives the in-app Marketplace and its update badges. |
| `capsules/<id>/{spec.mdui,style.css,logic.mdui}` | — | Raw capsule layers (three-layer capsule packages). |
| `plugins/<id>/{manifest.json,main.js}` | — | Plugin bundles, installable/updatable from the app. |
| `themes/<id>.json` | `FcxTheme` v2 token JSON | Whole-app theme presets — applying remaps every surface instantly. |
| `templates/<id>.md` | markdown | Clinical note templates (bodies include frontmatter + `emr-*` fences). |
| `snippets/*.css` | CSS | Copy-in editor/UI snippets. |

CORS is open (`Access-Control-Allow-Origin: *`) — GitHub Pages does it for free, which is what makes this site a true API mediator for any client.

## The core contract

`api/core.json` is the **mandatory file**: small, always fetched, always applied. Bump its `version`, edit flags or add an announcement, sync, push — done:

```json
{
  "schema": "fcx.market.core.v1",
  "version": "1.0.0",
  "minAppVersion": "1.14.4",
  "flags": { "remoteMarketplace": true, "autoCheckUpdates": true, "showAnnouncements": true },
  "announcement": { "id": "marketplace-launch-1", "title": "…", "body": "…", "level": "info" },
  "featured": { "capsule": "ui-appointment", "theme": "midnight", "plugin": "focus-mode", "template": "refraction-note" },
  "autoEnableCapsules": [],
  "endpoints": { "registry": "api/registry.json", "core": "api/core.json" }
}
```

The authoritative source of truth for the core lives in the private app repo at `marketplace-src/core.source.json`; this repo's `api/core.json` is its published copy.

## Item contract

Registry items follow the app's `MarketItem` shape, plus `files`:

```json
{
  "id": "capsule:ui-exam",
  "kind": "capsule",
  "name": "Exam",
  "tagline": "…",
  "description": "…",
  "author": "CaseX Labs",
  "version": "1.0.0",
  "category": "Clinical",
  "tags": ["capsule", "clinical", "exam"],
  "icon": "ClipboardList",
  "rating": 4.6, "reviews": 158, "downloads": 2140,
  "released": "", "verified": true, "featured": false,
  "meta": { "capsuleId": "ui-exam", "…": "…" },
  "files": { "spec": "capsules/ui-exam/spec.mdui", "style": "capsules/ui-exam/style.css", "logic": "capsules/ui-exam/logic.mdui" }
}
```

`files` paths are site-root relative — clients resolve them against the marketplace base URL.

## How it syncs

From the **private app repo** (stromplayz/FocusCaseX):

```bash
# 1. edit marketplace-src/core.source.json (optional: flags / announcement / version bump)
# 2. regenerate the marketplace clone
npx tsx scripts/sync-marketplace.mts
# 3. commit + push from /marketplace (the working clone of this repo)
cd marketplace && git add -A && git commit -m "marketplace: sync" && git push origin main
```

The script wipes and regenerates `api/`, `capsules/`, `plugins/`, `snippets/`, `themes/`, `templates/` from the app's catalog modules (the exact same code the in-app store renders from) and disk assets. Hand-authored files — this README, the landing page, LICENSE — are never touched.

A [validation workflow](.github/workflows/validate.yml) runs on every push and fails the build if any JSON is malformed or a registry item breaks the contract.

## Structure

```
FocusCaseX-Marketplace/
├── index.html               ← the site you are reading (catalog browser + API docs)
├── api/
│   ├── core.json            ← mandatory core config (published from marketplace-src/core.source.json)
│   └── registry.json        ← full catalog manifest
├── capsules/<id>/           ← spec.mdui · style.css · logic.mdui
├── plugins/<id>/            ← manifest.json · main.js
├── themes/<id>.json         ← FcxTheme v2 token files
├── templates/<id>.md        ← clinical templates
├── snippets/*.css           ← editor/UI snippets
├── .github/
│   ├── workflows/validate.yml
│   └── scripts/validate.mjs
├── LICENSE
└── README.md
```

## License

MIT — see [LICENSE](LICENSE). FocusCaseX itself remains private; only marketplace content and this API surface are public.
