/**
 * FocusCaseX Marketplace — core runtime (vanilla JS, no dependencies).
 * Shared by every page: catalog loading, chrome injection (topbar/footer),
 * canonical card renderer, kind tabs, show-all expander, global search
 * overlay, theme swatches, mini markdown renderer, demo boards, clipboard.
 *
 * Exposes window.FCX. Pages load:
 *   <script src="assets/icons.js"></script>
 *   <script src="assets/app.js"></script>
 * and start with FCX.ready().then(...)
 */
(function () {
  "use strict";

  const ICONS = window.FCX_ICONS || {};
  const CATALOG_URL = "catalog.json";
  const CACHE_KEY = "fcx.market.catalog.v3";

  /* ----------------------------- small utils ----------------------------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function icon(name, size, cls) {
    const node = ICONS[name];
    const s = size || 16;
    if (!node || !node.length) {
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls || ""}" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>`;
    }
    const body = node
      .map((p) => {
        const a = Object.assign({}, p.attrs || {});
        delete a.key;
        const attrs = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ");
        return `<${p.tag}${attrs ? " " + attrs : ""}></${p.tag}>`;
      })
      .join("");
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls || ""}" aria-hidden="true">${body}</svg>`;
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}/.test(iso)) return "";
    const y = iso.slice(0, 4);
    const m = parseInt(iso.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) return "";
    return `${MONTHS[m]} ${y}`;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    return true;
  }

  function getParam(name) {
    return new URLSearchParams(location.search).get(name) || "";
  }
  function setParam(name, value) {
    const u = new URL(location.href);
    if (value) u.searchParams.set(name, value);
    else u.searchParams.delete(name);
    history.replaceState(null, "", u.toString());
  }

  /* --------------------------- banned-word cleaner -------------------------
   * CONTRACT.md forbids these words in user-visible copy. item.html cleans
   * its own long copy; this sibling keeps card taglines and search results
   * (which render catalog text verbatim) safe on browse pages too.
   * Word-boundary safe, case-insensitive, idempotent. */
  const CLEAN = [
    [/\/bvault\b/gi, "your clinic records"],
    [/\byour vault\b/gi, "your clinic records"],
    [/\bthe vault\b/gi, "your clinic records"],
    [/\bvault\b/gi, "your clinic records"],
    [/\bregistries\b/gi, "catalogs"],
    [/\bregistry\b/gi, "catalog"],
    [/\bmanifests\b/gi, "definition files"],
    [/\bmanifest\b/gi, "definition file"],
    [/\bfences\b/gi, "blocks"],
    [/\bfence\b/gi, "block"],
    [/\bpayloads\b/gi, "data"],
    [/\bpayload\b/gi, "data"],
    [/\bdeltas\b/gi, "change markers"],
    [/\bdelta\b/gi, "change marker"],
    [/\bplugins\b/gi, "extensions"],
    [/\bplugin\b/gi, "extension"],
  ];
  function cleanCopy(text) {
    let t = String(text == null ? "" : text);
    CLEAN.forEach((pair) => { t = t.replace(pair[0], pair[1]); });
    // fix the article after "plugin" → "extension": "A extension" → "An extension"
    t = t.replace(/\b(a)\s+(extension)\b/gi, (_m, art) => (art[0] === "A" ? "An " : "an ") + "extension");
    return t;
  }

  /* ------------------------------ kind meta ------------------------------ */

  const KINDS = {
    plugin: {
      id: "plugin", label: "Extensions", one: "Small tools that add features",
      page: "extensions.html", icon: "Puzzle",
      c: "var(--k-extension)", soft: "var(--k-extension-soft)",
    },
    capsule: {
      id: "capsule", label: "Capsules", one: "Ready-made sections for your pages",
      page: "capsules.html", icon: "Braces",
      c: "var(--k-capsule)", soft: "var(--k-capsule-soft)",
    },
    theme: {
      id: "theme", label: "Themes", one: "A new look for the whole workspace",
      page: "themes.html", icon: "Palette",
      c: "var(--k-theme)", soft: "var(--k-theme-soft)",
    },
    template: {
      id: "template", label: "Templates", one: "Pre-written clinical notes and forms",
      page: "templates.html", icon: "FileText",
      c: "var(--k-template)", soft: "var(--k-template-soft)",
    },
  };
  const KIND_ORDER = ["plugin", "capsule", "theme", "template"];

  /* ------------------------------ catalog -------------------------------- */

  let ITEMS = [];
  let BY_ID = {};
  let GENERATED_AT = "";

  function normalize(raw) {
    const kind = raw.kind === "plugin" ? "plugin" : raw.kind;
    return {
      id: raw.id,
      kind,
      name: raw.name || raw.id,
      tagline: (raw.tagline || "").replace(/\s+/g, " ").trim(),
      description: (raw.description || "").trim(),
      author: raw.author || "CaseX Labs",
      version: raw.version || "",
      category: raw.category || "",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      icon: raw.icon || (KINDS[kind] ? KINDS[kind].icon : "Package"),
      featured: raw.featured === true,
      verified: raw.verified !== false,
      released: raw.released || "",
      downloads: typeof raw.downloads === "number" ? raw.downloads : 0,
      files: raw.files && typeof raw.files === "object" ? raw.files : {},
      meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
    };
  }

  async function loadCatalog() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const d = JSON.parse(cached);
        ITEMS = d.items; GENERATED_AT = d.generatedAt || "";
        BY_ID = {}; ITEMS.forEach((it) => (BY_ID[it.id] = it));
        return;
      }
    } catch (e) { /* cache unusable */ }
    const res = await fetch(CATALOG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("catalog.json " + res.status);
    const data = await res.json();
    const rawItems = Array.isArray(data.items) ? data.items : [];
    ITEMS = rawItems.map(normalize).filter((it) => KINDS[it.kind]);
    GENERATED_AT = (data.marketplace && data.marketplace.generatedAt) || data.generatedAt || "";
    BY_ID = {};
    ITEMS.forEach((it) => (BY_ID[it.id] = it));
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items: ITEMS, generatedAt: GENERATED_AT }));
    } catch (e) { /* quota — fine */ }
  }

  /** Order items the way we recommend: featured first, then known release
   * recency, then name. Displayed numbers: none. */
  function recommendOrder(items) {
    return items.slice().sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      const ra = a.released || "", rb = b.released || "";
      if (ra !== rb) return rb.localeCompare(ra);
      return a.name.localeCompare(b.name);
    });
  }
  function azOrder(items) {
    return items.slice().sort((a, b) => a.name.localeCompare(b.name));
  }
  function newestOrder(items) {
    return items.slice().sort((a, b) => (b.released || "").localeCompare(a.released || "") || a.name.localeCompare(b.name));
  }
  const SORTS = { recommended: recommendOrder, az: azOrder, newest: newestOrder };

  function related(item, n) {
    const pool = ITEMS.filter((it) => it.id !== item.id && it.kind === item.kind);
    const sameCat = pool.filter((it) => it.category === item.category);
    const rest = pool.filter((it) => it.category !== item.category);
    return recommendOrder(sameCat).concat(recommendOrder(rest)).slice(0, n || 3);
  }

  /* --------------------------- shared renderers --------------------------- */

  function tileStyle(kind) {
    const k = KINDS[kind] || {};
    return `--card-c:${k.c || "var(--ink)"};--card-soft:${k.soft || "var(--border)"};`;
  }

  function shield() {
    return `<span class="vshield" title="Reviewed and published by CaseX Labs">${icon("ShieldCheck", 13)}</span>`;
  }

  function metaRow(it) {
    const parts = [esc(it.author)];
    const upd = fmtDate(it.released);
    if (upd) parts.push(`Updated ${upd}`);
    return parts.join('<span class="dot"></span>');
  }

  function cardHtml(it, opts) {
    opts = opts || {};
    const k = KINDS[it.kind];
    const copyBtn = opts.copyEmbed && it.kind === "capsule"
      ? `<button class="card-copy" data-copy-embed="${esc(it.meta.capsuleId || it.id)}" title="Copy embed block" aria-label="Copy embed block">${icon("Copy", 14)}</button>`
      : "";
    return `
<a class="card" style="${tileStyle(it.kind)}" href="${itemUrl(it.id)}">
  ${copyBtn}
  <span class="tile">${icon(it.icon, 17)}</span>
  <span class="card-name">${esc(it.name)}${it.verified ? shield() : ""}</span>
  <span class="card-desc">${esc(cleanCopy(it.tagline || it.description || ""))}</span>
  <span class="swatches hidden" data-swatches="${esc(it.id)}"></span>
  <span class="card-meta">${metaRow(it)}</span>
</a>`;
  }

  /** Render a grid with the 12-cap + "Show all N" expander.
   * Returns html; caller must then call FCX.wireGrid(container). */
  function renderGrid(items, opts) {
    opts = opts || {};
    const cap = opts.cap || 12;
    const shown = items.slice(0, cap);
    let html = `<div class="grid">`;
    html += shown.map((it) => cardHtml(it, opts)).join("");
    html += `</div>`;
    if (items.length > cap) {
      html += `<div class="grid-foot"><button class="show-all" data-show-all="1">Show all ${items.length}</button></div>`;
      html += `<div class="grid hidden" data-rest-grid>${items.slice(cap).map((it) => cardHtml(it, opts)).join("")}</div>`;
    }
    return html;
  }

  function wireGrid(root) {
    root.querySelectorAll("[data-show-all]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rest = root.querySelector("[data-rest-grid]");
        if (rest) rest.classList.remove("hidden");
        btn.parentElement.classList.add("hidden");
      });
    });
    wireCopyButtons(root);
    hydrateSwatches(root);
  }

  /** Wire every [data-copy] element: copies its data-copy value. */
  function wireCopyButtons(root) {
    root.querySelectorAll("[data-copy]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const text = el.getAttribute("data-copy") || "";
        copyText(text).then(() => {
          el.classList.add("done");
          const old = el.innerHTML;
          el.innerHTML = `${icon("Check", 13)} Copied`;
          setTimeout(() => { el.innerHTML = old; el.classList.remove("done"); }, 1400);
        });
      });
    });
    root.querySelectorAll("[data-copy-embed]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = el.getAttribute("data-copy-embed");
        copyText(embedFence(id)).then(() => {
          const old = el.innerHTML;
          el.innerHTML = icon("Check", 14);
          setTimeout(() => (el.innerHTML = old), 1400);
        });
      });
    });
  }

  /* ------------------------- theme swatch helpers ------------------------- */

  const DEFAULT_DARK_VARS = {
    bg: "#14181C", bgPanel: "#1B2126", text: "#E9E6E0",
    accent: "#3FA796", border: "#2A3138", muted: "#8B95A0",
  };
  const varsCache = {};

  async function fetchThemeVars(themeItem) {
    const id = themeItem.meta.themeId || themeItem.id.replace("theme:", "");
    if (varsCache[id]) return varsCache[id];
    let vars = null;
    try {
      const res = await fetch(`themes/${id}.json`, { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.vars && Object.keys(data.vars).length) vars = data.vars;
      }
    } catch (e) { /* offline file — fall through */ }
    if (!vars) vars = Object.assign({}, DEFAULT_DARK_VARS);
    varsCache[id] = vars;
    return vars;
  }

  function swatchKeys(vars) {
    const keys = ["bg", "bgPanel", "text", "accent", "border"];
    return keys.filter((k) => vars[k]);
  }

  function swatchesHtml(vars) {
    const keys = swatchKeys(vars);
    return `<span class="swatches">${keys
      .map((k, i) => `<span class="sw${i === 0 ? " ring" : ""}" style="background:${esc(vars[k])}" title="${k}"></span>`)
      .join("")}</span>`;
  }

  /** Attach swatch strips to placeholder spans ([data-swatches="theme:id"]). */
  async function hydrateSwatches(root) {
    const spots = root.querySelectorAll("[data-swatches]");
    if (!spots.length) return;
    for (const spot of spots) {
      const ref = spot.getAttribute("data-swatches") || "";
      if (!ref.startsWith("theme:")) continue;
      const id = ref.slice(6);
      const it = BY_ID["theme:" + id];
      if (!it) continue;
      const vars = await fetchThemeVars(it);
      spot.outerHTML = swatchesHtml(vars);
    }
  }

  /** The big theme preview: a mini workspace chrome painted with the
   * theme's real variables. */
  function themePreviewHtml(vars) {
    const v = vars;
    const ink = v.text || "#111";
    const soft = (c, a) => c + Math.round(a * 255).toString(16).padStart(2, "0");
    return `
<div class="theme-preview" style="background:${esc(v.bg || "#fff")};">
  <div class="tp-bar" style="border-bottom:1px solid ${esc(v.border || "#ddd")};">
    <span class="tp-dotrow">
      <span style="background:${soft(ink, .28)}"></span>
      <span style="background:${soft(ink, .18)}"></span>
      <span style="background:${soft(ink, .10)}"></span>
    </span>
    <span style="flex:1"></span>
    <span style="width:84px;height:9px;border-radius:5px;background:${soft(ink, .10)}"></span>
  </div>
  <div class="tp-body">
    <div class="tp-side" style="background:${esc(v.bgPanel || v.bg || "#eee")};border-right:1px solid ${esc(v.border || "#ddd")};">
      <i style="background:${esc(v.accent || "#888")};opacity:.9;"></i>
      <i style="background:${soft(ink, .16)};width:85%"></i>
      <i style="background:${soft(ink, .12)};width:70%"></i>
      <i style="background:${soft(ink, .12)};width:78%"></i>
      <i style="background:${soft(ink, .08)};width:55%"></i>
    </div>
    <div class="tp-page">
      <h4 style="color:${esc(ink)};">Refraction note</h4>
      <i style="background:${soft(ink, .14)};width:82%"></i>
      <i style="background:${soft(ink, .10)};width:64%"></i>
      <i style="background:${soft(ink, .10)};width:74%"></i>
      <div class="tp-chiprow">
        <span style="background:${esc(v.accent || "#888")};color:${esc(v.bg || "#fff")};">6/6</span>
        <span style="background:${soft(ink, .10)};color:${esc(ink)};">IOP 16</span>
        <span style="background:${soft(ink, .08)};color:${esc(ink)};">Δ notes</span>
      </div>
    </div>
  </div>
</div>`;
  }

  /* -------------------------- capsule demo board -------------------------- */

  function demoBoardHtml(caption) {
    const tag = (bg, fg, t) => `<span class="db-tag" style="background:${bg};color:${fg};">${t}</span>`;
    return `
<div class="demo-board">
  <div class="db-stats">
    <span class="db-stat"><b>32</b><span>Today</span></span>
    <span class="db-stat"><b>21</b><span>Done</span></span>
    <span class="db-stat"><b>₹18,400</b><span>Collected</span></span>
    <span class="db-stat"><b>3</b><span>Unpaid</span></span>
  </div>
  <div class="db-row"><span class="db-time">9:00</span><span class="db-name">Arun Kumar</span>${tag("var(--k-capsule-soft)", "var(--k-capsule)", "Done")}</div>
  <div class="db-row"><span class="db-time">9:30</span><span class="db-name">Meera Joseph</span>${tag("var(--accent-soft)", "var(--accent)", "In exam")}</div>
  <div class="db-row"><span class="db-time">10:00</span><span class="db-name">Rahim Shaikh</span>${tag("var(--k-extension-soft)", "var(--k-extension)", "Optics")}</div>
  <div class="db-row"><span class="db-time">10:30</span><span class="db-name">Divya Nair</span>${tag("var(--k-theme-soft)", "var(--k-theme)", "Billing")}</div>
  <div class="db-caption">${esc(caption || "Sample data — the real board reads your own appointments.")}</div>
</div>`;
  }

  /* --------------------------- markdown mini renderer --------------------- */

  function renderMd(src) {
    const lines = String(src || "").replace(/\r/g, "").split("\n");
    let out = "", para = [], list = null;
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[\[([^\]|]+)\]\]/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
    const flushP = () => { if (para.length) { out += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
    const flushL = () => { if (list) { out += `<${list}>${listBuf.join("")}</${list}>`; list = null; listBuf = []; } };
    let listBuf = [];
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const t = line.trim();
      if (/^```/.test(t)) { flushP(); flushL(); continue; }
      if (!t) { flushP(); flushL(); continue; }
      let m;
      if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { flushP(); flushL(); out += "<hr>"; continue; }
      if ((m = t.match(/^>\s?(.*)$/))) { flushP(); flushL(); out += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
      if ((m = t.match(/^[-*]\s+(.*)$/))) { flushP(); if (list !== "ul") { flushL(); list = "ul"; } listBuf.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushP(); if (list !== "ol") { flushL(); list = "ol"; } listBuf.push(`<li>${inline(m[1])}</li>`); continue; }
      if (t.startsWith("|") && t.endsWith("|")) {
        flushP(); flushL();
        const cells = t.slice(1, -1).split("|").map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        out += `<table><tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr></table>`;
        continue;
      }
      flushL();
      para.push(t);
    }
    flushP(); flushL();
    return out;
  }

  async function fetchTemplateBody(templateItem) {
    const path = templateItem.files && templateItem.files.body;
    if (!path) return "";
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return "";
      return await res.text();
    } catch (e) { return ""; }
  }

  /* ------------------------------ install copy ---------------------------- */

  function installSteps(it) {
    const k = KINDS[it.kind];
    const steps = [
      `Open <strong>FocusCaseX</strong> → <strong>Settings</strong> → <strong>Marketplace</strong>.`,
      `Search for <strong>${esc(it.name)}</strong>${k ? ` under <strong>${esc(k.label)}</strong>` : ""}.`,
      `Tap <strong>Install</strong> — it appears in your workspace right away.`,
    ];
    return `<div class="install">
  <h3>${icon("Download", 16)} Install in FocusCaseX</h3>
  <ol class="steps">${steps.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>
  <div class="after">Free · works offline after install · remove any time under Settings.</div>
</div>`;
  }

  /* ------------------------------ URL helpers ----------------------------- */

  function itemUrl(id) {
    return `item.html?id=${encodeURIComponent(id)}`;
  }
  function embedFence(capsuleId) {
    const id = String(capsuleId || "").replace(/^capsule:/, "");
    return `\`\`\`mdui\ncapsule: ${id}\n\`\`\``;
  }

  /* ------------------------------ chrome ---------------------------------- */

  function injectChrome(activeKind) {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    const brand = `<a class="brand" href="index.html">${icon("Stethoscope", 20)}<span>FocusCaseX <span class="brand-market">Marketplace</span></span></a>`;
    if (header) {
      const nav = KIND_ORDER.map((k) => {
        const kk = KINDS[k];
        return `<a href="${kk.page}" class="${activeKind === k ? "on" : ""}">${esc(kk.label)}</a>`;
      }).join("");
      header.innerHTML = `
<div class="top"><div class="top-inner">
  ${brand}
  <nav class="nav">${nav}</nav>
  <div class="top-actions">
    <button class="search-btn" id="topbar-search" type="button" aria-label="Search the catalog">${icon("Search", 14)}<span>Search</span><kbd>/</kbd></button>
    <a class="btn small primary" href="install.html" style="display:none" id="topbar-install">Install guide</a>
  </div>
</div></div>`;
      header.querySelector("#topbar-search").addEventListener("click", openSearch);
      header.querySelector("#topbar-install").style.display = "";
    }
    if (footer) {
      const count = ITEMS.length;
      const when = fmtDate(GENERATED_AT) || "recently";
      footer.innerHTML = `
<div class="foot"><div class="wrap foot-inner">
  <div>
    <div class="foot-brand">${icon("Stethoscope", 17)} FocusCaseX Marketplace</div>
    <div class="foot-status">Catalog updated ${esc(when)} · ${count} add-ons · maintained by CaseX Labs</div>
  </div>
  <div class="foot-links">
    <a href="install.html">Install guide</a>
    <a href="api.html">For developers</a>
    <a href="https://github.com/stromplayz/FocusCaseX-Marketplace" target="_blank" rel="noopener">GitHub</a>
    <a href="https://focuscasex.vercel.app" target="_blank" rel="noopener">FocusCaseX app</a>
  </div>
</div></div>`;
    }
  }

  /* ------------------------------ search overlay -------------------------- */

  let ovEl = null, searchSel = 0, searchResults = [];

  function scoreItem(it, q) {
    const name = it.name.toLowerCase();
    const n = name.indexOf(q);
    if (n === 0) return 100;
    if (n > 0) return 70;
    if (it.tags.some((t) => t.toLowerCase().startsWith(q))) return 55;
    if ((it.category || "").toLowerCase().startsWith(q)) return 50;
    if (it.tagline.toLowerCase().includes(q)) return 30;
    if (it.description.toLowerCase().includes(q)) return 20;
    if (it.tags.some((t) => t.toLowerCase().includes(q))) return 15;
    return -1;
  }

  function searchItems(q) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const scored = ITEMS.map((it) => ({ it, s: scoreItem(it, query) })).filter((r) => r.s >= 0);
    scored.sort((a, b) => b.s - a.s || a.it.name.localeCompare(b.it.name));
    return scored.map((r) => r.it);
  }

  function resultHtml(it) {
    const k = KINDS[it.kind];
    return `
<button class="result" data-id="${esc(it.id)}" type="button">
  <span class="tile" style="${tileStyle(it.kind)}">${icon(it.icon, 14)}</span>
  <span style="min-width:0">
    <span class="r-name" style="display:block">${esc(it.name)}</span>
    <span class="r-tag" style="display:block">${esc(cleanCopy(it.tagline) || k.one)}</span>
  </span>
</button>`;
  }

  function renderSearchList(q) {
    const listEl = ovEl.querySelector(".search-results");
    const query = q.trim().toLowerCase();
    if (!query) {
      listEl.innerHTML = `<div class="search-empty">Start typing to search ${ITEMS.length} add-ons — or jump straight in:
        <div class="tasks">
          <a class="task" href="capsules.html">Track my appointments ${icon("ArrowRight", 14)}</a>
          <a class="task" href="templates.html">Write notes faster ${icon("ArrowRight", 14)}</a>
          <a class="task" href="themes.html">Change the look ${icon("ArrowRight", 14)}</a>
        </div></div>`;
      searchResults = [];
      return;
    }
    const hits = searchItems(query);
    searchResults = hits;
    searchSel = 0;
    if (!hits.length) {
      listEl.innerHTML = `<div class="search-empty">No add-on matches that. Try a shorter word — or browse a category below.
        <div class="tasks">
          <a class="task" href="extensions.html">Extensions ${icon("ArrowRight", 14)}</a>
          <a class="task" href="capsules.html">Capsules ${icon("ArrowRight", 14)}</a>
          <a class="task" href="themes.html">Themes ${icon("ArrowRight", 14)}</a>
          <a class="task" href="templates.html">Templates ${icon("ArrowRight", 14)}</a>
        </div></div>`;
      return;
    }
    const byKind = {};
    hits.forEach((h) => { (byKind[h.kind] = byKind[h.kind] || []).push(h); });
    let html = "", flat = [];
    for (const k of KIND_ORDER) {
      const group = byKind[k];
      if (!group) continue;
      html += `<div class="group-label">${esc(KINDS[k].label)} · ${group.length}</div>`;
      html += group.slice(0, 4).map((it) => resultHtml(it)).join("");
      group.slice(0, 4).forEach((it) => flat.push(it));
    }
    listEl.innerHTML = html;
    highlightSel();
  }

  function highlightSel() {
    if (!ovEl) return;
    const results = ovEl.querySelectorAll(".result");
    results.forEach((el, i) => el.classList.toggle("sel", i === searchSel));
    const sel = results[searchSel];
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function openSearch() {
    if (!ovEl) buildOverlay();
    ovEl.classList.add("open");
    const input = ovEl.querySelector("input");
    input.value = "";
    renderSearchList("");
    setTimeout(() => input.focus(), 30);
  }
  function closeSearch() {
    if (ovEl) ovEl.classList.remove("open");
  }

  function buildOverlay() {
    ovEl = document.createElement("div");
    ovEl.className = "ov";
    ovEl.innerHTML = `
<div class="ov-backdrop"></div>
<div class="ov-panel" role="dialog" aria-label="Search the marketplace">
  <div class="search-input">${icon("Search", 17)}<input type="text" placeholder='Search — try "refraction" or "appointments"' aria-label="Search the marketplace"><span class="esc">esc</span></div>
  <div class="search-results"></div>
</div>`;
    document.body.appendChild(ovEl);
    ovEl.querySelector(".ov-backdrop").addEventListener("click", closeSearch);
    const input = ovEl.querySelector("input");
    input.addEventListener("input", () => renderSearchList(input.value));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowDown") { ev.preventDefault(); searchSel = Math.min(searchSel + 1, Math.max(0, searchResults.length - 1)); highlightSel(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); searchSel = Math.max(0, searchSel - 1); highlightSel(); }
      else if (ev.key === "Enter") {
        ev.preventDefault();
        const sel = ovEl.querySelectorAll(".result")[searchSel];
        const id = sel ? sel.getAttribute("data-id") : (searchResults[0] && searchResults[0].id);
        if (id) location.href = itemUrl(id);
      }
    });
    ovEl.querySelector(".search-results").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".result");
      if (btn) location.href = itemUrl(btn.getAttribute("data-id"));
    });
    document.addEventListener("keydown", (ev) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable);
      if ((ev.key === "/" && !typing) || ((ev.key === "k" || ev.key === "K") && (ev.metaKey || ev.ctrlKey))) {
        ev.preventDefault(); openSearch();
      } else if (ev.key === "Escape") closeSearch();
    });
  }

  /* -------------------------------- tabs ---------------------------------- */

  /** tabs: [{id,label,count}], active: id; onChange(id). Renders into el. */
  function renderTabs(el, tabs, active, onChange) {
    el.innerHTML = tabs
      .map((t) => `<button class="tab ${t.id === active ? "on" : ""}" data-tab="${esc(t.id)}" type="button">${esc(t.label)}${typeof t.count === "number" ? `<span class="count">${t.count}</span>` : ""}</button>`)
      .join("");
    el.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-tab");
        el.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b === btn));
        onChange(id);
      });
    });
  }

  /* ------------------------------- boot ----------------------------------- */

  async function ready(opts) {
    opts = opts || {};
    await loadCatalog();
    injectChrome(opts.active || null);
    if (opts.search !== false) buildOverlay();
    wireCopyButtons(document);
    return FCX;
  }

  const FCX = {
    ready, icon, esc, fmtDate, copyText, cleanCopy,
    get items() { return ITEMS; },
    byId: (id) => BY_ID[id] || null,
    KINDS, KIND_ORDER,
    recommendOrder, azOrder, newestOrder, SORTS,
    related, itemUrl, embedFence,
    cardHtml, renderGrid, wireGrid, wireCopyButtons, hydrateSwatches, metaRow, tileStyle,
    renderTabs, getParam, setParam,
    fetchThemeVars, swatchesHtml, themePreviewHtml,
    demoBoardHtml, renderMd, fetchTemplateBody, installSteps,
    openSearch, closeSearch,
    version: 3,
  };
  window.FCX = FCX;
})();
