/**
 * FocusCaseX — Core Settings (core plugin, marketplace payload v2.2).
 *
 * The settings surface becomes a core-owned layer, riding the exact
 * plugin + CSS system every other extension uses:
 *
 *   • polish  — accent seams on section heads, sticky navigation, focus
 *     rings that follow the live accent.
 *   • compact — tighter settings rows for small screens / fast hands.
 *   • pixel   — the pixel-art motion graphics layer: steps() entrance
 *     animations, pixel caret and a snowfall drift on the app frame.
 *     Auto-pairs with the Christmas theme (html[data-fcx-theme-id=
 *     "christmas"]) but can be forced on for any theme.
 *
 * Settings write through ctx.settings (the same deep-merge the Settings
 * modal uses), so nothing here is a second source of truth.
 *
 * Surfaces: CSS · Settings pane · Commands · Storage.
 */
(function (ctx) {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* option state                                                      */

  var OPTIONS = [
    { key: "polish", label: "Settings polish (accent seams + sticky nav)", def: true },
    { key: "compact", label: "Compact rows (tighter settings density)", def: false },
    { key: "pixel", label: "Pixel motion graphics (steps animations + snowfall)", def: true },
  ];

  var data = { autoPairChristmas: true };
  for (var i = 0; i < OPTIONS.length; i++) data[OPTIONS[i].key] = OPTIONS[i].def;

  var ROOT_CLASS = "fcx-core-settings-on";

  function isChristmas() {
    return document.documentElement.getAttribute("data-fcx-theme-id") === "christmas";
  }

  function apply() {
    var html = document.documentElement;
    html.classList.add(ROOT_CLASS);
    for (var i = 0; i < OPTIONS.length; i++) {
      var opt = OPTIONS[i];
      /* the pixel layer always rides an active Christmas theme unless
         the pairing is disabled — then it obeys the raw toggle only */
      var on = data[opt.key];
      if (opt.key === "pixel" && data.autoPairChristmas !== false && isChristmas()) on = true;
      html.classList.toggle("fcx-core-settings-" + opt.key, on);
    }
  }

  function clear() {
    var html = document.documentElement;
    html.classList.remove(ROOT_CLASS);
    for (var i = 0; i < OPTIONS.length; i++) html.classList.remove("fcx-core-settings-" + OPTIONS[i].key);
  }

  /* ---------------------------------------------------------------- */
  /* stylesheet — token-driven, zero raw colors, steps() only          */

  var CSS = [
    "/* ---- Core Settings: pane ---- */",
    ".fcx-cs-head{margin:0 0 .25rem;font-weight:700;font-size:.875rem;}",
    ".fcx-cs-hint{margin:0 0 .75rem;font-size:.75rem;color:var(--muted-foreground);}",
    ".fcx-cs-row{display:flex;align-items:center;gap:.5rem;margin:0 0 .5rem;font-size:.8125rem;}",
    ".fcx-cs-row input[type=checkbox]{width:1rem;height:1rem;accent-color:var(--accent-live,var(--accent));}",

    "/* ---- Core Settings: polish ---- */",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] h3{letter-spacing:.02em;}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] h3::before{content:\"\";display:inline-block;width:6px;height:6px;margin-right:.5rem;background:var(--accent-live,var(--accent));vertical-align:middle;}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] nav button{transition:none;}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] nav button[aria-current=\"page\"]{box-shadow:2px 2px 0 0 color-mix(in srgb,var(--foreground) 22%,transparent);}",
    "html.fcx-core-settings-on.fcx-core-settings-polish [role=\"dialog\"] section{scroll-margin-top:1rem;}",

    "/* ---- Core Settings: compact ---- */",
    "html.fcx-core-settings-on.fcx-core-settings-compact [role=\"dialog\"] section{margin-bottom:1.1rem;}",
    "html.fcx-core-settings-on.fcx-core-settings-compact [role=\"dialog\"] .rounded-xl{padding-block:.55rem;}",

    "/* ---- Core Settings: pixel motion (steps() everywhere, reduced-motion respected) ---- */",
    "@keyframes fcx-cs-pop{0%{transform:translateY(6px);opacity:0;}100%{transform:translateY(0);opacity:1;}}",
    "@keyframes fcx-cs-caret{0%,49%{opacity:1;}50%,100%{opacity:0;}}",
    "@keyframes fcx-cs-snow{0%{background-position:0 0,0 0;}100%{background-position:0 96px,0 64px;}}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"] section{animation:fcx-cs-pop .22s steps(3) both;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"] h3::after{content:\"\";display:inline-block;width:.45rem;height:.9rem;margin-left:.4rem;background:var(--accent-live,var(--accent));vertical-align:middle;animation:fcx-cs-caret .9s steps(1) infinite;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel aside{position:relative;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel aside::before{content:\"\";position:absolute;inset:0 0 auto 0;height:88px;pointer-events:none;z-index:0;opacity:.5;background-image:repeating-linear-gradient(to right,color-mix(in srgb,var(--foreground) 26%,transparent) 0 2px,transparent 2px 22px),repeating-linear-gradient(to bottom,color-mix(in srgb,var(--foreground) 18%,transparent) 0 2px,transparent 2px 32px);animation:fcx-cs-snow 4s steps(8) infinite;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel aside > *{position:relative;z-index:1;}",
    "html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"]{animation:fcx-cs-pop .18s steps(2) both;}",
    "@media (prefers-reduced-motion:reduce){html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"] section,html.fcx-core-settings-on.fcx-core-settings-pixel [role=\"dialog\"]{animation:none;}html.fcx-core-settings-on.fcx-core-settings-pixel aside::before{animation:none;}}",
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
        "The settings surface as a core extension — polish, density and the pixel-motion graphics layer. Toggles apply instantly.",
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
    }
    apply();
  });

  ctx.onunload = function () {
    clear();
  };
})(ctx);
