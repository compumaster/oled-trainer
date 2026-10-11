/*
 * Warm-up timeline: single source of truth for the live renderer (app.js)
 * and the MP4 renderer (scripts/render-video.mjs).
 *
 * Every frame is one full-field color, so the whole cycle is a function
 * t (seconds) -> [r, g, b] (0-255). ES5 + UMD so it runs in old webOS
 * Chromium builds and under Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WarmupSequence = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var HOLD = 40; // seconds per solid field; < 60 s so LG's static-image dimming resets
  var FADE = 4; // crossfade into the next field
  var BLACK = 20; // APL reset / cool-down
  var HUE_SWEEP = 120; // one full hue rotation
  var LUMA_RAMP = 90; // gray 0% -> 100% -> 0%

  var SOLIDS = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [0, 255, 255],
    [255, 0, 255],
    [255, 255, 0],
    [255, 255, 255]
  ];

  // Segment: { dur, color(u) } where u is seconds into the segment.
  var segments = [];
  var i;
  for (i = 0; i < SOLIDS.length; i++) {
    segments.push(solid(SOLIDS[i], HOLD));
  }
  segments.push(solid([0, 0, 0], BLACK));
  segments.push({ dur: HUE_SWEEP, color: hueSweep });
  segments.push({ dur: LUMA_RAMP, color: lumaRamp });
  segments.push(solid([0, 0, 0], BLACK));

  var CYCLE = 0;
  for (i = 0; i < segments.length; i++) CYCLE += segments[i].dur;

  function solid(rgb, dur) {
    return { dur: dur, color: function () { return rgb; } };
  }

  function hueSweep(u) {
    return hsvToRgb((u / HUE_SWEEP) * 360);
  }

  function lumaRamp(u) {
    var x = u / LUMA_RAMP; // 0..1
    var v = Math.round(255 * (x < 0.5 ? x * 2 : (1 - x) * 2));
    return [v, v, v];
  }

  // Full saturation / value HSV -> RGB.
  function hsvToRgb(h) {
    var c = 255;
    var hp = (h % 360) / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round(r), Math.round(g), Math.round(b)];
  }

  function mix(a, b, k) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k)
    ];
  }

  // Color at time t (seconds since session start); loops every CYCLE seconds.
  // The last FADE seconds of each segment crossfade into the next segment's start,
  // which makes the loop seamless (last segment fades into the first).
  function colorAt(t) {
    var u = ((t % CYCLE) + CYCLE) % CYCLE;
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      if (u < seg.dur) {
        var own = seg.color(u);
        var fadeStart = seg.dur - FADE;
        if (u <= fadeStart) return own;
        var next = segments[(s + 1) % segments.length];
        return mix(own, next.color(0), (u - fadeStart) / FADE);
      }
      u -= seg.dur;
    }
    return segments[0].color(0);
  }

  // Uniformity inspection fields (not part of the warm-up loop).
  // Grays are percent of full-range code value (5% -> 13/255).
  var INSPECTION = [
    { label: "5% gray", rgb: gray(5) },
    { label: "10% gray", rgb: gray(10) },
    { label: "20% gray", rgb: gray(20) },
    { label: "50% gray", rgb: gray(50) },
    { label: "Black", rgb: [0, 0, 0] },
    { label: "White", rgb: [255, 255, 255] },
    { label: "Red", rgb: [255, 0, 0] },
    { label: "Green", rgb: [0, 255, 0] },
    { label: "Blue", rgb: [0, 0, 255] },
    { label: "Cyan", rgb: [0, 255, 255] },
    { label: "Magenta", rgb: [255, 0, 255] },
    { label: "Yellow", rgb: [255, 255, 0] }
  ];

  function gray(pct) {
    var v = Math.round((pct / 100) * 255);
    return [v, v, v];
  }

  // A timestamp inside the first black segment (clear of crossfades); the video
  // player parks here when a session ends.
  var BLACK_AT = SOLIDS.length * HOLD + 1;

  return { CYCLE: CYCLE, BLACK_AT: BLACK_AT, colorAt: colorAt, INSPECTION: INSPECTION };
});
