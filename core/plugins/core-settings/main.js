/**
 * FocusCaseX — Core Settings (core plugin, marketplace payload v2.2.1).
 *
 * The settings surface becomes a core-owned layer, riding the exact
 * plugin + CSS system every other extension uses:
 *
 *   • polish  — accent seams on section heads, sticky navigation, focus
 *     rings that follow the live accent.
 *   • compact — tighter settings rows for small screens / fast hands.
 *   • pixel   — the pixel-art motion graphics layer, now APP-WIDE:
 *     steps() entrance animations, a pixel caret, a quantized canvas
 *     snowfall across the whole workspace and a festive string-light
 *     strip on the top chrome. Auto-pairs with the Christmas theme
 *     (html[data-fcx-theme-id="christmas"]) but can be forced on for any
 *     theme. Fully responsive — flake count and light size scale down on
 *     small screens, and prefers-reduced-motion freezes everything.
 *
 * Settings write through ctx.settings (the same deep-merge the Settings
 * modal uses), so nothing here is a second source of truth.
 *
 * Surfaces: CSS · Settings pane · Snowfall canvas · Storage.
 */
(function (ctx) {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* option state                                                      */

  var OPTIONS = [
    { key: "polish", label: "Settings polish (accent seams + sticky nav)", def: true },
    { key: "compact", label: "Compact rows (tighter settings density)", def: false },
    { key: "pixel", label: "Pixel motion graphics (snowfall, lights, steps animations)", def: true },
  ];

  var data = { autoPairChristmas: true, snow: "medium" };
  for (var i = 0; i < OPTIONS.length; i++) data[OPTIONS[i].key] = OPTIONS[i].def;

  var ROOT_CLASS = "fcx-core-settings-on";
  var SNOW_ID = "fcx-pixel-snow";
  var snowCanvas = null;
  var snowTimer = null;
  var flakes = [];

  function isChristmas() {
    return document.documentElement.getAttribute("data-fcx-theme-id") === "christmas";
  }

  function pixelWanted() {
    var on = data.pixel;
    if (data.autoPairChristmas !== false && isChristmas()) on = true;
    return on === true;
  }

  /* ---------------------------------------------------------------- */
  /* pixel snowfall canvas — quantized steps() drift, token colors      */

  function flakeCount() {
    var size = Math.min(window.innerWidth, window.innerHeight);
    if (size < 480) return 26;
    if (size < 900) return 44;
    return data.snow === "light" ? 34 : data.snow === "heavy" ? 90 : 60;
  }

  function flakeSize() {
    return window.innerWidth < 480 ? 2 : 3;
  }

  function buildFlakes() {
    flakes = [];
    var n = flakeCount();
    for (var i = 0; i < n; i++) {
      flakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: 0.6 + Math.random() * 1.4,
        vx: Math.random() < 0.5 ? -1 : 1,
        drift: 1 + Math.random() * 2,
        tick: Math.floor(Math.random() * 4),
      });
    }
  }

  function drawFlakes() {
    if (!snowCanvas) return;
    var c = snowCanvas.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
    var styles = getComputedStyle(document.documentElement);
    var ink = (styles.getPropertyValue("--foreground") || "#fff").trim() || "#fff";
    var accent = (styles.getPropertyValue("--accent-live") || styles.getPropertyValue("--accent") || ink).trim();
    var s = flakeSize();
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      c.fillStyle = f.tick % 7 === 0 ? accent : ink;
      c.globalAlpha = 0.5 + (f.tick % 3) * 0.16;
      c.fillRect(Math.round(f.x), Math.round(f.y), s, s);
    }
    c.globalAlpha = 1;
  }

  function stepFlakes() {
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.tick += 1;
      f.y += f.vy;
      if (f.tick % 12 === 0) {
        f.x += f.drift * (Math.random() < 0.5 ? -1 : 1);
      }
      if (f.y > window.innerHeight + 4) {
        f.y = -4;
        f.x = Math.random() * window.innerWidth;
      }
      if (f.x > window.innerWidth + 4) f.x = -4;
      if (f.x < -4) f.x = window.innerWidth + 4;
    }
    drawFlakes();
  }

  function startSnow() {
    stopSnow();
    if (typeof window === "undefined") return;
    /* guard against a re-run without unload: stop any snow instance this
       plugin started before (double canvases were stacking flakes) */
    try {
      var stale = document.getElementById(SNOW_ID);
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      if (typeof window.__fcxSnowStop === "function") window.__fcxSnowStop();
    } catch (ignored) { }
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* the canvas exists in BOTH branches — the reduced-motion "one static
       frame" used to draw before the canvas existed (nothing painted) */
    snowCanvas = document.createElement("canvas");
    snowCanvas.id = SNOW_ID;
    snowCanvas.setAttribute("aria-hidden", "true");
    /* background layer: BELOW every panel/banner/chrome (the flakes fell
       ON TOP of the workspace chrome at the old z-index) but above the
       app background, so snow shows wherever the UI is transparent */
    snowCanvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;image-rendering:pixelated;";
    document.body.appendChild(snowCanvas);
    resizeSnow();
    buildFlakes();
    drawFlakes();
    if (reduced) {
      /* motion freezes, the look stays — one static frame */
      window.__fcxSnowStop = stopSnow;
      return;
    }
    /* quantized steps: ~11 fps — pixel motion, near-zero CPU */
    snowTimer = setInterval(stepFlakes, 90);
    window.__fcxSnowStop = stopSnow;
  }

  function resizeSnow() {
    if (!snowCanvas) return;
    /* device-pixel aware: crisp square flakes on HiDPI phone screens */
    var dpr = window.devicePixelRatio || 1;
    snowCanvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    snowCanvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    var c = snowCanvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function stopSnow() {
    if (snowTimer) clearInterval(snowTimer);
    snowTimer = null;
    if (snowCanvas && snowCanvas.parentNode) snowCanvas.parentNode.removeChild(snowCanvas);
    snowCanvas = null;
    flakes = [];
    try {
      if (typeof window !== "undefined" && window.__fcxSnowStop === stopSnow) {
        delete window.__fcxSnowStop;
      }
    } catch (ignored) { }
  }

  function onResize() {
    if (!snowCanvas) return;
    resizeSnow();
    buildFlakes();
    drawFlakes();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("resize", onResize);
  }

  /* ---------------------------------------------------------------- */
  /* class application                                                  */

  function apply() {
    var html = document.documentElement;
    html.classList.add(ROOT_CLASS);
    for (var i = 0; i < OPTIONS.length; i++) {
      var opt = OPTIONS[i];
      var on = data[opt.key];
      if (opt.key === "pixel" && data.autoPairChristmas !== false && isChristmas()) on = true;
      html.classList.toggle("fcx-core-settings-" + opt.key, on === true);
    }
    if (pixelWanted()) startSnow();
    else stopSnow();
  }

  function clear() {
    var html = document.documentElement;
    html.classList.remove(ROOT_CLASS);
    for (var i = 0; i < OPTIONS.length; i++) html.classList.remove("fcx-core-settings-" + OPTIONS[i].key);
    stopSnow();
  }

  /* ---------------------------------------------------------------- */
  /* stylesheet — token-driven, zero raw colors, steps() only          */

  var CSS = [
    "/* ---- Core Settings: pane ---- */",
    ".fcx-cs-head{margin:0 0 .25rem;font-weight:700;font-size:.875rem;}",
    ".fcx-cs-hint{margin:0 0 .75rem;font-size:.75rem;color:var(--muted-foreground);}",
    ".fcx-cs-row{display:flex;align-items:center;gap:.5rem;margin:0 0 .5rem;font-size:.8125rem;}",
    ".fcx-cs-row input[type=checkbox]{width:1rem;height:1rem;accent-color:var(--accent-live,var(--accent));}",
    ".fcx-cs-perm-row{display:flex;align-items:center;gap:.5rem;margin:0 0 .4rem;font-size:.75rem;}",
    ".fcx-cs-perm-name{font-family:var(--font-mono);font-weight:700;}",
    ".fcx-cs-perm-detail{color:var(--muted-foreground);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".fcx-cs-perm-revoke{border:1px solid var(--border);background:transparent;color:var(--foreground);font-family:var(--font-mono);font-size:.625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.25rem .5rem;cursor:pointer;}",
    ".fcx-cs-perm-revoke:hover{background:color-mix(in srgb,var(--accent-live,var(--accent)) 14%,transparent);}",

    "/* ---- Core Settings: polish ---- */",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] h3{letter-spacing:.02em;}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] h3::before{content:\"\";display:inline-block;width:6px;height:6px;margin-right:.5rem;background:var(--accent-live,var(--accent));vertical-align:middle;}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] nav button{transition:none;}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] nav button[aria-current=\"page\"]{box-shadow:2px 2px 0 0 color-mix(in srgb,var(--foreground) 22%,transparent);}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] section{scroll-margin-top:1rem;}",

    "/* ---- Core Settings: compact ---- */",
    "html.fcx-core-settings-on.fcx-core-settings-compact [role=\"dialog\"] section{margin-bottom:1.1rem;}",
    "html.fcx-core-settings-on.fcx-core-settings-compact [role=\"dialog\"] .rounded-xl{padding-block:.55rem;}",

    "/* ---- Core Settings: pixel motion (steps() everywhere) ---- */",
    "@keyframes fcx-cs-pop{0%{transform:translateY(6px);opacity:0;}100%{transform:translateY(0);opacity:1;}}",
    "@keyframes fcx-cs-caret{0%,49%{opacity:1;}50%,100%{opacity:0;}}",
    "@keyframes fcx-cs-snowbg{0%{background-position:0 0,0 0;}100%{background-position:0 96px,0 64px;}}",
    "@keyframes fcx-cs-lights{0%,100%{opacity:1;}50%{opacity:.25;}}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"] section{animation:fcx-cs-pop .22s steps(3) both;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"] h3::after{content:\"\";display:inline-block;width:.45rem;height:.9rem;margin-left:.4rem;background:var(--accent-live,var(--accent));vertical-align:middle;animation:fcx-cs-caret .9s steps(1) infinite;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel aside{position:relative;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel aside::before{content:\"\";position:absolute;inset:0 0 auto 0;height:88px;pointer-events:none;z-index:0;opacity:.5;background-image:repeating-linear-gradient(to right,color-mix(in srgb,var(--foreground) 26%,transparent) 0 2px,transparent 2px 22px),repeating-linear-gradient(to bottom,color-mix(in srgb,var(--foreground) 18%,transparent) 0 2px,transparent 2px 32px);animation:fcx-cs-snowbg 4s steps(8) infinite;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel aside > *{position:relative;z-index:1;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"]{animation:fcx-cs-pop .18s steps(2) both;}",

    "/* string lights on the top chrome — pixel bulbs on a token-colored wire */",
    "html.fcx-core-settings-on.fcx-core-settings-pixel .fcx-chrome{position:relative;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel .fcx-chrome::before{content:\"\";position:absolute;inset:0 0 auto 0;height:3px;pointer-events:none;z-index:5;background-image:repeating-linear-gradient(to right,color-mix(in srgb,var(--accent-live,var(--accent)) 85%,transparent) 0 4px,transparent 4px 14px),repeating-linear-gradient(to right,color-mix(in srgb,var(--foreground) 40%,transparent) 0 1px,transparent 1px 14px);animation:fcx-cs-lights 1.6s steps(2) infinite;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel .fcx-chrome::after{content:\"\";position:absolute;inset:3px 0 auto 0;height:1px;pointer-events:none;z-index:5;background:color-mix(in srgb,var(--foreground) 25%,transparent);}",

    "/* responsive: smaller fixtures, tighter motion on small screens */",
    "@media (max-width:480px){html.fcx-core-settings-on.fcx-core-settings-pixel .fcx-chrome::before{height:2px;background-image:repeating-linear-gradient(to right,color-mix(in srgb,var(--accent-live,var(--accent)) 85%,transparent) 0 3px,transparent 3px 10px),repeating-linear-gradient(to right,color-mix(in srgb,var(--foreground) 40%,transparent) 0 1px,transparent 1px 10px);}}",
    "@media (min-width:1200px){html.fcx-core-settings-on.fcx-core-settings-pixel .fcx-chrome::before{background-image:repeating-linear-gradient(to right,color-mix(in srgb,var(--accent-live,var(--accent)) 85%,transparent) 0 5px,transparent 5px 18px),repeating-linear-gradient(to right,color-mix(in srgb,var(--foreground) 40%,transparent) 0 1px,transparent 1px 18px);}}",

    "@media (prefers-reduced-motion:reduce){html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"] section,html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"]{animation:none;}html.fcx-core-settings-on.fcx-core-settings-pixel aside::before{animation:none;}html.fcx-core-settings-on.fcx-core-settings-pixel .fcx-chrome::before{animation:none;}}",
  ].join("\n");
  if (typeof ctx.registerCss === "function") ctx.registerCss(CSS);

  /* ---------------------------------------------------------------- */
  /* settings pane                                                     */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function save() {
    void ctx.saveData(data);
  }

  ctx.addSettingsPane(function (container) {
    container.replaceChildren();

    container.appendChild(el("p", "fcx-cs-head", "Core Settings"));
    container.appendChild(
      el(
        "p",
        "fcx-cs-hint",
        "The settings surface as a core extension — polish, density and the pixel-motion graphics layer (now app-wide: snowfall canvas + string lights). Toggles apply instantly.",
      ),
    );

    var _loop = function (i) {
      var opt = OPTIONS[i];
      var row = el("label", "fcx-cs-row");
      var check = document.createElement("input");
      check.type = "checkbox";
      check.checked = data[opt.key] === true;
      check.addEventListener("change", function () {
        data[opt.key] = check.checked;
        save();
        apply();
      });
      row.appendChild(check);
      row.appendChild(el("span", null, " " + opt.label));
      container.appendChild(row);
    };
    for (var i = 0; i < OPTIONS.length; i++) _loop(i);

    var snowRow = el("label", "fcx-cs-row");
    snowRow.appendChild(el("span", null, " Snowfall "));
    var select = document.createElement("select");
    var optLight = el("option", null, "Light");
    optLight.value = "light";
    var optMedium = el("option", null, "Medium");
    optMedium.value = "medium";
    var optHeavy = el("option", null, "Heavy");
    optHeavy.value = "heavy";
    select.appendChild(optLight);
    select.appendChild(optMedium);
    select.appendChild(optHeavy);
    select.value = data.snow === "light" || data.snow === "heavy" ? data.snow : "medium";
    select.addEventListener("change", function () {
      data.snow = select.value;
      save();
      apply();
    });
    snowRow.appendChild(select);
    container.appendChild(snowRow);

    var pairRow = el("label", "fcx-cs-row");
    var pair = document.createElement("input");
    pair.type = "checkbox";
    pair.checked = data.autoPairChristmas !== false;
    pair.addEventListener("change", function () {
      data.autoPairChristmas = pair.checked;
      save();
      apply();
    });
    pairRow.appendChild(pair);
    pairRow.appendChild(el("span", null, " Always pair pixel motion with the Christmas theme"));
    container.appendChild(pairRow);

    /* ---- extension permissions — the clinic stays in control ---- */
    var permsHead = el("p", "fcx-cs-head", "Extension permissions");
    permsHead.style.marginTop = "1rem";
    container.appendChild(permsHead);
    var permsHint = el(
      "p",
      "fcx-cs-hint",
      "Folders and access each extension was granted. Revoking takes effect immediately — the extension will simply ask again the next time it needs access.",
    );
    container.appendChild(permsHint);

    var PERMS_KEY = "fcx.plugin-perms.v1";
    var renderPerms = function () {
      var listNode = el("div", "fcx-cs-perms");
      var grants = {};
      try {
        grants = JSON.parse(window.localStorage.getItem(PERMS_KEY) || "{}") || {};
      } catch (ignored) {
        grants = {};
      }
      var ids = Object.keys(grants);
      if (ids.length === 0) {
        listNode.appendChild(el("p", "fcx-cs-hint", "No extensions have been granted folder or network access yet."));
        container.appendChild(listNode);
        return;
      }
      for (var g = 0; g < ids.length; g++) {
        (function (id) {
          var grant = grants[id] || {};
          var rowNode = el("div", "fcx-cs-perm-row");
          var labelNode = el("span", "fcx-cs-perm-name", id);
          var folders = Array.isArray(grant.folders) ? grant.folders : [];
          var detail = folders.length > 0
            ? folders.map(function (f) { return f + "/"; }).join(", ")
            : "network only";
          if (grant.fetch === true && folders.length > 0) detail += " + network";
          var detailNode = el("span", "fcx-cs-perm-detail", detail);
          var revoke = el("button", "fcx-cs-perm-revoke", "Revoke");
          revoke.type = "button";
          revoke.addEventListener("click", function () {
            try {
              var next = JSON.parse(window.localStorage.getItem(PERMS_KEY) || "{}") || {};
              delete next[id];
              window.localStorage.setItem(PERMS_KEY, JSON.stringify(next));
              try {
                window.dispatchEvent(new CustomEvent("fcx:perm-changed", { detail: { pluginId: id } }));
              } catch (ignored) { }
              ctx.showToast("Access revoked for " + id);
              refreshPane();
            } catch (ignored) { }
          });
          rowNode.appendChild(labelNode);
          rowNode.appendChild(detailNode);
          rowNode.appendChild(revoke);
          listNode.appendChild(rowNode);
        })(ids[g]);
      }
      container.appendChild(listNode);
    };
    var refreshPane = function () {
      // repaint the permissions list in place after a revoke
      var existing = container.querySelector(".fcx-cs-perms");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      renderPerms();
    };
    renderPerms();
  });

  /* ---------------------------------------------------------------- */
  /* boot                                                              */

  void ctx.loadData().then(function (saved) {
    if (saved && typeof saved === "object") {
      for (var i = 0; i < OPTIONS.length; i++) {
        var key = OPTIONS[i].key;
        if (typeof saved[key] === "boolean") data[key] = saved[key];
      }
      if (typeof saved.autoPairChristmas === "boolean") data.autoPairChristmas = saved.autoPairChristmas;
      if (saved.snow === "light" || saved.snow === "medium" || saved.snow === "heavy") data.snow = saved.snow;
    }
    apply();
  });

  ctx.onunload = function () {
    clear();
    if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
  };
})(ctx);
