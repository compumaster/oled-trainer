// Renders one warm-up cycle from site/sequence.js to site/media/warmup.mp4.
// Every frame is a single full-field color, so frames are generated at 16x16
// and nearest-neighbor scaled to 1080p by ffmpeg (exact, and fast).
// H.264 1080p30 decodes on every TV browser; solid fields gain nothing from 4K.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { CYCLE, colorAt } = createRequire(import.meta.url)(join(root, "site", "sequence.js"));

const FPS = 30;
const SRC = 16;
const out = join(root, "site", "media", "warmup.mp4");
mkdirSync(dirname(out), { recursive: true });

const ffmpeg = spawn(
  "ffmpeg",
  [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${SRC}x${SRC}`, "-r", String(FPS), "-i", "-",
    "-vf", "scale=1920:1080:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-level", "4.1",
    "-g", String(FPS * 10),
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);

const frames = CYCLE * FPS;
const buf = Buffer.alloc(SRC * SRC * 3);

for (let f = 0; f < frames; f++) {
  const [r, g, b] = colorAt(f / FPS);
  for (let p = 0; p < buf.length; p += 3) {
    buf[p] = r;
    buf[p + 1] = g;
    buf[p + 2] = b;
  }
  if (!ffmpeg.stdin.write(buf)) await new Promise((res) => ffmpeg.stdin.once("drain", res));
}
ffmpeg.stdin.end();

const code = await new Promise((res) => ffmpeg.on("close", res));
if (code !== 0) {
  console.error(`ffmpeg exited with ${code}`);
  process.exit(code ?? 1);
}
console.log(`Wrote ${out} (${CYCLE}s cycle, ${frames} frames)`);
