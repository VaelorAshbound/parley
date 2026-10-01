// Cuts reports/demo (from record.ts) into docs/demo.gif: about 30 s, real
// time where something happens, faster while the model thinks, and the
// PDF's first page at the end. Needs ffmpeg, and poppler's pdftoppm (or
// podman, which runs it in a container).
//
//   node scripts/demo/gif.ts

import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "../..")
const out = join(root, "reports/demo")
const gif = join(root, "docs/demo.gif")
const { video, events } = JSON.parse(
  readFileSync(join(out, "events.json"), "utf8")
) as { video: string; events: Record<string, number> }

const at = (name: string) => {
  const time = events[name]
  if (time === undefined) throw new Error(`No "${name}" in events.json`)
  return time
}

/** [from, to, speed] in video seconds. */
const segments: [number, number, number][] = [[at("loaded"), at("sent"), 2]]
let thinkingFrom = at("sent")
for (let round = 1; events[`questions-${round}`] !== undefined; round += 1) {
  // Waiting for the model, then answering its questions.
  segments.push([thinkingFrom, at(`questions-${round}`), 6])
  segments.push([at(`questions-${round}`), at(`answered-${round}`), 3])
  thinkingFrom = at(`answered-${round}`)
}
segments.push(
  [thinkingFrom, at("done"), 4],
  [at("done"), at("asked-to-sign-up"), 1.5],
  [at("asked-to-sign-up"), at("signed-up"), 2.5],
  [at("back"), at("end"), 1.5]
)

function pdfFirstPage() {
  const args = ["-f", "1", "-l", "1", "-r", "110", "-png", "-singlefile"]
  try {
    execFileSync("pdftoppm", [...args, join(out, "nda.pdf"), join(out, "page")])
  } catch {
    execFileSync("podman", [
      "run",
      "--rm",
      "-v",
      `${out}:/w:Z`,
      "docker.io/library/alpine:3.22",
      "sh",
      "-c",
      `apk add -q poppler-utils && pdftoppm ${args.join(" ")} /w/nda.pdf /w/page`,
    ])
  }
  return join(out, "page.png")
}

const fps = 12
const parts = segments.map(
  ([from, to, speed], index) =>
    `[0:v]trim=${from}:${to},setpts=(PTS-STARTPTS)/${speed},fps=${fps}[v${index}]`
)
// The PDF on the brand's paper-deep ground, for 3 s.
parts.push(
  `[1:v]scale=-1:760,pad=1280:800:(ow-iw)/2:20:color=0xEDEAE2,setsar=1,fps=${fps},trim=duration=3[v${segments.length}]`
)
const inputs = parts.map((_, index) => `[v${index}]`).join("")
const filter = [
  ...parts,
  `${inputs}concat=n=${parts.length}:v=1:a=0,scale=960:-1:flags=lanczos,split[a][b]`,
  // 64 colors and only the changed part of each frame: about 7 MB.
  "[a]palettegen=stats_mode=diff:max_colors=64[p]",
  "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
].join(";")

execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-i",
  video,
  "-loop",
  "1",
  "-i",
  pdfFirstPage(),
  "-filter_complex",
  filter,
  gif,
])
const seconds = execFileSync("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "format=duration",
  "-of",
  "csv=p=0",
  gif,
])
console.log(
  `docs/demo.gif: ${Number(seconds).toFixed(1)} s, ${(statSync(gif).size / 1e6).toFixed(1)} MB`
)
