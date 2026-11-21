/**
 * FocusCaseX sample plugin — Focus Mode.
 * Toggles body.fcx-focus-mode; the injected stylesheet hides both side
 * panels while the class is present. Cleaned up automatically on unload.
 */
(function (ctx) {
  "use strict";

  ctx.registerCss([
    "body.fcx-focus-mode aside[aria-label='Vault sidebar'],",
    "body.fcx-focus-mode aside[aria-label='Note metadata'] {",
    "  display: none !important;",
    "}",
    "body.fcx-focus-mode {",
    "  --fcx-zen: 1;",
    "}"
  ].join("\n"));

  function toggle() {
    var on = document.body.classList.toggle("fcx-focus-mode");
    ctx.showToast(on ? "Focus mode on — sidebars hidden." : "Focus mode off.");
  }

  ctx.registerCommand({
    id: "toggle-focus",
    title: "Toggle focus mode",
    icon: "Moon",
    run: toggle,
  });

  ctx.addRibbonIcon("Moon", "Toggle focus mode", toggle);

  ctx.onunload = function () {
    document.body.classList.remove("fcx-focus-mode");
  };
})(ctx);
