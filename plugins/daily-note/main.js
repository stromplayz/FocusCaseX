/**
 * FocusCaseX sample plugin — Daily Notes.
 * Ribbon calendar + "Open today's note" command. The target folder is
 * configurable through the plugin's settings pane and persisted via loadData.
 */
(function (ctx) {
  "use strict";

  var FOLDER_KEY_RE = /^[a-z0-9\-\/]{0,60}$/;
  var settings = { folder: "daily" };

  function todayKey() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function cleanFolder() {
    var f = String(settings.folder || "daily").toLowerCase().replace(/[^a-z0-9\-\/]+/g, "-");
    return FOLDER_KEY_RE.test(f) ? f.replace(/^\/+|\/+$/g, "") : "daily";
  }

  function openToday() {
    var path = cleanFolder() + "/" + todayKey();
    ctx.app
      .getNotes()
      .then(function (notes) {
        var exists = notes.some(function (n) {
          return n.path === path;
        });
        if (exists) return ctx.app.openNote(path);
        return ctx.app.createNote(path, { title: todayKey(), content: "# " + todayKey() + "\n\n" });
      })
      .catch(function () {
        ctx.showToast("Daily note could not be opened.");
      });
  }

  ctx.registerCommand({
    id: "open-today",
    title: "Open today's note",
    icon: "Calendar",
    run: openToday,
  });

  ctx.addRibbonIcon("Calendar", "Open today's daily note", openToday);

  ctx.addSettingsPane(function (el, container) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px;";

    var label = document.createElement("label");
    label.style.cssText = "font-size:12px;color:var(--muted-foreground);";
    label.textContent = "Daily notes folder";

    var input = document.createElement("input");
    input.value = settings.folder;
    input.spellcheck = false;
    input.style.cssText =
      "height:36px;border-radius:8px;border:1px solid var(--border);background:var(--background);" +
      "color:var(--foreground);padding:0 10px;font-size:13px;outline:none;";

    input.addEventListener("change", function () {
      settings.folder = input.value.trim() || "daily";
      ctx.saveData({ folder: settings.folder }).catch(function () {});
    });

    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });

  ctx.loadData().then(function (data) {
    if (data && typeof data.folder === "string") settings.folder = data.folder;
  });

  ctx.onunload = function () {
    /* registrations are removed automatically by the host */
  };
})(ctx);
