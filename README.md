# OLED Trainer

Free browser tool for new OLED TV owners: hands-off warm-up sessions and uniformity test slides. No ads, no accounts, no install.

**Live:** https://oledtrainer.kataren.com

## What it does

- **Uniformity slides**: 5/10/20/50% gray, black, white and primaries, for checking vertical banding, tint and dead pixels before and after.
- **Warm-up sessions (1, 2 or 4 hours)**: full-field color slides (R, G, B, C, M, Y, W, 40 s each with crossfades), a slow hue sweep, a gray ramp and black breaks, looping every ~9 minutes. Nothing static on screen, and overall brightness changes at least every 60 s so LG's static-image dimming doesn't kick in.
- **Two ways to run it**:
  - **Computer over HDMI**: rendered live in the browser, full screen, cursor hidden, screen kept awake via the Screen Wake Lock API. Press any key for the remaining time (shown for 3 s); Esc stops.
  - **TV's built-in browser**: plays a pre-rendered looping video, because on LG OLEDs the webOS screensaver is only held off while a video plays full screen. Back stops.

When a session ends the screen goes black. Turn the TV off (or let its Auto Off timer do it) so the TV's compensation cycle can run.

## What "break-in" actually is

LG OLEDs run a short compensation cycle (about 10 minutes) in standby after every 4 hours of cumulative use, plus a long one about every 2,000 hours ([LG support](https://www.lg.com/in/support/product-support/troubleshoot/help-library/cs-CT52006584-20153710651188OLT/)). Reports of early vertical banding fading out line up with those cycles. Any content gets you there; this tool just makes the first hours even, unattended and free of logos or tickers.

There's no controlled evidence that color slides beat normal viewing, and this tool doesn't claim they do. If you try it, comparing your 5% gray slide before and after is the useful data point.

## Recommended TV settings

- SDR picture mode (Standard or Filmmaker), moderate brightness.
- Leave **Auto Off** on. It puts the TV in standby after about 4 hours without a remote press, which starts compensation.
- Never unplug the TV right after a session; compensation runs in standby.
- Connected over HDMI from a PC: label the input as **PC**.

## Status

- Tested in desktop Chromium (Edge).
- **Not yet tested on a real LG TV.** Open questions: whether the full-screen video keeps the webOS screensaver away for a full session, and whether the remote's arrow / OK / Back keys reach the page. Reports welcome via issues.
- Built with substantial AI assistance.

## Development

Requires Node.js and, for re-rendering the video, `ffmpeg` on `PATH`.

```sh
npm install
npm run dev      # local server on http://0.0.0.0:8080 (reachable from a TV on your LAN)
npm run render   # regenerate site/media/warmup.mp4 from site/sequence.js
npm run deploy   # deploy to Cloudflare Workers (static assets)
```

Change the timeline in `site/sequence.js`, then run `npm run render` so the video matches the live mode.

### Layout

| Path | Purpose |
|---|---|
| `site/sequence.js` | Warm-up timeline (`colorAt(t)`) and test slides. Single source for live mode and the video. |
| `site/app.js` | Menu, uniformity slides, live and video sessions. ES5 on purpose: TV browsers run old Chromium. |
| `site/index.html`, `site/style.css` | The page. |
| `site/media/warmup.mp4` | One 530 s cycle, H.264 1080p30 (~2 MB). Generated, but committed so deploys don't need ffmpeg. |
| `scripts/render-video.mjs` | Renders the timeline to the MP4 via ffmpeg. |
| `wrangler.jsonc` | Cloudflare Workers config: assets-only, custom domain `oledtrainer.kataren.com`. |

## License

Public domain via [The Unlicense](LICENSE). Do whatever you want with it.
