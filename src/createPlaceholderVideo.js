import { execFileSync } from "child_process";

/**
 * Creates a plain placeholder MP4 (solid color, silent) instead of calling
 * HeyGen at all — used when HEYGEN_TEST_MODE=true so caption styling, the
 * YouTube upload step, etc. can be iterated on with zero HeyGen API cost.
 *
 * Duration is estimated from the script's word count at a typical spoken
 * pace, so caption timing during testing roughly matches what a real
 * HeyGen render would produce.
 */
export function createPlaceholderVideo(script, { outputPath }) {
  const wordCount = script.split(/\s+/).length;
  const estimatedSeconds = Math.max(10, Math.round(wordCount / 2.4));

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=gray:s=1080x1920:d=${estimatedSeconds}`,
      "-f", "lavfi",
      "-i", "anullsrc=r=44100:cl=stereo",
      "-shortest",
      "-pix_fmt", "yuv420p",
      outputPath,
    ],
    { stdio: "inherit" }
  );

  return { outputPath, duration: estimatedSeconds };
}
