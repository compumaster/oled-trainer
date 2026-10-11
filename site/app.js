/* ES5 on purpose: the LG TV browser runs an old Chromium. */
(function () {
  "use strict";

  var Seq = window.WarmupSequence;
  var BACK_KEY = 461; // webOS remote "Back"
  var OVERLAY_MS = 3000;

  var menu = $("menu");
  var stage = $("stage");
  var video = $("video");
  var overlay = $("overlay");
  var errorEl = $("error");

  var mode = null; // null | "inspect" | "live" | "video"
  var ended = false;
  var startAt = 0;
  var endAt = 0;
  var raf = 0;
  var tick = 0;
  var overlayTimer = 0;
  var slide = 0;
  var wakeLock = null;

  var isWebOS = /web0s|webos/i.test(navigator.userAgent);
  $(isWebOS ? "choice-video" : "choice-live").className += " recommended";

  $("btn-inspect").onclick = function () { begin("inspect"); };
  $("btn-live").onclick = function () { begin("live"); };
  $("btn-video").onclick = function () { begin("video"); };

  function $(id) { return document.getElementById(id); }

  function begin(next) {
    errorEl.hidden = true;
    mode = next;
    ended = false;
    menu.hidden = true;
    stage.hidden = false;
    stage.className = next === "video" ? "video" : "";
    stage.style.backgroundColor = "#000";

    if (next === "inspect") {
      slide = 0;
      showSlide();
      enterFullscreen(stage);
      return;
    }

    startAt = performance.now();
    endAt = startAt + Number($("session-hours").value) * 3600 * 1000;

    if (next === "live") {
      requestWakeLock();
      enterFullscreen(stage);
      frame();
      return;
    }

    video.currentTime = 0;
    var played = video.play();
    if (played && played.catch) {
      played.catch(function (e) {
        if (mode === "video") fail("Video playback failed (" + e.name + ").");
      });
    }
    // Fullscreen the <video> itself: on LG OLEDs the screensaver is suppressed
    // only while a video plays in full screen.
    enterFullscreen(video);
    tick = setInterval(function () {
      if (performance.now() >= endAt) finish();
    }, 1000);
  }

  function frame() {
    var now = performance.now();
    if (now >= endAt) {
      finish();
      return;
    }
    var c = Seq.colorAt((now - startAt) / 1000);
    stage.style.backgroundColor = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    raf = requestAnimationFrame(frame);
  }

  // Session complete: go black and let the TV (and the PC) sleep.
  function finish() {
    ended = true;
    cancelAnimationFrame(raf);
    clearInterval(tick);
    stage.style.backgroundColor = "#000";
    if (mode === "video") {
      video.pause();
      video.currentTime = Seq.BLACK_AT;
    }
    releaseWakeLock();
  }

  function stop() {
    if (!mode) return;
    mode = null;
    cancelAnimationFrame(raf);
    clearInterval(tick);
    clearTimeout(overlayTimer);
    overlay.className = "";
    video.pause();
    releaseWakeLock();
    stage.hidden = true;
    menu.hidden = false;
    exitFullscreen();
  }

  function fail(message) {
    stop();
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  video.addEventListener("error", function () {
    if (mode === "video") fail("Couldn't load media/warmup.mp4. Generate it with: npm run render");
  });

  // ---- Uniformity slides ----

  function showSlide() {
    var s = Seq.INSPECTION[slide];
    stage.style.backgroundColor = "rgb(" + s.rgb.join(",") + ")";
    flash(s.label + "  (" + (slide + 1) + "/" + Seq.INSPECTION.length + ")");
  }

  function step(delta) {
    var n = Seq.INSPECTION.length;
    slide = (slide + delta + n) % n;
    showSlide();
  }

  // ---- Input ----

  document.addEventListener("keydown", function (e) {
    if (!mode) return;
    var k = e.keyCode;
    if (k === 27 || k === BACK_KEY) {
      e.preventDefault();
      stop();
      return;
    }
    if (mode === "inspect") {
      if (k === 37 || k === 38) step(-1);
      else if (k === 39 || k === 40 || k === 13 || k === 32) step(1);
      else return;
      e.preventDefault();
      return;
    }
    e.preventDefault();
    showRemaining();
  });

  stage.addEventListener("click", function () {
    if (mode === "inspect") step(1);
    else if (mode) showRemaining();
  });

  // Esc in browser fullscreen exits fullscreen without a keydown; treat as stop.
  function onFullscreenChange() {
    if (mode && !fullscreenElement()) stop();
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  // ---- Transient overlay ----

  function showRemaining() {
    if (ended) {
      flash("Session complete. Turn the TV off so compensation can run.");
      return;
    }
    var left = Math.max(0, Math.round((endAt - performance.now()) / 1000));
    flash(formatDuration(left) + " remaining");
  }

  // Shown briefly at a random spot so no on-screen element lingers in one place.
  function flash(text) {
    overlay.textContent = text;
    overlay.style.left = 25 + Math.random() * 50 + "%";
    overlay.style.top = 25 + Math.random() * 50 + "%";
    overlay.className = "show";
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(function () { overlay.className = ""; }, OVERLAY_MS);
  }

  function formatDuration(s) {
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return h + ":" + pad(m) + ":" + pad(sec);
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  // ---- Platform helpers ----

  function enterFullscreen(el) {
    var fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return;
    try {
      var p = fn.call(el);
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* stage is already a fixed full-viewport layer */ }
  }

  function exitFullscreen() {
    if (!fullscreenElement()) return;
    var fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) {
      var p = fn.call(document);
      if (p && p.catch) p.catch(function () {});
    }
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function requestWakeLock() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      if (mode !== "live" || ended) {
        lock.release();
        return;
      }
      wakeLock = lock;
      lock.addEventListener("release", function () {
        if (wakeLock === lock) wakeLock = null;
      });
    }, function () {});
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    var lock = wakeLock;
    wakeLock = null;
    lock.release();
  }

  // The browser drops wake locks when the tab is hidden; re-take on return.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && mode === "live" && !ended && !wakeLock) {
      requestWakeLock();
    }
  });
})();
