/**
 * FocusCaseX sample plugin — Pomodoro Timer.
 * Statusbar countdown (25:00) with start/stop/reset commands.
 */
(function (ctx) {
  "use strict";

  var DURATION = 25 * 60;
  var item = ctx.addStatusBarItem();
  var secondsLeft = DURATION;
  var timer = null;

  function render() {
    var m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    var s = String(secondsLeft % 60).padStart(2, "0");
    item.setText("\u25D5 " + m + ":" + s + (timer ? "" : " (paused)"));
  }

  function tick() {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      stop();
      secondsLeft = DURATION;
      ctx.showToast("Pomodoro finished — take a break!");
    }
    render();
  }

  function start() {
    if (timer) return;
    timer = setInterval(tick, 1000);
    render();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    render();
  }

  function reset() {
    stop();
    secondsLeft = DURATION;
    render();
  }

  ctx.registerCommand({ id: "start", title: "Start pomodoro", icon: "Timer", run: start });
  ctx.registerCommand({ id: "stop", title: "Pause pomodoro", icon: "Clock", run: stop });
  ctx.registerCommand({ id: "reset", title: "Reset pomodoro", icon: "Activity", run: reset });
  ctx.addRibbonIcon("Timer", "Start or pause the pomodoro", function () {
    if (timer) stop();
    else start();
  });

  render();
  ctx.onunload = function () {
    if (timer) clearInterval(timer);
    item.setText("");
  };
})(ctx);
